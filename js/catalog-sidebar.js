/**
 * js/catalog-sidebar.js — Left-side catalog panel UI
 *
 * Renders the object catalog grid with thumbnails, category
 * filtering, search, drag-start handlers, and click-to-add.
 *
 * Depends on: utilities.js, app-state.js, canvas-drawing.js,
 *             pointer-interaction.js
 */
(function () {
  'use strict';
  const A = window.Atelier;
  function S() { return A.state || {}; }

  // ── Thumbnail cache & generator ──────────────────────────────
  const thumbCache = new Map();

  function makeThumb(spec) {
    if(thumbCache.has(spec.type)) return thumbCache.get(spec.type);
    const W=100, H=68, dpr=Math.min(2,devicePixelRatio||1), cv=document.createElement('canvas');
    cv.width=W*dpr; cv.height=H*dpr;
    const c=cv.getContext('2d'); c.scale(dpr,dpr);
    const o={...spec, rotation:0, transparency:0, active:spec.active};
    const pad=14, sc=Math.min((W-pad*2)/Math.max(spec.w,1),(H-pad*2)/Math.max(spec.d,1),spec.system?3.5:0.55);
    c.translate(W/2, H/2); c.scale(sc,sc);
    const prev = S().scale !== undefined ? S().scale : 1;
    if (A.state) S().scale = sc;
    try { A.furnitureSymbol(o,c); } catch(_) { c.fillStyle='#dfe3de'; c.fillRect(-spec.w/2,-spec.d/2,spec.w,spec.d); }
    if (A.state) S().scale = prev;
    const url=cv.toDataURL(); thumbCache.set(spec.type,url); return url;
  }

  // ── Card HTML builder ────────────────────────────────────────
  const catCardHtml = x =>
    `<div class="object-card" role="button" tabindex="0" aria-label="Add ${x.name}" draggable="true" data-object="${x.type}" title="Tap to add · Drag onto plan">` +
    `<div class="object-icon"><img src="${makeThumb(x)}" alt=""></div>` +
    `<span>${x.name}</span>` +
    `<small>${A.formatLength(x.w)} × ${A.formatLength(x.d)}</small></div>`;

  // ── Main catalog renderer ────────────────────────────────────
  let activeCategoryFilter = 'all';

  function renderCatalog(filter = '', category = activeCategoryFilter) {
    activeCategoryFilter = category;
    const f = filter.toLowerCase();
    const visible=x=>(S().workspace!=='services'||!!x.system)&&(category==='all'||x.category===category)&&x.name.toLowerCase().includes(f);
    const items = A.CATALOG.filter(visible);
    A.$('#catalogCount').textContent = `${items.length} item${items.length===1?'':'s'}`;

    let html = '';
    if (category === 'all') {
      A.CATEGORY_META.forEach(([key, label]) => {
        const group = items.filter(x => x.category===key);
        if(!group.length) return;
        html += `<div class="cat-group-head">${label}<span>${group.length}</span></div><div class="object-grid">${group.map(catCardHtml).join('')}</div>`;
      });
      if(!html) html='<p style="color:var(--muted);font-size:11px;padding:8px 2px">No objects match your search.</p>';
    } else {
      html = `<div class="object-grid">${items.map(catCardHtml).join('')}</div>`;
    }
    A.$('#objectGrid').innerHTML = html;

    // Wire drag + click handlers
    A.$$('.object-card').forEach(el => {
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('application/x-atelier-object', el.dataset.object);
        e.dataTransfer.setData('text/plain', el.dataset.object);
        e.dataTransfer.effectAllowed = 'copy';
      });
      el.addEventListener('click', () => A.addObjectToPlan(el.dataset.object));
      el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();A.addObjectToPlan(el.dataset.object);}});
    });

    // Sync pill + dropdown state
    A.$$('#categoryPills .cat-pill').forEach(pill => pill.classList.toggle('active', pill.dataset.cat === category));
    const sel = A.$('#categorySelect');
    if(sel && sel.value !== category) sel.value = category;
  }

  Object.assign(A, { makeThumb, renderCatalog });
})();
