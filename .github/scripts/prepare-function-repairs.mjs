import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { zipFunction } from '@netlify/zip-it-and-ship-it';

const root = process.cwd();
const destination = path.resolve(process.argv[2]);
const plan = JSON.parse(await fs.readFile('.github/function-repairs.json', 'utf8'));
await fs.mkdir(destination, { recursive: true });
const updates = [];
for (const [name, repair] of Object.entries(plan.functions)) {
  const source = path.join(root, repair.sourcePath.slice(1));
  const bytes = await fs.readFile(source);
  if (crypto.createHash('sha1').update(bytes).digest('hex') !== repair.sourceSha) throw new Error(`Review the new function source before bundling: ${name}`);
  const result = await zipFunction(source, destination, { basePath: root, config: { '*': { nodeBundler: 'esbuild', nodeVersion: '22' } } });
  if (result.name !== name || result.runtime !== 'js') throw new Error(`Unexpected function bundle: ${name}`);
  const zip = await fs.readFile(result.path);
  if (result.runtimeAPIVersion !== 2 || result.invocationMode !== 'stream') throw new Error(`Repair must use the modern Netlify runtime: ${name}`);
  updates.push({ name, ...repair, invocationMode: result.invocationMode, path: result.path, sha: crypto.createHash('sha256').update(zip).digest('hex') });
}
await fs.writeFile(path.join(destination, 'repairs.json'), JSON.stringify(updates, null, 2));
console.log(`Prepared reviewed function repairs: ${updates.map(update => update.name).join(', ')}`);
