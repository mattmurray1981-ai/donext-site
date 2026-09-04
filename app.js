/* app.js — DoNext Community Features */
(function () {
  'use strict';

  // ============================================================
  // SUPABASE CLIENT
  // ============================================================
  var SUPABASE_URL = 'https://jywppjzqdwakixddcllr.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5d3BwanpxZHdha2l4ZGRjbGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTgxMzEsImV4cCI6MjA4ODI3NDEzMX0.HbEQztDBdTYnOYW-DTFttGQQuXIHvv_-rZfsszNBeD4';

  var sb = null;
  var currentUser = null;
  var currentProfile = null;

  // Cardiff city ID — we'll fetch it once
  var CARDIFF_CITY_ID = null;
  var _cityIdPromise = null;

  function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window._donextSb = sb;
      _cityIdPromise = fetchCardiffCityId();
      handleAuthState();
      // Load daily report once Supabase is ready (if on Cardiff view)
      _cityIdPromise.then(function () {
        if (window.location.hash === '#cardiff' || window.location.hash.indexOf('#cardiff/') === 0) {
          loadDailyReport();
        }
      });
    } else {
      setTimeout(initSupabase, 100);
    }
  }

  async function fetchCardiffCityId() {
    if (!sb) return;
    try {
      var _r = await sb.from('cities').select('id').eq('slug', 'cardiff').single();
      if (_r.data) CARDIFF_CITY_ID = _r.data.id;
    } catch (e) { /* ignore */ }
  }

  // Ensure city ID is loaded before using it
  async function ensureCityId() {
    if (CARDIFF_CITY_ID) return CARDIFF_CITY_ID;
    if (_cityIdPromise) await _cityIdPromise;
    if (!CARDIFF_CITY_ID) await fetchCardiffCityId();
    return CARDIFF_CITY_ID;
  }

  // ============================================================
  // AUTH MODULE
  // ============================================================
  async function handleAuthState() {
    // Check for magic link tokens in URL (hash fragments)
    if (window.location.hash && window.location.hash.includes('access_token')) {
      // Supabase will parse the hash automatically on getSession
    }

    var _s = await sb.auth.getSession();
    if (_s.data && _s.data.session) {
      currentUser = _s.data.session.user;
      window._donextUser = currentUser;
      await loadProfile();
      updateAuthUI();
    }

    sb.auth.onAuthStateChange(async function (_event, session) {
      if (session && session.user) {
        currentUser = session.user;
        window._donextUser = currentUser;
        await loadProfile();
        // If we came back from a magic link, clean the URL
        if (window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else {
        currentUser = null;
        currentProfile = null;
        window._donextUser = null;
      }
      updateAuthUI();
    });
  }

  async function loadProfile() {
    if (!currentUser || !sb) return;
    var _r = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (_r.data) {
      currentProfile = _r.data;
    } else {
      // Create profile if doesn't exist
      var _ins = await sb.from('profiles').insert({
        id: currentUser.id,
        display_name: currentUser.email ? currentUser.email.split('@')[0] : 'DoNexter',
        reputation_level: 'Explorer'
      }).select().single();
      if (_ins.data) currentProfile = _ins.data;
    }
  }

  function updateAuthUI() {
    var signInBtn = document.getElementById('auth-signin-btn');
    var userMenu = document.getElementById('auth-user-menu');
    var userAvatar = document.getElementById('auth-user-avatar');
    var userName = document.getElementById('auth-user-name');
    var adminLink = document.getElementById('nav-admin-link');
    var adminLinkMobile = document.getElementById('nav-admin-link-mobile');
    var discoverLink = document.getElementById('nav-discover-link');
    var discoverLinkMobile = document.getElementById('nav-discover-link-mobile');

    if (currentUser && currentProfile) {
      if (signInBtn) signInBtn.style.display = 'none';
      if (userMenu) userMenu.style.display = 'flex';
      if (userName) userName.textContent = currentProfile.display_name || 'DoNexter';
      if (userAvatar) {
        if (currentProfile.avatar_url) {
          userAvatar.style.backgroundImage = 'url(' + currentProfile.avatar_url + ')';
          userAvatar.textContent = '';
        } else {
          userAvatar.textContent = (currentProfile.display_name || 'D')[0].toUpperCase();
        }
      }
      if (adminLink) adminLink.style.display = currentProfile.is_admin ? '' : 'none';
      if (adminLinkMobile) adminLinkMobile.style.display = currentProfile.is_admin ? '' : 'none';
      if (discoverLink) discoverLink.style.display = '';
      if (discoverLinkMobile) discoverLinkMobile.style.display = '';
    } else {
      if (signInBtn) signInBtn.style.display = '';
      if (userMenu) userMenu.style.display = 'none';
      if (adminLink) adminLink.style.display = 'none';
      if (adminLinkMobile) adminLinkMobile.style.display = 'none';
      if (discoverLink) discoverLink.style.display = 'none';
      if (discoverLinkMobile) discoverLinkMobile.style.display = 'none';
    }
  }

  async function signInWithMagicLink(email) {
    if (!sb) return { error: 'Supabase not ready' };
    var _r = await sb.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    return _r;
  }

  async function signOut() {
    if (!sb) return;
    await sb.auth.signOut();
    currentUser = null;
    currentProfile = null;
    updateAuthUI();
    window.location.hash = '#home';
  }

  // ============================================================
  // AUTH MODAL
  // ============================================================
  function showAuthModal(message) {
    var existing = document.getElementById('auth-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-content">' +
        '<button class="modal-close" aria-label="Close">&times;</button>' +
        '<span class="section-label">Sign in to DoNext</span>' +
        '<h2 class="modal-title">' + (message || 'Join the community') + '</h2>' +
        '<p class="modal-desc">Enter your email and we\'ll send you a magic link — no password needed.</p>' +
        '<form id="auth-form" class="auth-form">' +
          '<label for="auth-email" class="sr-only">Email</label>' +
          '<input type="email" id="auth-email" placeholder="your@email.com" autocomplete="email" required>' +
          '<button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">Send magic link</button>' +
        '</form>' +
        '<div id="auth-message" class="auth-message" style="display:none;"></div>' +
      '</div>';

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', function () { modal.remove(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });

    var form = document.getElementById('auth-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email = document.getElementById('auth-email').value.trim();
      if (!email) return;
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      var _r = await signInWithMagicLink(email);
      var msgEl = document.getElementById('auth-message');
      if (_r.error) {
        msgEl.style.display = 'block';
        msgEl.className = 'auth-message auth-message--error';
        msgEl.textContent = _r.error.message || 'Something went wrong. Try again.';
        btn.disabled = false;
        btn.textContent = 'Send magic link';
      } else {
        form.style.display = 'none';
        msgEl.style.display = 'block';
        msgEl.className = 'auth-message auth-message--success';
        msgEl.textContent = 'Check your email! Click the link we sent to ' + email + ' to sign in.';
      }
    });
  }

  // ============================================================
  // USER DROPDOWN
  // ============================================================
  function setupUserDropdown() {
    var toggle = document.getElementById('auth-user-menu');
    var dropdown = document.getElementById('auth-dropdown');
    if (!toggle || !dropdown) return;
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', function () {
      if (dropdown) dropdown.classList.remove('open');
    });
    var logoutBtn = document.getElementById('auth-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        signOut();
      });
    }
  }

  // ============================================================
  // COMMUNITY VIEW (hash: #cardiff/community)
  // ============================================================
  var CHIP_LABELS = {
    'worth-it': 'Worth it',
    'rain-proof': 'Rain-proof',
    'great-for-toddlers': 'Great for toddlers',
    'great-for-tweens': 'Great for tweens',
    'free-fun': 'Free fun',
    'educational': 'Educational',
    'burns-energy': 'Burns energy',
    'cozy-indoor': 'Cosy indoor',
    'hidden-gem-find': 'Hidden gem'
  };

  var TAG_FILTERS = {
    'Kids': ['great-for-toddlers', 'great-for-tweens'],
    'Rain-proof': ['rain-proof', 'cozy-indoor'],
    'Free': ['free-fun'],
    'Date night': ['worth-it']
  };

  var activeFilters = [];

  async function loadCommunityView() {
    var container = document.getElementById('community-activities');
    if (!container) return;
    container.innerHTML = '<div class="community-loading">Loading activities…</div>';

    if (!sb) { container.innerHTML = '<p>Could not connect to database.</p>'; return; }

    var query = sb.from('activities')
      .select('*')
      .eq('moderation_status', 'approved')
      .order('event_date', { ascending: true, nullsFirst: false });

    if (CARDIFF_CITY_ID) {
      query = query.eq('city_id', CARDIFF_CITY_ID);
    }

    var _r = await query;

    if (_r.error || !_r.data) {
      container.innerHTML = '<p class="community-empty">No activities found yet. Be the first to discover something!</p>';
      return;
    }

    var activities = _r.data;

    // Apply tag filters
    if (activeFilters.length > 0) {
      activities = activities.filter(function (a) {
        if (!a.tags || !a.tags.length) return false;
        return activeFilters.some(function (filterKey) {
          var filterTags = TAG_FILTERS[filterKey];
          return filterTags.some(function (t) { return a.tags.indexOf(t) !== -1; });
        });
      });
    }

    if (activities.length === 0) {
      container.innerHTML = '<p class="community-empty">No activities match your filters. Try removing some filters or <a href="#discover">submit a discovery</a>!</p>';
      return;
    }

    var html = '';
    activities.forEach(function (a) {
      html += renderActivityCard(a);
    });
    container.innerHTML = html;

    // Attach click handlers
    container.querySelectorAll('[data-activity-id]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        e.preventDefault();
        var id = this.getAttribute('data-activity-id');
        window.location.hash = '#activity/' + id;
      });
    });
  }

  function renderActivityCard(a) {
    var gemBadge = a.is_hidden_gem ? '<span class="community-card__gem-badge">Hidden Gem</span>' : '';
    var cost = a.cost_text || 'Free';
    var costClass = (cost.toLowerCase() === 'free') ? 'event-card__cost--free' : '';
    var validations = a.validation_count || 0;

    return '<article class="community-card" data-activity-id="' + a.id + '" tabindex="0" role="button">' +
      '<div class="community-card__header">' +
        '<div class="community-card__title">' + escapeHtml(a.title) + '</div>' +
        gemBadge +
      '</div>' +
      '<div class="community-card__meta">' +
        '<span class="community-card__location">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
          escapeHtml(a.location_name || '') +
        '</span>' +
        '<span class="community-card__validations">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' +
          validations + ' validation' + (validations !== 1 ? 's' : '') +
        '</span>' +
      '</div>' +
      '<div class="community-card__footer">' +
        '<span class="community-card__cost ' + costClass + '">' + escapeHtml(cost) + '</span>' +
        '<span class="community-card__age">' + escapeHtml(a.age_range || 'All ages') + '</span>' +
      '</div>' +
    '</article>';
  }

  function setupFilterChips() {
    document.querySelectorAll('.community-filter-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var filter = this.getAttribute('data-filter');
        this.classList.toggle('active');
        if (this.classList.contains('active')) {
          if (activeFilters.indexOf(filter) === -1) activeFilters.push(filter);
        } else {
          activeFilters = activeFilters.filter(function (f) { return f !== filter; });
        }
        loadCommunityView();
      });
    });
  }

  // ============================================================
  // ACTIVITY DETAIL VIEW (hash: #activity/{id})
  // ============================================================
  async function loadActivityDetail(activityId) {
    var container = document.getElementById('activity-detail-content');
    if (!container) return;
    container.innerHTML = '<div class="community-loading">Loading activity…</div>';

    if (!sb) return;

    var _r = await sb.from('activities').select('*, profiles:discovered_by(display_name)').eq('id', activityId).single();
    if (_r.error || !_r.data) {
      container.innerHTML = '<p class="community-empty">Activity not found.</p>';
      return;
    }

    var a = _r.data;

    // Fetch validations
    var _v = await sb.from('validations').select('*, profiles:user_id(display_name, avatar_url)').eq('activity_id', activityId).order('created_at', { ascending: false });
    var validations = (_v.data || []);

    // Build chip breakdown
    var chipCounts = {};
    validations.forEach(function (v) {
      if (v.chips && v.chips.length) {
        v.chips.forEach(function (c) {
          chipCounts[c] = (chipCounts[c] || 0) + 1;
        });
      }
    });

    var chipBreakdownHtml = '';
    Object.keys(chipCounts).sort(function (a, b) { return chipCounts[b] - chipCounts[a]; }).forEach(function (c) {
      chipBreakdownHtml += '<span class="chip-count-badge">' + chipCounts[c] + 'x ' + (CHIP_LABELS[c] || c) + '</span>';
    });

    var gemBadge = a.is_hidden_gem ? '<span class="detail-gem-badge">Hidden Gem</span>' : '';
    var discoveredBy = '';
    if (a.profiles && a.profiles.display_name) {
      discoveredBy = '<p class="detail-discovered">Discovered by <strong>' + escapeHtml(a.profiles.display_name) + '</strong></p>';
    }

    var bookingLink = '';
    if (a.booking_url) {
      bookingLink = '<a href="' + escapeHtml(a.booking_url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Book / More info <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7M7 7h10v10"/></svg></a>';
    }

    var cost = a.cost_text || 'Free';
    var costClass = (cost.toLowerCase() === 'free') ? 'event-card__cost--free' : '';

    var html =
      '<div class="detail-header">' +
        '<a href="#cardiff/community" class="detail-back">&larr; Back to community</a>' +
        gemBadge +
        '<h1 class="detail-title">' + escapeHtml(a.title) + '</h1>' +
        discoveredBy +
        '<div class="detail-meta-row">' +
          '<span class="detail-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + escapeHtml(a.location_name || '') + '</span>' +
          '<span class="detail-meta-item ' + costClass + '">' + escapeHtml(cost) + '</span>' +
          '<span class="detail-meta-item">' + escapeHtml(a.age_range || 'All ages') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="detail-body">' +
        '<p class="detail-description">' + escapeHtml(a.description || '') + '</p>' +
        (a.address ? '<p class="detail-address"><strong>Address:</strong> ' + escapeHtml(a.address) + '</p>' : '') +
        bookingLink +
      '</div>' +
      '<div class="detail-validations-section">' +
        '<h2 class="detail-validations-title">Validations <span class="detail-validation-count">(' + validations.length + ')</span></h2>' +
        (chipBreakdownHtml ? '<div class="chip-breakdown">' + chipBreakdownHtml + '</div>' : '') +
        '<button class="btn btn-accent btn--lg" id="validate-btn" style="margin-bottom:var(--space-6);">Validate this activity</button>' +
        '<div class="validations-list">' + renderValidations(validations) + '</div>' +
      '</div>';

    container.innerHTML = html;

    // Back link handler
    container.querySelector('.detail-back').addEventListener('click', function (e) {
      e.preventDefault();
      window.location.hash = '#cardiff/community';
    });

    // Validate button
    var validateBtn = document.getElementById('validate-btn');
    if (validateBtn) {
      validateBtn.addEventListener('click', function () {
        if (!currentUser) {
          showAuthModal('Sign in to validate');
          return;
        }
        showValidationModal(activityId);
      });
    }
  }

  function renderValidations(validations) {
    if (!validations.length) return '<p class="community-empty">No validations yet. Be the first!</p>';
    var html = '';
    validations.forEach(function (v) {
      var name = (v.profiles && v.profiles.display_name) ? escapeHtml(v.profiles.display_name) : 'DoNexter';
      var chips = '';
      if (v.chips && v.chips.length) {
        v.chips.forEach(function (c) {
          chips += '<span class="validation-chip">' + (CHIP_LABELS[c] || c) + '</span>';
        });
      }
      var photoHtml = '';
      if (v.photo_url) {
        photoHtml = '<img src="' + escapeHtml(v.photo_url) + '" alt="Validation photo" class="validation-photo" loading="lazy">';
      }
      html += '<div class="validation-item">' +
        '<div class="validation-item__header">' +
          '<strong>' + name + '</strong>' +
          '<span class="validation-item__date">' + formatDate(v.created_at) + '</span>' +
        '</div>' +
        (chips ? '<div class="validation-item__chips">' + chips + '</div>' : '') +
        (v.comment ? '<p class="validation-item__comment">' + escapeHtml(v.comment) + '</p>' : '') +
        photoHtml +
      '</div>';
    });
    return html;
  }

  // ============================================================
  // VALIDATION MODAL
  // ============================================================
  function showValidationModal(activityId) {
    var existing = document.getElementById('validation-modal');
    if (existing) existing.remove();

    var chipOptions = '';
    Object.keys(CHIP_LABELS).forEach(function (key) {
      chipOptions += '<label class="chip-option"><input type="checkbox" name="chip" value="' + key + '"><span>' + CHIP_LABELS[key] + '</span></label>';
    });

    var modal = document.createElement('div');
    modal.id = 'validation-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML =
      '<div class="modal-content modal-content--lg">' +
        '<button class="modal-close" aria-label="Close">&times;</button>' +
        '<span class="section-label">Validate Activity</span>' +
        '<h2 class="modal-title">Share your experience</h2>' +
        '<form id="validation-form" class="validation-form">' +
          '<div class="form-group">' +
            '<label class="form-label">Photo <span class="required">*required</span></label>' +
            '<input type="file" accept="image/*" id="validation-photo" required class="form-file-input">' +
            '<p class="form-hint">Photo of the venue or activity (not people). Avoid identifiable faces — photos with children will be rejected.</p>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Chips <span class="form-hint-inline">(pick 1-3)</span></label>' +
            '<div class="chip-options">' + chipOptions + '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="validation-comment">Comment <span class="form-hint-inline">(optional)</span></label>' +
            '<textarea id="validation-comment" maxlength="140" rows="2" placeholder="Quick thought about this activity…" class="form-textarea"></textarea>' +
            '<div class="char-counter"><span id="comment-chars">0</span>/140</div>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">Submit validation</button>' +
        '</form>' +
        '<div id="validation-success" class="auth-message auth-message--success" style="display:none;">Validation submitted! Thanks for contributing.</div>' +
      '</div>';

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', function () { modal.remove(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });

    // Char counter
    var commentEl = document.getElementById('validation-comment');
    var charCount = document.getElementById('comment-chars');
    commentEl.addEventListener('input', function () {
      charCount.textContent = this.value.length;
    });

    // Chip limit: max 3
    var chipCheckboxes = modal.querySelectorAll('input[name="chip"]');
    chipCheckboxes.forEach(function (cb) {
      cb.addEventListener('change', function () {
        var checked = modal.querySelectorAll('input[name="chip"]:checked');
        if (checked.length > 3) {
          this.checked = false;
        }
      });
    });

    // Submit
    var form = document.getElementById('validation-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Submitting…';

      // Anti-spam check
      if (window.DoNextAntiSpam) {
        var spamCheck = await window.DoNextAntiSpam.checkCanValidate(sb, currentUser.id);
        if (!spamCheck.allowed) {
          btn.disabled = false;
          btn.textContent = 'Submit validation';
          alert(spamCheck.reason);
          return;
        }
      }

      // Get selected chips
      var selectedChips = [];
      modal.querySelectorAll('input[name="chip"]:checked').forEach(function (cb) {
        selectedChips.push(cb.value);
      });

      if (selectedChips.length === 0) {
        btn.disabled = false;
        btn.textContent = 'Submit validation';
        alert('Please select at least 1 chip.');
        return;
      }

      // Upload photo
      var fileInput = document.getElementById('validation-photo');
      if (!fileInput.files || !fileInput.files[0]) {
        btn.disabled = false;
        btn.textContent = 'Submit validation';
        alert('Please upload a photo.');
        return;
      }

      var file = fileInput.files[0];
      var fileExt = file.name.split('.').pop();
      var filePath = currentUser.id + '/' + Date.now() + '.' + fileExt;

      var _upload = await sb.storage.from('validation-photos').upload(filePath, file, { upsert: false });
      if (_upload.error) {
        btn.disabled = false;
        btn.textContent = 'Submit validation';
        alert('Photo upload failed: ' + _upload.error.message);
        return;
      }

      var _pub = sb.storage.from('validation-photos').getPublicUrl(filePath);
      var photoUrl = _pub.data.publicUrl;

      var comment = commentEl.value.trim().substring(0, 140);

      var _ins = await sb.from('validations').insert({
        activity_id: activityId,
        user_id: currentUser.id,
        chips: selectedChips,
        photo_url: photoUrl,
        comment: comment || null
      });

      if (_ins.error) {
        btn.disabled = false;
        btn.textContent = 'Submit validation';
        alert('Submission failed: ' + (_ins.error.message || 'You may have already validated this activity.'));
        return;
      }

      form.style.display = 'none';
      document.getElementById('validation-success').style.display = 'block';

      // Refresh the activity view after a moment
      setTimeout(function () {
        modal.remove();
        loadActivityDetail(activityId);
      }, 1500);
    });
  }

  // ============================================================
  // DISCOVERY SUBMISSION (hash: #discover)
  // ============================================================
  function setupDiscoveryForm() {
    var form = document.getElementById('discovery-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (!currentUser) {
        showAuthModal('Sign in to submit a discovery');
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Submitting…';

      // Ensure city ID is loaded
      var cityId = await ensureCityId();
      if (!cityId) {
        btn.disabled = false;
        btn.textContent = 'Submit discovery';
        alert('Could not connect to the database. Please refresh and try again.');
        return;
      }

      var title = form.querySelector('#disc-title').value.trim();
      var description = form.querySelector('#disc-description').value.trim();
      var locationName = form.querySelector('#disc-location').value.trim();
      var address = form.querySelector('#disc-address').value.trim();
      var postcode = form.querySelector('#disc-postcode').value.trim();
      var costText = form.querySelector('#disc-cost').value.trim();
      var ageRange = form.querySelector('#disc-age').value.trim();
      var bookingUrl = form.querySelector('#disc-booking').value.trim();

      // Combine address with postcode/w3w
      var fullAddress = address;
      if (postcode) {
        fullAddress = fullAddress ? fullAddress + ' | ' + postcode : postcode;
      }

      // Tags
      var tags = [];
      form.querySelectorAll('input[name="disc-tag"]:checked').forEach(function (cb) {
        tags.push(cb.value);
      });

      // Optional photo
      var photoUrl = null;
      var fileInput = form.querySelector('#disc-photo');
      if (fileInput && fileInput.files && fileInput.files[0]) {
        var file = fileInput.files[0];
        var fileExt = file.name.split('.').pop();
        var filePath = currentUser.id + '/discovery-' + Date.now() + '.' + fileExt;
        var _upload = await sb.storage.from('validation-photos').upload(filePath, file, { upsert: false });
        if (!_upload.error) {
          var _pub = sb.storage.from('validation-photos').getPublicUrl(filePath);
          photoUrl = _pub.data.publicUrl;
        }
      }

      var insertData = {
        submitted_by: currentUser.id,
        city_id: cityId,
        title: title,
        description: description || null,
        location_name: locationName,
        address: fullAddress || null,
        cost_text: costText || 'Free',
        age_range: ageRange || 'All ages',
        tags: tags.length > 0 ? tags : [],
        photo_url: photoUrl,
        booking_url: bookingUrl || null
      };

      var _ins = await sb.from('discoveries').insert(insertData);

      if (_ins.error) {
        btn.disabled = false;
        btn.textContent = 'Submit discovery';
        alert('Failed: ' + _ins.error.message);
        return;
      }

      form.style.display = 'none';
      document.getElementById('discovery-success').style.display = 'block';
    });
  }

  // ============================================================
  // LEADERBOARD (hash: #leaderboard)
  // ============================================================
  async function loadLeaderboard() {
    // Populate both the standalone and inline leaderboard tables
    var containers = [
      document.getElementById('leaderboard-table-body'),
      document.getElementById('leaderboard-table-body-inline')
    ].filter(Boolean);
    if (!containers.length || !sb) return;
    containers.forEach(function (c) { c.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:var(--space-6);">Loading…</td></tr>'; });

    var _r = await sb.from('profiles')
      .select('display_name, reputation_level, total_validations, total_discoveries, total_hidden_gems')
      .eq('banned', false)
      .order('total_validations', { ascending: false })
      .limit(50);

    if (_r.error || !_r.data || _r.data.length === 0) {
      containers.forEach(function (c) { c.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:var(--space-6);">No community members yet. Be the first!</td></tr>'; });
      return;
    }

    var html = '';
    _r.data.forEach(function (p, i) {
      var levelClass = 'level-' + (p.reputation_level || 'Explorer').toLowerCase();
      html += '<tr>' +
        '<td class="lb-rank">' + (i + 1) + '</td>' +
        '<td class="lb-name">' + escapeHtml(p.display_name || 'DoNexter') + '</td>' +
        '<td><span class="lb-level ' + levelClass + '">' + escapeHtml(p.reputation_level || 'Explorer') + '</span></td>' +
        '<td class="lb-num">' + (p.total_validations || 0) + '</td>' +
        '<td class="lb-num">' + (p.total_discoveries || 0) + '</td>' +
        '<td class="lb-num">' + (p.total_hidden_gems || 0) + '</td>' +
      '</tr>';
    });
    containers.forEach(function (c) { c.innerHTML = html; });
  }

  // ============================================================
  // ADMIN PANEL (hash: #admin)
  // ============================================================
  var adminTab = 'discoveries';

  function setupAdminPanel() {
    var tabs = document.querySelectorAll('.admin-tab-btn');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        adminTab = this.getAttribute('data-tab');
        loadAdminTab();
      });
    });
  }

  async function loadAdminTab() {
    if (!currentProfile || !currentProfile.is_admin || !sb) return;

    if (adminTab === 'discoveries') {
      await loadAdminDiscoveries();
    } else if (adminTab === 'validations') {
      await loadAdminValidations();
    } else if (adminTab === 'users') {
      await loadAdminUsers();
    }
  }

  async function loadAdminDiscoveries() {
    var container = document.getElementById('admin-content');
    if (!container) return;
    container.innerHTML = '<div class="community-loading">Loading pending discoveries…</div>';

    var _r = await sb.from('discoveries').select('*, profiles:submitted_by(display_name)').eq('moderation_status', 'pending').order('created_at', { ascending: false });
    if (_r.error || !_r.data || _r.data.length === 0) {
      container.innerHTML = '<p class="community-empty">No pending discoveries.</p>';
      return;
    }

    var html = '';
    _r.data.forEach(function (d) {
      var submitter = (d.profiles && d.profiles.display_name) ? escapeHtml(d.profiles.display_name) : 'Unknown';
      html += '<div class="admin-item">' +
        '<div class="admin-item__info">' +
          '<strong>' + escapeHtml(d.title) + '</strong>' +
          '<span class="admin-item__meta">by ' + submitter + ' · ' + escapeHtml(d.location_name || '') + '</span>' +
          '<p class="admin-item__desc">' + escapeHtml(d.description || '') + '</p>' +
        '</div>' +
        '<div class="admin-item__actions">' +
          '<button class="btn btn-primary btn-sm" data-approve="' + d.id + '">Approve</button>' +
          '<button class="btn btn-ghost btn-sm" data-reject="' + d.id + '">Reject</button>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;

    // Handlers
    container.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var discId = this.getAttribute('data-approve');
        await approveDiscovery(discId);
      });
    });
    container.querySelectorAll('[data-reject]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var discId = this.getAttribute('data-reject');
        await moderateItem('discovery', discId, 'rejected');
      });
    });
  }

  async function approveDiscovery(discId) {
    // Fetch the discovery
    var _r = await sb.from('discoveries').select('*').eq('id', discId).single();
    if (_r.error || !_r.data) return;
    var d = _r.data;

    // Create activity from it
    var _act = await sb.from('activities').insert({
      city_id: d.city_id,
      title: d.title,
      description: d.description,
      location_name: d.location_name,
      address: d.address,
      cost_text: d.cost_text,
      age_range: d.age_range,
      tags: d.tags,
      booking_url: d.booking_url,
      discovered_by: d.submitted_by,
      moderation_status: 'approved',
      validation_count: 0,
      weighted_score: 0
    }).select().single();

    if (_act.data) {
      // Update discovery
      await sb.from('discoveries').update({
        moderation_status: 'approved',
        promoted_to_activity_id: _act.data.id
      }).eq('id', discId);
    } else {
      await sb.from('discoveries').update({ moderation_status: 'approved' }).eq('id', discId);
    }

    // Log
    await sb.from('moderation_log').insert({
      admin_id: currentUser.id,
      action: 'approved',
      target_type: 'discovery',
      target_id: discId
    });

    loadAdminDiscoveries();
  }

  async function moderateItem(targetType, targetId, action, reason) {
    if (targetType === 'discovery') {
      await sb.from('discoveries').update({ moderation_status: action }).eq('id', targetId);
    } else if (targetType === 'validation') {
      await sb.from('validations').delete().eq('id', targetId);
    }

    await sb.from('moderation_log').insert({
      admin_id: currentUser.id,
      action: action,
      target_type: targetType,
      target_id: targetId,
      reason: reason || null
    });

    loadAdminTab();
  }

  async function loadAdminValidations() {
    var container = document.getElementById('admin-content');
    if (!container) return;
    container.innerHTML = '<div class="community-loading">Loading recent validations…</div>';

    var _r = await sb.from('validations').select('*, profiles:user_id(display_name), activities:activity_id(title)').order('created_at', { ascending: false }).limit(50);
    if (_r.error || !_r.data || _r.data.length === 0) {
      container.innerHTML = '<p class="community-empty">No validations yet.</p>';
      return;
    }

    var html = '';
    _r.data.forEach(function (v) {
      var user = (v.profiles && v.profiles.display_name) ? escapeHtml(v.profiles.display_name) : 'Unknown';
      var activity = (v.activities && v.activities.title) ? escapeHtml(v.activities.title) : 'Unknown Activity';
      html += '<div class="admin-item">' +
        '<div class="admin-item__info">' +
          '<strong>' + user + '</strong> validated <em>' + activity + '</em>' +
          '<span class="admin-item__meta">' + formatDate(v.created_at) + '</span>' +
          (v.comment ? '<p class="admin-item__desc">' + escapeHtml(v.comment) + '</p>' : '') +
        '</div>' +
        '<div class="admin-item__actions">' +
          '<button class="btn btn-ghost btn-sm" data-remove-validation="' + v.id + '">Remove</button>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-remove-validation]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var valId = this.getAttribute('data-remove-validation');
        await moderateItem('validation', valId, 'removed');
      });
    });
  }

  async function loadAdminUsers() {
    var container = document.getElementById('admin-content');
    if (!container) return;
    container.innerHTML = '<div class="community-loading">Loading users…</div>';

    var _r = await sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
    if (_r.error || !_r.data || _r.data.length === 0) {
      container.innerHTML = '<p class="community-empty">No users found.</p>';
      return;
    }

    var html = '';
    _r.data.forEach(function (p) {
      var banLabel = p.banned ? 'Unban' : 'Ban';
      var banClass = p.banned ? 'btn-primary' : 'btn-ghost';
      html += '<div class="admin-item">' +
        '<div class="admin-item__info">' +
          '<strong>' + escapeHtml(p.display_name || 'Unknown') + '</strong>' +
          '<span class="admin-item__meta">' + escapeHtml(p.reputation_level || 'Explorer') + ' · ' + (p.total_validations || 0) + ' validations' + (p.banned ? ' · BANNED' : '') + '</span>' +
        '</div>' +
        '<div class="admin-item__actions">' +
          '<button class="btn ' + banClass + ' btn-sm" data-toggle-ban="' + p.id + '" data-banned="' + (p.banned ? '1' : '0') + '">' + banLabel + '</button>' +
        '</div>' +
      '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-toggle-ban]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var userId = this.getAttribute('data-toggle-ban');
        var isBanned = this.getAttribute('data-banned') === '1';
        await sb.from('profiles').update({ banned: !isBanned }).eq('id', userId);
        await sb.from('moderation_log').insert({
          admin_id: currentUser.id,
          action: isBanned ? 'unbanned' : 'banned',
          target_type: 'user',
          target_id: userId
        });
        loadAdminUsers();
      });
    });
  }

  // ============================================================
  // COMMUNITY TABS (Activities / Leaderboard)
  // ============================================================
  function setupCommunityTabs() {
    var tabs = document.querySelectorAll('.community-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = this.getAttribute('data-tab');
        tabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');
        document.querySelectorAll('.community-tab-panel').forEach(function (p) {
          p.classList.remove('active');
        });
        var panel = document.querySelector('[data-tab-panel="' + target + '"]');
        if (panel) panel.classList.add('active');
        // Load leaderboard data when tab is first shown
        if (target === 'leaderboard') loadLeaderboard();
      });
    });
  }

  function switchCommunityTab(tabName) {
    var tab = document.querySelector('.community-tab[data-tab="' + tabName + '"]');
    if (tab) tab.click();
  }

  // ============================================================
  // NAV VISIBILITY — hide city items on landing page
  // ============================================================
  function updateCityNavVisibility(viewName) {
    // Only target nav links in the header and mobile nav, NOT city cards on the homepage
    var headerNav = document.querySelector('.nav-links');
    var mobileNav = document.getElementById('mobile-nav');
    var isHome = (!viewName || viewName === 'home' || viewName === 'about' || viewName === 'join');

    [headerNav, mobileNav].forEach(function (nav) {
      if (!nav) return;
      nav.querySelectorAll('[data-nav="cardiff"], [data-nav="community"]').forEach(function (link) {
        var container = link.closest('li') || link;
        container.style.display = isHome ? 'none' : '';
      });
    });
  }

  // ============================================================
  // ROUTING INTEGRATION
  // ============================================================
  function handleCommunityRoutes() {
    var hash = window.location.hash.replace('#', '');

    // Redirect #leaderboard to community view with leaderboard tab
    if (hash === 'leaderboard') {
      window.location.hash = '#cardiff/community';
      setTimeout(function () { switchCommunityTab('leaderboard'); }, 100);
      return true;
    }

    // Community views mapping
    var communityViews = {
      'cardiff/community': 'view-community',
      'discover': 'view-discover',
      'admin': 'view-admin'
    };

    // Check for activity detail route
    var activityMatch = hash.match(/^activity\/(.+)$/);

    var matchedView = null;
    var matchedKey = null;

    if (activityMatch) {
      matchedView = 'view-activity';
      matchedKey = 'activity';
    } else if (communityViews[hash]) {
      matchedView = communityViews[hash];
      matchedKey = hash;
    }

    if (!matchedView) return false; // Not a community route

    // Hide all views (including original ones)
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.remove('active');
    });

    // Show community view
    var el = document.getElementById(matchedView);
    if (el) {
      el.classList.add('active');

      // Update nav active states
      document.querySelectorAll('[data-nav]').forEach(function (link) {
        link.classList.remove('active');
      });
      document.querySelectorAll('[data-nav="community"]').forEach(function (link) {
        link.classList.add('active');
      });

      // Show city nav items when in a city view
      updateCityNavVisibility('cardiff');
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Close mobile nav
    var mobileNav = document.getElementById('mobile-nav');
    var mobileBtn = document.getElementById('mobile-menu-btn');
    if (mobileNav) mobileNav.classList.remove('open');
    if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');

    // Load view data
    if (matchedKey === 'cardiff/community') {
      loadCommunityView();
    } else if (matchedKey === 'activity' && activityMatch) {
      loadActivityDetail(activityMatch[1]);
    } else if (matchedKey === 'discover') {
      if (!currentUser) {
        showAuthModal('Sign in to submit a discovery');
        window.location.hash = '#home';
        return true;
      }
    } else if (matchedKey === 'admin') {
      if (!currentProfile || !currentProfile.is_admin) {
        window.location.hash = '#home';
        return true;
      }
      loadAdminTab();
    }

    // Update page title
    var titles = {
      'cardiff/community': 'DoNext Cardiff — Community Activities',
      'activity': 'Activity Detail — DoNext',
      'discover': 'Submit a Discovery — DoNext',
      'admin': 'Admin Panel — DoNext'
    };
    document.title = titles[matchedKey] || 'DoNext — Never run out of ideas';

    return true;
  }

  // Patch into existing routing
  function patchRouting() {
    // Override hashchange to check community routes first
    var origOnHashChange = function () {
      if (!handleCommunityRoutes()) {
        // Fall through to existing routing — trigger re-evaluation
        var hash = window.location.hash.replace('#', '');
        var views = {
          home: document.getElementById('view-home'),
          cardiff: document.getElementById('view-cardiff'),
          about: document.getElementById('view-about'),
          join: document.getElementById('view-join')
        };
        var viewName = (hash && views[hash]) ? hash : 'home';

        document.querySelectorAll('.view').forEach(function (v) {
          v.classList.remove('active');
        });
        if (views[viewName]) views[viewName].classList.add('active');

        document.querySelectorAll('[data-nav]').forEach(function (link) {
          link.classList.toggle('active', link.getAttribute('data-nav') === viewName);
        });

        // Hide city-specific nav items on home page
        updateCityNavVisibility(viewName);

        // Load daily report when Cardiff view is shown
        if (viewName === 'cardiff') loadDailyReport();

        window.scrollTo({ top: 0, behavior: 'instant' });

        var mobileNav = document.getElementById('mobile-nav');
        var mobileBtn = document.getElementById('mobile-menu-btn');
        if (mobileNav) mobileNav.classList.remove('open');
        if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');

        var pageTitles = {
          home:    'DoNext — Cardiff kids’ weekend plans',
          cardiff: 'DoNext Cardiff — Family Events this Week',
          about: 'About DoNext — Built by parents, for parents',
          join: 'Join DoNext Club — Coming Soon'
        };
        document.title = pageTitles[viewName] || pageTitles.home;
      }
    };

    window.addEventListener('hashchange', origOnHashChange);

    // Handle community nav link clicks
    document.querySelectorAll('[data-community-nav]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var target = this.getAttribute('data-community-nav');
        window.history.pushState(null, '', '#' + target);
        origOnHashChange();
      });
    });

    // Check on initial load
    setTimeout(function () {
      handleCommunityRoutes();
      // Set initial nav visibility
      var initHash = window.location.hash.replace('#', '') || 'home';
      updateCityNavVisibility(initHash);
      // Load daily report if we're on the Cardiff view
      if (initHash === 'cardiff') loadDailyReport();
    }, 200);
  }

  // ============================================================
  // CARDIFF CATALOG — data/cardiff-today.json via cardiff-catalog.js
  // ============================================================
  function loadDailyReport() {
    if (window.DoNextCatalog && typeof window.DoNextCatalog.load === 'function') {
      return window.DoNextCatalog.load();
    }
    var content = document.getElementById('cardiff-report-content');
    if (content) {
      content.innerHTML = '<p class="report-error">Catalog script missing. Ensure cardiff-catalog.js is loaded.</p>';
    }
  }

  window._donextLoadReport = loadDailyReport;

  // ============================================================
  // (legacy multi-day report helpers removed — catalog is JSON-driven)

  // ============================================================
  // DUAL PANEL TABS (Report / Planner toggle on mobile)
  // ============================================================
  function setupDualPanelTabs() {
    var tabs = document.querySelectorAll('.dual-panel-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = this.getAttribute('data-panel');
        tabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');
        document.querySelectorAll('.dual-panel-card').forEach(function (p) {
          p.classList.remove('active');
        });
        var panel = document.querySelector('[data-panel-content="' + target + '"]');
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return dateStr; }
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    initSupabase();
    setupUserDropdown();
    setupFilterChips();
    setupDiscoveryForm();
    setupAdminPanel();
    setupCommunityTabs();
    setupDualPanelTabs();
    patchRouting();
    loadDailyReport();

    // Sign in button handler
    var signInBtn = document.getElementById('auth-signin-btn');
    if (signInBtn) {
      signInBtn.addEventListener('click', function (e) {
        e.preventDefault();
        showAuthModal();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
