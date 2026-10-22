(function () {
  'use strict';
  const A=window.Atelier;
  const lengthKeys=new Set(['w','d','x','y','x1','y1','x2','y2','height','elevation','wallOffset','ceilingHeight','thickness','clearance','stairWidth','stairLandingMin','stairPlatformLength','stairTargetRiser','landingDepth','landingWidth','landingLength','width','depth','footingWidth','footingDepth','footingThickness']);
  function cancelInteraction() {
    const s=A.state, backup=s.pointerBackup;
    if(backup){if(backup.project!==null){s.project=JSON.parse(backup.project);s.history=backup.history;s.future=backup.future;}s.offset=backup.offset;s.scale=backup.scale;}
    s.interaction=null;s.pointerBackup=null;s.snapGuides=[];s.pointerOwner=null;s.nudgeActive=false;
    A.cancelScheduledDraw?.();
    if(s.saveDeferred)A.resumeSave?.();
    A.syncUI();A.showHint('Edit canceled');
  }
  function initEditingSupport() {
    const s=A.state;
    document.addEventListener('change',e=>{if(e.target.id==='studioFloor'){if(s.pointerBackup)A.cancelInteraction();if(document.querySelector('#serviceRouteBar'))A.stopServiceRoute?.();s.routeEditing=null;}},true);
    document.addEventListener('focusin',e=>{
      if(e.target.matches('input,select,textarea'))s.editSession={element:e.target,checkpointed:false};
    });
    document.addEventListener('focusout',()=>{s.editSession=null;});
    function captureEdit(e){
      const el=e.target;
      if(el.id==='unitSelect'||el.id?.startsWith('site-')||el.closest('[data-project-settings]')||el.id==='copyTargetFloor')return;
      if(['moveConstraint','moveDistance','moveKeyboardInput','moveKeyboardStep'].includes(el.id))return;
      if(el.closest('[data-structural-editor]'))return;
      if(el.id?.startsWith('service')||el.id==='routeDrawElevation')return;
      if(['stairStartSide','stairHandedness'].includes(el.id)||A.findEntity(s.selected)?.shape==='three-side-stairs'&&['w','d','height','stairWidth','stairLandingMin','stairPlatformLength','stairTargetRiser'].includes(el.dataset.key))return;
      if(!el.matches('input,select,textarea')||el.disabled||el.type==='file'||['catalogSearch','objectSearch','treeSearch','commandSearch','drawingScale','gridAlignToleranceRange','uniformScale','groupScale','routeScaleMode','studioFloor','categorySelect'].includes(el.id))return;
      const key=el.dataset.key;
      const isLength=lengthKeys.has(key)||['builtUpWidthInput','builtUpDepthInput','newFloorElevation'].includes(el.id);
      if(e.type==='input'&&(isLength||el.type==='number'))return;
      if(e.type==='change'&&(isLength||el.type==='number')){
        const n=isLength?A.toCm(el.value):Number(el.value);
        const positive=isLength&&!['x','y','x1','y1','x2','y2','elevation','clearance'].includes(key)&&el.id!=='newFloorElevation';
        if(!Number.isFinite(n)||(positive&&n<=0)||(key==='clearance'&&n<0)){
          e.stopImmediatePropagation();el.setCustomValidity(positive?'Enter a positive length.':'Enter a valid measurement.');el.reportValidity();
          A.showToast('Invalid measurement — project unchanged');return;
        }
      }
      el.setCustomValidity('');
      if(!el.closest('#floorModal')){
        if(s.editSession?.element!==el)s.editSession={element:el,checkpointed:false};
        A.checkpoint();s.editSession.checkpointed=true;
      }
    }
    document.addEventListener('input',e=>{e.target.setCustomValidity?.('');captureEdit(e);},true);
    document.addEventListener('change',captureEdit,true);
    document.addEventListener('click',e=>{if(e.target.closest('.switch'))A.checkpoint();},true);
  }
  Object.assign(A,{cancelInteraction,initEditingSupport,lengthKeys});
})();
