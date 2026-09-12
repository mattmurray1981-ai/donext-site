import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, eligible, publish, verifyAccount, request, metaClient, GitHubLedger } from './publisher.mjs';

const now = Date.parse('2026-09-18T14:30:00Z');
const accounts = { cardiff: { enabled: true, instagramUsername: 'donext_cardiff', pageId: '11' } };
const post = { id: 'weekend-2026-09-18', city: 'cardiff', network: 'instagram', status: 'ready', caption: 'A verified Cardiff weekend pick.', publishAt: '2026-09-18T15:30:00+01:00', expiresAt: '2026-09-18T18:00:00+01:00', verifiedAt: '2026-09-18T13:00:00Z', sources: ['https://venue.example/event'], imageUrl: 'https://donext.co.uk/social/cardiff.jpg', aiGenerated: false };
const account = { pageId: '11', instagramId: '22' };
const clock = { now: () => now, sleep: async () => {} };
function ledger() {
  const instance = new GitHubLedger('unused');
  instance.state = { version: 1, posts: {} };
  instance.save = async () => {};
  return instance;
}

test('offset times, stale sources, drafts, disabled cities and expiry determine eligibility', () => {
  validate([post], accounts);
  assert.equal(eligible(post, accounts, now), true);
  assert.equal(eligible(post, accounts, now - 1), false);
  assert.equal(eligible(post, accounts, Date.parse(post.expiresAt)), false);
  assert.equal(eligible({ ...post, status: 'draft' }, accounts, now), false);
  assert.equal(eligible(post, { cardiff: { enabled: false } }, now), false);
  assert.equal(eligible({ ...post, verifiedAt: '2026-09-16T00:00:00Z' }, accounts, now), false);
});

test('reject ambiguous dates, wrong cities, duplicate IDs and unapproved image origins', () => {
  for (const change of [{ publishAt: '2026-09-18T15:30:00' }, { city: 'london' }, { imageUrl: 'https://evil.example/x.jpg' }, { imageUrl: 'https://donext.co.uk/x.png' }, { imageUrl: 'https://user:secret@donext.co.uk/x.jpg' }, { aiGenerated: true }, { sources: [] }]) assert.throws(() => validate([{ ...post, ...change }], accounts));
  assert.throws(() => validate([post, post], accounts));
});

test('a token for the wrong city or page fails before publishing', async () => {
  const correct = { id: '11', instagram_business_account: { id: '22', username: 'donext_cardiff' } };
  assert.deepEqual(await verifyAccount(async () => correct, accounts.cardiff), { ...account, instagramUsername: 'donext_cardiff' });
  await assert.rejects(verifyAccount(async () => ({ ...correct, id: '99' }), accounts.cardiff));
  await assert.rejects(verifyAccount(async () => ({ ...correct, instagram_business_account: { id: '22', username: 'donext_bristol' } }), accounts.cardiff));
});

test('a failed durable claim makes no Meta mutation', async () => {
  let calls = 0;
  const state = ledger(); state.save = async () => { throw new Error('CAS conflict'); };
  await assert.rejects(publish(post, account, async () => { calls++; }, state, clock));
  assert.equal(calls, 0);
});

test('Instagram waits for processing, publishes once, and saves the remote ID', async () => {
  const calls = []; let poll = 0;
  const meta = async (path, params, method = 'GET') => {
    calls.push([path, method]);
    if (path === '22/media') return { id: '33' };
    if (path === '33') return { status_code: ++poll === 1 ? 'IN_PROGRESS' : 'FINISHED' };
    if (path === '22/media_publish') return { id: '44' };
    throw new Error('Unexpected endpoint');
  };
  const state = ledger();
  assert.equal((await publish(post, account, meta, state, clock)).mediaId, '44');
  assert.equal((await publish(post, account, meta, state, clock)).status, 'skipped-existing');
  assert.equal(calls.filter(([path]) => path === '22/media_publish').length, 1);
  assert.equal(state.state.posts['cardiff/instagram/weekend-2026-09-18'].status, 'published');
});

test('lost publishing response is not automatically retried', async () => {
  let sends = 0;
  const meta = async path => {
    if (path === '22/media') return { id: '33' };
    if (path === '33') return { status_code: 'FINISHED' };
    sends++; throw new Error('Connection lost after server may have published');
  };
  const state = ledger();
  await assert.rejects(publish(post, account, meta, state, clock));
  await assert.rejects(publish(post, account, meta, state, clock), /reconciliation/);
  assert.equal(sends, 1);
});

test('failure saving a successful post also blocks repeat delivery', async () => {
  const state = ledger(); let saved = { version: 1, posts: {} }; let sends = 0;
  state.save = async () => {
    if (Object.values(state.state.posts).some(p => p.status === 'published')) throw new Error('Ledger unavailable');
    saved = structuredClone(state.state);
  };
  const meta = async path => {
    if (path === '22/media') return { id: '33' };
    if (path === '33') return { status_code: 'FINISHED' };
    sends++; return { id: '44' };
  };
  await assert.rejects(publish(post, account, meta, state, clock));
  state.state = saved; // New process reloads the last durable state.
  await assert.rejects(publish(post, account, meta, state, clock), /reconciliation/);
  assert.equal(sends, 1);
});

test('processing error or expiry prevents publication', async () => {
  for (const status of ['ERROR', 'EXPIRED', 'PUBLISHED']) {
    let sends = 0;
    const meta = async path => {
      if (path === '22/media') return { id: '33' };
      if (path === '33') return { status_code: status };
      sends++; return { id: '44' };
    };
    await assert.rejects(publish(post, account, meta, ledger(), clock));
    assert.equal(sends, 0);
  }
});

test('Facebook sends once with the correct Page and stores the post ID', async () => {
  const result = await publish({ ...post, network: 'facebook' }, account, async (path, params, method) => {
    assert.equal(path, '11/photos'); assert.equal(method, 'POST'); assert.equal(params.caption, post.caption);
    return { id: '33', post_id: '11_44' };
  }, ledger(), clock);
  assert.equal(result.mediaId, '11_44');
});

test('provider errors and redirects do not leak tokens', async () => {
  await assert.rejects(request('https://example.com', {}, async () => { throw new Error('secret-value'); }), error => !error.message.includes('secret-value'));
  await assert.rejects(request('https://example.com', {}, async () => ({ ok: false, status: 401, json: async () => ({ token: 'secret-value' }) })), /HTTP 401/);
  await metaClient('secret-value', async (url, options) => {
    assert.equal(url.search.includes('secret-value'), false);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer secret-value');
    return { ok: true, json: async () => ({}) };
  })('me');
});
