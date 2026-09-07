import fs from 'node:fs/promises';

const siteId = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
const mode = process.env.BRAND_MODE || 'inspect';
if (!siteId || !token) throw new Error('Missing Netlify deployment configuration');
if (mode !== 'inspect') throw new Error('Preview/publish remain disabled until live preservation metadata is audited');

async function api(endpoint) {
  const response = await fetch(`https://api.netlify.com/api/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Netlify ${endpoint}: HTTP ${response.status}`);
  return response.json();
}

await fs.mkdir('brand-report', { recursive: true });
const site = await api(`/sites/${siteId}`);
const liveId = site.published_deploy?.id;
if (!liveId) throw new Error('Cannot identify current published deployment');
const deploy = await api(`/sites/${siteId}/deploys/${liveId}`);
const files = await api(`/sites/${siteId}/files`);
const functions = await api(`/sites/${siteId}/functions`);
const after = await api(`/sites/${siteId}`);
if (after.published_deploy?.id !== liveId) throw new Error('Live deployment changed during inspection');
const selectedDeployFields = {};
for (const key of Object.keys(deploy)) {
  if (/^(id|site_id|state|draft|deploy_url|deploy_ssl_url|created_at|published_at|function.*|edge_function.*)$/.test(key)) selectedDeployFields[key] = deploy[key];
}
await fs.writeFile('brand-report/live-metadata.json', JSON.stringify({ liveId, deployKeys: Object.keys(deploy), deploy: selectedDeployFields, files, functions }, null, 2));
console.log(JSON.stringify({ liveId, state: deploy.state, fileCount: files.length, functionGroups: functions.length, report: 'live-metadata.json' }));

