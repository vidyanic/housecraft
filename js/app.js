/**
 * js/app.js — Application bootstrap
 *
 * Entry point. All modules have been loaded by the time this
 * runs. Calls `Atelier.initUI()` to wire up the DOM, render
 * the catalog, and kick off the first draw.
 */
(function () {
  'use strict';

  async function boot() {
    const A = window.Atelier;
    const s = A?.state;
    if(A.readOnly) {
      try { await A.loadSharedLayout(); }
      catch(error) {
        document.body.textContent='Shared layout could not be opened: '+error.message;
        return;
      }
    }
    // Render the catalog and boot the app
    A.renderCatalog();
    A.initUI();
    A.initStructuralWorkspace?.();
    A.initStudioUI?.();
    A.initCanvasSpace?.();
    const params=new URLSearchParams(location.search);
    const tab=params.get('tab')||params.get('view');
    if(tab==='3d')A.setView('3d');
    else if(['architecture','structure','services'].includes(tab))A.setWorkspace(tab);
    A.initReadOnly?.();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
