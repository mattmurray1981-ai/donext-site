import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { brandFiles, htmlPaths } from './apply-brand-v4.mjs';

const siteId = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
const mode = process.env.BRAND_MODE || 'inspect';
if (!siteId || !token) throw new Error('Missing Netlify deployment configuration');
if (!['inspect', 'preview', 'publish'].includes(mode)) throw new Error('Unsupported mode');

async function api(endpoint, options = {}) {
  const response = await fetch(`https://api.netlify.com/api/v1${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(`Netlify ${endpoint}: HTTP ${response.status}; ${String(detail.message || detail.error || 'no error detail').replaceAll(token, '[redacted]')}`);
  }
  return response.json();
}

await fs.mkdir('brand-report', { recursive: true });
const site = await api(`/sites/${siteId}`);
const liveId = site.published_deploy?.id;
if (!liveId) throw new Error('Cannot identify current published deployment');
const deploy = await api(`/sites/${siteId}/deploys/${liveId}`);
const files = await api(`/sites/${siteId}/files`);
const functions = await api(`/sites/${siteId}/functions?filter=${encodeURIComponent(`deploy:${liveId}`)}`);
const after = await api(`/sites/${siteId}`);
if (after.published_deploy?.id !== liveId) throw new Error('Live deployment changed during inspection');
const selectedDeployFields = {};
for (const key of Object.keys(deploy)) {
  if (/^(id|site_id|state|draft|deploy_url|deploy_ssl_url|created_at|published_at|available_functions|function.*|edge_function.*)$/.test(key)) selectedDeployFields[key] = deploy[key];
}
await fs.writeFile('brand-report/live-metadata.json', JSON.stringify({ liveId, deployKeys: Object.keys(deploy), deploy: selectedDeployFields, files, functions }, null, 2));
console.log(JSON.stringify({ liveId, state: deploy.state, fileCount: files.length, functionCount: functions.functions?.length, report: 'live-metadata.json' }));
if (mode === 'inspect') process.exit(0);

if (deploy.edge_functions_present) throw new Error('Edge functions need a separate preservation review');
const originalFiles = Object.fromEntries(files.map(file => [file.path, file.sha]));
if (!Array.isArray(functions.functions) || !functions.functions.length) throw new Error('Cannot identify live function set');
const originalFunctions = functions.functions;
const functionsDigest = {}, functionsConfig = {};
const configKeys = { dn: 'display_name', g: 'generator', bd: 'build_data', p: 'priority', ro: 'routes', er: 'excluded_routes', vcpu: 'vcpu' };
for (const fn of originalFunctions) {
  if (!fn.n || !/^[0-9a-f]{64}$/.test(fn.d)) throw new Error('Function metadata lacks a usable digest');
  functionsDigest[fn.n] = fn.d;
  const config = {};
  for (const [from, to] of Object.entries(configKeys)) if (fn[from] != null) config[to] = fn[from];
  functionsConfig[fn.n] = config;
}

async function assertLiveUnchanged() {
  const latest = await api(`/sites/${siteId}`);
  if (latest.published_deploy?.id !== liveId) throw new Error('Live production changed; prepare a fresh preview');
}
async function verifyFunctions(id) {
  const candidate = await api(`/sites/${siteId}/functions?filter=${encodeURIComponent(`deploy:${id}`)}`);
  const keys = ['n', 'd', 'dn', 'g', 'bd', 'p', 'm', 'r', 'rg', 's', 'schedule', 'ro', 'er', 'vcpu'];
  const normalize = list => list.map(fn => Object.fromEntries(keys.map(key => [key, fn[key] ?? null]))).sort((a,b) => a.n.localeCompare(b.n));
  if (JSON.stringify(normalize(candidate.functions || [])) !== JSON.stringify(normalize(originalFunctions))) throw new Error('Preview function code or configuration changed');
  return candidate.functions.map(fn => ({ name: fn.n, digest: fn.d }));
}

if (mode === 'publish') {
  const id = process.env.BRAND_PREVIEW_ID;
  if (!/^[0-9a-f]{24}$/.test(id || '')) throw new Error('A verified preview ID is required');
  const preview = await api(`/sites/${siteId}/deploys/${id}`);
  if (preview.state !== 'ready' || preview.title !== `DoNext orange brand v4 overlay of ${liveId}`) throw new Error('Preview does not match current production baseline');
  await verifyFunctions(id);
  await assertLiveUnchanged();
  await api(`/sites/${siteId}/deploys/${id}/restore`, { method: 'POST' });
  const published = await api(`/sites/${siteId}`);
  if (published.published_deploy?.id !== id) throw new Error('Preview was not published');
  console.log(JSON.stringify({ publishedId: id, preservedFrom: liveId, url: 'https://donext.co.uk/' }));
  process.exit(0);
}

const source = new Map();
for (const file of Object.keys(originalFiles)) {
  const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/files/${file.slice(1)}`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.bitballoon.v1.raw' } });
  if (!response.ok) throw new Error(`Cannot read original deployed source: ${file}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash('sha1').update(bytes).digest('hex') !== originalFiles[file]) throw new Error(`Original source digest does not match: ${file}`);
  source.set(file, bytes);
  const backupPath = path.join('brand-report', 'original', file);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.writeFile(backupPath, bytes);
}
const assetRoot = '.github/brand-v4';
const changes = brandFiles(source, await fs.readFile(`${assetRoot}/donext-cardiff-avatar-v4.png`), await fs.readFile(`${assetRoot}/donext-cardiff-share-v4.png`));
changes.set('/assets/brand/cardiff/README.md', Buffer.from('# DoNext Cardiff — approved orange identity\n\nUse [the canonical avatar](donext-cardiff-avatar-v4.png) for the website and social profile image, with a circular crop where required. Use [the share card](donext-cardiff-share-v4.png) for link previews. Preserve the artwork proportions and lettering.\n\nThe [editable Instagram feed template](instagram-feed-template.html) expects the avatar alongside it. Replace every placeholder, verify practical event details and inspect the composition before export.\n\nThe full production handoff and provenance remain in .github/brand-v4/ in the source repository.\n'));
changes.set('/assets/brand/cardiff/instagram-feed-template.html', await fs.readFile(`${assetRoot}/instagram-feed-template.html`));
const digest = { ...originalFiles };
const changedByHash = new Map();
for (const [file, bytes] of changes) {
  const sha = crypto.createHash('sha1').update(bytes).digest('hex');
  digest[file] = sha;
  changedByHash.set(sha, { file, bytes });
  const artifactPath = path.join('brand-report', 'overlay', file);
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, bytes);
}
await assertLiveUnchanged();
// Memory is the existing platform default; explicitly setting it requests a
// paid feature. Verify the effective memory remains identical after reuse.
let preview = await api(`/sites/${siteId}/deploys?title=${encodeURIComponent(`DoNext orange brand v4 overlay of ${liveId}`)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: true, files: digest, functions: functionsDigest, functions_config: functionsConfig, function_schedules: deploy.function_schedules || [] }) });
if (preview.required_functions?.length || preview.required_edge_functions?.length) throw new Error('Netlify cannot reuse existing function bundles; draft will not be published');
for (const sha of preview.required || []) {
  const entry = changedByHash.get(sha);
  if (!entry) throw new Error('Netlify requested a live file that should have been preserved by digest');
  await api(`/deploys/${preview.id}/files/${entry.file.slice(1)}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: entry.bytes });
}
for (let attempt = 0; attempt < 30 && preview.state !== 'ready'; attempt++) {
  await new Promise(resolve => setTimeout(resolve, 2000));
  preview = await api(`/sites/${siteId}/deploys/${preview.id}`);
  if (preview.state === 'error') throw new Error('Netlify preview processing failed');
}
if (preview.state !== 'ready') throw new Error('Preview did not become ready');
const preservedFunctions = await verifyFunctions(preview.id);
await assertLiveUnchanged();
const report = { sourceDeployId: liveId, previewId: preview.id, previewUrl: preview.deploy_ssl_url, state: preview.state, originalFileCount: files.length, finalFileCount: Object.keys(digest).length, changedPaths: [...changes.keys()], preservedCatalogSha: originalFiles['/data/cardiff-today.json'], preservedFunctions };
await fs.writeFile('brand-report/preview-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));

