/** Shared-layout viewer policy. Loaded after all editor wrappers. */
(function () {
  'use strict';
  const A=window.Atelier;
  A.loadSharedLayout=async function () {
    const path=new URLSearchParams(location.search).get('layout');
    let project=A.deep(window.ATELIER_REFERENCE_LAYOUT||A.DEFAULT);
    if(path){
      const url=new URL(path,location.href);
      if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))throw new Error('Layout must be hosted on this site');
      const response=await fetch(url);
      if(!response.ok)throw new Error('Layout file unavailable ('+response.status+')');
      const raw=await response.text();
      if(raw.length>20*1024*1024)throw new Error('Layout exceeds 20 MB');
      project=JSON.parse(raw);
    }
    A.state.project=A.normalizeProject(A.validateProject(project));
    A.state.isFreshProject=false;
  };
  A.initReadOnly=function () {
    if(!A.readOnly)return;
    const oldTool=A.setTool;
    A.setTool=()=>oldTool('pan');
    A.setTool('pan');
    // Explicit navigation allowlist: newly added editor controls default to disabled.
    const ids=new Set(['studioFloor','fitBtn','gridBtn','structureBtn','floorViewMode',
      'zoomIn','zoomOut','stageZoomIn','stageZoomOut','expandCanvas','helpBtn','menuHelp',
      'mobileMenuBtn','closeHelp','closeHelpHeader','closeCatalogBtn','closeInspectorBtn',
      'structInteriorToggle','drawingScale','exportSvgBtn','exportPdfBtn','printPlanBtn']);
    function allowed(el){return ids.has(el.id)||el.id.startsWith('reveal-')||
      el.matches('[data-view],[data-workspace],[data-sheet-tab],[data-nav],[data-library],.chrome-hide,[data-tool="pan"]');}
    function refresh(){
      document.querySelectorAll('button,input,select,textarea').forEach(el=>{
        if(!allowed(el)&&!el.disabled){el.disabled=true;el.dataset.viewerDisabled='true';}
      });
      document.querySelectorAll('[draggable="true"]').forEach(el=>el.draggable=false);
      const status=document.querySelector('#saveState');
      if(status&&status.textContent!=='Read-only · shared layout')status.textContent='Read-only · shared layout';
    }
    for(const type of ['pointerdown','click','input','change','dragstart','drop','dblclick'])document.addEventListener(type,event=>{
      const control=event.target.closest('button,input,select,textarea,[draggable]');
      if(type==='drop'||(control&&!allowed(control))){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    window.addEventListener('keydown',event=>{
      // Keep browser navigation, tab focus and viewer activation; block editor shortcuts.
      if(['Tab','Escape','Shift','Control','Alt','Meta'].includes(event.key)||
        (['Enter',' '].includes(event.key)&&allowed(event.target)))return;
      event.stopImmediatePropagation();
      if(event.ctrlKey||event.metaKey||['Delete','Backspace','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))event.preventDefault();
    },true);
    new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});
    refresh();
  };
})();
