import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const GRAPH = 'https://graph.facebook.com/v24.0/';
const REPOSITORY = 'mattmurray1981-ai/donext-site';
const STATE_BRANCH = 'donext-publishing-state';
const MAX_AGE = 36 * 60 * 60 * 1000;
const fail = message => { throw new Error(message); };
const timestamp = value => typeof value === 'string' && /T.*(Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));

export function validate(queue, accounts) {
  if (!Array.isArray(queue)) fail('Queue must be an array');
  const keys = new Set();
  for (const post of queue) {
    if (!/^[a-z0-9][a-z0-9-]{2,100}$/.test(post.id ?? '')) fail('Invalid post ID');
    if (!Object.hasOwn(accounts, post.city)) fail('Unknown city');
    if (!['instagram', 'facebook'].includes(post.network)) fail('Unknown network');
    const key = `${post.city}/${post.network}/${post.id}`;
    if (keys.has(key)) fail('Duplicate queue ID');
    keys.add(key);
    if (!['draft', 'ready'].includes(post.status)) fail('Invalid editorial status');
    if (typeof post.caption !== 'string' || !post.caption.trim() || post.caption.length > 2200) fail('Caption must contain 1–2200 characters');
    for (const field of ['publishAt', 'expiresAt', 'verifiedAt']) if (!timestamp(post[field])) fail(`Invalid ${field}: explicit timezone required`);
    if (Date.parse(post.expiresAt) <= Date.parse(post.publishAt)) fail('Expiry must follow publication');
    if (Date.parse(post.verifiedAt) > Date.parse(post.publishAt)) fail('Verification must precede publication');
    if (!Array.isArray(post.sources) || !post.sources.length || post.sources.some(url => !/^https:\/\/[^\s]+$/.test(url))) fail('Official source URLs required');
    let url;
    try { url = new URL(post.imageUrl); } catch { fail('Invalid image URL'); }
    if (url.protocol !== 'https:' || url.hostname !== 'donext.co.uk' || url.username || url.password || url.search || url.hash || !/\.jpe?g$/i.test(url.pathname)) fail('Image must be a public JPEG on donext.co.uk');
    if (post.aiGenerated !== false) fail('This first publisher supports non-AI images only; use original artwork or a licensed photograph');
  }
  return queue;
}

export function eligible(post, accounts, now) {
  return accounts[post.city]?.enabled === true && post.status === 'ready' &&
    Date.parse(post.publishAt) <= now && now < Date.parse(post.expiresAt) &&
    Date.parse(post.verifiedAt) <= now && now - Date.parse(post.verifiedAt) <= MAX_AGE;
}

// Provider responses can contain credentials. Log only fixed messages and status codes.
export async function request(url, options = {}, fetcher = fetch) {
  let response;
  try { response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
  catch { fail('Remote request failed; result may be uncertain. Inspect the ledger before retrying.'); }
  if (!response.ok) fail(`Remote request failed (HTTP ${response.status})`);
  try { return await response.json(); } catch { fail('Remote response was not JSON'); }
}

export function metaClient(token, fetcher = fetch) {
  return async (path, params = {}, method = 'GET') => {
    const url = new URL(path, GRAPH);
    if (url.origin !== new URL(GRAPH).origin || !url.pathname.startsWith('/v24.0/')) fail('Invalid Meta endpoint');
    const headers = { Authorization: `Bearer ${token}` };
    const options = { method, headers };
    if (method === 'GET') url.search = new URLSearchParams(params).toString();
    else options.body = new URLSearchParams(params);
    return request(url, options, fetcher);
  };
}

export async function verifyAccount(meta, expected) {
  const page = await meta('me', { fields: 'id,name,instagram_business_account{id,username}' });
  const ig = page.instagram_business_account;
  if (!/^\d+$/.test(page.id ?? '') || !/^\d+$/.test(ig?.id ?? '') || ig?.username !== expected.instagramUsername) fail('Token does not identify the expected city Page and linked Instagram account');
  if (expected.pageId && page.id !== expected.pageId) fail('Facebook Page ID mismatch');
  // This proves read access and identity, not permission to publish. The first live test does that.
  return { pageId: page.id, instagramId: ig.id, instagramUsername: ig.username };
}

export class GitHubLedger {
  constructor(token, fetcher = fetch) { this.token = token; this.fetcher = fetcher; }
  api(path, method = 'GET', body) {
    return request(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    }, this.fetcher);
  }
  async load() {
    // Branch and file are deliberately provisioned once. Missing state is an error, never an empty history.
    const file = await this.api(`contents/state.json?ref=${STATE_BRANCH}`);
    this.sha = file.sha;
    this.state = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
    if (this.state.version !== 1 || !this.state.posts || typeof this.state.posts !== 'object' || Array.isArray(this.state.posts)) fail('Invalid publishing ledger');
  }
  async save() {
    const result = await this.api('contents/state.json', 'PUT', {
      message: 'Record DoNext publishing state', branch: STATE_BRANCH, sha: this.sha,
      content: Buffer.from(JSON.stringify(this.state, null, 2) + '\n').toString('base64')
    });
    this.sha = result.content.sha;
  }
  async reserve(key, hash) {
    if (Object.hasOwn(this.state.posts, key)) {
      if (this.state.posts[key].status !== 'published') fail('Previous attempt needs manual reconciliation; it will not be retried automatically');
      return false;
    }
    this.state.posts[key] = { hash, status: 'claimed', claimedAt: new Date().toISOString() };
    await this.save(); // Compare-and-swap must succeed before any Meta mutation.
    return true;
  }
  async record(key, fields) { Object.assign(this.state.posts[key], fields); await this.save(); }
}

export async function publish(post, account, meta, ledger, { sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => Date.now() } = {}) {
  const key = `${post.city}/${post.network}/${post.id}`;
  const hash = createHash('sha256').update(JSON.stringify(post)).digest('hex');
  if (!(await ledger.reserve(key, hash))) return { status: 'skipped-existing', key };
  if (now() >= Date.parse(post.expiresAt)) fail('Post expired before upload');
  let mediaId;
  if (post.network === 'instagram') {
    const container = await meta(`${account.instagramId}/media`, { image_url: post.imageUrl, caption: post.caption }, 'POST');
    if (!/^\d+$/.test(container.id ?? '')) fail('Container ID missing; manual reconciliation required');
    await ledger.record(key, { containerId: container.id, status: 'processing' });
    let finished = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const state = await meta(container.id, { fields: 'status_code' });
      if (state.status_code === 'FINISHED') { finished = true; break; }
      if (state.status_code !== 'IN_PROGRESS') fail('Container was not ready; manual reconciliation required');
      await sleep(5000);
    }
    if (!finished) fail('Container processing timed out; manual reconciliation required');
    if (now() >= Date.parse(post.expiresAt)) fail('Post expired during processing');
    await ledger.record(key, { status: 'publishing' });
    const result = await meta(`${account.instagramId}/media_publish`, { creation_id: container.id }, 'POST');
    mediaId = result.id;
  } else {
    await ledger.record(key, { status: 'publishing' });
    const result = await meta(`${account.pageId}/photos`, { url: post.imageUrl, caption: post.caption, published: 'true' }, 'POST');
    mediaId = result.post_id ?? result.id;
  }
  if (!/^[\d_]+$/.test(mediaId ?? '')) fail('Published ID missing; manual reconciliation required');
  await ledger.record(key, { status: 'published', mediaId, publishedAt: new Date().toISOString() });
  return { status: 'published', key, mediaId };
}

export async function operate(mode, queue, accounts, {
  env = process.env, log = console.log, createMeta = metaClient,
  createLedger = token => new GitHubLedger(token), now = () => Date.now(), sleep
} = {}) {
  if (!['check', 'publish'].includes(mode)) fail('Unknown command');
  if (env.GITHUB_REPOSITORY !== REPOSITORY) fail('Unexpected repository');
  if (mode === 'publish' && env.GITHUB_REF !== 'refs/heads/main') fail('Publishing requires main');
  const report = { accountFailures: [], postFailures: [], published: 0, skipped: 0 };
  const due = mode === 'publish' ? queue.filter(post => eligible(post, accounts, now())) : [];
  if (mode === 'publish' && !due.length) { log('No eligible posts. Nothing published.'); return report; }
  if (due.length > 20) fail('More than 20 due posts; inspect queue before publishing');
  // An unrelated city with no due content must not block delivery or require a token.
  const cities = mode === 'check' ? Object.keys(accounts) : [...new Set(due.map(post => post.city))];
  const clients = {};
  for (const city of cities) {
    const token = env[`META_${city.toUpperCase()}_PAGE_TOKEN`];
    if (!token) { log(`${city}: connection required`); report.accountFailures.push(city); continue; }
    try {
      const meta = createMeta(token);
      const account = await verifyAccount(meta, accounts[city]);
      clients[city] = { meta, account };
      log(`${city}: identity verified as @${account.instagramUsername}; publishing permission still needs a live test`);
    } catch {
      // Never echo provider errors: a response or unexpected exception may contain credentials.
      log(`${city}: connection check failed; verify authorisation and expected account identity`);
      report.accountFailures.push(city);
    }
  }
  if (mode === 'check' || !Object.keys(clients).length) return report;
  if (!env.GITHUB_TOKEN) fail('Publishing ledger credentials missing');
  const ledger = createLedger(env.GITHUB_TOKEN);
  const head = await ledger.api('git/ref/heads/main');
  if (head.object.sha !== env.GITHUB_SHA) fail('Main changed since checkout; run again from current main');
  for (const post of due) {
    if (!eligible(post, accounts, now())) continue;
    const client = clients[post.city];
    if (!client) continue;
    try {
      // Reload durable state for each independent entry. A failed save must not carry
      // speculative state or a stale compare-and-swap SHA into the next delivery.
      await ledger.load();
      if (!eligible(post, accounts, now())) continue;
      const result = await publish(post, client.account, client.meta, ledger, { now, sleep });
      log(JSON.stringify(result));
      if (result.status === 'published') report.published++;
      else report.skipped++;
    } catch {
      const key = `${post.city}/${post.network}/${post.id}`;
      log(`${key}: delivery failed or uncertain; inspect the ledger before any retry`);
      report.postFailures.push(key);
    }
  }
  return report;
}

async function main() {
  const accounts = JSON.parse(await readFile('.github/social/accounts.json', 'utf8'));
  const queue = validate(JSON.parse(await readFile('.github/social/queue.json', 'utf8')), accounts);
  const mode = process.argv[2] ?? 'validate';
  if (mode === 'validate') { console.log(`Queue valid: ${queue.length} entries. No API calls.`); return; }
  const report = await operate(mode, queue, accounts);
  console.log(JSON.stringify({ status: 'run-summary', ...report }));
  if (report.accountFailures.length || report.postFailures.length) fail('Some accounts or posts failed; independent eligible posts were processed. Review the run summary.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(error.message); process.exitCode = 1;
});
