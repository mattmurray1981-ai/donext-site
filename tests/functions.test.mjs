import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(name, store) {
  const source = fs.readFileSync(new URL(`../netlify/functions/${name}.mjs`, import.meta.url), 'utf8')
    .replace('import { getStore } from "@netlify/blobs";', '')
    .replace('export default async function', 'async function');
  return vm.runInNewContext(source + '\nhandler;', {
    URL, Response, Date, getStore(options) {
      assert.equal(options.name, 'donext-metrics');
      assert.equal(options.consistency, 'strong');
      assert.equal('token' in options, false);
      return store;
    },
  });
}

test('metrics reads the existing date key and returns stored totals', async () => {
  const handler = load('metrics-day', { async get(key) {
    assert.equal(key, 'hits/2026-09-10');
    return { date: '2026-09-10', total: 7, paths: { '/bristol/': 7 } };
  } });
  const response = await handler(new Request('https://donext.co.uk/api/metrics-day?date=2026-09-10'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).total, 7);
});

test('an empty metrics date is a successful zero result', async () => {
  const handler = load('metrics-day', { get: async () => null });
  assert.deepEqual(await (await handler(new Request('https://donext.co.uk/api/metrics-day?date=1970-01-01'))).json(), { date: '1970-01-01', total: 0, paths: {} });
});

test('hit ignores GET and OPTIONS without touching storage', async () => {
  const handler = load('hit', null);
  assert.equal((await handler(new Request('https://donext.co.uk/api/hit'))).status, 405);
  assert.equal((await handler(new Request('https://donext.co.uk/api/hit', { method: 'OPTIONS' }))).status, 204);
});

test('hit preserves prior traffic while adding the current path and referrer', async () => {
  let saved;
  const handler = load('hit', {
    get: async () => ({ total: 4, paths: { '/': 3, '/bristol/': 1 }, refs: { old: 4 } }),
    async setJSON(key, value) { assert.match(key, /^hits\/\d{4}-\d{2}-\d{2}$/); saved = value; },
  });
  const response = await handler(new Request('https://donext.co.uk/api/hit', { method: 'POST', body: JSON.stringify({ path: '/bristol/', ref: 'instagram' }) }));
  assert.equal(response.status, 200);
  assert.equal(saved.total, 5);
  assert.deepEqual(saved.paths, { '/': 3, '/bristol/': 2 });
  assert.deepEqual(saved.refs, { old: 4, instagram: 1 });
});
