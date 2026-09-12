const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const catalog = require('../cardiff-catalog.js');

function pick(overrides = {}) {
  return { id: 'one', title: 'Build something', date: '2026-09-12', time: '10:00–12:00',
    location: 'Cardiff Hub', cost: 'Free', ageBands: ['5-8', '9-12'], role: 'feature', score: 75,
    organiserUrl: 'https://example.org/event', ...overrides };
}

test('London day is independent of browser timezone and follows British Summer Time', () => {
  assert.equal(catalog.londonTodayISO('2026-09-12T23:30:00Z'), '2026-09-13');
  assert.equal(catalog.londonTodayISO('2026-01-12T23:30:00Z'), '2026-01-12');
  assert.equal(catalog.londonTodayISO('2026-03-29T23:30:00Z'), '2026-03-30');
});

test('weekend means upcoming Saturday/Sunday on weekdays and current weekend on Sunday', () => {
  for (const now of ['2026-09-07T12:00:00Z', '2026-09-11T12:00:00Z', '2026-09-12T12:00:00Z', '2026-09-13T12:00:00Z']) {
    assert.deepEqual(catalog.dateWindow('weekend', now), { start: '2026-09-12', end: '2026-09-13', label: 'This weekend' });
  }
  assert.equal(catalog.dateWindow('weekend', '2026-09-13T23:00:00Z').start, '2026-09-19');
  assert.equal(catalog.dateWindow('weekend', '2026-12-31T12:00:00Z').start, '2027-01-02');
});

test('finished sessions expire at their precise end, including explicit DST offsets', () => {
  const summer = pick({ date: '2026-09-07', endsAt: '2026-09-07T11:30:00+01:00' });
  assert.equal(catalog.currentDatedPicks([summer], '2026-09-07T10:29:59Z').length, 1);
  assert.equal(catalog.currentDatedPicks([summer], '2026-09-07T10:30:00Z').length, 0);
  const autumn = pick({ date: '2026-10-25', endsAt: '2026-10-25T01:30:00+00:00' });
  assert.equal(catalog.currentDatedPicks([autumn], '2026-10-25T01:00:00Z').length, 1);
  assert.equal(catalog.currentDatedPicks([autumn], '2026-10-25T01:30:00Z').length, 0);
  const spring = pick({ date: '2026-03-29', endDateTime: '2026-03-29T02:30:00+01:00' });
  assert.equal(catalog.currentDatedPicks([spring], '2026-03-29T01:30:00Z').length, 0);
});

test('legacy clock ranges and offset-free endsAt are interpreted in London', () => {
  assert.equal(catalog.pickEndMs(pick({ date: '2026-09-07', time: '10:30–11:30 (drop-in)' })), Date.parse('2026-09-07T10:30:00Z'));
  assert.equal(catalog.pickEndMs(pick({ date: '2026-01-07', time: '10:30–11:30' })), Date.parse('2026-01-07T11:30:00Z'));
  assert.equal(catalog.pickEndMs(pick({ date: '2026-09-07', endsAt: '2026-09-07T11:30:00' })), Date.parse('2026-09-07T10:30:00Z'));
  assert.equal(catalog.pickEndMs(pick({ date: '2026-09-12', time: '23:00–01:00' })), Date.parse('2026-09-13T00:00:00Z'));
});

test('day-only dates and uncertain time prose remain until London day ends', () => {
  const unknown = pick({ date: '2026-09-07', time: 'Afternoon; confirm with organiser' });
  assert.equal(catalog.currentDatedPicks([unknown], '2026-09-07T22:59:59Z').length, 1);
  assert.equal(catalog.currentDatedPicks([unknown], '2026-09-07T23:00:00Z').length, 0);
  assert.equal(catalog.currentDatedPicks([pick({ date: 'not-a-date', time: '' })], '2026-09-07T10:00:00Z').length, 0);
});

test('weekend selection excludes weekday sessions and a finished morning hero', () => {
  const dated = [pick({ id: 'weekday', date: '2026-09-10', role: 'hero', score: 100 }),
    pick({ id: 'morning', role: 'hero', endsAt: '2026-09-12T11:00:00+01:00' }),
    pick({ id: 'afternoon', title: 'Afternoon', time: '14:00–16:00', score: 80 })];
  const selected = catalog.selectPicks(dated, 'weekend', 'all', '2026-09-12T12:00:00+01:00');
  assert.deepEqual(selected.map(item => item.id), ['afternoon']);
  assert.equal(catalog.chooseHero(selected).id, 'afternoon');
  assert.equal(catalog.chooseHero([pick({ role: 'backup', score: 100 })]), null);
});

test('repeat series become one card while both sessions and anchor ids survive', () => {
  const dated = [pick({ id: 'sat', seriesId: 'club' }), pick({ id: 'sun', seriesId: 'club', date: '2026-09-13', time: '13:00–15:00' })];
  const selected = catalog.selectPicks(dated, 'weekend', 'all', '2026-09-07T15:00:00Z');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].sessions.length, 2);
  assert.deepEqual(selected[0].memberIds, ['sat', 'sun']);
  const html = catalog.renderPickCard(selected[0]);
  assert.match(html, /Sat 12 Sept? · 10:00–12:00/);
  assert.match(html, /Sun 13 Sept? · 13:00–15:00/);
  assert.match(html, /id="pick-sun"/);
  const sunday = catalog.selectPicks(dated, 'weekend', 'all', '2026-09-13T10:00:00+01:00');
  assert.equal(sunday.length, 1);
  assert.equal(sunday[0].sessions.length, 1);
  assert.equal(sunday[0].sessions[0].id, 'sun');
});

test('legacy day suffix deduplicates, without merging unrelated venues', () => {
  const grouped = catalog.groupSessions([pick({ id: 'sat' }), pick({ id: 'sun', title: 'Build something (Sunday)', date: '2026-09-13' }),
    pick({ id: 'other', location: 'Another Hub' })]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.find(group => group.id === 'sat').sessions.length, 2);
});

test('different session prices and booking destinations remain visible in a merged card', () => {
  const grouped = catalog.groupSessions([pick({ seriesId: 'club', bookingUrl: 'https://example.org/saturday', cost: '£5' }),
    pick({ id: 'second', seriesId: 'club', date: '2026-09-13', bookingUrl: 'https://example.org/sunday', cost: 'Free' })]);
  const html = catalog.renderPickCard(grouped[0]);
  assert.match(html, /£5/);
  assert.match(html, /Free/);
  assert.match(html, /href="https:\/\/example.org\/saturday"/);
  assert.match(html, /href="https:\/\/example.org\/sunday"/);
});

test('older-child filter never substitutes an unsuitable or unknown-age pick', () => {
  const selected = catalog.selectPicks([pick({ ageBands: ['0-4'] }), pick({ id: 'unknown', ageBands: [] })], 'weekend', '9-12', '2026-09-07T15:00:00Z');
  assert.deepEqual(selected, []);
  assert.equal(catalog.chooseHero(selected), null);
  assert.match(catalog.emptyMessage('weekend', '9-12', '2026-09-07T15:00:00Z'), /ages 9–12/);
});

test('cards keep real full costs and parent copy; source leads and internal reasoning stay private', () => {
  const html = catalog.renderPickCard(pick({ cost: 'Free entry · parking £7', appeal: 'Make your own model.',
    whyPicked: 'fills the under-five band', leadUrl: 'https://facebook.com/groups/private',
    parentTip: 'Bring a bag.', sourceName: 'Local Hub' }));
  assert.match(html, /Free entry · parking £7/);
  assert.match(html, /See session details/);
  assert.match(html, /Local Hub/);
  assert.match(html, /<summary>Venue &amp; address<\/summary><p>Cardiff Hub<\/p>/);
  assert.doesNotMatch(html, /fills the under-five band|facebook.com\/groups|Best for:/);
  assert.equal(catalog.publicCtaUrl({ organiserUrl: 'https://facebook.com/groups/private', bookingUrl: 'https://example.org/book' }), 'https://example.org/book');
  assert.equal(catalog.publicCtaUrl({ organiserUrl: 'javascript:alert(1)' }), '');
  assert.equal(catalog.publicCtaUrl({ organiserUrl: 'https://example.org/calendar', bookingUrl: 'https://example.org/book', ctaLabel: 'Book tickets' }), 'https://example.org/book');
  const bookingHtml = catalog.renderPickCard(pick({ bookingUrl: 'https://example.org/book' }));
  assert.match(bookingHtml, /class="pick__booking" href="https:\/\/example.org\/book"/);
});

test('notices respect selected dates, Monday opening patterns, and weather expiry', () => {
  const now = Date.parse('2026-09-07T15:00:00Z');
  const notices = [{ title: 'Weekday closure', startDate: '2026-09-07', endDate: '2026-09-10' },
    { title: 'Monday closure', weekdays: [1] }, { title: 'Weather — old forecast' },
    { title: 'Weather — timed forecast', expiresAt: '2026-09-07T12:00:00+01:00' },
    { title: 'Weekend gate', date: '2026-09-12', relatedVenueIds: ['hub'] }];
  assert.deepEqual(catalog.relevantNotices(notices, [pick({ venueId: 'hub' })], 'weekend', now).map(item => item.title), ['Weekend gate']);
  assert.deepEqual(catalog.relevantNotices(notices, [], 'today', now).map(item => item.title), ['Weekday closure', 'Monday closure']);
});

test('city resolution defaults to Cardiff and only allows the three explicit catalogs', () => {
  assert.deepEqual(catalog.resolveCity(), { id: 'cardiff', name: 'Cardiff', catalogUrl: '/data/cardiff-today.json' });
  assert.equal(catalog.resolveCity(null).id, 'cardiff');
  assert.equal(catalog.resolveCity('').id, 'cardiff');
  assert.deepEqual(catalog.resolveCity('Bristol'), { id: 'bristol', name: 'Bristol', catalogUrl: '/data/bristol-today.json' });
  assert.deepEqual(catalog.resolveCity('Birmingham'), { id: 'birmingham', name: 'Birmingham', catalogUrl: '/data/birmingham-today.json' });
  for (const value of ['bath', '../cardiff', 'https://example.org/catalog', '__proto__', 'constructor']) {
    assert.throws(() => catalog.resolveCity(value), /Unsupported catalog city/);
  }
});

test('catalog identity must match the requested city before it can render', () => {
  const bristol = { city: 'Bristol', datedPicks: [], evergreen: [] };
  assert.equal(catalog.validateCatalog(bristol, 'bristol'), bristol);
  assert.throws(() => catalog.validateCatalog(bristol, 'cardiff'), /does not match Cardiff/);
  assert.throws(() => catalog.validateCatalog({ city: 'Cardiff', datedPicks: [], evergreen: [] }, 'bristol'), /does not match Bristol/);
  assert.throws(() => catalog.validateCatalog({ datedPicks: [], evergreen: [] }, 'bristol'), /does not match Bristol/);
  assert.throws(() => catalog.validateCatalog({ city: 'Bristol', datedPicks: [] }, 'bristol'), /Invalid catalog/);
});

// A small browser harness exercises actual load/render state, without a browser dependency.
function browserCatalog({ city = null, fetcher, href = 'https://donext.co.uk/' } = {}) {
  const elements = new Map(['hero-pick', 'dated-picks', 'notices', 'backups', 'brief-preview', 'pick-count',
    'catalog-headline', 'date-range', 'weekend-heading', 'stale-banner', 'catalog-freshness', 'date-chips', 'age-chips']
    .map(id => [id, { innerHTML: '', textContent: '', hidden: false, querySelectorAll: () => [] }]));
  const nudge = { hidden: false };
  const calls = [], errors = [], timers = new Map();
  let timerId = 0;
  const document = {
    body: { getAttribute: name => name === 'data-city' ? city : null },
    readyState: 'complete', activeElement: null,
    getElementById: id => elements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: selector => selector === '.brief-nudge' ? [nudge] : []
  };
  const window = {
    location: new URL(href),
    addEventListener() {},
    setInterval(callback) { timers.set(++timerId, callback); return timerId; },
    clearInterval(id) { timers.delete(id); }
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-09-07T15:00:00Z'])); }
    static now() { return Date.parse('2026-09-07T15:00:00Z'); }
  }
  const context = vm.createContext({ window, document, URL, Intl, Date: FixedDate,
    console: { error: (...args) => errors.push(args.join(' ')) },
    fetch: async (url, options) => { calls.push({ url, options }); return fetcher(url); }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../cardiff-catalog.js'), 'utf8'), context);
  return { api: window.DoNextCatalog, window, document, elements, calls, errors, timers, nudge, context };
}

function cityCatalog(city) {
  return { city, updatedAt: '2026-09-07T14:00:00+01:00',
    datedPicks: [pick({ id: city.toLowerCase() + '-pick', title: city + ' discovery', location: city + ' venue' })],
    evergreen: [pick({ id: city.toLowerCase() + '-backup', title: city + ' backup', role: 'backup' })] };
}
function okResponse(data) { return { ok: true, json: async () => data }; }

test('Birmingham loads its own catalog and rejects another city response', async () => {
  const data = cityCatalog('Birmingham');
  const browser = browserCatalog({ city: 'birmingham', fetcher: () => okResponse(data) });
  await browser.api.load();
  assert.deepEqual(browser.calls.map(call => call.url), ['/data/birmingham-today.json']);
  assert.match(browser.elements.get('hero-pick').innerHTML, /Birmingham discovery/);
  assert.throws(() => catalog.validateCatalog(cityCatalog('Cardiff'), 'birmingham'), /does not match Birmingham/);
});

test('an editorial update does not erase an old source-check warning', async () => {
  const data = { ...cityCatalog('Bristol'), sourceCheckedAt: '2026-09-01T09:00:00+01:00' };
  const browser = browserCatalog({ city: 'bristol', fetcher: () => okResponse(data) });
  await browser.api.load();
  assert.equal(browser.elements.get('stale-banner').hidden, false);
  assert.match(browser.elements.get('catalog-freshness').textContent, /Shortlist updated/);
});

test('directions encode the venue safely and disappear when no location is known', () => {
  const html = catalog.renderPickCard(pick({ location: 'Gallery & Garden, Bristol' }));
  assert.match(html, /query=Gallery%20%26%20Garden%2C%20Bristol/);
  assert.doesNotMatch(catalog.renderPickCard(pick({ location: '' })), /Get directions/);
});

test('browser load() remains Cardiff-compatible when a page has no city configuration', async () => {
  const data = cityCatalog('Cardiff');
  const browser = browserCatalog({ fetcher: () => okResponse(data) });
  assert.equal(await browser.api.load(), data);
  assert.deepEqual(browser.calls.map(call => call.url), ['/data/cardiff-today.json']);
  assert.match(browser.elements.get('hero-pick').innerHTML, /Cardiff discovery/);
  assert.equal(browser.window._donextCatalog.city, 'Cardiff');
  assert.equal(browser.timers.size, 1);
  assert.equal(browser.errors.length, 0);
});

test('Bristol body configuration loads only Bristol, independently of route/query text', async () => {
  const data = cityCatalog('Bristol');
  const browser = browserCatalog({ city: 'bristol', href: 'https://donext.co.uk/bristol/?city=cardiff', fetcher: () => okResponse(data) });
  assert.equal(await browser.api.load(), data);
  assert.deepEqual(browser.calls.map(call => call.url), ['/data/bristol-today.json']);
  assert.match(browser.elements.get('hero-pick').innerHTML, /Bristol discovery/);
  assert.match(browser.elements.get('brief-preview').innerHTML, /Bristol discovery/);
  assert.doesNotMatch(browser.elements.get('hero-pick').innerHTML, /Cardiff discovery/);
  assert.equal(browser.window._donextCatalog.city, 'Bristol');
});

test('browser rejects the wrong-city response and never tries a fallback catalog', async () => {
  const browser = browserCatalog({ city: 'bristol', fetcher: () => okResponse(cityCatalog('Cardiff')) });
  assert.equal(await browser.api.load(), undefined);
  assert.deepEqual(browser.calls.map(call => call.url), ['/data/bristol-today.json']);
  assert.equal(browser.elements.get('hero-pick').innerHTML, '');
  assert.equal(browser.elements.get('brief-preview').innerHTML, '');
  assert.match(browser.elements.get('dated-picks').innerHTML, /couldn’t load/);
  assert.equal(browser.window._donextCatalog, null);
  assert.equal(browser.timers.size, 0);
  assert.equal(browser.nudge.hidden, true);
  assert.match(browser.errors[0], /does not match Bristol/);
});

test('a failed Bristol reload clears Cardiff cards, backups and refresh state', async () => {
  const browser = browserCatalog({ fetcher: url => url.includes('cardiff') ? okResponse(cityCatalog('Cardiff')) : { ok: false, status: 503 } });
  await browser.api.load();
  assert.match(browser.elements.get('backups').innerHTML, /Cardiff backup/);
  await browser.api.load({ city: 'bristol' });
  browser.api.render();
  assert.deepEqual(browser.calls.map(call => call.url), ['/data/cardiff-today.json', '/data/bristol-today.json']);
  assert.equal(browser.elements.get('hero-pick').innerHTML, '');
  assert.equal(browser.elements.get('backups').innerHTML, '');
  assert.equal(browser.elements.get('brief-preview').innerHTML, '');
  assert.equal(browser.window._donextCatalog, null);
  assert.equal(browser.timers.size, 0);
});

test('an unsupported page city fails without requesting Cardiff or a constructed URL', async () => {
  const browser = browserCatalog({ city: '../cardiff', fetcher: () => { throw new Error('Unexpected fetch'); } });
  await browser.api.load();
  assert.equal(browser.calls.length, 0);
  assert.equal(browser.window._donextCatalog, null);
  assert.match(browser.errors[0], /Unsupported catalog city/);
});

test('a delayed Cardiff response cannot overwrite a newer Bristol load', async () => {
  let finishCardiff;
  const delayedCardiff = new Promise(resolve => { finishCardiff = resolve; });
  const browser = browserCatalog({ fetcher: url => url.includes('cardiff') ? delayedCardiff : okResponse(cityCatalog('Bristol')) });
  const oldLoad = browser.api.load({ city: 'cardiff' });
  await Promise.resolve();
  await browser.api.load({ city: 'bristol' });
  finishCardiff(okResponse(cityCatalog('Cardiff')));
  await oldLoad;
  assert.equal(browser.window._donextCatalog.city, 'Bristol');
  assert.match(browser.elements.get('hero-pick').innerHTML, /Bristol discovery/);
  assert.equal(browser.timers.size, 1);
  assert.equal(browser.errors.length, 0);
});

test('app bootstrap passes the body city and waits for the DOM when necessary', () => {
  const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  for (const readyState of ['complete', 'loading']) {
    const calls = [];
    let ready;
    const context = vm.createContext({
      window: { DoNextCatalog: { load: options => calls.push(options.city) } },
      document: { readyState, body: { getAttribute: () => 'bristol' },
        addEventListener: (name, callback) => { assert.equal(name, 'DOMContentLoaded'); ready = callback; } }
    });
    vm.runInContext(source, context);
    if (readyState === 'loading') { assert.equal(calls.length, 0); ready(); }
    assert.deepEqual(calls, ['bristol']);
  }
});
