import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validate, eligible, publish, verifyAccount, request, metaClient, GitHubLedger, operate } from './publisher.mjs';

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

const operationEnv = {
  GITHUB_REPOSITORY: 'mattmurray1981-ai/donext-site', GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: 'current-main', GITHUB_TOKEN: 'ledger-secret', META_CARDIFF_PAGE_TOKEN: 'cardiff-secret'
};
function durableLedger(initial = { version: 1, posts: {} }) {
  const instance = ledger(); let saved = structuredClone(initial);
  instance.api = async () => ({ object: { sha: 'current-main' } });
  instance.load = async () => { instance.state = structuredClone(saved); };
  instance.save = async () => { saved = structuredClone(instance.state); };
  return instance;
}
const cardiffIdentity = { id: '11', instagram_business_account: { id: '22', username: 'donext_cardiff' } };

test('a failed city does not block another city, and cities without due content are not checked', async () => {
  const allAccounts = {
    ...accounts,
    bristol: { enabled: true, instagramUsername: 'donext_bristol', pageId: '55' },
    birmingham: { enabled: true, instagramUsername: 'donext_birmingham', pageId: '77' }
  };
  const checked = []; const sent = []; const logs = []; const state = durableLedger();
  const report = await operate('publish', [post, { ...post, city: 'bristol', network: 'facebook' }], allAccounts, {
    ...clock, env: { ...operationEnv, META_BRISTOL_PAGE_TOKEN: 'bristol-secret', META_BIRMINGHAM_PAGE_TOKEN: 'unused-secret' },
    log: message => logs.push(message), createLedger: () => state,
    createMeta: token => {
      checked.push(token);
      return async path => {
        if (token === 'cardiff-secret') throw new Error('Provider error containing cardiff-secret');
        assert.equal(token, 'bristol-secret');
        if (path === 'me') return { id: '55', instagram_business_account: { id: '66', username: 'donext_bristol' } };
        sent.push(path); return { id: '88', post_id: '55_88' };
      };
    }
  });
  assert.deepEqual(checked, ['cardiff-secret', 'bristol-secret']);
  assert.deepEqual(sent, ['55/photos']);
  assert.deepEqual(report, { accountFailures: ['cardiff'], postFailures: [], published: 1, skipped: 0 });
  assert.equal(logs.join('\n').includes('cardiff-secret'), false);
});

test('check mode reports every missing or invalid city and continues to valid disabled accounts', async () => {
  const allAccounts = {
    cardiff: { ...accounts.cardiff, enabled: false },
    bristol: { enabled: false, instagramUsername: 'donext_bristol', pageId: '55' },
    birmingham: { enabled: false, instagramUsername: 'donext_birmingham', pageId: '77' }
  };
  const checked = []; const logs = [];
  const report = await operate('check', [], allAccounts, {
    env: { ...operationEnv, META_CARDIFF_PAGE_TOKEN: '', META_BRISTOL_PAGE_TOKEN: 'invalid-secret', META_BIRMINGHAM_PAGE_TOKEN: 'valid-secret' },
    log: message => logs.push(message), createLedger: () => { throw new Error('Read-only check must not open ledger'); },
    createMeta: token => async path => {
      checked.push(token); assert.equal(path, 'me');
      if (token === 'invalid-secret') throw new Error('invalid-secret');
      return { id: '77', instagram_business_account: { id: '88', username: 'donext_birmingham' } };
    }
  });
  assert.deepEqual(checked, ['invalid-secret', 'valid-secret']);
  assert.deepEqual(report.accountFailures, ['cardiff', 'bristol']);
  assert.equal(logs.length, 3);
  assert.equal(logs.join('\n').includes('invalid-secret'), false);
});

test('publish with no eligible posts does not inspect credentials or call remote services', async () => {
  const report = await operate('publish', [{ ...post, status: 'draft' }], accounts, {
    ...clock, env: { ...operationEnv, META_CARDIFF_PAGE_TOKEN: '' }, log: () => {},
    createMeta: () => { throw new Error('No account check expected'); },
    createLedger: () => { throw new Error('No ledger expected'); }
  });
  assert.deepEqual(report, { accountFailures: [], postFailures: [], published: 0, skipped: 0 });
});

test('ambiguous and newly failed entries leave later entries deliverable without retrying either failure', async () => {
  const ambiguous = { ...post, id: 'already-claimed' };
  const broken = { ...post, id: 'broken-image' };
  const later = { ...post, id: 'later-facebook', network: 'facebook' };
  const ambiguousKey = `cardiff/instagram/${ambiguous.id}`;
  const brokenKey = `cardiff/instagram/${broken.id}`;
  const state = durableLedger({ version: 1, posts: { [ambiguousKey]: { status: 'publishing', containerId: '90' } } });
  const mutations = [];
  const options = {
    ...clock, env: operationEnv, log: () => {}, createLedger: () => state,
    createMeta: () => async (path, params, method = 'GET') => {
      if (path === 'me') return cardiffIdentity;
      if (method === 'POST') mutations.push(path);
      if (path === '22/media') throw new Error('Image rejected');
      assert.equal(path, '11/photos'); return { id: '99', post_id: '11_99' };
    }
  };
  const first = await operate('publish', [ambiguous, broken, later], accounts, options);
  assert.deepEqual(first, { accountFailures: [], postFailures: [ambiguousKey, brokenKey], published: 1, skipped: 0 });
  const second = await operate('publish', [ambiguous, broken, later], accounts, options);
  assert.deepEqual(second, { accountFailures: [], postFailures: [ambiguousKey, brokenKey], published: 0, skipped: 1 });
  assert.deepEqual(mutations, ['22/media', '11/photos']);
  assert.equal(state.state.posts[ambiguousKey].status, 'publishing');
  assert.equal(state.state.posts[brokenKey].status, 'claimed');
});

test('a failed final ledger save is reloaded before the next post and never causes a repeat send', async () => {
  const first = { ...post, id: 'lost-confirmation', network: 'facebook' };
  const second = { ...post, id: 'independent-next', network: 'facebook' };
  const firstKey = `cardiff/facebook/${first.id}`;
  const state = durableLedger(); const persist = state.save;
  state.save = async () => {
    if (state.state.posts[firstKey]?.status === 'published') throw new Error('Final ledger save unavailable');
    await persist();
  };
  let sends = 0;
  const options = {
    ...clock, env: operationEnv, log: () => {}, createLedger: () => state,
    createMeta: () => async path => {
      if (path === 'me') return cardiffIdentity;
      assert.equal(path, '11/photos'); sends++; return { id: String(90 + sends), post_id: `11_${90 + sends}` };
    }
  };
  const report = await operate('publish', [first, second], accounts, options);
  assert.deepEqual(report, { accountFailures: [], postFailures: [firstKey], published: 1, skipped: 0 });
  assert.equal(state.state.posts[firstKey].status, 'publishing');
  const rerun = await operate('publish', [first, second], accounts, options);
  assert.deepEqual(rerun, { accountFailures: [], postFailures: [firstKey], published: 0, skipped: 1 });
  assert.equal(sends, 2);
});

test('CLI check emits all connection failures and exits unsuccessfully without tokens', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./publisher.mjs', import.meta.url)), 'check'], {
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    env: { GITHUB_REPOSITORY: operationEnv.GITHUB_REPOSITORY }, encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /cardiff: connection required/);
  assert.match(result.stdout, /bristol: connection required/);
  assert.match(result.stdout, /birmingham: connection required/);
  const summary = JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.deepEqual(summary.accountFailures, ['cardiff', 'bristol', 'birmingham']);
  assert.match(result.stderr, /Some accounts or posts failed/);
});

async function accountDiagnostic(fetcher, env = operationEnv) {
  const logs = [];
  const report = await operate('check', [], accounts, {
    env, log: message => logs.push(message),
    createMeta: token => metaClient(token, async (url, options) => {
      assert.equal(options.method, 'GET');
      assert.equal(url.pathname, '/v24.0/me');
      return fetcher(url, options);
    }),
    createLedger: () => { throw new Error('Read-only check must not open ledger'); }
  });
  assert.deepEqual(report.accountFailures, ['cardiff']);
  assert.equal(logs.length, 1);
  assert.equal(logs.join('\n').includes('cardiff-secret'), false);
  return JSON.parse(logs[0]);
}

test('read-only checks report missing token without contacting Meta', async () => {
  const result = await accountDiagnostic(() => { throw new Error('Must not fetch'); }, { ...operationEnv, META_CARDIFF_PAGE_TOKEN: '' });
  assert.equal(result.reason, 'missing_token');
  assert.equal(result.status, 'account-check');
  assert.equal(result.city, 'cardiff');
});

test('Meta error diagnostics include only safe numeric allowlisted fields', async () => {
  const result = await accountDiagnostic(async () => ({
    ok: false, status: 400,
    json: async () => ({ error: { code: 190, error_subcode: 463, message: 'cardiff-secret', type: 'cardiff-secret', fbtrace_id: 'cardiff-secret', access_token: 'cardiff-secret' } })
  }));
  assert.equal(result.reason, 'meta_http_error');
  assert.equal(result.httpStatus, 400);
  assert.equal(result.metaCode, 190);
  assert.equal(result.metaSubcode, 463);
  assert.deepEqual(Object.keys(result).sort(), ['city', 'httpStatus', 'message', 'metaCode', 'metaSubcode', 'reason', 'result', 'status']);
  for (const unsafe of ['cardiff-secret', '190', -1, Infinity, 1.5, 1_000_000_001, { value: 190 }]) {
    const omitted = await accountDiagnostic(async () => ({ ok: false, status: 403, json: async () => ({ error: { code: unsafe, error_subcode: unsafe } }) }));
    assert.equal(omitted.httpStatus, 403);
    assert.equal(Object.hasOwn(omitted, 'metaCode'), false);
    assert.equal(Object.hasOwn(omitted, 'metaSubcode'), false);
  }
  const unsafeStatus = await accountDiagnostic(async () => ({ ok: false, status: 'cardiff-secret', json: async () => ({}) }));
  assert.equal(unsafeStatus.reason, 'meta_http_error');
  assert.equal(Object.hasOwn(unsafeStatus, 'httpStatus'), false);
});

test('identity mismatch diagnostics distinguish Page, missing linkage and Instagram username without leaking returned identities', async () => {
  const cases = [
    [{ id: '99', instagram_business_account: { id: '22', username: 'cardiff-secret' } }, 'page_id_mismatch'],
    [{ id: '11' }, 'instagram_account_missing'],
    [{ id: '11', instagram_business_account: null }, 'instagram_account_missing'],
    [{ id: '11', instagram_business_account: { id: '22', username: 'cardiff-secret' } }, 'instagram_username_mismatch'],
    [null, 'malformed_response'],
    [{ id: 'cardiff-secret' }, 'malformed_response'],
    [{ id: '11', instagram_business_account: { id: 'cardiff-secret', username: 'donext_cardiff' } }, 'malformed_response']
  ];
  for (const [body, reason] of cases) {
    const result = await accountDiagnostic(async () => ({ ok: true, json: async () => body }));
    assert.equal(result.reason, reason);
    assert.equal(Object.hasOwn(result, 'httpStatus'), false);
  }
});

test('network and malformed responses remain credential-safe and distinct', async () => {
  const network = await accountDiagnostic(async () => { throw new Error('cardiff-secret'); });
  assert.equal(network.reason, 'network_error');
  const malformed = await accountDiagnostic(async () => ({ ok: true, json: async () => { throw new Error('cardiff-secret'); } }));
  assert.equal(malformed.reason, 'malformed_response');
  const missingResponse = await accountDiagnostic(async () => undefined);
  assert.equal(missingResponse.reason, 'malformed_response');
  const nonJsonError = await accountDiagnostic(async () => ({ ok: false, status: 502, json: async () => { throw new Error('cardiff-secret'); } }));
  assert.equal(nonJsonError.reason, 'meta_http_error');
  assert.equal(nonJsonError.httpStatus, 502);
});
