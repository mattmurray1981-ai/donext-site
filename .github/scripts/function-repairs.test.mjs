import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyFunctionRepair } from './function-repairs.mjs';

const bytes = Buffer.from('reviewed bundle');
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
const update = { name: 'hit', sourcePath: '/netlify/functions/hit.mjs', previousSourceSha: 'old', sourceSha: 'new', invocationMode: 'stream', sha };
const context = { name: 'hit', sourcePath: update.sourcePath, oldSha: 'old', newSha: 'new', bytes };

test('a repair requires the exact old source, new source and prepared bundle', () => {
  assert.equal(verifyFunctionRepair(update, context), sha);
  for (const mismatch of [{ oldSha: 'newer live source' }, { newSha: 'unreviewed edit' }, { name: 'other' }, { bytes: Buffer.from('different bundle') }]) {
    assert.throws(() => verifyFunctionRepair(update, { ...context, ...mismatch }), /matching reviewed/);
  }
  assert.throws(() => verifyFunctionRepair({ ...update, invocationMode: 'buffered' }, context), /matching reviewed/);
});
