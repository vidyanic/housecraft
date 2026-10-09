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
    const s=S(),bounds=A.planBounds(),stage=s.stage,r=stage.getBoundingClientRect(),pad=75;
    if(s.viewMode==='3d'){const span=Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY);s.project.camera.zoom=Math.max(.2,Math.min(.9,Math.min((r.width-pad*2)/(span*1.25||1),(r.height-pad*2)/(span*.82||1))));updateZoom();window.atelier3D?.rebuild();window.atelier3D?.setCamera(s.project.camera);return}
    s.scale=Math.max(.18,Math.min(1.2,Math.min((r.width-pad*2)/(bounds.maxX-bounds.minX||1),(r.height-pad*2)/(bounds.maxY-bounds.minY||1))));
    s.offset={x:(r.width-(bounds.maxX-bounds.minX)*s.scale)/2-bounds.minX*s.scale,y:(r.height-(bounds.maxY-bounds.minY)*s.scale)/2-bounds.minY*s.scale};
    updateZoom();A.draw();
  }

  function zoomIn() { const s=S();if(s.viewMode==='3d'){s.project.camera.zoom=Math.min(1.4,s.project.camera.zoom*1.15);window.atelier3D?.setCamera(s.project.camera)}else s.scale=Math.min(1.8,s.scale*1.15);updateZoom();A.draw(); }
  function zoomOut(){ const s=S();if(s.viewMode==='3d'){s.project.camera.zoom=Math.max(.18,s.project.camera.zoom/1.15);window.atelier3D?.setCamera(s.project.camera)}else s.scale=Math.max(.18,s.scale/1.15);updateZoom();A.draw(); }

  // ── Undo / redo ──────────────────────────────────────────────
  function undo() { const s=S();if(!s.history.length)return;s.future.push(JSON.stringify(s.project));s.project=JSON.parse(s.history.pop());s.selected=null;s.selectedIds.clear();syncUI();A.queueSave(); }
  function redo() { const s=S();if(!s.future.length)return;s.history.push(JSON.stringify(s.project));s.project=JSON.parse(s.future.pop());s.selected=null;s.selectedIds.clear();syncUI();A.queueSave(); }

  // ── Floor management ─────────────────────────────────────────
  function openFloorModal() { A.$('#newFloorElevation').value=A.displayValue((A.floor().elevation||0)+300);delete A.$('#newFloorElevation').dataset.cm;A.$('#floorListModal').innerHTML=S().project.floors.map(f=>`<div>${A.escapeHtml(f.name)} · elevation ${A.formatLength(f.elevation||0)}</div>`).join('');A.$('#floorModal').classList.add('show'); }
  function renderFloors() {
    const s=S(),project=s.project;
    A.$('#floorTabs').innerHTML=project.floors.map((f,i)=>`<button class="floor-tab ${i===project.activeFloor?'active':''}" data-floor="${i}">${A.escapeHtml(f.name)}</button>`).join('')+`<button class="add-floor" id="addFloor" title="Add floor">+</button>`;
    A.$$('.floor-tab').forEach(b=>b.onclick=()=>{project.activeFloor=Number(b.dataset.floor);s.selected=null;s.selectedIds.clear();fitPlan();syncUI();A.queueSave()});
    A.$('#addFloor').onclick=openFloorModal;A.$('#floorLabel').textContent=A.floor().name;
  }

  function updateCounts() { const n=A.allEntities().length;A.$('#objectCount').textContent=`${n} object${n===1?'':'s'}`; }

  // ── Full UI sync ─────────────────────────────────────────────
  function syncUI() {
    const project=S().project;
    A.$('#projectName').value=project.name;
    if(A.$('#floorViewMode'))A.$('#floorViewMode').value=project.camera.allFloors?'all':'active';
    A.$('#compass').style.setProperty('--north',`${project.north||0}deg`);
    A.updateGridLegend();renderFloors();A.renderInspector();updateCounts();updateZoom();A.draw();
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
      if(!S().pointerBackup)S().pointerBackup={project:JSON.stringify(S().project),history:[...S().history],future:[...S().future],offset:{...S().offset},scale:S().scale};
      S().editSession=null;
      activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(activePointers.size===2){
        const pts=Array.from(activePointers.values());
        pinchStartDist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
        pinchStartScale=s().viewMode==='3d'?s().project.camera.zoom:s().scale;
        const r=canvas.getBoundingClientRect();
        const midScreen={x:(pts[0].x+pts[1].x)/2-r.left,y:(pts[0].y+pts[1].y)/2-r.top};
        pinchMidWorld=A.screenToWorld(midScreen);
        s().interaction={type:'pinch'};return;
      }
      if(e.button===2)return;
      const p=A.pointerPos(e),w=A.screenToWorld(p);canvas.setPointerCapture(e.pointerId);
      if(s().viewMode==='3d'){s().interaction={type:'orbit',start:p,yaw:s().project.camera.yaw,pitch:s().project.camera.pitch};return}
      if(s().tool==='pan'||e.button===1||e.code==='Space'){s().interaction={type:'pan',start:p,origin:{...s().offset}};return}
      if(s().tool==='select'){
        const active=A.findEntity(s().selected);
        const wallHandle=active&&active.type==='wall'?A.wallHandleHit(p,active):null;
        const beamHandle=active&&active.type==='beam'?A.beamHandleHit(p,active):null;
        const handle=s().selectedIds.size===1&&active&&A.floor().items.includes(active)?A.itemHandleHit(p,active):null;
        if(wallHandle){const center={x:(active.x1+active.x2)/2,y:(active.y1+active.y2)/2};A.checkpoint();s().interaction={type:wallHandle,id:active.id,original:A.deep(active),center,startAngle:Math.atan2(w.y-center.y,w.x-center.x),baseAngle:Math.atan2(active.y2-active.y1,active.x2-active.x1),length:Math.hypot(active.x2-active.x1,active.y2-active.y1)};return}
        if(beamHandle){A.checkpoint();s().interaction={type:beamHandle,id:active.id,original:A.deep(active)};return}
        if(handle){A.checkpoint();const handleType=typeof handle==='string'?handle:handle.type;s().interaction={type:handleType==='resize-item'?'resize-item-corner':handleType,corner:typeof handle==='string'?null:handle.corner,id:active.id,original:A.deep(active),center:{x:active.x+active.w/2,y:active.y+active.d/2},keepRatio:active.lockAspect||e.shiftKey};return}
        if(A.selectionRotateHandleHit(p)){
          const b=A.selectionBounds(),ids=Array.from(s().selectedIds),originals=Object.fromEntries(A.selectedObjectList().map(o=>[o.id,A.deep(o)]));
          A.checkpoint();s().interaction={type:'rotate-group',ids,originals,center:{x:b.cx,y:b.cy},startAngle:Math.atan2(w.y-b.cy,w.x-b.cx)};return;
        }
        const hit=A.hitTest(p),additive=e.shiftKey||e.metaKey||e.ctrlKey;
        if(hit&&A.floor().items.includes(hit)){
          if(additive){const wasSelected=s().selectedIds.has(hit.id);A.toggleSelection(hit.id);if(wasSelected)return;}else if(!s().selectedIds.has(hit.id))A.select(hit.id);
          const ids=Array.from(s().selectedIds.has(hit.id)?s().selectedIds:[hit.id]);
          A.checkpoint();s().interaction={type:'move-group',ids,originals:Object.fromEntries(A.floor().items.filter(o=>ids.includes(o.id)).map(o=>[o.id,A.deep(o)])),start:w};
        } else if(!hit||(hit.type==='room'&&(e.altKey||e.shiftKey||e.metaKey||e.ctrlKey))){
          s().interaction={type:'marquee',start:w,current:w,additive,clickTarget:hit?.id||null};
          if(!additive)A.select(null);
        } else {
          if(hit.boundaryWallIds){A.select(hit.id);A.showHint('This room follows its boundary walls. Move a wall to edit it.');return;}
          A.select(hit.id);A.checkpoint();
          s().interaction={type:'move',id:hit.id,original:A.deep(hit),start:w};
        }
      } else if(['room','wall','roof','dimension','beam','column'].includes(s().tool)) {s().interaction={type:s().tool,start:{x:A.snap(w.x),y:A.snap(w.y)},current:{x:A.snap(w.x),y:A.snap(w.y)}}}
    });

    canvas.addEventListener('pointermove', e=>{
      if(activePointers.has(e.pointerId))activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(activePointers.size===2&&s().interaction?.type==='pinch'){
        const pts=Array.from(activePointers.values()),dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
        if(pinchStartDist>0){
          const factor=dist/pinchStartDist;
          if(s().viewMode==='3d'){s().project.camera.zoom=Math.max(.18,Math.min(1.4,pinchStartScale*factor));window.atelier3D?.setCamera(s().project.camera)}
          else{const nextScale=Math.max(.18,Math.min(1.8,pinchStartScale*factor));const r=canvas.getBoundingClientRect();const midScreen={x:(pts[0].x+pts[1].x)/2-r.left,y:(pts[0].y+pts[1].y)/2-r.top};if(pinchMidWorld){s().offset.x=midScreen.x-pinchMidWorld.x*nextScale;s().offset.y=midScreen.y-pinchMidWorld.y*nextScale}s().scale=nextScale}
          updateZoom();A.draw();
        }
        return;
      }
      const p=A.pointerPos(e);
      if(s().viewMode==='3d'){if(s().interaction?.type==='orbit'){s().project.camera.yaw=s().interaction.yaw+(p.x-s().interaction.start.x)*.35;s().project.camera.pitch=Math.max(22,Math.min(58,s().interaction.pitch-(p.y-s().interaction.start.y)*.22));A.draw();A.updateCameraReadouts()}return}
      const w=A.screenToWorld(p);A.$('#cursorPosition').textContent=`x ${A.formatLength(w.x)} · y ${A.formatLength(w.y)}`;
      if(!s().interaction){
        if(s().tool==='select'){const active=A.findEntity(s().selected),handle=s().selectedIds.size===1&&active&&A.floor().items.includes(active)?A.itemHandleHit(p,active):null;canvas.style.cursor=handle?(handle.type==='rotate-item'?'grab':'nwse-resize'):'default'}else canvas.style.cursor=s().tool==='pan'?'grab':'crosshair';return;
      }
      canvas.style.cursor='default';
      if(s().interaction.type==='pan'){s().offset.x=s().interaction.origin.x+(p.x-s().interaction.start.x);s().offset.y=s().interaction.origin.y+(p.y-s().interaction.start.y)}
      else if(s().interaction.type==='move'){const o=A.findEntity(s().interaction.id),dx=A.snap(w.x-s().interaction.start.x),dy=A.snap(w.y-s().interaction.start.y),base=s().interaction.original;if(o.type==='wall'||o.type==='dimension'||o.type==='beam'){o.x1=base.x1+dx;o.y1=base.y1+dy;o.x2=base.x2+dx;o.y2=base.y2+dy}else{o.x=base.x+dx;o.y=base.y+dy;if(A.floor().items.includes(o))A.applySmartGuides([o])}}
      else if(s().interaction.type==='move-group'){const dx=A.snap(w.x-s().interaction.start.x),dy=A.snap(w.y-s().interaction.start.y);s().interaction.ids.forEach(id=>{const o=A.findEntity(id),base=s().interaction.originals[id];if(o&&base){o.x=base.x+dx;o.y=base.y+dy}});const moving=A.floor().items.filter(o=>s().interaction.ids.includes(o.id));A.applySmartGuides(moving);moving.forEach(o=>{if(['door','window'].includes(o.shape))A.hostOpening(o)});}
      else if(s().interaction.type==='rotate-group')A.applyGroupRotation(s().interaction,w)
      else if(s().interaction.type==='marquee')s().interaction.current={x:A.snap(w.x),y:A.snap(w.y)}
      else if(s().interaction.type==='resize-wall-start'||s().interaction.type==='resize-wall-end'){const o=A.findEntity(s().interaction.id);if(o){if(s().interaction.type==='resize-wall-start'){o.x1=A.snap(w.x);o.y1=A.snap(w.y)}else{o.x2=A.snap(w.x);o.y2=A.snap(w.y)}}}
      else if(s().interaction.type==='resize-beam-start'||s().interaction.type==='resize-beam-end'){const o=A.findEntity(s().interaction.id);if(o){if(s().interaction.type==='resize-beam-start'){o.x1=A.snap(w.x);o.y1=A.snap(w.y)}else{o.x2=A.snap(w.x);o.y2=A.snap(w.y)}}}
      else if(s().interaction.type==='rotate-wall'){const o=A.findEntity(s().interaction.id),c=s().interaction.center;if(o){let angle=s().interaction.baseAngle+(Math.atan2(w.y-c.y,w.x-c.x)-s().interaction.startAngle);if(s().project.snap)angle=Math.round(angle/(Math.PI/12))*(Math.PI/12);const half=s().interaction.length/2;o.x1=c.x-Math.cos(angle)*half;o.y1=c.y-Math.sin(angle)*half;o.x2=c.x+Math.cos(angle)*half;o.y2=c.y+Math.sin(angle)*half}}
      else if(s().interaction.type==='resize-item-corner')A.resizeItemFromCorner(s().interaction,w)
      else if(s().interaction.type==='resize-item'){const o=A.findEntity(s().interaction.id),base=s().interaction.original,a=-(base.rotation||0)*Math.PI/180,dx=w.x-s().interaction.center.x,dy=w.y-s().interaction.center.y,lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);let nw=Math.max(20,Math.abs(lx)*2),nd=Math.max(20,Math.abs(ly)*2);if(s().interaction.keepRatio){const ratio=base.w/base.d;if(nw/nd>ratio)nd=nw/ratio;else nw=nd*ratio}if(s().project.snap){nw=Math.max(20,A.snap(nw));nd=Math.max(20,A.snap(nd))}o.w=nw;o.d=nd;o.x=s().interaction.center.x-nw/2;o.y=s().interaction.center.y-nd/2}
      else if(s().interaction.type==='rotate-item'){const o=A.findEntity(s().interaction.id),angle=Math.atan2(w.y-s().interaction.center.y,w.x-s().interaction.center.x)*180/Math.PI+90;o.rotation=s().project.snap?Math.round(angle/15)*15:Math.round(angle)}
      else s().interaction.current={x:A.snap(w.x),y:A.snap(w.y)};
      A.draw();
    });

    const handlePointerUp=e=>{
      activePointers.delete(e.pointerId);
      s().pointerBackup=null;
      if(s().interaction?.type==='pinch'){s().interaction=null;pinchStartDist=0;A.queueSave();return}
      if(!s().interaction)return;
      if(s().interaction.type==='orbit'){s().interaction=null;A.queueSave();return}
      if(s().interaction.type==='move'||s().interaction.type==='move-group'||s().interaction.type==='rotate-group'){A.queueSave();A.renderInspector()}
      if(['resize-item','resize-item-corner','rotate-item','resize-wall-start','resize-wall-end','rotate-wall','resize-beam-start','resize-beam-end'].includes(s().interaction.type)){A.queueSave();A.renderInspector()}
      if(s().interaction.type==='marquee'){
        const dragDistance=Math.hypot(s().interaction.current.x-s().interaction.start.x,s().interaction.current.y-s().interaction.start.y)*s().scale;
        if(dragDistance>6)A.marqueeSelection(s().interaction);
        else if(s().interaction.clickTarget)A.select(s().interaction.clickTarget);
      }
      if(s().interaction.type==='column'){
        const a=s().interaction.start;
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
          const recD = Math.max(30, Math.ceil((spanM / 14) * 10) * 5);
          const o={
            id: A.uid(),
            type: 'beam',
            name: `Beam B${beamCount}`,
            tag: `B${beamCount}`,
            x1: a.x, y1: a.y, x2: b.x, y2: b.y,
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
    canvas.addEventListener('pointercancel',e=>{activePointers.delete(e.pointerId);A.cancelInteraction();});

    canvas.addEventListener('wheel',e=>{e.preventDefault();if(s().viewMode==='3d'){s().project.camera.zoom=Math.max(.18,Math.min(1.4,s().project.camera.zoom*(e.deltaY>0?.9:1.1)));updateZoom();A.draw();return}const p=A.pointerPos(e),before=A.screenToWorld(p);s().scale=Math.max(.18,Math.min(1.8,s().scale*(e.deltaY>0?.9:1.1)));s().offset.x=p.x-before.x*s().scale;s().offset.y=p.y-before.y*s().scale;updateZoom();A.draw()},{passive:false});
  }

  // ── Keyboard shortcuts ───────────────────────────────────────
  function bindKeyboard() {
    addEventListener('keydown',e=>{
      if(e.key==='Escape'&&A.$('#helpModal').classList.contains('show')){A.$('#helpModal').classList.remove('show');return}
      if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
      if(window.atelier3D?.isWalking?.()){if(e.key==='Escape'){window.atelier3D.setWalk(false);A.renderInspector();A.showToast('Orbit view restored')}return}
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();A.deleteSelected();return}
      if(e.key==='Escape'){if(S().interaction)A.cancelInteraction();A.select(null);A.setTool(S().viewMode==='3d'?'pan':'select')}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='c'){e.preventDefault();A.copySelected();return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='v'){e.preventDefault();A.pasteClipboard();return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){e.preventDefault();A.duplicateSelected();return}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
      if(S().viewMode==='plan'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault();const project=S().project;
        const step=e.shiftKey?(project.unit==='ft'||project.unit==='in'?30.48:100):(project.snap?A.gridStep():5);
        const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
        const targets=S().selectedIds.size?A.selectedObjectList():[A.findEntity(S().selected)].filter(Boolean);
        if(targets.length){A.checkpoint();targets.forEach(o=>{if(o.x!==undefined){o.x+=dx;o.y+=dy}else{o.x1+=dx;o.x2+=dx;o.y1+=dy;o.y2+=dy}});A.renderInspector();A.draw();A.queueSave()}
      }
      const keys={v:'select',r:'room',w:'wall',t:'roof',d:'dimension',h:'pan',p:'column',b:'beam'};if(keys[e.key.toLowerCase()])A.setTool(keys[e.key.toLowerCase()])
    });
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
    A.$('#floorViewMode').onchange=e=>{A.checkpoint();s.project.camera.allFloors=e.target.value==='all';if(s.viewMode==='3d')fitPlan();window.atelier3D?.requestRebuild();A.queueSave();};
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
        A.checkpoint();
        s.project.showStructure = !(s.project.showStructure !== false);
        structBtn.classList.toggle('active', s.project.showStructure);
        A.draw();
        if(s.viewMode==='3d') window.atelier3D?.requestRebuild();
        A.queueSave();
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
    A.$('#newFloorElevation').oninput=e=>{e.target.dataset.cm=String(A.toCm(e.target.value))};
    A.$('#cancelFloor').onclick=()=>A.$('#floorModal').classList.remove('show');
    const closeFloorModalBtn=A.$('#closeFloorModalBtn');if(closeFloorModalBtn)closeFloorModalBtn.onclick=()=>A.$('#floorModal').classList.remove('show');
    A.$('#confirmFloor').onclick=()=>{
      const name=A.$('#newFloorName').value.trim()||`Floor ${s.project.floors.length+1}`,elevation=A.toCm(A.$('#newFloorElevation').value);
      if(!Number.isFinite(elevation)){A.showToast('Enter a valid floor elevation');return;}
      A.checkpoint();let next={id:A.uid(),name,elevation,rooms:[],walls:[],items:[],dimensions:[],columns:[],beams:[]};
      if(A.$('#copyFloorContents').checked){next=A.deep(A.floor());const remap=new Map();for(const key of ['rooms','walls','items','dimensions','columns','beams'])for(const o of next[key]||[]){const old=o.id;o.id=A.uid();remap.set(old,o.id);}for(const key of ['rooms','items','dimensions'])for(const o of next[key]||[]){if(o.hostWallId)o.hostWallId=remap.get(o.hostWallId);if(o.boundaryWallIds)o.boundaryWallIds=o.boundaryWallIds.map(id=>remap.get(id)).sort();for(const end of [1,2])if(o['anchor'+end])o['anchor'+end].entityId=remap.get(o['anchor'+end].entityId);}Object.assign(next,{id:A.uid(),name,elevation});}
      s.project.floors.push(next);s.project.activeFloor=s.project.floors.length-1;s.selected=null;s.selectedIds.clear();A.$('#floorModal').classList.remove('show');syncUI();fitPlan();A.queueSave();A.showToast(`${name} added`);
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
    addEventListener('beforeunload',()=>{clearTimeout(s.saveTimer);A.saveProject()});

    // Bridge for renderer3d.js
    window.atelierBridge={get project(){return s.project},floor:A.floor,planBounds:A.planBounds,get selected(){return s.selected},select:selectFloorEntity,queueSave:A.queueSave,checkpoint:A.checkpoint,draw:A.draw,renderInspector:A.renderInspector,snap:A.snap,findEntity:A.findEntity,showToast:A.showToast,applySmartGuides:A.applySmartGuides,updateCameraUI(){A.updateCameraReadouts();updateZoom()}};
    window.addEventListener('atelier:renderer-ready',()=>window.atelier3D?.setVisible(s.viewMode==='3d'));

    // Boot
    A.initEditingSupport();A.initAccessibility();A.initServiceRouting?.();syncUnitPresentation();syncUI();setTimeout(fitPlan,80);
  }

  Object.assign(A, {
    resizeCanvas, syncUnitPresentation, updateZoom, fitPlan,
    zoomIn, zoomOut, undo, redo,
    openFloorModal, renderFloors, updateCounts, syncUI,
    setMobileTab, toggleDesktopPanel, initUI
  });
})();
