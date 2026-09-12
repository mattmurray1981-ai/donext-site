/** Release checks shared by the normal and recovery publishers. No network writes. */
const text = entry => entry?.bytes?.toString() || '';
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const isoTime = value => typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const privateFields = new Set(['whyPicked', 'leadUrl', 'gmailMessageId', 'gmailThreadId', 'groupName', 'seenInGroups', 'flyerOcr', 'rejectReason']);

export function validatePublicCatalog(data, city) {
  if (data?.city?.toLowerCase() !== city || !Array.isArray(data.datedPicks) || !Array.isArray(data.evergreen) || !isoTime(data.updatedAt)) {
    throw new Error(`Invalid ${city} public catalog identity, collections or timestamp`);
  }
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (privateFields.has(key)) throw new Error(`Private field ${key} is present in the ${city} public catalog`);
      inspect(child);
    }
  }
  inspect(data);
  const ids = new Set();
  for (const pick of data.datedPicks) {
    for (const field of ['id', 'seriesId', 'title', 'date', 'ageSuitability', 'appeal', 'parentTip', 'cost', 'organiserUrl']) {
      if (!hasText(pick[field])) throw new Error(`${city} pick ${pick.id || '(missing id)'} lacks ${field}`);
    }
    if (ids.has(pick.id)) throw new Error(`Duplicate ${city} pick id: ${pick.id}`);
    ids.add(pick.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pick.date) || new Date(pick.date + 'T12:00:00Z').toISOString().slice(0, 10) !== pick.date) throw new Error(`Invalid event date: ${pick.id}`);
    if (!Array.isArray(pick.ageBands) || !pick.ageBands.length || pick.ageBands.some(band => !['0-4', '5-8', '9-12'].includes(band))) throw new Error(`Invalid age bands: ${pick.id}`);
    if (pick.timeStatus === 'unconfirmed') {
      if (pick.startsAt || pick.endsAt) throw new Error(`Unconfirmed time must not invent event timestamps: ${pick.id}`);
    } else if (pick.timeStatus === 'end-unconfirmed') {
      if (!isoTime(pick.startsAt) || pick.endsAt) throw new Error(`An unknown finish needs a confirmed start and no invented end: ${pick.id}`);
    } else if (!isoTime(pick.startsAt) || !isoTime(pick.endsAt) || Date.parse(pick.endsAt) <= Date.parse(pick.startsAt)) {
      throw new Error(`Known session needs explicit offset-bearing start/end timestamps: ${pick.id}`);
    }
    for (const field of ['organiserUrl', 'bookingUrl', 'url']) {
      if (!pick[field]) continue;
      let url;
      try { url = new URL(pick[field]); } catch { throw new Error(`Invalid ${field}: ${pick.id}`); }
      if (!['https:', 'http:'].includes(url.protocol) || (/(^|\.)facebook\.com$/i.test(url.hostname) && /^\/groups(?:\/|$)/i.test(url.pathname))) throw new Error(`Private or unsafe public destination: ${pick.id}`);
    }
  }
  for (const notice of data.notices || []) {
    if (!isoTime(notice.expiresAt)) throw new Error(`${city} notice requires an explicit expiry: ${notice.title}`);
  }
}

export function verifyCityMarkup(html, city) {
  const title = city.charAt(0).toUpperCase() + city.slice(1);
  const route = city === 'cardiff' ? '/' : `/${city}/`;
  const confirmation = city === 'cardiff' ? '/thank-you' : `/${city}/thank-you/`;
  if (!new RegExp(`<title\\b[^>]*>[^<]*DoNext ${title}[^<]*</title>`, 'i').test(html) ||
      !new RegExp(`data-city=["']${city}["']`).test(html) || !html.includes(`/assets/brand/${city}/donext-${city}-avatar-v4.png`) ||
      !html.includes(`https://donext.co.uk${route}`) || !/src=["']\/cardiff-catalog\.js["']/.test(html) || !/src=["']\/app\.js["']/.test(html)) {
    throw new Error(`${title} page lost its city, canonical, branding or shared absolute scripts`);
  }
  for (const id of ['date-chips', 'age-chips', 'hero-pick', 'dated-picks']) {
    if (!new RegExp(`id=["']${id}["']`).test(html)) throw new Error(`${title} page is missing ${id}`);
  }
  const forms = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/gi) || [];
  for (const name of ['weekend-brief', 'weekday-morning']) {
    const form = forms.find(value => new RegExp(`\\bname=["']${name}["']`).test(value));
    if (!form || !new RegExp(`action=["']${confirmation}["']`).test(form) ||
        !new RegExp(`<input\\b[^>]*name=["']city["'][^>]*value=["']${city}["']`).test(form)) {
      throw new Error(`${title} ${name} signup lost its city or confirmation route`);
    }
  }
}

export function verifyStagedContract(staged) {
  for (const city of ['cardiff', 'bristol', 'birmingham']) {
    const htmlPath = city === 'cardiff' ? '/index.html' : `/${city}/index.html`;
    verifyCityMarkup(text(staged.get(htmlPath)), city);
    validatePublicCatalog(JSON.parse(text(staged.get(`/data/${city}-today.json`))), city);
    for (const kind of ['avatar', 'share']) {
      const asset = `/assets/brand/${city}/donext-${city}-${kind}-v4.png`;
      if (!staged.get(asset)?.bytes?.length) throw new Error(`Missing city asset: ${asset}`);
    }
  }
  for (const file of ['/base.css', '/style.css', '/cardiff-catalog.js', '/app.js', '/thank-you.html', '/bristol/thank-you/index.html', '/birmingham/thank-you/index.html']) {
    if (!staged.get(file)?.bytes?.length) throw new Error(`Missing shared release file: ${file}`);
  }
  const renderer = text(staged.get('/cardiff-catalog.js'));
  for (const feature of ['selectPicks', 'pickEndMs', 'groupSessions', 'validateCatalog', '/data/bristol-today.json', '/data/birmingham-today.json']) {
    if (!renderer.includes(feature)) throw new Error(`Catalog renderer is missing required behavior: ${feature}`);
  }
  const redirects = text(staged.get('/_redirects')).split('\n').map(line => line.trim().split(/\s+/));
  for (const route of ['/data/sourcing/*', '/data/metrics/*', '/data/featured-history.json', '/netlify/functions/*']) {
    if (!redirects.some(rule => rule[0] === route && rule[1] === '/404.html' && rule[2] === '404!')) throw new Error(`Missing forced privacy redirect: ${route}`);
  }
}

export const releaseRoutes = [
  ['/', 200, 'cardiff'], ['/now/', 200, 'cardiff'], ['/bristol/', 200, 'bristol'],
  ['/birmingham/', 200, 'birmingham'], ['/birmingham/thank-you/', 200], ['/bristol/thank-you/', 200], ['/thank-you', 200],
  ['/data/cardiff-today.json', 200], ['/data/bristol-today.json', 200], ['/data/birmingham-today.json', 200],
  ['/base.css', 200], ['/style.css', 200], ['/cardiff-catalog.js', 200], ['/app.js', 200],
  ...['cardiff', 'bristol', 'birmingham'].flatMap(city => ['avatar', 'share'].map(kind => [`/assets/brand/${city}/donext-${city}-${kind}-v4.png`, 200])),
  ['/data/sourcing/sources.json', 404], ['/data/sourcing/candidates.json', 404],
  ['/data/sourcing/join-list-2026-09-05.md', 404], ['/data/featured-history.json', 404],
  ['/data/metrics/daily/2026-09-06.json', 404], ['/netlify/functions/hit.mjs', 404],
  ['/__forms.html', 200],
  // GET does not register a hit. The metrics query reads an intentionally unused day.
  ['/.netlify/functions/hit', 405], ['/.netlify/functions/metrics-day?date=1970-01-01', 200],
];
