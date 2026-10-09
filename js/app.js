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
    // Auto-frame initial layout if no columns exist yet
    if (s && s.isFreshProject && s.project && typeof A.autoGenerateFraming === 'function') {
      s.project.floors.forEach(f => {
        if ((!f.columns || f.columns.length === 0) && f.walls && f.walls.length > 0) {
          A.autoGenerateFraming(f, s.project);
        }
      });
    }
    // Render the catalog and boot the app
    A.renderCatalog();
    A.initUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
