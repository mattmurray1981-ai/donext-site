import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyStagedContract, releaseRoutes } from './site-contract.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(file) {
  return { bytes: fs.readFileSync(path.join(root, file.replace(/^\//, ''))) };
}

test('tracked site files satisfy the deploy-time public contract', () => {
  const staged = new Map();
  for (const route of new Set([
    '/index.html',
    '/bristol/index.html', '/birmingham/index.html',
    '/data/cardiff-today.json',
    '/data/bristol-today.json', '/data/birmingham-today.json',
    '/base.css',
    '/style.css',
    '/cardiff-catalog.js',
    '/app.js',
    '/thank-you.html',
    '/bristol/thank-you/index.html', '/birmingham/thank-you/index.html',
    '/_redirects',
    '/assets/brand/cardiff/donext-cardiff-avatar-v4.png',
    '/assets/brand/cardiff/donext-cardiff-share-v4.png',
    '/assets/brand/bristol/donext-bristol-avatar-v4.png',
    '/assets/brand/bristol/donext-bristol-share-v4.png', '/assets/brand/birmingham/donext-birmingham-avatar-v4.png', '/assets/brand/birmingham/donext-birmingham-share-v4.png',
  ])) {
    staged.set(route, read(route));
  }
  assert.doesNotThrow(() => verifyStagedContract(staged));
});

test('release route checks cover all three city pages, forms, private paths and functions', () => {
  const routes = new Map(releaseRoutes.map(([route, status, city]) => [route, { status, city }]));
  for (const [route, status, city] of [
    ['/', 200, 'cardiff'],
    ['/now/', 200, 'cardiff'],
    ['/bristol/', 200, 'bristol'], ['/birmingham/', 200, 'birmingham'], ['/birmingham/thank-you/', 200, undefined],
    ['/bristol/thank-you/', 200, undefined],
    ['/data/sourcing/sources.json', 404, undefined],
    ['/data/metrics/daily/2026-09-06.json', 404, undefined],
    ['/netlify/functions/hit.mjs', 404, undefined],
    ['/.netlify/functions/hit', 405, undefined],
    ['/.netlify/functions/metrics-day?date=1970-01-01', 200, undefined],
  ]) {
    assert.deepEqual(routes.get(route), { status, city });
  }
});
