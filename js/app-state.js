/**
 * js/app-state.js — Mutable application state
 *
 * Centralises all global mutable state: project data, selection,
 * active tool, view mode, zoom/pan, interaction state, history,
 * and canvas references. Other modules read and write via
 * `Atelier.state`.
 *
 * Depends on: utilities.js, project-model.js
 */
(function () {
  'use strict';
  const A = window.Atelier;
  const { deep, normalizeProject, DEFAULT } = A;

  // ── Persistence helper (inline, used only at init) ───────────
  function loadProject() {
    try {
      const raw = localStorage.getItem('atelier-plan-project');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // ── Core mutable state ───────────────────────────────────────
  const state = {
    project:   normalizeProject(loadProject() || deep(DEFAULT)),
    selected:  null,
    selectedIds: new Set(),
    tool:      'select',
    viewMode:  'plan',
    scale:     .55,
    offset:    { x: 60, y: 65 },
    interaction: null,
    history:   [],
    future:    [],
    copyBuffer: [],
    saveTimer: null,
    toastTimer: null,
    snapGuides: [],
    // Canvas & stage references — assigned after DOM ready
    canvas: null,
    ctx: null,
    stage: null
  };

  // ── Convenience accessors ────────────────────────────────────
  function floor() { return state.project.floors[state.project.activeFloor]; }
  function isRoof(o) { return (o.shape || o.type) === 'roof'; }
  function isRoofVisibleInPlan(o) {
    if (!isRoof(o)) return true;
    return state.project?.camera?.planRoofMode !== 'hidden';
  }
  function allEntities(f = floor()) {
    if (!f) return [];
    return [...f.rooms, ...f.walls, ...f.items, ...f.dimensions, ...(f.columns || []), ...(f.beams || [])];
  }
  function findEntity(id) { return allEntities().find(o => o.id === id); }

  // ── Coordinate transforms ────────────────────────────────────
  function worldToScreen(p) { return { x: p.x * state.scale + state.offset.x, y: p.y * state.scale + state.offset.y }; }
  function screenToWorld(p) { return { x: (p.x - state.offset.x) / state.scale, y: (p.y - state.offset.y) / state.scale }; }
  function pointerPos(e) {
    const c = state.canvas || (typeof document !== 'undefined' && (document.getElementById('planCanvas') || document.getElementById('canvas')));
    if (!c) return { x: e.clientX, y: e.clientY };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── History ──────────────────────────────────────────────────
  function checkpoint() {
    state.history.push(JSON.stringify(state.project));
    if (state.history.length > 40) state.history.shift();
    state.future = [];
  }

  Object.assign(A, {
    state,
    loadProject,
    floor,
    isRoof,
    isRoofVisibleInPlan,
    allEntities,
    findEntity,
    worldToScreen,
    screenToWorld,
    pointerPos,
    checkpoint
  });
})();
