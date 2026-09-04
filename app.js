/**
 * DoNext Cardiff — lean page bootstrap.
 * Catalog rendering lives in cardiff-catalog.js.
 */
(function () {
  'use strict';
  function boot() {
    if (window.DoNextCatalog) DoNextCatalog.load();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
