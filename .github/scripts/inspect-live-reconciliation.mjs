// Read-only snapshot of the exact files reported by the preservation guard.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const siteId = process.env.NETLIFY_SITE_ID;
const headers = { Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN}` };
const expected = {
  '/netlify.toml': '551405bed8c528e81c715f9d94f3f94dac31e783',
  '/data/sourcing/sources.json': 'ef6662ed2422dbb72a5f95e509675abe8127d114',
  '/data/sourcing/runs.json': '2c1df0705a5d1e17efb4b5d109e9ef01eda7f704',
  '/data/sourcing/checkpoint.json': 'd20db99fbe5182a6d9237ba276cbbaac608f477f',
};
async function get(endpoint, extra = {}) {
  const response = await fetch(`https://api.netlify.com/api/v1${endpoint}`, { headers: { ...headers, ...extra }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Inspection failed: HTTP ${response.status}`);
  return response;
}
const site = await (await get(`/sites/${siteId}`)).json();
const output = 'netlify-reconciliation';
await fs.mkdir(output, { recursive: true });
for (const [file, sha] of Object.entries(expected)) {
  const bytes = Buffer.from(await (await get(`/sites/${siteId}/files${file}`, { 'Content-Type': 'application/vnd.bitballoon.v1.raw' })).arrayBuffer());
  if (crypto.createHash('sha1').update(bytes).digest('hex') !== sha) throw new Error(`Live file changed since the preservation check: ${file}`);
  const destination = path.join(output, file.slice(1));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);
}
const latest = await (await get(`/sites/${siteId}`)).json();
if (latest.published_deploy?.id !== site.published_deploy?.id) throw new Error('Live deploy changed during inspection');
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ deployId: site.published_deploy.id, checkedAt: new Date().toISOString(), files: expected }, null, 2));
console.log(`Inspected ${Object.keys(expected).length} exact files from deploy ${site.published_deploy.id}; no production writes.`);

const inventory = await (await get(`/sites/${siteId}/functions?filter=${encodeURIComponent(`deploy:${site.published_deploy.id}`)}`)).json();
console.log(JSON.stringify({functions: inventory.functions.map(fn => Object.fromEntries(["n","d","dn","g","bd","p","m","r","rg","s","ro","er","vcpu"].map(key => [key, fn[key] ?? null])))}));
