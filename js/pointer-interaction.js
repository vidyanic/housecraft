/**
 * js/pointer-interaction.js — Pointer events, hit testing, tools
 *
 * Handles all mouse/touch input: hit testing, item selection,
 * item handle detection, resize/rotate/move logic, smart guides,
 * wall alignment, opening alignment, marquee selection, group
 * rotation, pinch-to-zoom, and tool/view switching.
 *
 * Depends on: utilities.js, constants.js, app-state.js, canvas-drawing.js
 */
(function () {
  'use strict';
  const A = window.Atelier;
  function S()  { return A.state; }

  // ── Item handle hit testing ──────────────────────────────────
  function itemHandleHit(p, o) {
    if(!A.canTransform(o)||!Number.isFinite(o.w)||!Number.isFinite(o.d))return null;
    const s = S(), center = A.worldToScreen({x:o.x+o.w/2,y:o.y+o.d/2});
    const a = -(o.rotation||0)*Math.PI/180, co = Math.cos(a), si = Math.sin(a);
    const lx = (p.x-center.x)*co-(p.y-center.y)*si, ly = (p.x-center.x)*si+(p.y-center.y)*co;
    if(o.type==='column'&&Math.abs(lx)<o.w*s.scale*.3&&Math.abs(ly)<o.d*s.scale*.3)return null;
    const pad=A.floor().items.includes(o)?7:0;
    const hw = o.w/2*s.scale+pad, hd = o.d/2*s.scale+pad;
    const corners = [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]];
    if(s.pointerType==='touch'&&Math.abs(lx)<o.w*s.scale*.3&&Math.abs(ly)<o.d*s.scale*.3)return null;
    const nearest=corners.map(([x,y],corner)=>({corner,distance:Math.hypot(lx-x,ly-y)})).sort((a,b)=>a.distance-b.distance)[0];
    if(!o.hostWallId&&nearest.distance<(s.pointerType==='touch'?22:14))return{type:'resize-item',corner:nearest.corner};
    const edges=[[0,-hd],[hw,0],[0,hd],[-hw,0]];
    for(let i=0;i<4;i++)if((!o.hostWallId||i%2===1)&&Math.hypot(lx-edges[i][0],ly-edges[i][1])<(s.pointerType==='touch'?18:10))return{type:'resize-item',edge:i};
    if(!o.hostWallId&&o.rotation!==undefined&&Math.hypot(lx,ly-(-(o.d/2*s.scale)-34))<14) return {type:'rotate-item'};
    return null;
  }

  function selectionRotateHandleHit(p) {
    const s=S();if(s.selectedIds.size<2||A.selectedObjectList().some(o=>o.hostWallId))return false;
    const g=A.groupSelectionScreen();if(!g)return false;
    return Math.hypot(p.x-g.handle.x,p.y-g.handle.y)<16;
  }

  // ── Hit testing (which entity is under the pointer) ──────────
  function itemContainsPoint(o,world,tolerance=0){
    if(A.isServiceRoute?.(o))return A.serviceHit(o,world,Math.max((o.diameter||2.5)/2,tolerance));
    const cx=o.x+o.w/2,cy=o.y+o.d/2,a=-(o.rotation||0)*Math.PI/180,dx=world.x-cx,dy=world.y-cy,x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);
    return Math.abs(x)<=o.w/2&&Math.abs(y)<=o.d/2;
  }
  function hitTestAll(p){
    const world=A.screenToWorld(p),f=A.floor(),s=S(),hits=[],reverse=list=>[...(list||[])].reverse();
    const nearSegment=(o,width)=>{const dx=o.x2-o.x1,dy=o.y2-o.y1,t=Math.max(0,Math.min(1,((world.x-o.x1)*dx+(world.y-o.y1)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(world.x-o.x1-t*dx,world.y-o.y1-t*dy)<width;};
    if(s.workspace!=='architecture'&&s.workspace!=='services'&&s.project.showStructure!==false){for(const o of reverse(f.columns))if(itemContainsPoint(o,world))hits.push(o);for(const o of reverse(f.beams))if(nearSegment(o,Math.max((o.width||23)/2,10/s.scale)))hits.push(o);}
    for(const o of reverse(f.items)){if(s.workspace==='services'?!o.system:s.project.framingMode||!A.isRoofVisibleInPlan(o))continue;if(itemContainsPoint(o,world,8/s.scale))hits.push(o);}
    if(s.workspace!=='services')for(const o of reverse(f.walls))if(nearSegment(o,Math.max(o.thickness/2,10/s.scale)))hits.push(o);
    for(const o of reverse(f.dimensions))if(nearSegment(o,12/s.scale))hits.push(o);
    if(s.workspace!=='services')for(const o of reverse(f.rooms))if(o.polygon?A.pointInPolygon(world,o.polygon):itemContainsPoint(o,world))hits.push(o);
    return hits;
  }
  function hitTest(p){return hitTestAll(p)[0]||null;}
  function cycleOverlapSelection(){
    const s=S(),o=A.findEntity(s.selected);if(!o||s.workspace==='structure'){A.showToast('Select a plan element before cycling overlaps');return;}
    const world=s.lastSelectionWorld?.floorId===A.floor().id?s.lastSelectionWorld:o.x!=null?{x:o.x+o.w/2,y:o.y+o.d/2}:{x:(o.x1+o.x2)/2,y:(o.y1+o.y2)/2};
    const hits=hitTestAll(A.worldToScreen(world));if(hits.length<2){A.showToast('No other visible element overlaps this point');return;}
    const index=hits.findIndex(hit=>hit.id===o.id),next=hits[(index+1)%hits.length];select(next.id);A.setMobileTab?.('stage');A.showHint(`Overlap ${(index+1)%hits.length+1} of ${hits.length} · ${next.name||next.type}`);
  }

  // ── Smart guide snapping ─────────────────────────────────────
  function applySmartGuides(movingObjs) {
    const s=S();s.snapGuides=[];
    if(!movingObjs.length||!s.project.snap)return;
    const box=A.movingBox(movingObjs),cx=(box.minX+box.maxX)/2,cy=(box.minY+box.maxY)/2,th=7/s.scale;
    let cache=s.interaction?.guideCache;
    if(!cache){const others=A.floor().items.filter(o=>!movingObjs.includes(o)&&A.isRoofVisibleInPlan(o)&&(s.workspace!=='services'||o.system)),vCands=[],hCands=[];
      others.forEach(o=>{const r=A.itemAabb(o,0);vCands.push(r.minX,(r.minX+r.maxX)/2,r.maxX);hCands.push(r.minY,(r.minY+r.maxY)/2,r.maxY)});
      A.floor().rooms.forEach(r=>{vCands.push(r.x,r.x+r.w/2,r.x+r.w);hCands.push(r.y,r.y+r.d/2,r.y+r.d)});
      A.floor().walls.forEach(w=>{if(Math.abs(w.x1-w.x2)<1.5){vCands.push(w.x1-w.thickness/2,w.x1,w.x1+w.thickness/2)}else if(Math.abs(w.y1-w.y2)<1.5){hCands.push(w.y1-w.thickness/2,w.y1,w.y1+w.thickness/2)}});
      cache={vCands,hCands};if(s.interaction)s.interaction.guideCache=cache;
    }
    const {vCands,hCands}=cache;
    let bx=null;[box.minX,cx,box.maxX].forEach(e=>vCands.forEach(c=>{const dd=Math.abs(e-c);if(dd<th&&(!bx||dd<bx.dd))bx={dd,shift:c-e,line:c}}));
    let by=null;[box.minY,cy,box.maxY].forEach(e=>hCands.forEach(c=>{const dd=Math.abs(e-c);if(dd<th&&(!by||dd<by.dd))by={dd,shift:c-e,line:c}}));
    const held=s.interaction?.heldGuide;
    if(held){for(const [axis,edges] of [['x',[box.minX,cx,box.maxX]],['y',[box.minY,cy,box.maxY]]]){if(held[axis]==null)continue;const edge=edges.reduce((best,e)=>Math.abs(e-held[axis])<Math.abs(best-held[axis])?e:best);const dd=Math.abs(edge-held[axis]);if(dd<th*1.5){const guide={dd,shift:held[axis]-edge,line:held[axis]};if(axis==='x')bx=guide;else by=guide;}}}
    if(s.interaction)s.interaction.heldGuide={x:bx?.line,y:by?.line};
    if(bx){movingObjs.forEach(o=>{if(o.x!==undefined)o.x+=bx.shift});s.snapGuides.push({x:bx.line})}
    if(by){movingObjs.forEach(o=>{if(o.y!==undefined)o.y+=by.shift});s.snapGuides.push({y:by.line})}
  }

  // ── Wall/opening alignment ───────────────────────────────────
  function alignOpeningToWall(o) {
    if(A.hostOpening){A.hostOpening(o);return;}
    if(!['door','window'].includes(o.shape))return;
    const cx=o.x+o.w/2,cy=o.y+o.d/2;let best=null;
    A.floor().walls.forEach(w=>{const vx=w.x2-w.x1,vy=w.y2-w.y1,t=Math.max(0,Math.min(1,((cx-w.x1)*vx+(cy-w.y1)*vy)/(vx*vx+vy*vy||1))),px=w.x1+t*vx,py=w.y1+t*vy,dist=Math.hypot(cx-px,cy-py);if(!best||dist<best.dist)best={wall:w,x:px,y:py,dist}});
    if(best&&best.dist<90){o.rotation=Math.atan2(best.wall.y2-best.wall.y1,best.wall.x2-best.wall.x1)*180/Math.PI;o.d=Math.max(10,best.wall.thickness+4);o.x=best.x-o.w/2;o.y=best.y-o.d/2;}
  }

  function alignWallMountedToWall(o) {
    if(!A.WALL_MOUNTED_SHAPES.has(o.shape))return;
    const cx=o.x+o.w/2,cy=o.y+o.d/2;let best=null;
    A.floor().walls.forEach(w=>{const vx=w.x2-w.x1,vy=w.y2-w.y1,len2=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((cx-w.x1)*vx+(cy-w.y1)*vy)/len2)),px=w.x1+t*vx,py=w.y1+t*vy,dist=Math.hypot(cx-px,cy-py);if(!best||dist<best.dist)best={wall:w,x:px,y:py,dist}});
    if(!best||best.dist>120)return;
    const angle=Math.atan2(best.wall.y2-best.wall.y1,best.wall.x2-best.wall.x1),nx=-Math.sin(angle),ny=Math.cos(angle),side=((cx-best.x)*nx+(cy-best.y)*ny)>=0?1:-1,gap=best.wall.thickness/2+o.d/2+1;
    o.rotation=angle*180/Math.PI;o.x=best.x+nx*side*gap-o.w/2;o.y=best.y+ny*side*gap-o.d/2;o.d=Math.max(4,o.d);
  }

  // ── Corner resize logic ──────────────────────────────────────
  function resizeItemFromCorner(interaction, w) {
    const o=A.findEntity(interaction.id),base=interaction.original;if(!o||!base)return;
    const angle=(base.rotation||0)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle),cx=base.x+base.w/2,cy=base.y+base.d/2;
    const dx=w.x-cx,dy=w.y-cy,cursor={x:dx*co+dy*si,y:-dx*si+dy*co};
    const signs=interaction.edge!=null?[[0,-1],[1,0],[0,1],[-1,0]][interaction.edge]:[[-1,-1],[1,-1],[1,1],[-1,1]][interaction.corner??2],anchor={x:-signs[0]*base.w/2,y:-signs[1]*base.d/2};
    cursor.x-=interaction.grabOffset?.x||0;cursor.y-=interaction.grabOffset?.y||0;
    const opening=['door','window'].includes(base.shape||base.type),minW=Math.min(base.w,base.system?1:20),minD=Math.min(base.d,base.system?1:opening?4:20);
    let nw=signs[0]?Math.max(minW,(cursor.x-anchor.x)*signs[0]):base.w,nd=signs[1]?Math.max(minD,(cursor.y-anchor.y)*signs[1]):base.d;
    const keepRatio=interaction.keepRatio&&!base.hostWallId;
    if(keepRatio){const ratio=base.w/base.d;if(nw/nd>ratio)nd=Math.max(minD,nw/ratio);else nw=Math.max(minW,nd*ratio)}
    const project=S().project;
    if(project.snap&&!interaction.freeSnap){nw=Math.max(minW,A.snap(nw));nd=opening?Math.max(minD,nd):Math.max(minD,A.snap(nd))}
    if(keepRatio){const ratio=base.w/base.d;if(interaction.edge===0||interaction.edge===2)nw=nd*ratio;else nd=nw/ratio;if(nw<minW||nd<minD){const factor=Math.max(minW/nw,minD/nd);nw*=factor;nd*=factor;}}
    if(base.hostWallId){const wall=A.floor().walls.find(o=>o.id===base.hostWallId);if(wall){const length=Math.hypot(wall.x2-wall.x1,wall.y2-wall.y1),station=base.wallOffset||0;nw=Math.min(nw,signs[0]>0?length-station+base.w/2:station+base.w/2);nd=base.d;}}
    const localCenter={x:anchor.x+signs[0]*nw/2,y:anchor.y+signs[1]*nd/2};o.w=nw;o.d=nd;o.x=cx+localCenter.x*co-localCenter.y*si-nw/2;o.y=cy+localCenter.x*si+localCenter.y*co-nd/2;
  }

  // ── Group rotation logic ─────────────────────────────────────
  function applyGroupRotation(interaction, w) {
    const project=S().project;
    let delta=Math.atan2(w.y-interaction.center.y,w.x-interaction.center.x)-interaction.startAngle;
    if(project.snap)delta=Math.round(delta/(Math.PI/12))*(Math.PI/12);
    const c=Math.cos(delta),si=Math.sin(delta);
    interaction.ids.forEach(id=>{const o=A.findEntity(id),b=interaction.originals[id];if(!o||!b)return;const ox=b.x+b.w/2-interaction.center.x,oy=b.y+b.d/2-interaction.center.y;o.x=interaction.center.x+(ox*c-oy*si)-b.w/2;o.y=interaction.center.y+(ox*si+oy*c)-b.d/2;o.rotation=((b.rotation||0)+delta*180/Math.PI+3600)%360});
  }

  // ── Marquee selection ────────────────────────────────────────
  function marqueeSelection(interaction) {
    const s=S();
    const minX=Math.min(interaction.start.x,interaction.current.x),maxX=Math.max(interaction.start.x,interaction.current.x),minY=Math.min(interaction.start.y,interaction.current.y),maxY=Math.max(interaction.start.y,interaction.current.y);
    const ids=A.floor().items.filter(o=>{if(!A.isRoofVisibleInPlan(o)||(s.workspace==='services'&&!o.system)||s.project.framingMode)return false;const b=A.itemAabb(o);return b.maxX>=minX&&b.minX<=maxX&&b.maxY>=minY&&b.minY<=maxY}).map(o=>o.id);
    const next=interaction.additive?new Set(s.selectedIds):new Set();ids.forEach(id=>next.add(id));A.setSelection(Array.from(next),ids[0]||Array.from(next)[0]);
  }

  // ── Selection helpers ────────────────────────────────────────
  function updateMobileSelectionChip(o) {
    const chip=A.$('#mobileSelectionChip'),badgeDot=A.$('#selectionBadgeDot');
    if(!chip)return;
    if(o&&A.floor().items.includes(o)){
      chip.classList.add('show');if(badgeDot)badgeDot.classList.add('active');
      const nameEl=A.$('#chipName'),metaEl=A.$('#chipMeta');
      if(nameEl)nameEl.textContent=o.name||o.type;
      if(metaEl)metaEl.textContent=`${A.formatLength(o.w)} × ${A.formatLength(o.d)}`;
    }else{
      chip.classList.remove('show');if(badgeDot)badgeDot.classList.remove('active');
    }
  }

  function setSelection(ids, primary) {
    const s=S(),itemIds=new Set(A.floor().items.map(o=>o.id));
    if(s.selected!==primary||ids.length!==s.selectedIds.size||ids.some(id=>!s.selectedIds.has(id)))s.moveConstraint='free';
    s.selectedIds=new Set(ids.filter(id=>id&&itemIds.has(id)));
    s.selected=primary||Array.from(s.selectedIds)[0]||null;
    A.renderInspector();A.draw();
    const o=A.findEntity(s.selected);
    updateMobileSelectionChip(o);
    if(o&&A.floor().items.includes(o)&&s.viewMode==='plan')A.showHint(s.selectedIds.size>1?'Drag the group to move · round handle to rotate':'Drag inside the object to move · drag a white corner handle to resize · round handle to rotate');
  }

  function select(id) { setSelection(id?[id]:[],id); }

  function movementDirection(mode,base) {
    const a=(base?.rotation||0)*Math.PI/180;
    return mode==='x'?{x:1,y:0}:mode==='y'?{x:0,y:1}:mode==='object-x'?{x:Math.cos(a),y:Math.sin(a)}:mode==='object-y'?{x:-Math.sin(a),y:Math.cos(a)}:null;
  }
  function constrainedMovement(interaction,dx,dy,{shift=false,freeSnap=false}={}) {
    const s=S(),mode=s.moveConstraint||'free',snap=n=>freeSnap?n:A.snap(n);
    let direction=null,label='';
    if(mode!=='free'&&interaction.type==='move-group'&&!interaction.targets.some(o=>o.hostWallId)){
      const base=interaction.originals[s.selected]||interaction.originals[interaction.ids[0]];
      direction=movementDirection(mode,base);
      label={'x':'X','y':'Y','object-x':'Object X','object-y':'Object Y'}[mode];
    }else if(shift){
      interaction.axisLock ||= Math.abs(dx)>=Math.abs(dy)?'x':'y';
      direction=interaction.axisLock==='x'?{x:1,y:0}:{x:0,y:1};label=interaction.axisLock.toUpperCase();
    }
    if(!shift)delete interaction.axisLock;
    if(direction){const distance=snap(dx*direction.x+dy*direction.y);interaction.movementGuide={origin:interaction.start,direction,label,distance};return{dx:distance*direction.x,dy:distance*direction.y};}
    delete interaction.movementGuide;return{dx:snap(dx),dy:snap(dy)};
  }

  function toggleSelection(id) {
    const s=S(),ids=new Set(s.selectedIds);if(ids.has(id))ids.delete(id);else ids.add(id);setSelection(Array.from(ids),ids.has(id)?id:Array.from(ids)[0]||null);
  }

  function selectedObjectList() { return A.floor().items.filter(o=>S().selectedIds.has(o.id)); }

  // ── Tool & view switching ────────────────────────────────────
  function setTool(next) {
    if(A.readOnly)next='pan';
    const s=S();
    if(s.workspace==='structure'&&!['select','pan','column','beam'].includes(next)||s.workspace==='services'&&!['select','pan','dimension'].includes(next)||s.workspace==='architecture'&&['column','beam'].includes(next))return;
    if(s.pointerBackup)A.cancelInteraction();
    if(document.querySelector('#serviceRouteBar'))A.stopServiceRoute?.();
    if(s.viewMode==='3d'&&['room','wall','roof','dimension'].includes(next)){A.showToast('Switch to Plan to draw');return}
    s.tool=next;s.interaction=null;s.canvas.dataset.tool=s.tool;A.$$('.tool[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===s.tool));
    const messages={select:'Drag objects or rooms to move · Shift-click to add · Alt/Option-drag over a room to marquee-select',room:'Drag to define a room',wall:'Drag to draw a wall',roof:'Drag to define a roof footprint',dimension:'Drag between two points',column:'Click or drag to place a column · Alt bypasses snaps',beam:'Drag a beam · snap endpoints to columns · Alt bypasses guides',pan:'Drag to move around'};
    if(messages[s.tool]) A.showHint(messages[s.tool]);
  }

  function setView(next) {
    const s=S();
    if(s.pointerBackup)A.cancelInteraction();
    if(document.querySelector('#serviceRouteBar'))A.stopServiceRoute?.();s.routeEditing=null;
    if(next==='3d'&&!window.atelier3D){A.showToast('3D is unavailable in this browser. Plan editing remains available.');return;}
    if(next!=='3d')window.atelier3D?.setWalk?.(false);
    s.viewMode=next;s.canvas.dataset.view=next;s.canvas.style.display=next==='3d'?'none':'block';A.$('#threeStage').style.display=next==='3d'?'block':'none';window.atelier3D?.setVisible(next==='3d');A.$$('.view-switch button').forEach(b=>b.classList.toggle('active',b.dataset.view===next));
    A.$$('.tool[data-tool="room"],.tool[data-tool="wall"],.tool[data-tool="roof"],.tool[data-tool="dimension"]').forEach(b=>b.disabled=next==='3d');
    A.$('#gridBtn').style.opacity=next==='3d'?'.35':'1';A.$('#gridBtn').disabled=next==='3d';A.$('#gridLegend').style.display=next==='3d'?'none':'block';A.$('#compass').style.display=next==='3d'?'none':'grid';
    A.$('#workspaceModeLabel').textContent=next==='3d'?'physically based 3D model':'2D drafting workspace';setTool(next==='3d'?'pan':'select');A.renderInspector();A.fitPlan();A.showToast(next==='3d'?'PBR scene ready — orbit, pan and zoom':'2D plan view');
  }

  // ── Add object to plan ───────────────────────────────────────
  function addObjectToPlan(type, customWorldPos=null) {
    const s=S(),src=A.CATALOG.find(x=>x.type===type);
    if(!src)return;
    if(s.viewMode==='3d'){setView('plan');}
    A.checkpoint();
    let wx, wy;
    if(customWorldPos){wx=customWorldPos.x; wy=customWorldPos.y;}
    else{
      const r=s.canvas.getBoundingClientRect(),centerScreen={x:r.width/2,y:r.height/2};
      const bounds=A.planBounds();
      const centerWorld=r.width&&r.height?A.screenToWorld(centerScreen):{x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2};
      wx=centerWorld.x; wy=centerWorld.y;
    }
    const o={id:A.uid(),type:src.type,shape:src.shape,name:src.name,x:A.snap(wx-src.w/2),y:A.snap(wy-src.d/2),w:src.w,d:src.d,height:src.height||80,elevation:src.elevation||0,rotation:0,swing:src.swing,openAngle:src.openAngle,hingeSide:'left',swingSide:1,doorStyle:src.doorStyle,openingStyle:src.openingStyle,templeFinial:src.templeFinial,stairWidth:src.stairWidth,landingWidth:src.landingWidth,landingLength:src.landingLength,landingDepth:src.landingDepth,lowerStepCount:src.lowerStepCount,upperStepCount:src.upperStepCount,stepCount:src.stepCount,underStorage:src.underStorage,parkingUnder:src.parkingUnder,switches:src.switches,breakers:src.breakers,bladeCount:src.bladeCount,lumens:src.lumens,transparency:src.transparency??(src.material==='Glass'?45:0),active:src.active??false,clearance:0,lockAspect:!['door','window'].includes(src.shape),material:src.material||'Wood',color:src.color};
    A.initServiceObject?.(o,src);
    if(src.shape==='three-side-stairs'){for(const key of ['stairStartSide','stairHandedness','stairTargetRiser','stairLandingMin','stairPlatformLength'])o[key]=src[key];o.lockAspect=false;}
    if(['door','window'].includes(src.shape))alignOpeningToWall(o);
    else if(A.WALL_MOUNTED_SHAPES.has(src.shape))alignWallMountedToWall(o);
    A.floor().items.push(o);
    select(o.id);
    A.queueSave();
    A.updateCounts();
    A.showToast(`${src.name} added`);
    if(window.innerWidth<=920){A.setMobileTab('stage');}
  }

  // ── Expose on global namespace ───────────────────────────────
  Object.assign(A, {
    itemHandleHit, itemContainsPoint, selectionRotateHandleHit, hitTest, hitTestAll, cycleOverlapSelection,
    applySmartGuides, alignOpeningToWall, alignWallMountedToWall,
    resizeItemFromCorner, applyGroupRotation, marqueeSelection, constrainedMovement, movementDirection,
    updateMobileSelectionChip, setSelection, select, toggleSelection, selectedObjectList,
    setTool, setView, addObjectToPlan
  });
})();
