const test = require('node:test');
const assert = require('node:assert/strict');
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
