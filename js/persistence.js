/**
 * js/persistence.js — Save, load, export, import, and notifications
 *
 * Handles localStorage persistence, JSON export/import,
 * autosave debouncing, toast messages, and hint overlays.
 *
 * Depends on: utilities.js, app-state.js
 */
(function () {
  'use strict';
  const A = window.Atelier;
  function S() { return A.state; }
  let savedSnapshot=JSON.stringify(S().project);

  // ── Toast / hint notifications ───────────────────────────────
  function showToast(msg) {
    const t=A.$('#toast');t.textContent=msg;t.classList.add('show');
    clearTimeout(S().toastTimer);S().toastTimer=setTimeout(()=>t.classList.remove('show'),2200);
  }

  function showHint(msg) {
    const h=A.$('#hint');h.textContent=msg;h.classList.add('show');
    setTimeout(()=>h.classList.remove('show'),1800);
  }

  // ── Save / Load ──────────────────────────────────────────────
  function saveProject() {
    if(A.readOnly)return;
    const s=S();
    if(s.pointerBackup){s.saveDeferred=true;return;}
    A.updateModelRelationships?.();
    A.settleCheckpoint();
    clearTimeout(s.saveTimer);s.saveTimer=null;
    s.project.name=s.project.name.trim()||'Untitled project';
    s.project.projectId ||= A.uid();
    try {
      const snapshot=JSON.stringify(s.project);
      localStorage.setItem(A.storagePrefix+'project',snapshot);
      A.recordProject?.();
      savedSnapshot=snapshot;
      A.$('#saveState').textContent='Saved locally';showToast('Project saved in this browser');
      A.$('#saveState').style.setProperty('--dot','#29a978');
    } catch {
      A.$('#saveState').textContent='Browser storage unavailable';showToast('Use Export JSON to keep this project');
    }
  }

  function queueSave() {
    if(A.readOnly)return;
    const s=S();
    if(s.pointerBackup){s.saveDeferred=true;return;}
    A.updateModelRelationships?.();
    A.settleCheckpoint();
    clearTimeout(s.saveTimer);
    s.saveTimer=null;
    if(JSON.stringify(s.project)===savedSnapshot){
      A.$('#saveState').textContent='Saved locally';
      A.$('#saveState').style.setProperty('--dot','#29a978');
      return;
    }
    A.$('#saveState').textContent='Unsaved changes';
    A.requestDraw?.();
    A.$('#saveState').style.setProperty('--dot','#ca7a3b');
    s.saveTimer=setTimeout(()=>{
      s.saveTimer=null;
      if(JSON.stringify(s.project)!==savedSnapshot)saveProject();
    },650);
  }

  function flushSave() {
    if(A.readOnly)return;
    if(S().pointerBackup)A.cancelInteraction?.();
    clearTimeout(S().saveTimer);S().saveTimer=null;
    if(JSON.stringify(S().project)!==savedSnapshot)saveProject();
  }
  function resumeSave(){S().saveDeferred=false;queueSave();}

  // ── Export / Import ──────────────────────────────────────────
  function exportProject() {
    saveProject();
    const blob=new Blob([JSON.stringify(S().project,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download=`${S().project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'atelier-plan'}.json`;
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showToast('JSON project downloaded');
  }

  function importProject(file) {
    if (file.size > 20 * 1024 * 1024) { showToast('Project files must be under 20 MB'); return; }
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const p=A.normalizeProject(A.validateProject(JSON.parse(reader.result)));
        A.checkpoint();const s=S();s.project=p;
        s.selected=null;s.selectedIds.clear();A.fitPlan();A.syncUI();saveProject();showToast('Project imported');
      } catch(err) { showToast(`Import failed: ${err.message}`); }
    };
    reader.onerror=()=>showToast('Could not read this project file');
    reader.readAsText(file);
  }

  function loadSampleProject() {
    A.checkpoint();const s=S();
    const sample=window.ATELIER_REFERENCE_LAYOUT?A.deep(window.ATELIER_REFERENCE_LAYOUT):A.deep(A.DEFAULT);
    s.project=A.normalizeProject(sample);
    s.selected=null;s.selectedIds.clear();
    A.fitPlan();A.syncUI();saveProject();showToast('Sample layout loaded');
  }

  Object.assign(A, {
    showToast, showHint,
    saveProject, queueSave, flushSave, resumeSave,
    exportProject, importProject, loadSampleProject
  });
})();
