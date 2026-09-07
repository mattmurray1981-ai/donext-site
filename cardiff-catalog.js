/** DoNext city shortlists. Calendar dates use London time. */
(function (global) {
  'use strict';
  var CITIES = Object.freeze({
    cardiff: Object.freeze({ id: 'cardiff', name: 'Cardiff', catalogUrl: '/data/cardiff-today.json' }),
    bristol: Object.freeze({ id: 'bristol', name: 'Bristol', catalogUrl: '/data/bristol-today.json' })
  });
  var AGE_BANDS = ['0-4', '5-8', '9-12'];
  var _data = null, _activeAge = 'all', _activeWhen = 'weekend', _timer = null, _loadVersion = 0;

  function resolveCity(value) {
    var city = value == null || value === '' ? 'cardiff' : String(value).trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(CITIES, city)) throw new Error('Unsupported catalog city');
    return CITIES[city];
  }
  function validateCatalog(data, city) {
    var expected = resolveCity(city);
    if (!data || !Array.isArray(data.datedPicks) || !Array.isArray(data.evergreen)) throw new Error('Invalid catalog');
    if (typeof data.city !== 'string' || data.city.trim().toLowerCase() !== expected.id) {
      throw new Error('Catalog city does not match ' + expected.name);
    }
    return data;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function safePublicUrl(value) {
    try {
      var url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      if (/(^|\.)facebook\.com$/i.test(url.hostname) && /^\/groups(?:\/|$)/i.test(url.pathname)) return '';
      return url.href;
    } catch (_) { return ''; }
  }
  /** Prefer the verified organiser. Discovery/group URLs are never public CTAs. */
  function publicCtaUrl(pick) {
    if (!pick) return '';
    // An explicit booking CTA is useful when the organiser URL is a general calendar.
    if (pick.ctaLabel === 'Book tickets' && safePublicUrl(pick.bookingUrl)) return safePublicUrl(pick.bookingUrl);
    return safePublicUrl(pick.organiserUrl) || safePublicUrl(pick.bookingUrl) || safePublicUrl(pick.url);
  }
  function dateParts(value) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(value)).reduce(function (parts, part) { parts[part.type] = part.value; return parts; }, {});
  }
  function londonTodayISO(now) {
    var parts = dateParts(now == null ? Date.now() : now);
    return parts.year + '-' + parts.month + '-' + parts.day;
  }
  function validDay(day) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(day)) && !isNaN(Date.parse(day + 'T12:00:00Z')) &&
      new Date(day + 'T12:00:00Z').toISOString().slice(0, 10) === day;
  }
  function addDays(day, amount) {
    var date = new Date(day + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }
  function dateWindow(when, now) {
    var today = londonTodayISO(now);
    if (when === 'today') return { start: today, end: today, label: 'Today' };
    if (validDay(when)) return { start: when, end: when, label: formatDateLabel(when) };
    var weekday = new Date(today + 'T12:00:00Z').getUTCDay();
    // Sunday belongs to the current weekend; expiry removes Saturday's sessions.
    var saturday = addDays(today, weekday === 0 ? -1 : 6 - weekday);
    return { start: saturday, end: addDays(saturday, 1), label: 'This weekend' };
  }
  function formatDateLabel(day) {
    if (!validDay(day)) return '';
    return new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', {
      timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short'
    });
  }
  function windowLabel(window) {
    return formatDateLabel(window.start) + (window.start === window.end ? '' : ' – ' + formatDateLabel(window.end));
  }
  /** Offset-free event clocks are London times, never the visitor's timezone. */
  function londonClockMs(day, clock) {
    if (!validDay(day) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(clock)) return null;
    var wanted = day + 'T' + clock.slice(0, 5);
    var guess = Date.parse(day + 'T' + clock + (clock.length === 5 ? ':00' : '') + 'Z');
    if (!Number.isFinite(guess)) return null;
    var nominal = guess;
    for (var i = 0; i < 3; i++) {
      var parts = dateParts(guess);
      var local = parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute;
      if (local === wanted) return guess;
      guess += nominal - Date.parse(local + ':' + parts.second + 'Z');
    }
    return null; // Do not guess an expiry for an invalid/nonexistent DST clock.
  }
  function eventTimestamp(value) {
    if (!value) return null;
    var local = String(value).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)$/);
    if (local) return londonClockMs(local[1], local[2]);
    if (!/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
    var parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function pickStartDay(pick) {
    if (validDay(pick.date)) return pick.date;
    var timestamp = eventTimestamp(pick.startsAt || pick.startDateTime);
    return timestamp == null ? '' : londonTodayISO(timestamp);
  }
  function pickEndMs(pick) {
    var explicit = eventTimestamp(pick.endsAt || pick.endDateTime);
    if (explicit != null) return explicit;
    // Legacy records: only a clear 24-hour range at the start of the time field.
    var range = String(pick.time || '').match(/^\s*(\d{1,2}:\d{2})\s*(?:[–—-]|to)\s*(\d{1,2}:\d{2})(?:\b|\s|$)/i);
    if (!range) return null;
    var day = validDay(pick.endDate) ? pick.endDate : pickStartDay(pick);
    if (!day) return null;
    var start = range[1].padStart(5, '0'), end = range[2].padStart(5, '0');
    if (end < start && !pick.endDate) day = addDays(day, 1);
    return londonClockMs(day, end);
  }
  function pickEndDay(pick) {
    if (validDay(pick.endDate)) return pick.endDate;
    var end = pickEndMs(pick);
    return end == null ? pickStartDay(pick) : londonTodayISO(end - 1);
  }
  function pickIsCurrent(pick, now) {
    if (!pick || !pickStartDay(pick)) return false;
    if (pick.cancelled || /^(cancelled|canceled|sold out)$/i.test(pick.status || '')) return false;
    var end = pickEndMs(pick);
    return end == null ? pickEndDay(pick) >= londonTodayISO(now) : end > now;
  }
  function currentDatedPicks(dated, now) {
    now = now == null ? Date.now() : Number(new Date(now));
    return (dated || []).filter(function (pick) { return pickIsCurrent(pick, now); });
  }
  function matchesAge(pick, age) {
    // Unknown suitability is not evidence that an activity suits older children.
    return age === 'all' || (pick.ageBands || []).indexOf(age) !== -1;
  }
  function normalTitle(title) {
    return String(title || '').replace(/\s*\((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\)\s*$/i, '').trim();
  }
  function groupKey(pick) {
    return pick.seriesId ? 'series:' + pick.seriesId :
      [normalTitle(pick.title).toLowerCase(), String(pick.location || '').toLowerCase(), publicCtaUrl(pick)].join('|');
  }
  function comparePicks(a, b) {
    var roles = { hero: 2, feature: 1, backup: -1 };
    return ((roles[b.role] || 0) - (roles[a.role] || 0)) || ((Number(b.score) || 0) - (Number(a.score) || 0)) ||
      pickStartDay(a).localeCompare(pickStartDay(b));
  }
  function groupSessions(picks) {
    var groups = new Map();
    picks.forEach(function (pick) {
      var key = groupKey(pick);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(pick);
    });
    return Array.from(groups.values()).map(function (sessions) {
      sessions.sort(function (a, b) {
        return pickStartDay(a).localeCompare(pickStartDay(b)) || String(a.time || '').localeCompare(String(b.time || ''));
      });
      var best = sessions.slice().sort(comparePicks)[0];
      return Object.assign({}, best, { title: normalTitle(best.title), sessions: sessions,
        memberIds: sessions.map(function (pick) { return pick.id; }) });
    }).sort(comparePicks);
  }
  function selectPicks(dated, when, age, now) {
    now = now == null ? Date.now() : Number(new Date(now));
    var window = dateWindow(when, now);
    return groupSessions(currentDatedPicks(dated, now).filter(function (pick) {
      return pickStartDay(pick) <= window.end && pickEndDay(pick) >= window.start && matchesAge(pick, age || 'all');
    }));
  }
  function chooseHero(picks) {
    return picks.filter(function (pick) { return pick.role !== 'backup'; }).sort(comparePicks)[0] || null;
  }
  function formatStamp(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('en-GB', {
      timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }
  function setText(id, text) {
    var element = document.getElementById(id);
    if (element) element.textContent = text;
  }
  function saveSelection() {
    if (!global.history || !global.location) return;
    var url = new URL(global.location.href);
    if (_activeWhen === 'weekend') url.searchParams.delete('when'); else url.searchParams.set('when', _activeWhen);
    if (_activeAge === 'all') url.searchParams.delete('age'); else url.searchParams.set('age', _activeAge);
    url.hash = '';
    global.history.replaceState(null, '', url.pathname + url.search);
  }
  function readSelection() {
    if (!global.location) return;
    var url = new URL(global.location.href), age = url.searchParams.get('age'), when = url.searchParams.get('when');
    _activeAge = AGE_BANDS.indexOf(age) !== -1 ? age : 'all';
    _activeWhen = when === 'today' || validDay(when) ? when : 'weekend';
    var id;
    try { id = decodeURIComponent(url.hash.slice(1)).replace(/^pick-/, ''); } catch (_) { id = ''; }
    var linked = (_data.datedPicks || []).find(function (pick) { return pick.id === id; });
    if (linked && pickIsCurrent(linked, Date.now())) {
      var day = pickStartDay(linked), weekend = dateWindow('weekend');
      _activeWhen = day === londonTodayISO() ? 'today' : (day >= weekend.start && day <= weekend.end ? 'weekend' : day);
      if (!matchesAge(linked, _activeAge)) _activeAge = 'all';
    }
  }
  function renderFilters(now) {
    var dateChips = document.getElementById('date-chips');
    var options = [{ key: 'today', label: 'Today' }, { key: 'weekend', label: 'This weekend' }];
    if (validDay(_activeWhen)) options.push({ key: _activeWhen, label: formatDateLabel(_activeWhen) });
    if (dateChips) {
      dateChips.innerHTML = options.map(function (option) {
        return '<button type="button" class="date-chip' + (_activeWhen === option.key ? ' is-active' : '') +
          '" data-when="' + option.key + '" aria-pressed="' + (_activeWhen === option.key) + '">' + option.label + '</button>';
      }).join('');
      dateChips.querySelectorAll('[data-when]').forEach(function (button) {
        button.addEventListener('click', function () { _activeWhen = button.dataset.when; saveSelection(); renderAll(); });
      });
    }
    var ageChips = document.getElementById('age-chips');
    if (ageChips) {
      ageChips.innerHTML = ['all'].concat(AGE_BANDS).map(function (age) {
        return '<button type="button" class="age-chip' + (_activeAge === age ? ' is-active' : '') +
          '" data-age="' + age + '" aria-pressed="' + (_activeAge === age) + '">' + (age === 'all' ? 'All ages' : age.replace('-', '–')) + '</button>';
      }).join('');
      ageChips.querySelectorAll('[data-age]').forEach(function (button) {
        button.addEventListener('click', function () { _activeAge = button.dataset.age; saveSelection(); renderAll(); });
      });
    }
    var window = dateWindow(_activeWhen, now);
    setText('weekend-heading', _activeWhen === 'today' ? 'Still to come today' : window.label);
    setText('date-range', windowLabel(window) + ' · UK time');
  }
  function renderFreshness(data, now) {
    var stamp = formatStamp(data.updatedAt);
    setText('catalog-freshness', stamp ? 'Shortlist checked ' + stamp + ' (UK)' : 'Check time unavailable');
    var banner = document.getElementById('stale-banner');
    if (!banner) return;
    var hours = (now - Date.parse(data.updatedAt)) / 3600000;
    var limit = typeof data.staleAfterHours === 'number' ? data.staleAfterHours : 36;
    banner.hidden = Number.isFinite(hours) && hours <= limit;
    banner.innerHTML = banner.hidden ? '' : '<strong>This shortlist needs a fresh check.</strong> Confirm times and availability with the organiser before setting off.';
  }
  function whenLine(pick) {
    var entries = [];
    var sessions = pick.sessions || [pick];
    var distinctCosts = new Set(sessions.map(function (session) { return session.cost || ''; })).size > 1;
    var distinctBookings = new Set(sessions.map(function (session) { return safePublicUrl(session.bookingUrl); })).size > 1;
    sessions.forEach(function (session) {
      var start = pickStartDay(session), end = pickEndDay(session);
      var label = formatDateLabel(start) + (end && end !== start ? ' – ' + formatDateLabel(end) : '') +
        (session.time ? ' · ' + session.time : ' · Time: check organiser') + (distinctCosts && session.cost ? ' · ' + session.cost : '');
      label = escapeHtml(label);
      if (distinctBookings && safePublicUrl(session.bookingUrl)) label += ' <a href="' + escapeHtml(safePublicUrl(session.bookingUrl)) +
        '" target="_blank" rel="noopener noreferrer">Book this session</a>';
      if (entries.indexOf(label) === -1) entries.push(label);
    });
    return entries.join('<br>');
  }
  function renderPickCard(pick, opts) {
    opts = opts || {};
    var cta = publicCtaUrl(pick);
    var ctaLabel = cta && cta === safePublicUrl(pick.bookingUrl) ? 'Book tickets' : 'See session details';
    var booking = safePublicUrl(pick.bookingUrl);
    var organiser = safePublicUrl(pick.organiserUrl);
    var source = escapeHtml(pick.sourceName || 'Organiser');
    if (organiser) source = '<a href="' + escapeHtml(organiser) + '" target="_blank" rel="noopener noreferrer">' + source + '</a>';
    var checked = formatStamp(pick.checkedAt);
    var ages = pick.ageSuitability || ((pick.ageBands || []).length ? 'Suggested ages ' + pick.ageBands.map(function (band) {
      return band.replace('-', '–');
    }).join(' / ') : 'Check age suitability with the organiser');
    var tip = pick.parentTip || pick.parentHeadsUp;
    var image = opts.hero && pick.image && safePublicUrl(pick.image.url) ? pick.image : null;
    var aliases = (pick.memberIds || []).filter(function (id) { return id !== pick.id; }).map(function (id) {
      return '<span id="pick-' + escapeHtml(id) + '" class="pick__anchor" aria-hidden="true"></span>';
    }).join('');
    var photo = image ? '<figure class="pick__image"><img src="' + escapeHtml(safePublicUrl(image.url)) + '" alt="' +
      escapeHtml(image.alt || '') + '" fetchpriority="high" decoding="async">' + (image.credit ? '<figcaption class="pick__image-credit">' +
      (safePublicUrl(image.sourceUrl) ? '<a href="' + escapeHtml(safePublicUrl(image.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(image.credit) + '</a>' : escapeHtml(image.credit)) + '</figcaption>' : '') + '</figure>' : '';
    return '<article class="pick' + (opts.hero ? ' pick--hero' : '') + '" id="pick-' + escapeHtml(pick.id) + '" data-event-id="' + escapeHtml(pick.id) + '">' +
      aliases + photo + '<div class="pick__body">' + (opts.hero ? '<div class="pick__kicker">Our first pick</div>' : '') +
      '<h3 class="pick__title">' + escapeHtml(pick.title) + '</h3>' +
      '<div class="pick__meta"><span class="pick__sessions">' + whenLine(pick) + '</span><span title="' + escapeHtml(pick.location) + '">' +
        escapeHtml(pick.neighbourhood || pick.area || pick.location) + '</span></div>' +
      '<div class="pick__facts"><p class="pick__age"><strong>For:</strong> ' + escapeHtml(ages) + '</p><p class="pick__cost"><strong>Cost:</strong> ' +
        escapeHtml(pick.cost || 'Check organiser for prices') + '</p></div>' +
      '<p class="pick__desc">' + escapeHtml(pick.appeal || pick.description) + '</p>' +
      (tip ? '<p class="pick__heads"><strong>Before you go:</strong> ' + escapeHtml(tip) + '</p>' : '') +
      (pick.statusNote ? '<p class="pick__status">' + escapeHtml(pick.statusNote) + '</p>' : '') +
      (pick.location ? '<details class="pick__location"><summary>Venue &amp; address</summary><p>' + escapeHtml(pick.location) + '</p></details>' : '') +
      '<div class="pick__footer"><span class="pick__source">' + source + '</span>' +
      (checked ? '<span class="checked">Checked ' + escapeHtml(checked) + ' (UK)</span>' : '') + '</div></div>' +
      (cta ? '<div class="pick__side"><a class="btn-cta" href="' + escapeHtml(cta) + '" target="_blank" rel="noopener noreferrer">' + ctaLabel +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"/></svg></a>' +
        (booking && booking !== cta ? '<a class="pick__booking" href="' + escapeHtml(booking) + '" target="_blank" rel="noopener noreferrer">Book tickets</a>' : '') + '</div>' : '') + '</article>';
  }
  function emptyMessage(when, age, now) {
    var window = dateWindow(when, now), audience = age === 'all' ? '' : ' for ages ' + age.replace('-', '–');
    if (when === 'today') return 'No more checked sessions' + audience + ' today (' + formatDateLabel(window.start) + '). Try This weekend for plans ahead.';
    return 'No checked picks' + audience + ' for ' + windowLabel(window) + ' yet. ' +
      (age === 'all' ? 'Check back for new finds.' : 'Try All ages, or check back for new finds.');
  }
  function renderHeroAndDated(selected, now) {
    var heroEl = document.getElementById('hero-pick'), listEl = document.getElementById('dated-picks');
    if (!heroEl || !listEl) return;
    var main = selected.filter(function (pick) { return pick.role !== 'backup'; }), hero = chooseHero(main);
    setText('catalog-headline', main.length ? '' : 'Good finds are worth waiting for.');
    setText('pick-count', main.length + (main.length === 1 ? ' distinct idea' : ' distinct ideas'));
    heroEl.innerHTML = hero ? renderPickCard(hero, { hero: true }) : '';
    document.querySelectorAll('.brief-nudge').forEach(function (nudge) { nudge.hidden = !hero; });
    var rest = main.filter(function (pick) { return pick !== hero; });
    listEl.innerHTML = !main.length ? '<p class="empty-state">' + escapeHtml(emptyMessage(_activeWhen, _activeAge, now)) + '</p>' :
      (rest.length ? '<div class="pick-list">' + rest.map(function (pick) { return renderPickCard(pick); }).join('') + '</div>' : '');
  }
  function relevantNotices(notices, selected, when, now) {
    var window = dateWindow(when, now), ids = selected.flatMap(function (pick) { return pick.memberIds || [pick.id]; });
    var venues = selected.map(function (pick) { return pick.venueId; }).filter(Boolean);
    return (notices || []).filter(function (notice) {
      var expiry = eventTimestamp(notice.expiresAt);
      if (expiry != null && expiry <= now) return false;
      if (/weather|forecast|met office/i.test(notice.title || '') && expiry == null) return false;
      var start = notice.startDate || notice.date, end = notice.endDate || notice.date;
      if (validDay(start) && start > window.end) return false;
      if (validDay(end) && end < window.start) return false;
      if (notice.weekdays && !notice.weekdays.some(function (weekday) {
        for (var day = window.start; day <= window.end; day = addDays(day, 1)) {
          if (new Date(day + 'T12:00:00Z').getUTCDay() === weekday) return true;
        }
        return false;
      })) return false;
      if (notice.relatedPickIds && !notice.relatedPickIds.some(function (id) { return ids.indexOf(id) !== -1; })) return false;
      if (notice.relatedVenueIds && !notice.relatedVenueIds.some(function (id) { return venues.indexOf(id) !== -1; })) return false;
      return true;
    });
  }
  function renderNotices(data, selected, now) {
    var element = document.getElementById('notices');
    if (!element) return;
    var notices = relevantNotices(data.notices, selected, _activeWhen, now);
    element.innerHTML = notices.map(function (notice) {
      var url = safePublicUrl(notice.sourceUrl);
      return '<details class="notice"><summary>' + escapeHtml(notice.title) + '</summary><p>' + escapeHtml(notice.detail) +
        (url ? ' <a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(notice.sourceName || 'Official update') + '</a>' : '') + '</p></details>';
    }).join('');
    element.hidden = !notices.length;
  }
  function renderBackups(evergreen, selected) {
    var element = document.getElementById('backups');
    if (!element) return;
    var picks = selected.filter(function (pick) { return pick.role === 'backup'; }).concat((evergreen || []).filter(function (pick) { return matchesAge(pick, _activeAge); }));
    element.innerHTML = !picks.length ? '' : '<div class="backups">' +
      '<p class="backups__lede">Familiar places for a flexible day. Check opening times before you go.</p><div class="backup-list">' + picks.map(function (pick) {
        var url = publicCtaUrl(pick);
        return '<div class="backup" id="pick-' + escapeHtml(pick.id) + '"><div class="backup__top"><span class="backup__title">' + escapeHtml(pick.title) +
          '</span></div><div class="backup__meta">' + (pick.date ? whenLine(pick) : escapeHtml(pick.time)) + '</div><p>' + escapeHtml(pick.cost) + '</p>' +
          (url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">See venue details →</a>' : '') + '</div>';
      }).join('') + '</div></div>';
  }
  function renderBriefPreview(now) {
    var element = document.getElementById('brief-preview');
    if (!element) return;
    var picks = selectPicks(_data.datedPicks, 'weekend', 'all', now).filter(function (pick) { return pick.role !== 'backup'; }).slice(0, 3);
    element.innerHTML = picks.length ? '<ol class="brief-preview__list">' + picks.map(function (pick) {
      var cta = publicCtaUrl(pick), tip = pick.parentTip || pick.parentHeadsUp;
      return '<li><strong>' + escapeHtml(pick.title) + '</strong><span>' + whenLine(pick) + '</span>' +
        '<p>' + escapeHtml(pick.appeal || pick.description) + '</p>' +
        '<p><strong>For:</strong> ' + escapeHtml(pick.ageSuitability || 'Check age suitability with the organiser') + '</p>' +
        '<p><strong>Cost:</strong> ' + escapeHtml(pick.cost || 'Check organiser for prices') + '</p>' +
        (tip ? '<p><strong>Before you go:</strong> ' + escapeHtml(tip) + '</p>' : '') +
        (cta ? '<a href="' + escapeHtml(cta) + '" target="_blank" rel="noopener noreferrer">' +
          (cta === safePublicUrl(pick.bookingUrl) ? 'Book tickets' : 'See session details') + '</a>' : '') + '</li>';
    }).join('') + '</ol>' : '<p>The next brief will include a first pick, age-fit alternatives, prices and booking links.</p>';
  }
  function renderAll() {
    if (!_data) return;
    var now = Date.now(), focused = document.activeElement;
    var focusAge = focused && focused.getAttribute('data-age'), focusWhen = focused && focused.getAttribute('data-when');
    var selected = selectPicks(_data.datedPicks, _activeWhen, _activeAge, now);
    renderFilters(now); renderFreshness(_data, now); renderHeroAndDated(selected, now);
    renderNotices(_data, selected.concat((_data.evergreen || []).filter(function (pick) { return matchesAge(pick, _activeAge); })), now);
    renderBackups(_data.evergreen, selected); renderBriefPreview(now);
    var focus = focusAge ? document.querySelector('[data-age="' + focusAge + '"]') :
      (focusWhen ? document.querySelector('[data-when="' + focusWhen + '"]') : null);
    if (focus) focus.focus({ preventScroll: true });
  }
  function showError(message) {
    var hero = document.getElementById('hero-pick'), dated = document.getElementById('dated-picks');
    if (hero) hero.innerHTML = '';
    if (dated) dated.innerHTML = '<p class="report-error">We couldn’t load the shortlist. Please refresh in a moment.</p>';
    setText('catalog-freshness', 'Shortlist unavailable');
    console.error('[DoNext catalog]', message);
  }
  function clearCatalog() {
    _data = null;
    global._donextCatalog = null;
    if (_timer) global.clearInterval(_timer);
    _timer = null;
    ['hero-pick', 'dated-picks', 'notices', 'backups', 'brief-preview'].forEach(function (id) {
      var element = document.getElementById(id);
      if (element) element.innerHTML = '';
    });
    ['pick-count', 'catalog-headline', 'date-range'].forEach(function (id) { setText(id, ''); });
    var banner = document.getElementById('stale-banner');
    if (banner) { banner.hidden = true; banner.innerHTML = ''; }
    document.querySelectorAll('.brief-nudge').forEach(function (nudge) { nudge.hidden = true; });
    setText('catalog-freshness', 'Checking the latest picks…');
  }
  function revealAnchor() {
    if (!global.location || !global.location.hash) return;
    var id;
    try { id = decodeURIComponent(global.location.hash.slice(1)); } catch (_) { return; }
    var target = document.getElementById(id);
    if (!target) return;
    var details = target.closest('details');
    if (details) details.open = true;
    target.scrollIntoView({ block: 'start' });
  }
  function load(options) {
    var version = ++_loadVersion;
    var requested = options && Object.prototype.hasOwnProperty.call(options, 'city') ? options.city :
      (document.body && document.body.getAttribute('data-city'));
    var city;
    clearCatalog();
    return Promise.resolve().then(function () {
      city = resolveCity(requested);
      return fetch(city.catalogUrl, { cache: 'no-store' });
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (data) {
      if (version !== _loadVersion) return;
      validateCatalog(data, city.id);
      _data = data; readSelection(); renderAll(); revealAnchor(); global._donextCatalog = data;
      _timer = global.setInterval(renderAll, 60000);
      return data;
    }).catch(function (error) {
      if (version !== _loadVersion) return;
      clearCatalog();
      showError(error.message);
    });
  }
  var api = { load: load, render: renderAll, publicCtaUrl: publicCtaUrl, londonTodayISO: londonTodayISO,
    currentDatedPicks: currentDatedPicks, dateWindow: dateWindow, selectPicks: selectPicks, chooseHero: chooseHero,
    groupSessions: groupSessions, pickEndMs: pickEndMs, renderPickCard: renderPickCard, relevantNotices: relevantNotices,
    emptyMessage: emptyMessage, resolveCity: resolveCity, validateCatalog: validateCatalog, AGE_BANDS: AGE_BANDS };
  global.DoNextCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global.addEventListener) {
    global.addEventListener('popstate', function () { if (_data) { readSelection(); renderAll(); revealAnchor(); } });
    global.addEventListener('hashchange', function () { if (_data) { readSelection(); renderAll(); revealAnchor(); } });
    global.addEventListener('visibilitychange', function () { if (typeof document !== 'undefined' && !document.hidden) renderAll(); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
