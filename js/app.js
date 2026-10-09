/**
 * js/app.js — Application bootstrap
 *
 * Entry point. All modules have been loaded by the time this
 * runs. Calls `Atelier.initUI()` to wire up the DOM, render
 * the catalog, and kick off the first draw.
 */
(function () {
  'use strict';

  function boot() {
    const A = window.Atelier;
    const s = A?.state;
    // Render the catalog and boot the app
    A.renderCatalog();
    A.initUI();
    A.initStructuralWorkspace?.();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
