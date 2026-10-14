/**
 * js/ui-wiring.js — DOM event wiring, keyboard shortcuts, panels
 *
 * Binds all toolbar buttons, keyboard shortcuts, pointer events
 * on the canvas, panel toggling (catalog/inspector), mobile tabs,
 * floor tabs, zoom controls, resize observer, drag-drop onto
 * stage, and the atelierBridge interface.
 *
 * Depends on: all other modules (loaded last before app.js)
 */
(function () {
  'use strict';
  const A = window.Atelier;
  function S() { return A.state; }

  // ── Canvas resize ────────────────────────────────────────────
  function resizeCanvas() {
    const s=S(),canvas=s.canvas,stage=s.stage;
    if(!canvas || !stage) return;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=canvas.clientWidth*dpr;canvas.height=canvas.clientHeight*dpr;
    s.ctx=canvas.getContext('2d');s.ctx.scale(dpr,dpr);A.draw();
  }

  // ── Unit presentation sync ───────────────────────────────────
  function syncUnitPresentation() {
    const project=S().project;
    A.$$('.unit-label').forEach(el=>el.textContent=A.unitLabel());
    A.$('#newFloorElevation')?.setAttribute('placeholder',project.unit==='ft'?'0\'':'0');
  }

  // ── Zoom helpers ─────────────────────────────────────────────
  function updateZoom() {
    const s=S(),text=s.viewMode==='3d'?`${Math.round(s.project.camera.zoom/.56*100)}%`:`${Math.round(s.scale/.55*100)}%`;
    const zl=A.$('#zoomLabel'),szl=A.$('#stageZoomLabel');
    if(zl)zl.textContent=text;if(szl)szl.textContent=text;
  }

  function fitPlan() {
    const s=S();
    if(s.viewMode==='3d'){window.atelier3D?.fitCamera(s.project.camera);updateZoom();return}
    const bounds=A.planBounds(),stage=s.stage,r=stage.getBoundingClientRect(),pad=75;
    s.scale=Math.max(.18,Math.min(1.2,Math.min((r.width-pad*2)/(bounds.maxX-bounds.minX||1),(r.height-pad*2)/(bounds.maxY-bounds.minY||1))));
    s.offset={x:(r.width-(bounds.maxX-bounds.minX)*s.scale)/2-bounds.minX*s.scale,y:(r.height-(bounds.maxY-bounds.minY)*s.scale)/2-bounds.minY*s.scale};
    updateZoom();A.draw();
  }

  function zoomIn() { const s=S();if(s.viewMode==='3d'){s.project.camera.zoom=Math.min(1.4,s.project.camera.zoom*1.15);window.atelier3D?.setCamera(s.project.camera)}else s.scale=Math.min(1.8,s.scale*1.15);updateZoom();A.draw(); }
  function zoomOut(){ const s=S();if(s.viewMode==='3d'){s.project.camera.zoom=Math.max(.000001,s.project.camera.zoom/1.15);window.atelier3D?.setCamera(s.project.camera)}else s.scale=Math.max(.18,s.scale/1.15);updateZoom();A.draw(); }

  // ── Undo / redo ──────────────────────────────────────────────
  function undo() { const s=S();if(s.pointerBackup)A.cancelInteraction();if(!s.history.length)return;s.future.push(JSON.stringify(s.project));s.project=JSON.parse(s.history.pop());s.selected=null;s.selectedIds.clear();syncUI();A.queueSave(); }
  function redo() { const s=S();if(s.pointerBackup)A.cancelInteraction();if(!s.future.length)return;s.history.push(JSON.stringify(s.project));s.project=JSON.parse(s.future.pop());s.selected=null;s.selectedIds.clear();syncUI();A.queueSave(); }

  // ── Floor management ─────────────────────────────────────────
  const orderedFloors = () => [...S().project.floors].sort((a,b)=>a.elevation-b.elevation);
  function floorMeasurement(input) {
    const cm=Number(input.dataset.cm);
    return input.dataset.cm!=null&&input.value===String(A.displayValue(cm))?cm:A.toCm(input.value);
  }
  function finishFloorChange(activeId) {
    A.reconcileStairFloors?.();
    const s=S();s.project.activeFloor=s.project.floors.findIndex(f=>f.id===activeId);
    s.selected=null;s.selectedIds.clear();s.inspectorMode=null;
    window.atelier3D?.requestRebuild();syncUI();A.queueSave();
  }
  function moveFloorLevel(id,direction) {
    if(S().pointerBackup)A.cancelInteraction();
    if(![1,-1].includes(direction))return false;
    const floors=orderedFloors(),i=floors.findIndex(f=>f.id===id),j=i+direction;
    if(i<0||j<0||j>=floors.length||floors[i].elevation===floors[j].elevation)return false;
    const activeId=A.floor().id;A.checkpoint();
    [floors[i].elevation,floors[j].elevation]=[floors[j].elevation,floors[i].elevation];
    S().project.floors.sort((a,b)=>a.elevation-b.elevation);finishFloorChange(activeId);return true;
  }
  function deleteFloor(id) {
    if(S().pointerBackup)A.cancelInteraction();
    const p=S().project,index=p.floors.findIndex(f=>f.id===id);
    if(index<0||p.floors.length===1)return false;
    const activeId=A.floor().id===id?p.floors[index?index-1:1].id:A.floor().id;
    A.checkpoint();p.floors.splice(index,1);finishFloorChange(activeId);return true;
  }
  function updateFloorStackPreview(recalculate=false) {
    const below=S().project.floors.find(f=>f.id===A.$('#newFloorBelow').value),gap=floorMeasurement(A.$('#newFloorGap'));
    if(recalculate&&(!Number.isFinite(gap)||gap<=0)){A.$('#floorStackPreview').textContent='Enter a positive floor-to-floor height.';return;}
    if(recalculate&&below&&Number.isFinite(gap)&&gap>0){A.$('#newFloorElevation').value=A.displayValue(below.elevation+gap);A.$('#newFloorElevation').dataset.cm=String(below.elevation+gap);}
    const elevation=floorMeasurement(A.$('#newFloorElevation'));
    const occupied=S().project.floors.find(f=>Math.abs(f.elevation-elevation)<.01);
    A.$('#floorStackPreview').textContent=occupied?`${occupied.name} already occupies ${A.formatLength(elevation)}. Choose a different height or elevation.`:Number.isFinite(elevation)?`New floor at ${A.formatLength(elevation)} from ground zero. Existing floors keep their elevations.`:'Enter a valid height or elevation.';
  }
  function renderFloorManager() {
    const floors=orderedFloors(),activeId=A.floor().id;
    A.$('#floorListModal').innerHTML=[...floors].reverse().map(f=>{const i=floors.indexOf(f);return `<section class="floor-manager-row" data-floor-id="${A.escapeHtml(f.id)}"><strong>${A.escapeHtml(f.name)}${f.id===activeId?' · current':''}</strong><span>${A.formatLength(f.elevation)} from ground zero${i?` · ${A.formatLength(f.elevation-floors[i-1].elevation)} above ${A.escapeHtml(floors[i-1].name)}`:' · lowest level'}</span><div class="floor-manager-fields"><label>Name<input data-floor-name value="${A.escapeHtml(f.name)}"></label><label>Elevation (${A.unitLabel()})<input data-floor-elevation value="${A.escapeHtml(A.displayValue(f.elevation))}"></label></div><div class="floor-manager-actions"><button data-floor-action="save">Save level</button><button data-floor-action="up" ${i===floors.length-1||f.elevation===floors[i+1]?.elevation?'disabled':''} aria-label="Move ${A.escapeHtml(f.name)} up">↑ Up</button><button data-floor-action="down" ${i===0||f.elevation===floors[i-1]?.elevation?'disabled':''} aria-label="Move ${A.escapeHtml(f.name)} down">↓ Down</button><button data-floor-action="delete" ${floors.length===1?'disabled':''}>Delete…</button></div><div class="floor-delete-confirm" hidden><p>Delete ${A.escapeHtml(f.name)} and all its rooms, objects, services and structural members? Other floor elevations stay unchanged. Undo can restore it.</p><button data-floor-action="confirm-delete">Delete floor</button><button data-floor-action="cancel-delete">Keep floor</button></div></section>`;}).join('');
    const below=A.$('#newFloorBelow'),previous=below.value;
    below.innerHTML=floors.map(f=>`<option value="${A.escapeHtml(f.id)}">${A.escapeHtml(f.name)} · ${A.formatLength(f.elevation)}</option>`).join('');
    below.value=floors.some(f=>f.id===previous)?previous:activeId;
  }
  function openFloorModal() {
    if(S().pointerBackup)A.cancelInteraction();A.stopServiceRoute?.();
    renderFloorManager();A.$('#newFloorBelow').value=A.floor().id;
    A.$('#newFloorName').value=`Floor ${S().project.floors.length+1}`;
    A.$('#newFloorGap').value=A.displayValue(S().project.structuralBasis?.storeyHeight||300);
    A.$('#newFloorGap').dataset.cm=String(S().project.structuralBasis?.storeyHeight||300);
    A.$('#floorManagerNotice').textContent='Changes to levels affect the 3D stack and structural analysis. Keep at least one floor.';
    A.$('#newFloorElevationUnit').textContent=A.unitLabel();updateFloorStackPreview(true);
    A.$('#floorModal').classList.add('show');
  }
  function renderFloors() {
    const s=S(),project=s.project;
    A.$('#floorTabs').innerHTML=project.floors.map((f,i)=>`<button class="floor-tab ${i===project.activeFloor?'active':''}" data-floor="${i}">${A.escapeHtml(f.name)}</button>`).join('')+`<button class="add-floor" id="addFloor" title="Add floor">+</button>`;
    A.$$('.floor-tab').forEach(b=>b.onclick=()=>{if(s.pointerBackup)A.cancelInteraction();s.project.activeFloor=Number(b.dataset.floor);s.selected=null;s.selectedIds.clear();fitPlan();syncUI();A.queueSave()});
    A.$('#addFloor').onclick=openFloorModal;A.$('#floorLabel').textContent=A.floor().name;
  }

  function updateCounts() { const n=A.allEntities().length;A.$('#objectCount').textContent=`${n} object${n===1?'':'s'}`; }

  // ── Full UI sync ─────────────────────────────────────────────
  function syncFloorViewMode(){
    const button=A.$('#floorViewMode');if(!button)return;
    button.setAttribute('aria-pressed',String(!!S().project.camera.allFloors));
    button.title=S().project.camera.allFloors?'Show active floor in 3D':'Show all floors in 3D';
    button.setAttribute('aria-label',button.title);
  }
  function syncUI() {
    A.updateModelRelationships();
    const project=S().project;
    A.$('#projectName').value=project.name;
    syncFloorViewMode();
    A.$('#compass').style.setProperty('--north',`${project.north||0}deg`);
    A.updateGridLegend();renderFloors();A.renderInspector();updateCounts();updateZoom();A.draw();
    if(A.$('#floorModal').classList.contains('show'))renderFloorManager();
  }
  function selectFloorEntity(id){
    const s=S();if(id){const index=s.project.floors.findIndex(f=>A.allEntities(f).some(o=>o.id===id));if(index>=0&&index!==s.project.activeFloor){s.project.activeFloor=index;renderFloors();A.queueSave();}}
    A.select(id);
  }

  // ── Mobile tab switching ─────────────────────────────────────
  function setMobileTab(tab) {
    const ws=A.$('#workspace');if(!ws)return;
    ws.dataset.mobileTab=tab;
    A.$$('.mobile-tab').forEach(b=>b.classList.toggle('active',b.dataset.nav===tab));
    if(tab==='stage'){resizeCanvas();if(S().viewMode==='3d')window.atelier3D?.resize();A.draw();}
  }

  function toggleDesktopPanel(panelName) {
    const ws=A.$('#workspace');if(!ws)return;
    if(innerWidth<=768){const cur=ws.dataset.mobileTab;setMobileTab(cur===panelName?'stage':panelName);return}
    const cls=panelName==='catalog'?'hide-catalog':'hide-inspector';
    const isHidden=ws.classList.toggle(cls);
    const btn=panelName==='catalog'?A.$('#tabBtnCatalog'):A.$('#tabBtnInspector');
    if(btn)btn.classList.toggle('active',!isHidden);
    resizeCanvas();if(S().viewMode==='3d')window.atelier3D?.resize();A.draw();
  }

  // ── Pointer event registration on canvas ─────────────────────
  function bindCanvasPointerEvents(canvas) {
    const activePointers=new Map();
    let pinchStartDist=0,pinchStartScale=1,pinchMidWorld=null;
    const s=S;

    canvas.addEventListener('pointerdown', e=>{
      if(e.button===2)return;
      S().editSession=null;
      S().pointerType=e.pointerType;
      activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(activePointers.size>2)return;
      if(activePointers.size===2){
        if(s().pointerBackup)A.cancelInteraction();
        const pts=Array.from(activePointers.values());
        pinchStartDist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
        pinchStartScale=s().viewMode==='3d'?s().project.camera.zoom:s().scale;
        const r=canvas.getBoundingClientRect();
        const midScreen={x:(pts[0].x+pts[1].x)/2-r.left,y:(pts[0].y+pts[1].y)/2-r.top};
        pinchMidWorld=A.screenToWorld(midScreen);
        s().interaction={type:'pinch'};return;
      }
      const p=A.pointerPos(e),w=A.screenToWorld(p);canvas.setPointerCapture(e.pointerId);
      s().pointerOwner=e.pointerId;s().pointerStart=p;
      if(s().viewMode==='3d'){s().interaction={type:'orbit',start:p,yaw:s().project.camera.yaw,pitch:s().project.camera.pitch};return}
      if(s().tool==='pan'||e.button===1||s().spacePressed){s().interaction={type:'pan',start:p,origin:{...s().offset}};return}
      if(s().workspace==='structure'&&s().structDrawingView&&s().structDrawingView!=='plan')return;
      A.armEdit();
      if(s().tool==='select'){
        s().lastSelectionWorld={...w,floorId:A.floor().id};
        if(s().multiSelect){const hit=A.hitTest(p);if(hit&&A.floor().items.includes(hit))A.toggleSelection(hit.id);else A.showHint('Tap objects to add or remove them from selection');A.setMobileTab('stage');return;}
        const active=A.findEntity(s().selected);
        const routeHandle=active&&A.routeHandleHit?.(p,active);
        if(routeHandle){s().routeVertexIndex=routeHandle.indices.length===1?routeHandle.indices[0]:null;s().interaction={...routeHandle,id:active.id,start:w};return;}
        const wallHandle=A.canTransform(active)&&['wall','structural-wall'].includes(active.type)?A.wallHandleHit(p,active):null;
        let beamHandle=A.canTransform(active)&&['beam','dimension'].includes(active.type)?A.beamHandleHit(p,active):null;if(beamHandle&&active.type==='dimension')beamHandle=beamHandle.replace('beam','dimension');
        const handle=s().selectedIds.size<=1&&A.canTransform(active)&&Number.isFinite(active.w)&&Number.isFinite(active.d)&&!(s().workspace==='structure'&&active.type==='column'&&!A.structuralMoveTargets(active))?A.itemHandleHit(p,active):null;
        if(wallHandle){const center={x:(active.x1+active.x2)/2,y:(active.y1+active.y2)/2};A.checkpoint();s().interaction={type:wallHandle,id:active.id,original:A.deep(active),center,startAngle:Math.atan2(w.y-center.y,w.x-center.x),baseAngle:Math.atan2(active.y2-active.y1,active.x2-active.x1),length:Math.hypot(active.x2-active.x1,active.y2-active.y1)};return}
        if(beamHandle){A.checkpoint();s().interaction={type:beamHandle,id:active.id,original:A.deep(active)};return}
        if(handle){A.checkpoint();const handleType=typeof handle==='string'?handle:handle.type,center={x:active.x+active.w/2,y:active.y+active.d/2},angle=(active.rotation||0)*Math.PI/180,dx=w.x-center.x,dy=w.y-center.y,signs=handle.edge!=null?[[0,-1],[1,0],[0,1],[-1,0]][handle.edge]:[[-1,-1],[1,-1],[1,1],[-1,1]][handle.corner??2];s().interaction={type:handleType==='resize-item'?'resize-item-corner':handleType,corner:handle.corner,edge:handle.edge,id:active.id,original:A.deep(active),center,keepRatio:active.lockAspect||e.shiftKey,grabOffset:{x:dx*Math.cos(angle)+dy*Math.sin(angle)-signs[0]*active.w/2,y:-dx*Math.sin(angle)+dy*Math.cos(angle)-signs[1]*active.d/2}};return}
        if(A.selectionRotateHandleHit(p)){
          const b=A.selectionBounds(),ids=Array.from(s().selectedIds),originals=Object.fromEntries(A.selectedObjectList().map(o=>[o.id,A.deep(o)]));
          if(A.selectedObjectList().some(o=>!A.canTransform(o)))return;
          A.checkpoint();s().interaction={type:'rotate-group',ids,originals,center:{x:b.cx,y:b.cy},startAngle:Math.atan2(w.y-b.cy,w.x-b.cx)};return;
        }
        const hit=A.hitTest(p),additive=e.shiftKey||e.metaKey||e.ctrlKey;
        if(s().workspace==='structure'&&hit){
          if(additive){const wasSelected=s().selectedIds.has(hit.id);if(wasSelected){const next=new Set(s().selectedIds);next.delete(hit.id);A.setStructuralSelection(Array.from(next),Array.from(next)[0]);return;}A.setStructuralSelection([...s().selectedIds,hit.id],hit.id);}
          else if(!s().selectedIds.has(hit.id))A.setStructuralSelection([hit.id],hit.id);
          if(!additive){const targets=A.structuralMoveTargets(hit);if(!targets)return;A.checkpoint();s().interaction={type:'move',id:hit.id,original:A.deep(hit),start:w,structTargets:targets,structOriginals:Object.fromEntries(targets.map(o=>[o.id,A.deep(o)]))};}
        } else if(hit&&A.floor().items.includes(hit)){
          if(additive){const wasSelected=s().selectedIds.has(hit.id);A.toggleSelection(hit.id);if(wasSelected)return;}else if(!s().selectedIds.has(hit.id))A.select(hit.id);
          const ids=Array.from(s().selectedIds.has(hit.id)?s().selectedIds:[hit.id]);
          const targets=A.floor().items.filter(o=>ids.includes(o.id));if(targets.some(o=>!A.canTransform(o)))return;
          A.checkpoint();s().interaction={type:'move-group',ids,targets,originals:Object.fromEntries(targets.map(o=>[o.id,A.deep(o)])),start:w};
        } else if(!hit||(hit.type==='room'&&(e.altKey||e.shiftKey||e.metaKey||e.ctrlKey))){
          s().interaction={type:'marquee',start:w,current:w,additive:additive||s().workspace==='structure',clickTarget:hit?.id||null};
          if(!additive)A.select(null);
        } else {
          if(hit.boundaryWallIds){A.select(hit.id);A.showHint('This room follows its boundary walls. Move a wall to edit it.');return;}
          A.select(hit.id);A.checkpoint();
          if(!A.canTransform(hit))return;
          if(s().workspace==='structure'){const targets=A.structuralMoveTargets(hit);if(!targets){A.showHint('Unlock support columns and connected beams before moving');return;}s().interaction={type:'move',id:hit.id,original:A.deep(hit),start:w,structTargets:targets,structOriginals:Object.fromEntries(targets.map(o=>[o.id,A.deep(o)]))};return;}
          if(hit.type==='beam'&&(hit.startColumnId||hit.endColumnId)){A.showHint('Move the supporting columns · drag an endpoint to detach it');return;}
          s().interaction={type:'move',id:hit.id,original:A.deep(hit),start:w};
        }
      } else if(['room','wall','roof','dimension','beam','column'].includes(s().tool)) {const start=s().workspace==='structure'?A.structuralGuidePoint(null,w,{free:e.altKey,joint:s().tool==='beam'}):{x:A.snap(w.x),y:A.snap(w.y)};s().interaction={type:s().tool,start,current:start}}
    });

    canvas.addEventListener('pointermove', e=>{
      if(activePointers.has(e.pointerId))activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(activePointers.size===2&&s().interaction?.type==='pinch'){
        const pts=Array.from(activePointers.values()),dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
        if(pinchStartDist>0){
          const factor=dist/pinchStartDist;
          if(s().viewMode==='3d'){s().project.camera.zoom=Math.max(.18,Math.min(1.4,pinchStartScale*factor));window.atelier3D?.setCamera(s().project.camera)}
          else{const nextScale=Math.max(.18,Math.min(1.8,pinchStartScale*factor));const r=canvas.getBoundingClientRect();const midScreen={x:(pts[0].x+pts[1].x)/2-r.left,y:(pts[0].y+pts[1].y)/2-r.top};if(pinchMidWorld){s().offset.x=midScreen.x-pinchMidWorld.x*nextScale;s().offset.y=midScreen.y-pinchMidWorld.y*nextScale}s().scale=nextScale}
          updateZoom();A.requestDraw();
        }
        return;
      }
      const p=A.pointerPos(e);
      if(s().interaction?.type==='pinch')return;
      if(s().interaction&&s().pointerOwner!==e.pointerId)return;
      if(s().viewMode==='3d'){if(s().interaction?.type==='orbit'){s().project.camera.yaw=s().interaction.yaw+(p.x-s().interaction.start.x)*.35;s().project.camera.pitch=Math.max(22,Math.min(58,s().interaction.pitch-(p.y-s().interaction.start.y)*.22));A.draw();A.updateCameraReadouts()}return}
      const w=A.screenToWorld(p);A.$('#cursorPosition').textContent=`x ${A.formatLength(w.x)} · y ${A.formatLength(w.y)}`;
      if(!s().interaction){
        if(s().tool==='select'){const active=A.findEntity(s().selected),handle=s().selectedIds.size<=1&&active?A.itemHandleHit(p,active):null;let cursor='default';if(handle?.type==='rotate-item')cursor='grab';else if(handle){const angle=((active.rotation||0)+(handle.edge!=null?(handle.edge%2?0:90):(handle.corner===0||handle.corner===2?45:135))+360)%180;cursor=['ew-resize','nwse-resize','ns-resize','nesw-resize'][Math.round(angle/45)%4];}else if(active?.type==='wall'&&A.wallHandleHit(p,active))cursor='crosshair';canvas.style.cursor=cursor;}else canvas.style.cursor=s().tool==='pan'?'grab':'crosshair';return;
      }
      if(!['pan','marquee','room','wall','roof','dimension','beam','column'].includes(s().interaction.type)&&!s().interaction.activated){
        if(Math.hypot(p.x-s().pointerStart.x,p.y-s().pointerStart.y)<(e.pointerType==='touch'?6:3))return;
        s().interaction.activated=true;
        A.beginEdit();
      }
      const deltaSnap=n=>e.altKey?n:A.snap(n);
      const movement=()=>A.constrainedMovement(s().interaction,w.x-s().interaction.start.x,w.y-s().interaction.start.y,{shift:e.shiftKey,freeSnap:e.altKey});
      canvas.style.cursor=['pan','move','move-group','rotate-item','rotate-group'].includes(s().interaction.type)?'grabbing':'crosshair';
      if(s().interaction.type==='pan'){s().offset.x=s().interaction.origin.x+(p.x-s().interaction.start.x);s().offset.y=s().interaction.origin.y+(p.y-s().interaction.start.y)}
      else if(s().interaction.type==='move'){const o=A.findEntity(s().interaction.id),{dx,dy}=movement(),base=s().interaction.original;if(s().interaction.structTargets){const i=s().interaction;let mx=dx,my=dy;if(!e.shiftKey&&!e.altKey&&['column','beam','structural-wall'].includes(o.type)){const anchor=o.x1!=null?{x:base.x1,y:base.y1}:{x:base.x+base.w/2,y:base.y+base.d/2},q=A.structuralGuidePoint(null,{x:anchor.x+dx,y:anchor.y+dy},{exclude:i.structTargets.map(v=>v.id)});mx=q.x-anchor.x;my=q.y-anchor.y;}else s().snapGuides=[];for(const v of i.structTargets){const b=i.structOriginals[v.id];if(v.x1!=null){v.x1=b.x1+mx;v.y1=b.y1+my;v.x2=b.x2+mx;v.y2=b.y2+my;}else if(v.type==='grid')v.position=b.position+(v.axis==='x'?mx:my);else{v.x=b.x+mx;v.y=b.y+my;}}A.syncStructuralJoints();}else if(o.type==='grid')o.position=base.position+(o.axis==='x'?dx:dy);else if(o.x1!==undefined){o.x1=base.x1+dx;o.y1=base.y1+dy;o.x2=base.x2+dx;o.y2=base.y2+dy;if(o.type==='dimension')for(const end of [1,2])if(base['anchor'+end])o['anchor'+end]={...base['anchor'+end],dx:(base['anchor'+end].dx||0)+dx,dy:(base['anchor'+end].dy||0)+dy};}else{o.x=base.x+dx;o.y=base.y+dy;}}
      else if(s().interaction.type==='move-group'){const {dx,dy}=movement();const moving=s().interaction.targets;moving.forEach(o=>{const base=s().interaction.originals[o.id];o.x=base.x+dx;o.y=base.y+dy});s().snapGuides=[];if(!e.altKey&&!e.shiftKey&&!s().interaction.movementGuide)A.applySmartGuides(moving);moving.forEach(o=>{if(['door','window'].includes(o.shape))A.hostOpening(o)});}
      else if(s().interaction.type==='rotate-group')A.applyGroupRotation(s().interaction,w)
      else if(['route-vertex','route-segment'].includes(s().interaction.type)){s().interaction.freeSnap=e.altKey;A.moveRouteHandle(s().interaction,w);}
      else if(s().interaction.type==='marquee')s().interaction.current={x:A.snap(w.x),y:A.snap(w.y)}
      else if(s().interaction.type==='resize-wall-start'||s().interaction.type==='resize-wall-end'){const o=A.findEntity(s().interaction.id);if(o){const end=s().interaction.type.endsWith('start')?1:2,other=end===1?2:1,origin={x:o['x'+other],y:o['y'+other]},q=o.type==='wall'&&s().workspace==='architecture'?A.wallGuidePoint(origin,w,e.altKey):{x:deltaSnap(w.x),y:deltaSnap(w.y)};o['x'+end]=q.x;o['y'+end]=q.y;if(o.type==='wall'&&s().workspace==='architecture'&&s().wallPlotGuide&&!e.altKey){const horizontal=q.y===origin.y;s().interaction.movementGuide={origin,direction:horizontal?{x:1,y:0}:{x:0,y:1},distance:horizontal?q.x-origin.x:q.y-origin.y,label:horizontal?'Parallel to plot width · 0°':'Parallel to plot length · 90°'};}else delete s().interaction.movementGuide;}}
      else if(s().interaction.type==='resize-beam-start'||s().interaction.type==='resize-beam-end'){const o=A.findEntity(s().interaction.id);if(o){const end=s().interaction.type.endsWith('start')?1:2,other=end===1?2:1,key=end===1?'startColumnId':'endColumnId',q=s().workspace==='structure'?A.structuralGuidePoint({x:o['x'+other],y:o['y'+other]},w,{free:e.altKey,joint:true,exclude:[o[other===1?'startColumnId':'endColumnId']]}):{x:deltaSnap(w.x),y:deltaSnap(w.y)};o[key]=q.columnId||'';o['x'+end]=q.x;o['y'+end]=q.y;}}
      else if(s().interaction.type==='resize-dimension-start'||s().interaction.type==='resize-dimension-end'){const o=A.findEntity(s().interaction.id),end=s().interaction.type.endsWith('start')?1:2;delete o['anchor'+end];o['x'+end]=deltaSnap(w.x);o['y'+end]=deltaSnap(w.y);}
      else if(s().interaction.type==='rotate-wall'){const o=A.findEntity(s().interaction.id),c=s().interaction.center;if(o){let angle=s().interaction.baseAngle+(Math.atan2(w.y-c.y,w.x-c.x)-s().interaction.startAngle);if(!e.altKey){if(o.type==='wall'&&s().workspace==='architecture'&&s().wallPlotGuide)angle=Math.round(angle/(Math.PI/2))*(Math.PI/2);else if(s().project.snap)angle=Math.round(angle/(Math.PI/12))*(Math.PI/12);}const half=s().interaction.length/2,co=Math.abs(Math.cos(angle))<1e-12?0:Math.cos(angle),si=Math.abs(Math.sin(angle))<1e-12?0:Math.sin(angle);o.x1=c.x-co*half;o.y1=c.y-si*half;o.x2=c.x+co*half;o.y2=c.y+si*half;if(o.type==='wall'&&s().workspace==='architecture'&&s().wallPlotGuide&&!e.altKey)s().interaction.movementGuide={origin:c,direction:{x:co,y:si},distance:half,label:si===0?'Parallel to plot width · 0°':'Parallel to plot length · 90°'};else delete s().interaction.movementGuide;}}
      else if(s().interaction.type==='resize-item-corner'){s().interaction.freeSnap=e.altKey;A.resizeItemFromCorner(s().interaction,w)}
      else if(s().interaction.type==='resize-item'){const o=A.findEntity(s().interaction.id),base=s().interaction.original,a=-(base.rotation||0)*Math.PI/180,dx=w.x-s().interaction.center.x,dy=w.y-s().interaction.center.y,lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);let nw=Math.max(20,Math.abs(lx)*2),nd=Math.max(20,Math.abs(ly)*2);if(s().interaction.keepRatio){const ratio=base.w/base.d;if(nw/nd>ratio)nd=nw/ratio;else nw=nd*ratio}if(s().project.snap){nw=Math.max(20,A.snap(nw));nd=Math.max(20,A.snap(nd))}o.w=nw;o.d=nd;o.x=s().interaction.center.x-nw/2;o.y=s().interaction.center.y-nd/2}
      else if(s().interaction.type==='rotate-item'){const o=A.findEntity(s().interaction.id),angle=Math.atan2(w.y-s().interaction.center.y,w.x-s().interaction.center.x)*180/Math.PI+90;o.rotation=s().project.snap?Math.round(angle/15)*15:Math.round(angle)}
      else if(s().interaction.type==='wall'&&s().workspace==='architecture'){
        const interaction=s().interaction;interaction.current=A.wallGuidePoint(interaction.start,w,e.altKey);
        if(s().wallPlotGuide&&!e.altKey){const horizontal=interaction.current.y===interaction.start.y;interaction.movementGuide={origin:interaction.start,direction:horizontal?{x:1,y:0}:{x:0,y:1},distance:horizontal?interaction.current.x-interaction.start.x:interaction.current.y-interaction.start.y,label:horizontal?'Parallel to plot width · 0°':'Parallel to plot length · 90°'};}else delete interaction.movementGuide;
      }
      else if(s().workspace==='structure'&&['beam','column'].includes(s().interaction.type)){const i=s().interaction;i.current=A.structuralGuidePoint(i.type==='beam'?i.start:null,w,{free:e.altKey,joint:i.type==='beam',exclude:[i.start.columnId]});}
      else s().interaction.current={x:A.snap(w.x),y:A.snap(w.y)};
      A.requestDraw();
    });

    const handlePointerUp=e=>{
      activePointers.delete(e.pointerId);
      if(s().interaction?.type==='pinch'&&activePointers.size)return;
      if(s().interaction?.type!=='pinch'&&s().pointerOwner!==e.pointerId)return;
      A.cancelScheduledDraw();
      const changed=A.commitEdit();
      s().pointerOwner=null;
      if(s().interaction?.type==='pinch'){s().interaction=null;pinchStartDist=0;A.queueSave();A.requestDraw();return}
      if(!s().interaction)return;
      if(s().interaction.type==='orbit'){s().interaction=null;A.queueSave();return}
      if(changed&&(s().interaction.type==='move'||s().interaction.type==='move-group'||s().interaction.type==='rotate-group')){A.queueSave();A.renderInspector()}
      if(changed&&['resize-item','resize-item-corner','rotate-item','resize-wall-start','resize-wall-end','rotate-wall','resize-beam-start','resize-beam-end','resize-dimension-start','resize-dimension-end'].includes(s().interaction.type)){A.queueSave();A.renderInspector()}
      if(changed&&['route-vertex','route-segment'].includes(s().interaction.type))A.renderInspector();
      if(s().interaction.type==='marquee'){
        const dragDistance=Math.hypot(s().interaction.current.x-s().interaction.start.x,s().interaction.current.y-s().interaction.start.y)*s().scale;
        if(dragDistance>6)A.marqueeSelection(s().interaction);
        else if(s().interaction.clickTarget)A.select(s().interaction.clickTarget);
      }
      if(s().interaction.type==='column'){
        const a=s().interaction.current;
        A.checkpoint();
        const colW=A.COLUMN_DEFAULT_WIDTH||23, colD=A.COLUMN_DEFAULT_DEPTH||30;
        const colCount=((A.floor().columns||[]).length)+1;
        const o={
          id: A.uid(),
          type: 'column',
          name: `Column C${colCount}`,
          tag: `C${colCount}`,
          x: a.x - colW/2,
          y: a.y - colD/2,
          w: colW,
          d: colD,
          height: A.COLUMN_DEFAULT_HEIGHT||300,
          shape: 'rect',
          material: 'RCC M25',
          steelGrade: 'Fe500',
          rebarSpec: '4-T16 + 8mm stirrups @ 150 c/c',
          footingWidth: 120,
          footingDepth: 120,
          footingThickness: 35,
          color: '#24332d'
        };
        (A.floor().columns ||= []).push(o);
        A.select(o.id);
        A.queueSave();
        updateCounts();
        A.showToast(`Pillar ${o.tag} placed`);
      }
      else if(s().interaction.type==='beam'){
        const a=s().interaction.start, b=s().interaction.current;
        if(Math.hypot(b.x-a.x, b.y-a.y) > 15){
          A.checkpoint();
          const beamCount=((A.floor().beams||[]).length)+1;
          const spanM = Math.hypot(b.x-a.x, b.y-a.y)/100;
          const recD = Math.max(30, Math.ceil((spanM * 100 / 14) / 5) * 5);
          const o={
            id: A.uid(),
            type: 'beam',
            name: `Beam B${beamCount}`,
            tag: `B${beamCount}`,
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
            startColumnId:a.columnId||'',endColumnId:b.columnId||'',supportCondition:'simply-supported',provenance:'manual',
            width: A.BEAM_DEFAULT_WIDTH||23,
            depth: recD,
            beamType: 'primary',
            material: 'RCC M25',
            steelGrade: 'Fe500',
            rebarSpec: spanM > 4.5 ? 'Top: 2-T12, Bot: 3-T16, 8mm @ 150 c/c' : 'Top: 2-T12, Bot: 2-T16, 8mm @ 150 c/c',
            color: '#2e493e'
          };
          (A.floor().beams ||= []).push(o);
          A.select(o.id);
          A.queueSave();
          updateCounts();
          A.showToast(`Beam ${o.tag} placed`);
        }
      }
      else if(['room','wall','roof','dimension'].includes(s().interaction.type)){
        const a=s().interaction.start,b=s().interaction.current;if(Math.hypot(b.x-a.x,b.y-a.y)>15){A.checkpoint();let o;
          if(s().interaction.type==='room'){o={id:A.uid(),type:'room',name:`Room ${A.floor().rooms.length+1}`,x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),d:Math.abs(b.y-a.y),color:'#f2ede2',opacity:1,floorMaterial:'Wood',ceilingHeight:280};A.floor().rooms.push(o)}
          else if(s().interaction.type==='wall'){o={id:A.uid(),type:'wall',x1:a.x,y1:a.y,x2:b.x,y2:b.y,thickness:A.WALL_DEFAULT_THICKNESS,height:A.WALL_DEFAULT_HEIGHT,color:'#3e4944'};A.floor().walls.push(o)}
          else if(s().interaction.type==='roof'){const roofElevation=Math.max(A.WALL_DEFAULT_HEIGHT,...A.floor().rooms.map(r=>Number(r.ceilingHeight)||0));o={id:A.uid(),type:'roof',shape:'roof',name:`Roof ${A.floor().items.filter(x=>(x.shape||x.type)==='roof').length+1}`,x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),d:Math.abs(b.y-a.y),height:15.24,elevation:roofElevation,rotation:0,color:'#a8aaa5',material:'Concrete',roofMode:'visible',clearance:0,lockAspect:false};A.floor().items.push(o)}
          else{o={id:A.uid(),type:'dimension',x1:a.x,y1:a.y,x2:b.x,y2:b.y,color:'#62716a'};A.floor().dimensions.push(o)}
          if(o.type==='dimension')A.attachDimension(o);
          A.select(o.id);A.queueSave();updateCounts();
        }
      }
      s().interaction=null;s().snapGuides=[];A.draw();
    };
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('dblclick',e=>{const o=A.findEntity(s().selected);if(!o||s().routeEditing!==o.id||!A.canTransform(o))return;const handle=A.routeHandleHit(A.pointerPos(e),o);if(handle?.type!=='route-segment')return;const points=handle.points,index=handle.indices[1],a=points[index-1],b=points[index];points.splice(index,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2});A.checkpoint();A.setServicePath(o,points);A.draw();A.renderInspector();A.queueSave();});
    canvas.addEventListener('pointercancel',e=>{activePointers.delete(e.pointerId);A.cancelInteraction();});
    canvas.addEventListener('lostpointercapture',e=>{if(s().pointerOwner===e.pointerId&&s().pointerBackup){activePointers.clear();A.cancelInteraction();}});
    addEventListener('blur',()=>{s().spacePressed=false;activePointers.clear();if(s().pointerBackup)A.cancelInteraction();s().interaction=null;});

    canvas.addEventListener('wheel',e=>{e.preventDefault();if(s().interaction)return;if(s().viewMode==='3d'){s().project.camera.zoom=Math.max(.18,Math.min(1.4,s().project.camera.zoom*(e.deltaY>0?.9:1.1)));updateZoom();A.requestDraw();return}const p=A.pointerPos(e),before=A.screenToWorld(p);s().scale=Math.max(.18,Math.min(1.8,s().scale*(e.deltaY>0?.9:1.1)));s().offset.x=p.x-before.x*s().scale;s().offset.y=p.y-before.y*s().scale;updateZoom();A.requestDraw()},{passive:false});
  }

  // ── Keyboard shortcuts ───────────────────────────────────────
  function bindKeyboard() {
    addEventListener('keydown',e=>{
      if(e.key==='Escape'&&A.$('#helpModal').classList.contains('show')){A.$('#helpModal').classList.remove('show');return}
      if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
      if(e.code==='Space'){S().spacePressed=true;e.preventDefault();return;}
      if(e.defaultPrevented||e.target.closest?.('button,[role="tab"],.modal-backdrop.show'))return;
      if(window.atelier3D?.isWalking?.()){if(e.key==='Escape'){window.atelier3D.setWalk(false);A.renderInspector();A.showToast('Orbit view restored')}return}
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();A.deleteSelected();return}
      if(e.key==='Escape'){S().multiSelect=false;if(S().interaction)A.cancelInteraction();A.select(null);A.setTool(S().viewMode==='3d'?'pan':'select')}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='c'){e.preventDefault();A.copySelected();return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='v'){e.preventDefault();A.pasteClipboard();return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){e.preventDefault();A.duplicateSelected();return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
      if(S().viewMode==='plan'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault();const project=S().project;
        const step=e.shiftKey?(project.unit==='ft'||project.unit==='in'?30.48:100):(project.snap?A.gridStep():5);
        const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
        const targets=(S().selectedIds.size?A.selectedObjectList():[A.findEntity(S().selected)]).filter(o=>A.canTransform(o));
        if(targets.length){if(!S().nudgeActive){A.beginEdit();S().nudgeActive=true;}targets.forEach(o=>{if(o.type==='grid')o.position+=o.axis==='x'?dx:dy;else if(o.x!==undefined){o.x+=dx;o.y+=dy}else{o.x1+=dx;o.x2+=dx;o.y1+=dy;o.y2+=dy;if(o.type==='dimension')for(const end of [1,2])if(o['anchor'+end]){o['anchor'+end].dx=(o['anchor'+end].dx||0)+dx;o['anchor'+end].dy=(o['anchor'+end].dy||0)+dy;}}});A.requestDraw();}
        return;
      }
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const keys={v:'select',r:'room',w:'wall',t:'roof',d:'dimension',h:'pan',p:'column',b:'beam'};if(keys[e.key.toLowerCase()])A.setTool(keys[e.key.toLowerCase()])
    });
    addEventListener('keyup',e=>{if(e.code==='Space')S().spacePressed=false;if(S().nudgeActive&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){S().nudgeActive=false;A.commitEdit();A.renderInspector();A.draw();}});
  }

  // ── Master init function ─────────────────────────────────────
  function initUI() {
    const s=S();
    s.canvas=A.$('#planCanvas') || A.$('#canvas');
    if(!s.canvas) {
      console.error('Canvas element (#planCanvas) not found in DOM');
      return;
    }
    s.stage=A.$('#stage');
    s.ctx=s.canvas.getContext('2d');
    resizeCanvas();

    // Tool buttons
    A.$$('.tool[data-tool]').forEach(b=>b.onclick=()=>A.setTool(b.dataset.tool));

    // Toolbar actions
    A.$('#projectsBtn').onclick=A.openLibrary;A.$('#newProjectBtn').onclick=A.newProject;
    A.$('#traceRoomsBtn').onclick=A.deriveRooms;A.$('#exportSvgBtn').onclick=A.exportDrawing;A.$('#exportPdfBtn').onclick=A.exportPdfDrawing;A.$('#printPlanBtn').onclick=A.printDrawing;
    A.$('#floorViewMode').onclick=()=>{s.project.camera.allFloors=!s.project.camera.allFloors;if(s.viewMode==='3d')fitPlan();window.atelier3D?.requestRebuild();A.queueSave();syncUI();};
    A.$('#undoBtn').onclick=undo;A.$('#redoBtn').onclick=redo;A.$('#saveBtn').onclick=A.saveProject;A.$('#exportBtn').onclick=A.exportProject;
    A.$('#importBtn').onclick=()=>A.$('#fileInput').click();A.$('#fileInput').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)A.importProject(file);};
    A.$('#projectName').oninput=e=>{s.project.name=e.target.value;A.queueSave()};

    // Catalog search + filter
    A.$('#catalogSearch').oninput=e=>A.renderCatalog(e.target.value,A.$('#categorySelect').value);
    A.$('#categorySelect').onchange=e=>A.renderCatalog(A.$('#catalogSearch').value,e.target.value);

    // Grid / fit / zoom / structure
    A.$('#gridBtn').onclick=()=>{A.checkpoint();s.project.grid=!s.project.grid;A.updateGridLegend();A.queueSave();A.draw();A.showToast(s.project.grid?'Grid visible':'Grid hidden')};
    const structBtn=A.$('#structureBtn');
    if(structBtn){
      structBtn.classList.toggle('active',s.project.showStructure!==false);
      structBtn.onclick=()=>{
        s.structureOnly3D=false;
        s.project.showStructure = !(s.project.showStructure !== false);
        structBtn.classList.toggle('active', s.project.showStructure);
        structBtn.setAttribute('aria-pressed',String(s.project.showStructure));
        structBtn.setAttribute('aria-label',s.project.showStructure?'Hide structure':'Show structure');
        A.draw();
        if(s.viewMode==='3d') window.atelier3D?.requestRebuild();
        A.syncUI();A.queueSave();
        A.showToast(s.project.showStructure ? 'Structure visible' : 'Structure hidden');
      };
    }
    A.$('#fitBtn').onclick=fitPlan;
    A.$('#zoomIn').onclick=zoomIn;A.$('#zoomOut').onclick=zoomOut;
    const stageZoomIn=A.$('#stageZoomIn'),stageZoomOut=A.$('#stageZoomOut');
    if(stageZoomIn)stageZoomIn.onclick=zoomIn;if(stageZoomOut)stageZoomOut.onclick=zoomOut;

    // View switch
    A.$$('.view-switch button').forEach(b=>b.onclick=()=>A.setView(b.dataset.view));

    // Floor modal
    A.$('#newFloorBelow').onchange=()=>updateFloorStackPreview(true);
    A.$('#newFloorGap').oninput=()=>{delete A.$('#newFloorGap').dataset.cm;updateFloorStackPreview(true)};
    A.$('#newFloorElevation').oninput=e=>{e.target.dataset.cm=String(A.toCm(e.target.value));updateFloorStackPreview()};
    A.$('#floorListModal').onclick=e=>{
      const button=e.target.closest('[data-floor-action]');if(!button)return;
      const row=button.closest('[data-floor-id]'),id=row.dataset.floorId,action=button.dataset.floorAction;
      const floor=S().project.floors.find(f=>f.id===id);if(!floor)return;
      const confirmation=row.querySelector('.floor-delete-confirm');
      if(action==='delete'||action==='cancel-delete'){confirmation.hidden=action==='cancel-delete';if(!confirmation.hidden)confirmation.querySelector('button').focus();else row.querySelector('[data-floor-action="delete"]').focus();return;}
      let changed=false;
      if(action==='confirm-delete')changed=deleteFloor(id);
      if(action==='up'||action==='down')changed=moveFloorLevel(id,action==='up'?1:-1);
      if(action==='save'){
        const name=row.querySelector('[data-floor-name]').value.trim(),input=row.querySelector('[data-floor-elevation]'),elevation=input.value===String(A.displayValue(floor.elevation))?floor.elevation:A.toCm(input.value);
        if(!name||!Number.isFinite(elevation)){A.$('#floorManagerNotice').textContent='Enter a floor name and a valid elevation.';return;}
        if(elevation!==floor.elevation&&S().project.floors.some(f=>f.id!==id&&Math.abs(f.elevation-elevation)<.01)){A.$('#floorManagerNotice').textContent='Another floor occupies this elevation. Use Up / Down to exchange levels.';return;}
        if(name!==floor.name||Math.abs(elevation-floor.elevation)>.01){const activeId=A.floor().id;A.checkpoint();Object.assign(floor,{name,elevation});S().project.floors.sort((a,b)=>a.elevation-b.elevation);finishFloorChange(activeId);changed=true;}
      }
      if(changed){renderFloorManager();updateFloorStackPreview(true);A.$('#floorManagerNotice').textContent='Floor stack updated. Undo restores the previous stack.';const target=A.$$('.floor-manager-row').find(r=>r.dataset.floorId===id)||A.$('.floor-manager-row');target?.querySelector('button:not(:disabled)')?.focus();}
    };
    A.$('#cancelFloor').onclick=()=>A.$('#floorModal').classList.remove('show');
    const closeFloorModalBtn=A.$('#closeFloorModalBtn');if(closeFloorModalBtn)closeFloorModalBtn.onclick=()=>A.$('#floorModal').classList.remove('show');
    A.$('#confirmFloor').onclick=()=>{
      const name=A.$('#newFloorName').value.trim()||`Floor ${s.project.floors.length+1}`,elevation=floorMeasurement(A.$('#newFloorElevation'));
      const gap=floorMeasurement(A.$('#newFloorGap'));if(!Number.isFinite(gap)||gap<=0){A.showToast('Enter a positive floor-to-floor height');return;}
      if(!Number.isFinite(elevation)){A.showToast('Enter a valid floor elevation');return;}
      if(s.project.floors.length>=100){A.showToast('A project can contain at most 100 floors');return;}
      if(s.project.floors.some(f=>Math.abs(f.elevation-elevation)<.01)){A.showToast('A floor already occupies this elevation. Choose another elevation.');return;}
      A.checkpoint();let next={id:A.uid(),name,elevation,rooms:[],walls:[],items:[],dimensions:[],columns:[],beams:[]};
      if(A.$('#copyFloorContents').checked){next=A.deep(A.floor());const remap=new Map();for(const key of ['rooms','walls','items','dimensions','columns','beams','slabs','loads','structuralWalls','grids'])for(const o of next[key]||[]){const old=o.id;o.id=A.uid();remap.set(old,o.id);}for(const key of ['rooms','items','dimensions','beams','loads'])for(const o of next[key]||[]){delete o.stairUpperFloorId;for(const k of ['startColumnId','endColumnId','columnId'])if(o[k])o[k]=remap.get(o[k])||'';if(o.hostWallId)o.hostWallId=remap.get(o.hostWallId);if(o.boundaryWallIds)o.boundaryWallIds=o.boundaryWallIds.map(id=>remap.get(id)).sort();for(const end of [1,2])if(o['anchor'+end])o['anchor'+end].entityId=remap.get(o['anchor'+end].entityId);}Object.assign(next,{id:A.uid(),name,elevation});}
      s.project.floors.push(next);s.project.floors.sort((a,b)=>a.elevation-b.elevation);A.normalizeStructure?.(s.project);s.project.activeFloor=s.project.floors.indexOf(next);s.selected=null;s.selectedIds.clear();A.$('#floorModal').classList.remove('show');window.atelier3D?.requestRebuild();syncUI();fitPlan();A.queueSave();A.showToast(`${name} added`);
    };
    A.$('#floorModal').addEventListener('click',e=>{if(e.target.id==='floorModal')e.currentTarget.classList.remove('show')});

    // Help modal
    A.$('#helpBtn').onclick=()=>A.$('#helpModal').classList.add('show');
    A.$('#closeHelp').onclick=()=>A.$('#helpModal').classList.remove('show');
    const closeHelpHeader=A.$('#closeHelpHeader');if(closeHelpHeader)closeHelpHeader.onclick=()=>A.$('#helpModal').classList.remove('show');
    A.$('#helpModal').addEventListener('click',e=>{if(e.target.id==='helpModal')e.currentTarget.classList.remove('show')});

    // Mobile tabs
    A.$$('.mobile-tab[data-nav]').forEach(b=>{b.onclick=()=>{const nav=b.dataset.nav;if(nav==='floors')openFloorModal();else if(nav==='help')A.$('#helpModal').classList.add('show');else setMobileTab(nav)}});
    window.setMobileTab=setMobileTab;

    // Desktop panel toggles
    const tabBtnCat=A.$('#tabBtnCatalog'),tabBtnInsp=A.$('#tabBtnInspector');
    if(tabBtnCat)tabBtnCat.onclick=()=>toggleDesktopPanel('catalog');
    if(tabBtnInsp)tabBtnInsp.onclick=()=>toggleDesktopPanel('inspector');
    const closeCat=A.$('#closeCatalogBtn'),closeInsp=A.$('#closeInspectorBtn');
    if(closeCat)closeCat.onclick=()=>{if(innerWidth<=768)setMobileTab('stage');else toggleDesktopPanel('catalog')};
    if(closeInsp)closeInsp.onclick=()=>{if(innerWidth<=768)setMobileTab('stage');else toggleDesktopPanel('inspector')};

    // Category pills
    A.$$('#categoryPills .cat-pill').forEach(pill=>{pill.onclick=()=>{const cat=pill.dataset.cat||'all';A.$$('#categoryPills .cat-pill').forEach(p=>p.classList.toggle('active',p===pill));const sel=A.$('#categorySelect');if(sel)sel.value=cat;A.renderCatalog(A.$('#catalogSearch').value,cat)}});

    // Mobile selection chip
    const chipEditBtn=A.$('#chipEditBtn'),chipDeleteBtn=A.$('#chipDeleteBtn');
    if(chipEditBtn)chipEditBtn.onclick=()=>{if(innerWidth<=768)setMobileTab('inspector');else{A.$('#workspace').classList.remove('hide-inspector');A.$('#tabBtnInspector')?.classList.add('active');resizeCanvas();A.draw()}};
    if(chipDeleteBtn)chipDeleteBtn.onclick=A.deleteSelected;

    // Mobile menu popover
    const mobileMenuBtn=A.$('#mobileMenuBtn'),mobileMenuPopover=A.$('#mobileMenuPopover');
    A.$('#menuProjects').onclick=()=>{mobileMenuPopover.classList.remove('show');A.openLibrary();};
    A.$('#menuObjects').onclick=()=>{mobileMenuPopover.classList.remove('show');A.$('#objectsBtn').click();};
    if(mobileMenuBtn&&mobileMenuPopover){
      mobileMenuBtn.onclick=e=>{e.stopPropagation();mobileMenuPopover.classList.toggle('show')};
      addEventListener('click',e=>{if(!mobileMenuPopover.contains(e.target)&&e.target!==mobileMenuBtn)mobileMenuPopover.classList.remove('show')});
    }
    const menuImport=A.$('#menuImport'),menuExport=A.$('#menuExport'),menuLoadSample=A.$('#menuLoadSample'),menuHelp=A.$('#menuHelp');
    if(menuImport)menuImport.onclick=()=>{mobileMenuPopover?.classList.remove('show');A.$('#fileInput').click()};
    if(menuExport)menuExport.onclick=()=>{mobileMenuPopover?.classList.remove('show');A.exportProject()};
    if(menuLoadSample)menuLoadSample.onclick=()=>{mobileMenuPopover?.classList.remove('show');A.loadSampleProject()};
    if(menuHelp)menuHelp.onclick=()=>{mobileMenuPopover?.classList.remove('show');A.$('#helpModal').classList.add('show')};

    // Drag-drop on stage
    s.stage.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy'});
    s.stage.addEventListener('drop',e=>{e.preventDefault();if(s.viewMode==='3d'){A.showToast('Switch to Plan to place objects');return}const type=e.dataTransfer.getData('application/x-atelier-object');if(!type)return;const r=s.canvas.getBoundingClientRect(),w=A.screenToWorld({x:e.clientX-r.left,y:e.clientY-r.top});A.addObjectToPlan(type,w)});

    // Canvas pointer events & keyboard
    bindCanvasPointerEvents(s.canvas);
    bindKeyboard();

    // Context menu
    A.setupContextMenu(s.canvas);

    // Resize observer
    new ResizeObserver(resizeCanvas).observe(s.stage);

    // Beforeunload — flush save
    addEventListener('beforeunload',A.flushSave);

    // Bridge for renderer3d.js
    window.atelierBridge={get project(){return s.project},floor:A.floor,planBounds:A.planBounds,get selected(){return s.selected},select:selectFloorEntity,queueSave:A.queueSave,checkpoint:A.checkpoint,beginEdit:A.beginEdit,commitEdit:A.commitEdit,cancelEdit:()=>A.cancelInteraction(),canTransform:A.canTransform,updateModelRelationships:A.updateModelRelationships,draw:A.draw,renderInspector:A.renderInspector,snap:A.snap,findEntity:A.findEntity,showToast:A.showToast,applySmartGuides:A.applySmartGuides,updateCameraUI(){A.updateCameraReadouts();updateZoom()}};
    window.addEventListener('atelier:renderer-ready',()=>window.atelier3D?.setVisible(s.viewMode==='3d'));

    // Boot
    A.initEditingSupport();A.initAccessibility();A.initServiceRouting?.();syncUnitPresentation();syncUI();setTimeout(fitPlan,80);
  }

  Object.assign(A, {
    resizeCanvas, syncUnitPresentation, updateZoom, fitPlan,
    zoomIn, zoomOut, undo, redo,
    openFloorModal, moveFloorLevel, deleteFloor, renderFloors, updateCounts, syncUI, syncFloorViewMode,
    setMobileTab, toggleDesktopPanel, initUI
  });
})();
