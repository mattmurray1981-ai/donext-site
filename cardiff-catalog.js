/**
 * DoNext Cardiff catalog — loads data/cardiff-today.json and renders
 * hero + dated picks + evergreen backups with age-band chips.
 * Public CTA: organiserUrl → bookingUrl → url. Never leadUrl.
 */
(function (global) {
  'use strict';

  var DATA_URL = './data/cardiff-today.json';
  var AGE_BANDS = ['0-4', '5-8', '9-12'];
  var DEFAULT_STALE_HOURS = 36;

  var _data = null;
  var _activeAge = 'all'; // 'all' | '0-4' | '5-8' | '9-12'

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Public CTA: organiserUrl → bookingUrl → url. Never leadUrl. */
  function publicCtaUrl(pick) {
    if (!pick || typeof pick !== 'object') return '';
    var u = pick.organiserUrl || pick.bookingUrl || pick.url || '';
    if (/facebook\.com\/groups\//i.test(String(u))) {
      return pick.organiserUrl && !/facebook\.com\/groups\//i.test(String(pick.organiserUrl))
        ? pick.organiserUrl
        : (pick.bookingUrl || '');
    }
    return u;
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

  function formatChecked(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function hoursSince(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return Infinity;
    return (Date.now() - d.getTime()) / 3600000;
  }

  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }

  function isFreeCost(cost) {
    return /^free\b/i.test(String(cost || '').trim());
  }

  function pickMatchesAge(pick) {
    if (_activeAge === 'all') return true;
    var bands = pick.ageBands || [];
    if (!bands.length) return true;
    return bands.indexOf(_activeAge) !== -1;
  }

  function ageChipLabel(band) {
    if (band === 'all') return 'All';
    return band.replace('-', '–');
  }

  function externalIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"/></svg>';
  }

  function renderAgeChips() {
    var el = document.getElementById('age-chips');
    if (!el) return;
    var options = ['all'].concat(AGE_BANDS);
    el.innerHTML = options.map(function (band) {
      var active = _activeAge === band;
      return '<button type="button" class="age-chip' + (active ? ' is-active' : '') +
        '" data-age="' + band + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
        escapeHtml(ageChipLabel(band)) + '</button>';
    }).join('');

    el.querySelectorAll('[data-age]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _activeAge = btn.getAttribute('data-age') || 'all';
        renderAll();
      });
    });
  }

  function renderFreshness(data) {
    var badge = document.getElementById('catalog-freshness');
    var banner = document.getElementById('stale-banner');
    var staleHours = typeof data.staleAfterHours === 'number' ? data.staleAfterHours : DEFAULT_STALE_HOURS;
    var ageHours = hoursSince(data.updatedAt);
    var stamp = formatStamp(data.updatedAt);

    if (badge) {
      badge.textContent = 'Checked ' + stamp + ' (UK)';
    }

    if (banner) {
      if (ageHours > staleHours) {
        banner.hidden = false;
        banner.innerHTML = '<strong>Catalog may be stale.</strong> Last checked ' +
          escapeHtml(stamp) + ' — more than ' + staleHours +
          ' hours ago. Dated picks may be incomplete; backups below still link to official pages.';
      } else {
        banner.hidden = true;
        banner.innerHTML = '';
      }
    }
  }

  function renderHeading(data) {
    var el = document.getElementById('catalog-headline');
    if (!el) return;
    el.textContent = data.headline || data.summary || 'Locally checked shortlist for this weekend.';
  }

  function renderNotices(data) {
    var container = document.getElementById('notices');
    if (!container) return;
    var notices = data.notices || [];
    if (!notices.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = notices.map(function (n) {
      var link = n.sourceUrl
        ? ' <a href="' + escapeHtml(n.sourceUrl) + '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(n.sourceName || 'Source') + '</a>'
        : '';
      return '<div class="notice"><strong>' + escapeHtml(n.title) + '</strong><p>' +
        escapeHtml(n.detail) + link + '</p></div>';
    }).join('');
  }

  function ageBadges(pick) {
    return (pick.ageBands || []).map(function (b) {
      return '<span class="badge badge--age">' + escapeHtml(ageChipLabel(b)) + '</span>';
    }).join('');
  }

  function whenLine(pick) {
    if (pick.date) {
      return escapeHtml(formatDateLabel(pick.date)) +
        (pick.time ? ' · ' + escapeHtml(pick.time) : '');
    }
    return escapeHtml(pick.time || 'Anytime');
  }

  function renderPickCard(pick, opts) {
    opts = opts || {};
    var isHero = !!opts.hero;
    var isFree = isFreeCost(pick.cost);
    var cta = publicCtaUrl(pick);
    var sourceLabel = pick.sourceName || 'Details';
    var checked = formatChecked(pick.checkedAt || (_data && _data.updatedAt));
    var why = pick.whyPicked
      ? '<p class="pick__why"><strong>Best for:</strong> ' + escapeHtml(pick.whyPicked) + '</p>'
      : '';
    var heads = pick.parentHeadsUp
      ? '<p class="pick__heads"><strong>Parent heads-up:</strong> ' + escapeHtml(pick.parentHeadsUp) + '</p>'
      : '';
    var status = pick.statusNote
      ? '<p class="pick__heads">' + escapeHtml(pick.statusNote) + '</p>'
      : '';
    var backupLabel = pick.role === 'backup'
      ? '<span class="badge badge--backup">Backup</span>'
      : '';
    var costBadge = isFree
      ? '<span class="badge badge--free">Free</span>'
      : (pick.cost ? '<span class="badge">' + escapeHtml(pick.cost) + '</span>' : '');
    var kicker = isHero
      ? '<div class="pick__kicker">If you do one thing</div>'
      : '';
    var linkHtml = cta
      ? '<a class="btn-cta" href="' + escapeHtml(cta) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(sourceLabel) + ' ' + externalIcon() + '</a>'
      : '';

    return '<article class="pick' + (isHero ? ' pick--hero' : '') + '" data-event-id="' + escapeHtml(pick.id) + '">' +
      '<div class="pick__body">' +
        kicker +
        '<h3 class="pick__title">' + escapeHtml(pick.title) + '</h3>' +
        '<div class="pick__meta">' +
          '<span>' + whenLine(pick) + '</span>' +
          '<span>' + escapeHtml(pick.location) + '</span>' +
        '</div>' +
        '<p class="pick__desc">' + escapeHtml(pick.description) + '</p>' +
        why +
        heads +
        status +
        '<div class="pick__footer">' +
          costBadge +
          ageBadges(pick) +
          backupLabel +
          (checked ? '<span class="checked">Checked ' + escapeHtml(checked) + '</span>' : '') +
        '</div>' +
      '</div>' +
      (linkHtml ? '<div class="pick__side">' + linkHtml + '</div>' : '') +
    '</article>';
  }

  function chooseHero(dated) {
    for (var i = 0; i < dated.length; i++) {
      if (dated[i].role === 'hero') return dated[i];
    }
    return dated[0] || null;
  }

  function renderHeroAndDated(dated) {
    var heroEl = document.getElementById('hero-pick');
    var listEl = document.getElementById('dated-picks');
    if (!heroEl || !listEl) return;

    var filtered = (dated || []).filter(pickMatchesAge);
    if (!filtered.length) {
      heroEl.innerHTML = '';
      listEl.innerHTML = '<p class="empty-state">No dated picks match this age filter. Try All, or check the backups below.</p>';
      return;
    }

    var hero = chooseHero(filtered);
    var rest = filtered.filter(function (p) { return p !== hero; });

    heroEl.innerHTML = hero ? renderPickCard(hero, { hero: true }) : '';
    if (rest.length) {
      listEl.innerHTML = '<div class="pick-list" role="list">' +
        rest.map(function (p) { return renderPickCard(p); }).join('') +
        '</div>';
    } else {
      listEl.innerHTML = '';
    }
  }

  function renderBackups(evergreen) {
    var el = document.getElementById('backups');
    if (!el) return;
    var filtered = (evergreen || []).filter(pickMatchesAge);
    if (!filtered.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML =
      '<aside class="backups" aria-labelledby="backups-heading">' +
        '<h2 class="backups__title" id="backups-heading">Back-pocket backups</h2>' +
        '<p class="backups__lede">Reliable tourist staples and venue links — not the main shortlist.</p>' +
        '<div class="backup-list">' +
          filtered.map(function (p) {
            var cta = publicCtaUrl(p);
            var link = cta
              ? '<a href="' + escapeHtml(cta) + '" target="_blank" rel="noopener noreferrer">' +
                escapeHtml(p.sourceName || 'Details') + ' →</a>'
              : '';
            return '<div class="backup">' +
              '<div class="backup__top">' +
                '<span class="backup__title">' + escapeHtml(p.title) + '</span>' +
                (isFreeCost(p.cost) ? '<span class="badge badge--free">Free</span>' : '<span class="badge">' + escapeHtml(p.cost) + '</span>') +
              '</div>' +
              '<div class="backup__meta">' + escapeHtml(p.time || '') +
                (p.location ? ' · ' + escapeHtml(p.location) : '') + '</div>' +
              link +
            '</div>';
          }).join('') +
        '</div>' +
      '</aside>';
  }

  function renderAll() {
    if (!_data) return;
    renderHeading(_data);
    renderFreshness(_data);
    renderAgeChips();
    renderNotices(_data);
    renderHeroAndDated(_data.datedPicks);
    renderBackups(_data.evergreen);
  }

  function showError(msg) {
    var hero = document.getElementById('hero-pick');
    var dated = document.getElementById('dated-picks');
    var freshness = document.getElementById('catalog-freshness');
    var banner = document.getElementById('stale-banner');
    if (hero) hero.innerHTML = '';
    if (dated) dated.innerHTML = '<p class="report-error">' + escapeHtml(msg) + '</p>';
    if (freshness) freshness.textContent = 'Catalog unavailable';
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

  global.DoNextCatalog = {
    load: load,
    render: renderAll,
    publicCtaUrl: publicCtaUrl,
    AGE_BANDS: AGE_BANDS
  };
})(window);
