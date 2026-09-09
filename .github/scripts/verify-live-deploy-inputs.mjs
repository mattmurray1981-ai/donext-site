import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateRecoveryManifest } from './recovery-manifest.mjs';
import { verifyStagedContract } from './site-contract.mjs';

// Grok can publish directly to Netlify. A git deploy must not silently remove
// production files/functions or replace its catalog with an older checkout.
const root = path.resolve(process.argv[2]);
const id = process.env.NETLIFY_SITE_ID;
const headers = { Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}` };
async function get(endpoint) {
  const response = await fetch(`https://api.netlify.com/api/v1${endpoint}`, { headers });
  if (!response.ok) throw new Error(`Netlify deployment guard: HTTP ${response.status}`);
  return response.json();
}
const site = await get(`/sites/${id}`);
const live = site.published_deploy;
if (!live?.id) throw new Error('Cannot identify the current production deploy');
const files = [];
for (let page = 1; page <= 1000; page++) {
  const batch = await get(`/deploys/${live.id}/files?page=${page}&per_page=100`);
  if (!Array.isArray(batch) || batch.some(file => files.some(existing => existing.path.toLowerCase() === file.path.toLowerCase()))) throw new Error('Invalid or repeated production file inventory');
  files.push(...batch);
  if (batch.length < 100) break;
  if (page === 1000) throw new Error('Production inventory pagination did not finish');
}
const recoveryPlan = process.env.NETLIFY_RECOVERY_MANIFEST ? JSON.parse(await fs.readFile(process.env.NETLIFY_RECOVERY_MANIFEST, 'utf8')) : null;
const recovery = recoveryPlan ? validateRecoveryManifest(recoveryPlan, { siteId: id, liveId: live.id, files }) : null;
const planned = new Map();
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else planned.set('/' + path.relative(root, absolute).replaceAll(path.sep, '/').toLowerCase(), absolute);
  }
}
await walk(root);
const staged = new Map(await Promise.all([...planned].map(async ([key, file]) => [key, { bytes: await fs.readFile(file) }])));
verifyStagedContract(staged);
const missing = files.map(file => file.path).filter(file => !planned.has(file.toLowerCase()) && !recovery?.removed.has(file.toLowerCase()));
if (missing.length) throw new Error(`Production contains files absent from git; reconcile first: ${missing.join(', ')}`);
for (const key of recovery?.removed.keys() || []) if (planned.has(key)) throw new Error(`Recovery removal is still staged: ${key}`);
const baseline = JSON.parse(await fs.readFile('.github/production-baseline.json', 'utf8'));
const known = new Map(Object.entries(baseline.files).map(([file, sha]) => [file.toLowerCase(), sha]));
const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
const priorPaths = new Map();
if (/^[0-9a-f]{40}$/.test(event.before || '') && !/^0+$/.test(event.before)) {
  const tree = execFileSync('git', ['ls-tree', '-r', '--name-only', event.before], { encoding: 'utf8' });
  for (const file of tree.trim().split('\n')) priorPaths.set('/' + file.toLowerCase(), file);
}
const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');
const unreconciled = [];
for (const file of files) {
  const key = file.path.toLowerCase();
  if (recovery?.removed.has(key)) continue;
  const stagedSha = sha1(await fs.readFile(planned.get(key)));
  if (stagedSha === file.sha || known.get(key) === file.sha || recovery?.expected.get(key) === file.sha) continue;
  const previousPath = priorPaths.get(key);
  const previousSha = previousPath ? sha1(execFileSync('git', ['show', `${event.before}:${previousPath}`])) : null;
  if (previousSha !== file.sha) unreconciled.push(`${file.path} ${file.sha}`);
}
if (unreconciled.length) throw new Error(`Production has unmerged changes; reconcile before replacing: ${unreconciled.join(', ')}`);
for (const catalogPath of ['/data/cardiff-today.json', '/data/bristol-today.json']) {
  const originalCatalog = files.find(file => file.path === catalogPath);
  if (!originalCatalog) continue;
  const bytes = await fs.readFile(planned.get(catalogPath));
  if (crypto.createHash('sha1').update(bytes).digest('hex') === originalCatalog.sha) continue;
  const response = await fetch(`https://api.netlify.com/api/v1/sites/${id}/files${catalogPath}`, { headers: { ...headers, 'Content-Type': 'application/vnd.bitballoon.v1.raw' } });
  if (!response.ok) throw new Error(`Cannot verify catalog freshness: ${catalogPath}`);
  const currentBytes = Buffer.from(await response.arrayBuffer());
  if (sha1(currentBytes) !== originalCatalog.sha) throw new Error(`Production catalog changed during verification: ${catalogPath}`);
  const current = JSON.parse(currentBytes);
  const next = JSON.parse(bytes);
  if (!(Date.parse(next.updatedAt) > Date.parse(current.updatedAt))) throw new Error(`Git catalog ${catalogPath} differs from production without a newer checked timestamp; reconcile before deploying`);
}
const inventory = await get(`/sites/${id}/functions?filter=${encodeURIComponent(`deploy:${live.id}`)}`);
for (const fn of inventory.functions || []) {
  if (!['.mjs', '.js', '.ts'].some(extension => planned.has(`/netlify/functions/${fn.n}${extension}`))) throw new Error(`Missing production function source: ${fn.n}`);
}
const latest = await get(`/sites/${id}`);
if (latest.published_deploy?.id !== live.id) throw new Error('Production changed during verification; retry from current content');
console.log(`Production preservation guard passed: ${files.length} paths, ${(inventory.functions || []).length} functions.`);
