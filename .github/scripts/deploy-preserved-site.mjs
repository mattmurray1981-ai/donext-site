import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verifyStagedContract, verifyCityMarkup, releaseRoutes } from './site-contract.mjs';
import { validateRecoveryManifest } from './recovery-manifest.mjs';

// The preceding verify-live-deploy-inputs.mjs workflow step still owns the
// catalog freshness / unmerged-production-change gate. This step publishes its
// staged static snapshot while retaining the verified live function bundles.
// API reference: https://open-api.netlify.com/#operation/createSiteDeploy
// File manifests: https://answers.netlify.com/t/22091/3
const API_ORIGIN = 'https://api.netlify.com';
const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');
const cleanPath = value => value.toLowerCase();
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const same = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const EMERGENCY_FUNCTION_DONOR_ID = '6a9edc1cea9d1962d4364df8';

export async function deployPreservedSite({ stageDirectory, siteId, token, commitSha = '', recoveryPlan = null, fetchImpl = fetch, sleep = pause, log = console.log }) {
  if (!stageDirectory || !siteId || !token) throw new Error('Stage directory, NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are required');
  if (!/^[a-zA-Z0-9-]+$/.test(siteId)) throw new Error('Invalid Netlify site ID');
  const root = await fs.realpath(stageDirectory);
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Staged site must be a directory');
  let candidateId = null;
  let publicationAttempted = false;
  const redact = value => String(value).replaceAll(token, '[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 600);

  async function request(endpoint, options = {}) {
    if (!endpoint.startsWith('/') || endpoint.startsWith('//')) throw new Error('API endpoint must be relative');
    const method = options.method || 'GET';
    let response;
    try {
      response = await fetchImpl(`${API_ORIGIN}/api/v1${endpoint}`, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, ...options.headers },
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) {
      throw new Error(`Netlify ${method} ${endpoint}: ${redact(error.message)}; request was not retried`);
    }
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(`Netlify ${method} ${endpoint}: HTTP ${response.status}; ${redact(detail.message || detail.error || 'no error detail')}; request was not retried`);
    }
    return response;
  }
  async function api(endpoint, options) {
    const response = await request(endpoint, options);
    return response.status === 204 ? null : response.json();
  }
  async function listFiles(deployId) {
    const rows = [];
    const seen = new Set();
    for (let page = 1; page <= 1000; page++) {
      const response = await request(`/deploys/${deployId}/files?page=${page}&per_page=100`);
      const batch = await response.json();
      if (!Array.isArray(batch)) throw new Error('Netlify did not return a file inventory');
      for (const file of batch) {
        if (typeof file.path !== 'string' || !file.path.startsWith('/') || !/^[0-9a-f]{40}$/.test(file.sha || '')) throw new Error('Invalid file inventory entry');
        const key = cleanPath(file.path);
        if (seen.has(key)) throw new Error(`Duplicate inventory path or repeated pagination: ${file.path}`);
        seen.add(key);
        rows.push(file);
      }
      const hasNext = /rel="?next"?/.test(response.headers.get('link') || '');
      if (!hasNext && batch.length < 100) return rows;
    }
    throw new Error('File inventory pagination did not finish');
  }
  const staged = new Map();
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw new Error(`Staged symlinks are not supported: ${relative}`);
      if (['.git', '.github', 'node_modules'].includes(entry.name) || /^\.env(?:\.|$)/i.test(entry.name)) throw new Error(`Private build input is present in staged site: ${relative}`);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) {
        if (/[?#]/.test(relative)) throw new Error(`Unsupported deploy filename: ${relative}`);
        const deployPath = '/' + relative;
        const key = cleanPath(deployPath);
        if (staged.has(key)) throw new Error(`Case-colliding staged filename: ${deployPath}`);
        const bytes = await fs.readFile(absolute);
        staged.set(key, { path: deployPath, bytes, sha: sha1(bytes) });
      } else throw new Error(`Unsupported staged file type: ${relative}`);
    }
  }

  function functionState(functions) {
    const keys = ['n', 'd', 'dn', 'g', 'bd', 'p', 'm', 'r', 'rg', 's', 'schedule', 'ro', 'er', 'vcpu'];
    return functions.map(fn => Object.fromEntries(keys.map(key => [key, fn[key] ?? null]))).sort((a, b) => a.n.localeCompare(b.n));
  }
  const scheduleState = schedules => [...(schedules || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));

  try {
    await walk(root);
    for (const required of ['/index.html', '/data/cardiff-today.json', '/__forms.html', '/_redirects', '/404.html']) {
      if (!staged.has(required)) throw new Error(`Required staged file is missing: ${required}`);
    }
    if (!staged.get('/_redirects').bytes.toString().trim()) throw new Error('Generated _redirects is empty; API deploys require the exported routing artifact');
    verifyStagedContract(staged);
    const formTags = staged.get('/__forms.html').bytes.toString().match(/<form\b[^>]*>/gi) || [];
    for (const name of ['weekend-brief', 'weekday-morning']) {
      if (!formTags.some(tag => new RegExp(`\\bname\\s*=\\s*["']${name}["']`, 'i').test(tag) && /\bdata-netlify\s*=\s*["']true["']/i.test(tag))) {
        throw new Error(`Static Netlify Forms declaration is missing: ${name}`);
      }
    }

    const site = await api(`/sites/${siteId}`);
    const liveId = site.published_deploy?.id;
    if (!/^[0-9a-f]{24}$/.test(liveId || '')) throw new Error('Cannot identify current production deployment');
    const live = await api(`/sites/${siteId}/deploys/${liveId}`);
    if (live.state !== 'ready') throw new Error('Current production deployment is not ready');
    if (live.edge_functions_present || live.available_edge_functions?.length) throw new Error('Edge functions require a separate preservation review');
    const originalFiles = await listFiles(liveId);
    const original = new Map(originalFiles.map(file => [cleanPath(file.path), file]));
    const recovery = recoveryPlan ? validateRecoveryManifest(recoveryPlan, { siteId, liveId, files: originalFiles }) : null;
    const missing = originalFiles.filter(file => !staged.has(cleanPath(file.path)) && !recovery?.removed.has(cleanPath(file.path)));
    if (missing.length) throw new Error(`Original production files are missing from staged site: ${missing.map(file => file.path).join(', ')}`);
    for (const key of recovery?.removed.keys() || []) {
      if (staged.has(key)) throw new Error(`Recovery removal is still present in staged files: ${key}`);
    }
    // This also runs for direct CLI use: a repair must never roll today's research
    // back just because a previous design/function deployment was healthier.
    for (const catalogPath of ['/data/cardiff-today.json', '/data/bristol-today.json', '/data/birmingham-today.json']) {
      if (!original.has(catalogPath) || original.get(catalogPath).sha === staged.get(catalogPath).sha) continue;
      const response = await request(`/sites/${siteId}/files${catalogPath}`, { headers: { 'Content-Type': 'application/vnd.bitballoon.v1.raw' } });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (sha1(bytes) !== original.get(catalogPath).sha) throw new Error(`Live catalog changed during preparation: ${catalogPath}`);
      const current = JSON.parse(bytes), next = JSON.parse(staged.get(catalogPath).bytes);
      if (!(Date.parse(next.updatedAt) > Date.parse(current.updatedAt))) throw new Error(`Reconcile the newer live research before replacing ${catalogPath}`);
    }
    const inventory = await api(`/sites/${siteId}/functions?filter=${encodeURIComponent(`deploy:${liveId}`)}`);
    if (!Array.isArray(inventory.functions)) throw new Error('Cannot identify current production functions');
    const functionSourceId = recoveryPlan?.functionSourceDeployId || (inventory.functions.length ? liveId : EMERGENCY_FUNCTION_DONOR_ID);
    const functionDeploy = functionSourceId === liveId ? live : await api(`/sites/${siteId}/deploys/${functionSourceId}`);
    if (functionDeploy.state !== 'ready' || functionDeploy.edge_functions_present || functionDeploy.available_edge_functions?.length) throw new Error('Function donor must be a ready same-site deployment without edge functions');
    const functionFiles = functionSourceId === liveId ? original : new Map((await listFiles(functionSourceId)).map(file => [cleanPath(file.path), file]));
    const functionInventory = functionSourceId === liveId ? inventory : await api(`/sites/${siteId}/functions?filter=${encodeURIComponent(`deploy:${functionSourceId}`)}`);
    const originalFunctions = functionInventory.functions;
    if (!Array.isArray(originalFunctions) || !originalFunctions.length) throw new Error('Cannot identify the live function set');
    if (functionSourceId !== liveId) {
      // Restore missing functions only. Never replace a surviving newer function.
      for (const fn of inventory.functions) {
        const donor = originalFunctions.find(value => value.n === fn.n);
        if (!donor || !same(functionState([fn]), functionState([donor]))) throw new Error(`Recovery donor would change a surviving live function: ${fn.n}`);
      }
    }
    for (const name of ['hit', 'metrics-day']) {
      if (!originalFunctions.some(fn => fn.n === name)) throw new Error(`Required live function is missing: ${name}`);
    }
    const functionsDigest = {};
    const functionsConfig = {};
    const configKeys = { dn: 'display_name', g: 'generator', bd: 'build_data', p: 'priority', ro: 'routes', er: 'excluded_routes', vcpu: 'vcpu' };
    for (const fn of originalFunctions) {
      if (!/^[a-zA-Z0-9_-]+$/.test(fn.n || '') || !/^[0-9a-f]{64}$/.test(fn.d || '') || functionsDigest[fn.n]) throw new Error('Live function metadata is invalid or duplicated');
      const sources = ['.mjs', '.js', '.ts'].map(extension => `/netlify/functions/${fn.n}${extension}`).filter(file => functionFiles.has(cleanPath(file)));
      if (sources.length !== 1) throw new Error(`Cannot identify exactly one original raw source for function ${fn.n}`);
      const source = cleanPath(sources[0]);
      if (staged.get(source)?.sha !== functionFiles.get(source).sha) throw new Error(`Function ${fn.n} source changed; unchanged bundle reuse is unsafe`);
      functionsDigest[fn.n] = fn.d;
      functionsConfig[fn.n] = Object.fromEntries(Object.entries(configKeys).filter(([key]) => fn[key] != null).map(([key, outputKey]) => [outputKey, fn[key]]));
    }
    for (const [key, entry] of staged) {
      if (key.startsWith('/netlify/functions/') || ['/package.json', '/package-lock.json'].includes(key)) {
        if (functionFiles.get(key)?.sha !== entry.sha) throw new Error(`Function source or dependency input changed: ${entry.path}; new bundles must be prepared separately`);
      }
    }
    async function assertLiveUnchanged() {
      const latest = await api(`/sites/${siteId}`);
      if (latest.published_deploy?.id !== liveId) throw new Error('Production changed during deployment preparation; reconcile and start again');
    }
    async function verifyFunctions(deployId, deployMetadata) {
      const result = await api(`/sites/${siteId}/functions?filter=${encodeURIComponent(`deploy:${deployId}`)}`);
      if (!Array.isArray(result.functions) || !same(functionState(originalFunctions), functionState(result.functions))) throw new Error('Candidate function bundle or effective configuration changed');
      if (!same(scheduleState(functionDeploy.function_schedules), scheduleState(deployMetadata.function_schedules))) throw new Error('Candidate function schedules changed');
      for (const key of ['functions_region', 'functions_region_overrides']) {
        if (!same(functionDeploy[key] ?? null, deployMetadata[key] ?? null)) throw new Error(`Candidate ${key} changed`);
      }
    }
    async function verifyManifest(deployId) {
      const rows = await listFiles(deployId);
      const actual = new Map(rows.map(file => [cleanPath(file.path), file]));
      for (const [key, entry] of staged) {
        // Netlify may consume _redirects during post-processing. Every ordinary
        // file must remain present with its exact uploaded source digest.
        if (key === '/_redirects' && !actual.has(key)) continue;
        if (actual.get(key)?.sha !== entry.sha) throw new Error(`Candidate file digest is missing or changed: ${entry.path}`);
      }
      for (const key of actual.keys()) if (!staged.has(key)) throw new Error(`Candidate includes an unexpected file: ${actual.get(key).path}`);
      return { count: rows.length, consumedRedirects: !actual.has('/_redirects') };
    }
    async function verifyDraftHTTP(candidate) {
      const base = new URL(candidate.deploy_ssl_url);
      if (base.protocol !== 'https:' || !base.hostname.startsWith(`${candidate.id}--`) || !base.hostname.endsWith('.netlify.app')) throw new Error('Candidate preview URL is not the expected Netlify deploy URL');
      for (const [route, expectedStatus, city] of releaseRoutes) {
        let response = await fetchImpl(new URL(route, base), { redirect: 'manual', signal: AbortSignal.timeout(30000) });
        if (route === '/now/' && [301, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) throw new Error('Candidate /now/ redirect has no Location header');
          const destination = new URL(location, base);
          if (destination.href !== new URL('/now', base).href) throw new Error('Candidate /now/ redirected somewhere other than its exact same-origin /now canonical URL');
          await response.arrayBuffer();
          // Netlify normalizes the trailing slash before applying the rewrite.
          // Follow this one known canonicalization only; all other routes and
          // any second redirect still have to meet their exact status checks.
          response = await fetchImpl(destination, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
        }
        if (response.status !== expectedStatus) throw new Error(`Candidate route ${route} returned ${response.status}, expected ${expectedStatus}`);
        if (city) {
          verifyCityMarkup(await response.text(), city);
        } else if (/^\/(bristol|birmingham)\/thank-you\/$/.test(route)) {
          const html = await response.text();
          const slug = route.split('/')[1];
          const name = slug.charAt(0).toUpperCase() + slug.slice(1);
          if (!html.includes(`DoNext ${name}`) || !html.includes(`href="/${slug}/"`)) throw new Error(`Candidate ${name} confirmation points to the wrong city`);
        } else if (['/data/cardiff-today.json', '/data/bristol-today.json', '/data/birmingham-today.json'].includes(route)) {
          if (sha1(Buffer.from(await response.arrayBuffer())) !== staged.get(route).sha) throw new Error('Candidate public catalog differs from staged catalog');
        } else if (route === '/__forms.html') {
          const html = await response.text();
          for (const name of ['weekend-brief', 'weekday-morning']) {
            if (!new RegExp(`\\bname\\s*=\\s*["']${name}["']`, 'i').test(html)) throw new Error(`Candidate form markup is missing: ${name}`);
          }
        } else if (route.includes('/metrics-day?')) {
          const metrics = await response.json();
          if (metrics.date !== '1970-01-01' || typeof metrics.total !== 'number' || !metrics.paths || typeof metrics.paths !== 'object') throw new Error('Candidate metrics function did not return a valid read-only result');
        } else {
          const bytes = Buffer.from(await response.arrayBuffer());
          if (expectedStatus === 200 && staged.has(route) && sha1(bytes) !== staged.get(route).sha) throw new Error(`Candidate asset differs from staged file: ${route}`);
        }
      }
      for (const [route, status, destination] of ['bristol', 'birmingham'].flatMap(slug => [[`/${slug}/now`, 302, `/${slug}/`], [`/${slug}/index.html`, 301, `/${slug}/`]])) {
        const response = await fetchImpl(new URL(route, base), { redirect: 'manual', signal: AbortSignal.timeout(30000) });
        if (response.status !== status || new URL(response.headers.get('location') || '/', base).href !== new URL(destination, base).href) throw new Error(`Candidate city alias is wrong: ${route}`);
        await response.arrayBuffer();
      }
    }

    const files = Object.fromEntries([...staged.values()].map(entry => [entry.path, entry.sha]));
    const byDigest = new Map([...staged.values()].map(entry => [entry.sha, entry]));
    await assertLiveUnchanged();
    log(JSON.stringify({ phase: 'verified-inputs', sourceDeployId: liveId, functionSourceDeployId: functionSourceId, originalFiles: originalFiles.length, stagedFiles: staged.size, reusedFunctions: Object.keys(functionsDigest), removedPaths: [...(recovery?.removed.keys() || [])] }));
    // Leave memory unset: the live platform default is preserved and verified
    // below. Sending an explicit memory configuration can request a paid feature.
    const title = `DoNext preserved site ${commitSha || 'manual'} from ${liveId}`;
    let candidate = await api(`/sites/${siteId}/deploys?title=${encodeURIComponent(title)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: true, files, functions: functionsDigest, functions_config: functionsConfig, function_schedules: functionDeploy.function_schedules || [] }),
    });
    candidateId = candidate.id;
    if (!/^[0-9a-f]{24}$/.test(candidateId || '')) throw new Error('API did not return a valid draft deployment ID');
    if (candidate.required_functions?.length || candidate.required_edge_functions?.length) throw new Error('Netlify cannot reuse existing function bundles; draft will not be published');
    if (!Array.isArray(candidate.required)) throw new Error('Draft did not return a required-file digest list');
    for (const digest of candidate.required) {
      const entry = byDigest.get(digest);
      if (!entry) throw new Error('Netlify requested an unknown file digest');
      const encodedPath = entry.path.slice(1).split('/').map(encodeURIComponent).join('/');
      await api(`/deploys/${candidateId}/files/${encodedPath}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: entry.bytes });
    }
    for (let attempt = 0; candidate.state !== 'ready' && attempt < 90; attempt++) {
      if (['error', 'rejected'].includes(candidate.state)) throw new Error(`Draft processing failed: ${redact(candidate.error_message || candidate.state)}`);
      await sleep(2000);
      candidate = await api(`/sites/${siteId}/deploys/${candidateId}`);
    }
    if (candidate.state !== 'ready') throw new Error('Draft did not become ready within three minutes');
    await verifyFunctions(candidateId, candidate);
    const manifest = await verifyManifest(candidateId);
    await verifyDraftHTTP(candidate);
    await assertLiveUnchanged();
    log(JSON.stringify({ phase: 'verified-draft', candidateDeployId: candidateId, files: manifest.count, consumedRedirects: manifest.consumedRedirects, previewUrl: candidate.deploy_ssl_url }));
    publicationAttempted = true;
    await api(`/sites/${siteId}/deploys/${candidateId}/restore`, { method: 'POST' });
    const publishedSite = await api(`/sites/${siteId}`);
    if (publishedSite.published_deploy?.id !== candidateId) throw new Error('Restore did not make the verified candidate the published deployment');
    const publishedDeploy = await api(`/sites/${siteId}/deploys/${candidateId}`);
    await verifyFunctions(candidateId, publishedDeploy);
    await verifyManifest(candidateId);
    const result = { phase: 'published', publishedDeployId: candidateId, preservedFrom: liveId, functionSourceDeployId: functionSourceId, fileCount: manifest.count, functions: Object.keys(functionsDigest), url: publishedSite.ssl_url || publishedSite.url };
    log(JSON.stringify(result));
    return result;
  } catch (error) {
    const state = candidateId ? ` Draft ${candidateId}; ${publicationAttempted ? 'publication was attempted—inspect current production before retrying' : 'publication was not attempted'}.` : ' No draft ID was received; do not retry an uncertain create request blindly.';
    throw new Error(redact(error.message) + state);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const recoveryPlan = process.env.NETLIFY_RECOVERY_MANIFEST ? JSON.parse(await fs.readFile(process.env.NETLIFY_RECOVERY_MANIFEST, 'utf8')) : null;
  deployPreservedSite({ stageDirectory: process.argv[2], siteId: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN, commitSha: process.env.GITHUB_SHA, recoveryPlan })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
