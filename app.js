/**
 * DoNext — city-aware page bootstrap.
 * Catalog rendering lives in cardiff-catalog.js.
 */
(function () {
  'use strict';
  function boot() {
    if (window.DoNextCatalog) {
      window.DoNextCatalog.load({ city: document.body && document.body.getAttribute('data-city') });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
