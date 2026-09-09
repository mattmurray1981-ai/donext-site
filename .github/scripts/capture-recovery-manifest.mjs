import fs from 'node:fs/promises';
import path from 'node:path';

// Read-only: no deploys, restores, uploads or account mutations.
const siteId = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
const donorId = process.env.NETLIFY_FUNCTION_SOURCE_DEPLOY_ID;
if (!/^[a-zA-Z0-9-]+$/.test(siteId || '') || !token || !/^[0-9a-f]{24}$/.test(donorId || '')) throw new Error('Supply site/token and an explicitly chosen function donor deployment');
async function api(endpoint) {
  const response = await fetch(`https://api.netlify.com/api/v1${endpoint}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Read-only recovery inspection failed: HTTP ${response.status} for ${endpoint}`);
  return response.json();
}
const site = await api(`/sites/${siteId}`), liveId = site.published_deploy?.id;
if (!/^[0-9a-f]{24}$/.test(liveId || '')) throw new Error('Could not identify current published deployment');
const live = await api(`/sites/${siteId}/deploys/${liveId}`);
const donor = await api(`/sites/${siteId}/deploys/${donorId}`);
if (donor.state !== 'ready') throw new Error('Chosen donor is not a ready deployment of this site');
const files = {};
for (let page = 1; page <= 1000; page++) {
  const batch = await api(`/deploys/${liveId}/files?page=${page}&per_page=100`);
  if (!Array.isArray(batch)) throw new Error('Invalid file inventory');
  for (const file of batch) {
    if (!file.path?.startsWith('/') || !/^[0-9a-f]{40}$/.test(file.sha || '') || Object.keys(files).some(key => key.toLowerCase() === file.path.toLowerCase())) throw new Error('Invalid/repeated file inventory entry');
    files[file.path] = file.sha;
  }
  if (batch.length < 100) break;
  if (page === 1000) throw new Error('File inventory pagination did not finish');
}
const currentFunctions = await api(`/sites/${siteId}/functions?filter=${encodeURIComponent(`deploy:${liveId}`)}`);
const donorFunctions = await api(`/sites/${siteId}/functions?filter=${encodeURIComponent(`deploy:${donorId}`)}`);
for (const name of ['hit', 'metrics-day']) if (!donorFunctions.functions?.some(fn => fn.n === name && /^[0-9a-f]{64}$/.test(fn.d || ''))) throw new Error(`Chosen donor lacks ${name}`);
if ((await api(`/sites/${siteId}`)).published_deploy?.id !== liveId) throw new Error('Production changed during inspection; capture again');
const output = {
  schemaVersion: 1, siteId, liveDeployId: liveId, functionSourceDeployId: donorId,
  capturedAt: new Date().toISOString(),
  reason: '', // Fill in after reviewing the proposed recovery; an empty reason cannot publish.
  removePaths: [], // Exact obsolete path + reason only. Unlisted files must be preserved.
  files,
  inspection: {
    liveCreatedAt: live.created_at, livePublishedAt: live.published_at, liveTitle: live.title,
    liveCommit: live.commit_ref || null, liveUserId: live.user_id || null,
    liveFunctions: (currentFunctions.functions || []).map(fn => fn.n),
    donorFunctions: donorFunctions.functions.map(fn => ({ name: fn.n, digest: fn.d })),
  },
};
const destination = path.resolve(process.argv[2] || 'recovery-report/live-manifest.json');
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ mode: 'read-only', liveDeployId: liveId, functionSourceDeployId: donorId, liveFunctions: output.inspection.liveFunctions, files: Object.keys(files).length, manifest: destination }));
