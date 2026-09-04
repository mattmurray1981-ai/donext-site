/**
 * DoNext Cardiff catalog — loads data/cardiff-today.json and renders
 * dated picks vs evergreen backups with age-band filters and stale banner.
 */
(function (global) {
  'use strict';

  var DATA_URL = './data/cardiff-today.json';
  var AGE_BANDS = ['0-4', '5-8', '9-12'];
  var DEFAULT_STALE_HOURS = 36;

  var _data = null;
  var _activeAges = {};
  AGE_BANDS.forEach(function (b) { _activeAges[b] = true; });

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatStamp(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return 'unknown time';
    return d.toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function hoursSince(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return Infinity;
    return (Date.now() - d.getTime()) / 3600000;
  }

  function pickMatchesAge(pick) {
    var bands = pick.ageBands || [];
    if (!bands.length) return true;
    return bands.some(function (b) { return _activeAges[b]; });
  }

  function activeAgeLabel() {
    var on = AGE_BANDS.filter(function (b) { return _activeAges[b]; });
    if (on.length === AGE_BANDS.length) return 'All ages 0–12';
    if (!on.length) return 'No age bands selected';
    return 'Ages ' + on.join(' · ');
  }

  function renderAgeFilters() {
    var el = document.getElementById('cardiff-age-filters');
    if (!el) return;
    el.innerHTML = AGE_BANDS.map(function (band) {
      var pressed = _activeAges[band] ? 'true' : 'false';
      var cls = _activeAges[band] ? 'age-filter-chip age-filter-chip--active' : 'age-filter-chip';
      return '<button type="button" class="' + cls + '" data-age-band="' + band +
        '" aria-pressed="' + pressed + '">' + escapeHtml(band) + '</button>';
    }).join('') +
      '<span class="age-filter-summary" id="cardiff-age-summary">' + escapeHtml(activeAgeLabel()) + '</span>';

    el.querySelectorAll('[data-age-band]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var band = btn.getAttribute('data-age-band');
        _activeAges[band] = !_activeAges[band];
        // Keep at least one band on for usability
        if (!AGE_BANDS.some(function (b) { return _activeAges[b]; })) {
          _activeAges[band] = true;
        }
        renderAll();
      });
    });
  }

  function renderFreshness(data) {
    var badge = document.getElementById('cardiff-report-freshness');
    var banner = document.getElementById('cardiff-stale-banner');
    var staleHours = typeof data.staleAfterHours === 'number' ? data.staleAfterHours : DEFAULT_STALE_HOURS;
    var ageHours = hoursSince(data.updatedAt);
    var stamp = formatStamp(data.updatedAt);

    if (badge) {
      badge.textContent = 'Last updated ' + stamp + ' (UK)';
    }

    if (banner) {
      if (ageHours > staleHours) {
        banner.hidden = false;
        banner.innerHTML = '<strong>Catalog may be stale.</strong> Last updated ' +
          escapeHtml(stamp) + ' — more than ' + staleHours +
          ' hours ago. Dated picks may be incomplete; evergreen venues below still link to official pages.';
      } else {
        banner.hidden = true;
        banner.innerHTML = '';
      }
    }
  }

  function renderNotices(data) {
    var container = document.getElementById('cardiff-report-notices');
    if (!container) return;
    var notices = data.notices || [];
    if (!notices.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = '<div class="report-notices" aria-label="Notices">' +
      notices.map(function (n) {
        var link = n.sourceUrl
          ? '<a class="event-card__link" href="' + escapeHtml(n.sourceUrl) +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(n.sourceName || 'Source') +
            '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"/></svg></a>'
          : '';
        return '<div class="report-notice"><div><strong>' + escapeHtml(n.title) +
          '</strong><p>' + escapeHtml(n.detail) + '</p></div>' + link + '</div>';
      }).join('') + '</div>';
  }

  function ageBadges(pick) {
    return (pick.ageBands || []).map(function (b) {
      return '<span class="event-card__age">' + escapeHtml(b) + '</span>';
    }).join(' ');
  }

  function renderCard(pick, kindLabel) {
    var isFree = String(pick.cost || '').toLowerCase().indexOf('free') === 0;
    var confidence = pick.confidence === 'medium'
      ? '<span class="event-card__status">Check before travel</span>'
      : '';
    var status = pick.statusNote
      ? '<p class="event-card__status-note">' + escapeHtml(pick.statusNote) + '</p>'
      : '';
    var when = pick.date
      ? escapeHtml(pick.date) + (pick.time ? ' · ' + escapeHtml(pick.time) : '')
      : escapeHtml(pick.time || 'Anytime');
    var sourceLabel = pick.sourceName || 'Details';
    var kind = kindLabel
      ? '<span class="event-card__kind">' + escapeHtml(kindLabel) + '</span>'
      : '';

    return '<article class="event-card" role="listitem" data-event-id="' + escapeHtml(pick.id) + '">' +
      '<div class="event-card__main">' +
        kind +
        '<div class="event-card__name">' + escapeHtml(pick.title) + '</div>' +
        '<div class="event-card__meta">' +
          '<span class="event-card__meta-item">' + when + '</span>' +
          '<span class="event-card__meta-item">' + escapeHtml(pick.location) + '</span>' +
        '</div>' +
        '<p class="event-card__desc">' + escapeHtml(pick.description) + '</p>' +
        status +
      '</div>' +
      '<div class="event-card__side">' +
        '<div class="event-card__cost' + (isFree ? ' event-card__cost--free' : '') + '">' + escapeHtml(pick.cost) + '</div>' +
        ageBadges(pick) +
        confidence +
        '<a href="' + escapeHtml(pick.url) + '" class="event-card__link" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(sourceLabel) +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"/></svg>' +
        '</a>' +
      '</div>' +
    '</article>';
  }

  function renderSection(containerId, title, badge, badgeClass, picks, emptyHtml, kindLabel) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var filtered = (picks || []).filter(pickMatchesAge);
    if (!filtered.length) {
      container.innerHTML = emptyHtml || '';
      return;
    }
    container.innerHTML =
      '<div class="events-section" aria-labelledby="' + containerId + '-heading">' +
        '<div class="events-section-header">' +
          '<h2 class="events-section-title" id="' + containerId + '-heading">' + escapeHtml(title) + '</h2>' +
          '<span class="events-section-badge ' + badgeClass + '">' + escapeHtml(badge) + '</span>' +
        '</div>' +
        '<div class="event-list" role="list">' +
          filtered.map(function (p) { return renderCard(p, kindLabel); }).join('') +
        '</div>' +
      '</div>';
  }

  function renderWeatherPlaceholder() {
    var weather = document.getElementById('cardiff-report-weather');
    if (!weather) return;
    weather.innerHTML =
      '<div class="weather-bar__title">Forecast is not bundled in the catalog file</div>' +
      '<p class="weather-advice">Check the Met Office Cardiff forecast before you head out, especially for outdoor evergreen picks.</p>' +
      '<p><a class="report-inline-link" href="https://weather.metoffice.gov.uk/forecast/gcjszevgx" target="_blank" rel="noopener noreferrer">Met Office Cardiff forecast</a></p>';
  }

  function renderHeading(data) {
    var heading = document.getElementById('cardiff-report-heading');
    var desc = document.getElementById('cardiff-report-desc');
    if (heading) heading.textContent = data.headline || (data.city + ' family picks');
    if (desc) {
      desc.textContent = data.summary ||
        'Dated picks for today, plus evergreen venue backups. Filter by age band.';
    }
  }

  function renderAll() {
    if (!_data) return;
    renderHeading(_data);
    renderFreshness(_data);
    renderAgeFilters();
    renderNotices(_data);
    renderWeatherPlaceholder();

    var datedEmpty =
      '<div class="events-section"><div class="events-section-header">' +
      '<h2 class="events-section-title">Dated picks</h2>' +
      '<span class="events-section-badge badge--gem">Today</span></div>' +
      '<p class="report-empty">No dated picks in the catalog yet. Morning automation will overwrite ' +
      '<code>data/cardiff-today.json</code> when verified listings are ready. Evergreen backups are below.</p></div>';

    var evergreenEmpty =
      '<div class="events-section"><p class="report-empty">No evergreen backups match the selected age bands.</p></div>';

    renderSection(
      'cardiff-report-feature',
      'Dated picks',
      'Checked for specific dates',
      'badge--gem',
      _data.datedPicks,
      datedEmpty,
      'Dated'
    );

    renderSection(
      'cardiff-report-events',
      'Evergreen backups',
      'Official venue links',
      'badge--anchor',
      _data.evergreen,
      evergreenEmpty,
      'Evergreen'
    );
  }

  function showError(msg) {
    var content = document.getElementById('cardiff-report-content');
    if (content) {
      content.innerHTML = '<p class="report-error">' + escapeHtml(msg) + '</p>';
    }
    var badge = document.getElementById('cardiff-report-freshness');
    if (badge) badge.textContent = 'Catalog unavailable';
    var banner = document.getElementById('cardiff-stale-banner');
    if (banner) {
      banner.hidden = false;
      banner.innerHTML = '<strong>Could not load the Cardiff catalog.</strong> ' + escapeHtml(msg);
    }
  }

  function load() {
    return fetch(DATA_URL, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' loading ' + DATA_URL);
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data !== 'object') throw new Error('Catalog JSON was empty');
        if (!Array.isArray(data.datedPicks) || !Array.isArray(data.evergreen)) {
          throw new Error('Catalog must include datedPicks and evergreen arrays');
        }
        _data = data;
        renderAll();
        global._donextCatalog = data;
        return data;
      })
      .catch(function (err) {
        console.error('[DoNext catalog]', err);
        showError(err.message || 'Failed to load catalog');
      });
  }

  global.DoNextCatalog = { load: load, render: renderAll };
})(window);
