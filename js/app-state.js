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
    if (A.readOnly) return null;
    try {
      const raw = localStorage.getItem(A.storagePrefix+'project');
      return raw ? A.validateProject(JSON.parse(raw)) : null;
    } catch { return null; }
  }

  // ── Core mutable state ───────────────────────────────────────
  const restoredProject=loadProject();
  const state = {
    project:   normalizeProject(restoredProject || deep(DEFAULT)),
    isFreshProject: !restoredProject,
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
    return [...f.rooms, ...f.walls, ...f.items, ...f.dimensions, ...(f.columns || []), ...(f.beams || []),...(f.slabs||[]),...(f.loads||[]),...(f.structuralWalls||[]),...(f.grids||[])];
  }
  const entityIndexes=new WeakMap();
  function findEntity(id) {
    const f=floor();if(!f||!id)return undefined;
    const collections=['rooms','walls','items','dimensions','columns','beams','slabs','loads','structuralWalls','grids'].map(key=>f[key]||null);
    let index=entityIndexes.get(f);
    if(!index||collections.some((list,i)=>list!==index.collections[i]||(list?.length||0)!==index.lengths[i])){
      index={collections,lengths:collections.map(list=>list?.length||0),entities:new Map(collections.flatMap(list=>list||[]).map(o=>[o.id,o]))};entityIndexes.set(f,index);
    }
    return index.entities.get(id);
  }
  function canTransform(o) { return !A.readOnly&&!!o&&!o.locked&&!o.boundaryWallIds; }
  function updateModelRelationships() { A.syncStructuralJoints?.();A.syncArchitecture?.();const f=floor();if(!state.pointerBackup&&f&&((f.columns||[]).length||(f.beams||[]).length))A.analyzeStructure?.(f,state.project); }

  function armEdit() {
    if(!state.pointerBackup)state.pointerBackup={project:null,offset:{...state.offset},scale:state.scale};
    return state.pointerBackup;
  }
  function beginEdit() {
    if(state.pointerBackup?.project)return state.pointerBackup;
    settleCheckpoint();
    state.pointerBackup={...armEdit(),project:JSON.stringify(state.project),history:[...state.history],future:[...state.future]};
    return state.pointerBackup;
  }
  function commitEdit() {
    const backup=state.pointerBackup;
    if(!backup)return false;
    state.pointerBackup=null;
    if(backup.project===null){if(state.saveDeferred)A.resumeSave?.();return false;}
    updateModelRelationships();
    if(backup.project===JSON.stringify(state.project)){if(state.saveDeferred)A.resumeSave?.();return false;}
    state.history=[...backup.history];
    if(state.history.at(-1)!==backup.project)state.history.push(backup.project);
    if(state.history.length>40)state.history.shift();
    state.future=[];A.queueSave?.();return true;
  }
  let drawFrame=null;
  function requestDraw(){
    if(typeof requestAnimationFrame!=='function'){if(state.pointerBackup?.project)updateModelRelationships();A.draw();return;}
    if(drawFrame!==null)return;
    drawFrame=requestAnimationFrame(()=>{drawFrame=null;if(state.pointerBackup?.project)updateModelRelationships();A.draw();});
  }
  function cancelScheduledDraw(){if(drawFrame!==null){cancelAnimationFrame(drawFrame);drawFrame=null;}}

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
    if(A.readOnly)return;
    // Pointer edits are committed on release, after comparing their result.
    if (state.pointerBackup) return;
    if (state.editSession?.checkpointed) return;
    const snapshot = JSON.stringify(state.project);
    if (state.history.at(-1) === snapshot) return;
    state.pendingCheckpoint={snapshot,history:[...state.history],future:[...state.future]};
    state.history.push(snapshot);
    if (state.history.length > 40) state.history.shift();
    state.future = [];
  }

  function settleCheckpoint() {
    const pending=state.pendingCheckpoint;
    if(!pending)return;
    if(pending.snapshot===JSON.stringify(state.project)){
      state.history=pending.history;state.future=pending.future;
      if(state.editSession)state.editSession.checkpointed=false;
    }
    state.pendingCheckpoint=null;
  }

  Object.assign(A, {
    state,
    loadProject,
    floor,
    isRoof,
    isRoofVisibleInPlan,
    allEntities,
    findEntity,
    canTransform, armEdit, beginEdit, commitEdit, updateModelRelationships,
    requestDraw, cancelScheduledDraw,
    worldToScreen,
    screenToWorld,
    pointerPos,
    checkpoint, settleCheckpoint
  });
})();
