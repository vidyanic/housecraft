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
    const s=S();
    s.project.name=s.project.name.trim()||'Untitled project';
    s.project.projectId ||= A.uid();
    try {
      localStorage.setItem(A.storagePrefix+'project',JSON.stringify(s.project));
      A.recordProject?.();
      A.$('#saveState').textContent='Saved locally';showToast('Project saved in this browser');
      A.$('#saveState').style.setProperty('--dot','#29a978');
    } catch {
      A.$('#saveState').textContent='Browser storage unavailable';showToast('Use Export JSON to keep this project');
    }
  }

  function queueSave() {
    const s=S();
    clearTimeout(s.saveTimer);
    A.$('#saveState').textContent='Unsaved changes';
    A.$('#saveState').style.setProperty('--dot','#ca7a3b');
    s.saveTimer=setTimeout(saveProject,650);
  }

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
    saveProject, queueSave,
    exportProject, importProject, loadSampleProject
  });
})();
