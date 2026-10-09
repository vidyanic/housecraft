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
    const s = S(), center = A.worldToScreen({x:o.x+o.w/2,y:o.y+o.d/2});
    const a = -(o.rotation||0)*Math.PI/180, co = Math.cos(a), si = Math.sin(a);
    const lx = (p.x-center.x)*co-(p.y-center.y)*si, ly = (p.x-center.x)*si+(p.y-center.y)*co;
    const hw = o.w/2*s.scale+7, hd = o.d/2*s.scale+7;
    const corners = [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]];
    for (let i=0; i<4; i++) if(Math.hypot(lx-corners[i][0],ly-corners[i][1])<14) return {type:'resize-item',corner:i};
    if(Math.hypot(lx,ly-(-(o.d/2*s.scale)-34))<14) return {type:'rotate-item'};
    return null;
  }

  function selectionRotateHandleHit(p) {
    const s=S();if(s.selectedIds.size<2)return false;
    const g=A.groupSelectionScreen();if(!g)return false;
    return Math.hypot(p.x-g.handle.x,p.y-g.handle.y)<16;
  }

  // ── Hit testing (which entity is under the pointer) ──────────
  function hitTest(p) {
    const world = A.screenToWorld(p), f = A.floor(), s = S();
    const showStructure = s.project.showStructure !== false;
    if(showStructure && f.columns){
      for(let i=f.columns.length-1;i>=0;i--){
        const o=f.columns[i];
        if(world.x>=o.x&&world.x<=o.x+(o.w||23)&&world.y>=o.y&&world.y<=o.y+(o.d||30)) return o;
      }
    }
    if(showStructure && f.beams){
      for(let i=f.beams.length-1;i>=0;i--){
        const o=f.beams[i],vx=o.x2-o.x1,vy=o.y2-o.y1,t=Math.max(0,Math.min(1,((world.x-o.x1)*vx+(world.y-o.y1)*vy)/(vx*vx+vy*vy||1))),dist=Math.hypot(world.x-(o.x1+t*vx),world.y-(o.y1+t*vy));
        if(dist<Math.max((o.width||23)/2, 10/s.scale)) return o;
      }
    }
    for(let i=f.items.length-1;i>=0;i--){const o=f.items[i];if(!A.isRoofVisibleInPlan(o))continue;if(A.isServiceRoute?.(o)){if(A.serviceHit(o,world,Math.max((o.diameter||2.5)/2,8/s.scale)))return o;continue;}const cx=o.x+o.w/2,cy=o.y+o.d/2,a=-(o.rotation||0)*Math.PI/180,dx=world.x-cx,dy=world.y-cy,x=dx*Math.cos(a)-dy*Math.sin(a)+cx,y=dx*Math.sin(a)+dy*Math.cos(a)+cy;if(x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.d)return o}
    for(let i=f.walls.length-1;i>=0;i--){const o=f.walls[i],vx=o.x2-o.x1,vy=o.y2-o.y1,t=Math.max(0,Math.min(1,((world.x-o.x1)*vx+(world.y-o.y1)*vy)/(vx*vx+vy*vy||1))),dist=Math.hypot(world.x-(o.x1+t*vx),world.y-(o.y1+t*vy));if(dist<Math.max(o.thickness/2,10/s.scale))return o}
    for(let i=f.dimensions.length-1;i>=0;i--){const o=f.dimensions[i],vx=o.x2-o.x1,vy=o.y2-o.y1,t=Math.max(0,Math.min(1,((world.x-o.x1)*vx+(world.y-o.y1)*vy)/(vx*vx+vy*vy||1))),dist=Math.hypot(world.x-(o.x1+t*vx),world.y-(o.y1+t*vy));if(dist<12/s.scale)return o}
    for(let i=f.rooms.length-1;i>=0;i--){const o=f.rooms[i];if(o.polygon?A.pointInPolygon(world,o.polygon):world.x>=o.x&&world.x<=o.x+o.w&&world.y>=o.y&&world.y<=o.y+o.d)return o}
    return null;
  }

  // ── Smart guide snapping ─────────────────────────────────────
  function applySmartGuides(movingObjs) {
    const s=S();s.snapGuides=[];
    if(!movingObjs.length||!s.project.snap)return;
    const box=A.movingBox(movingObjs),cx=(box.minX+box.maxX)/2,cy=(box.minY+box.maxY)/2,th=7/s.scale;
    const others=A.floor().items.filter(o=>!movingObjs.includes(o));
    const vCands=[],hCands=[];
    others.forEach(o=>{const r=A.itemAabb(o,0);vCands.push(r.minX,(r.minX+r.maxX)/2,r.maxX);hCands.push(r.minY,(r.minY+r.maxY)/2,r.maxY)});
    A.floor().rooms.forEach(r=>{vCands.push(r.x,r.x+r.w/2,r.x+r.w);hCands.push(r.y,r.y+r.d/2,r.y+r.d)});
    A.floor().walls.forEach(w=>{if(Math.abs(w.x1-w.x2)<1.5){vCands.push(w.x1-w.thickness/2,w.x1,w.x1+w.thickness/2)}else if(Math.abs(w.y1-w.y2)<1.5){hCands.push(w.y1-w.thickness/2,w.y1,w.y1+w.thickness/2)}});
    let bx=null;[box.minX,cx,box.maxX].forEach(e=>vCands.forEach(c=>{const dd=Math.abs(e-c);if(dd<th&&(!bx||dd<bx.dd))bx={dd,shift:c-e,line:c}}));
    let by=null;[box.minY,cy,box.maxY].forEach(e=>hCands.forEach(c=>{const dd=Math.abs(e-c);if(dd<th&&(!by||dd<by.dd))by={dd,shift:c-e,line:c}}));
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
    const signs=[[-1,-1],[1,-1],[1,1],[-1,1]][interaction.corner??2],anchor={x:-signs[0]*base.w/2,y:-signs[1]*base.d/2};
    const opening=['door','window'].includes(base.shape||base.type),minW=20,minD=opening?4:20;
    let nw=Math.max(minW,Math.abs(cursor.x-anchor.x)),nd=Math.max(minD,Math.abs(cursor.y-anchor.y));
    if(interaction.keepRatio){const ratio=base.w/base.d;if(nw/nd>ratio)nd=Math.max(minD,nw/ratio);else nw=Math.max(minW,nd*ratio)}
    const project=S().project;
    if(project.snap){nw=Math.max(minW,A.snap(nw));nd=opening?Math.max(minD,nd):Math.max(minD,A.snap(nd))}
    const localCenter={x:(cursor.x+anchor.x)/2,y:(cursor.y+anchor.y)/2};o.w=nw;o.d=nd;o.x=cx+localCenter.x*co-localCenter.y*si-nw/2;o.y=cy+localCenter.x*si+localCenter.y*co-nd/2;
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
    const ids=A.floor().items.filter(o=>{const b=A.itemAabb(o);return b.maxX>=minX&&b.minX<=maxX&&b.maxY>=minY&&b.minY<=maxY}).map(o=>o.id);
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
    s.selectedIds=new Set(ids.filter(id=>id&&itemIds.has(id)));
    s.selected=primary||Array.from(s.selectedIds)[0]||null;
    A.renderInspector();A.draw();
    const o=A.findEntity(s.selected);
    updateMobileSelectionChip(o);
    if(o&&A.floor().items.includes(o)&&s.viewMode==='plan')A.showHint(s.selectedIds.size>1?'Drag the group to move · round handle to rotate':'Drag inside the object to move · drag a white corner handle to resize · round handle to rotate');
  }

  function select(id) { setSelection(id?[id]:[],id); }

  function toggleSelection(id) {
    const s=S(),ids=new Set(s.selectedIds);if(ids.has(id))ids.delete(id);else ids.add(id);setSelection(Array.from(ids),id||Array.from(ids)[0]);
  }

  function selectedObjectList() { return A.floor().items.filter(o=>S().selectedIds.has(o.id)); }

  // ── Tool & view switching ────────────────────────────────────
  function setTool(next) {
    const s=S();
    if(s.viewMode==='3d'&&['room','wall','roof','dimension'].includes(next)){A.showToast('Switch to Plan to draw');return}
    s.tool=next;s.interaction=null;s.canvas.dataset.tool=s.tool;A.$$('.tool[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===s.tool));
    const messages={select:'Drag objects or rooms to move · Shift-click to add · Alt/Option-drag over a room to marquee-select',room:'Drag to define a room',wall:'Drag to draw a wall',roof:'Drag to define a roof footprint',dimension:'Drag between two points',pan:'Drag to move around'};
    if(messages[s.tool]) A.showHint(messages[s.tool]);
  }

  function setView(next) {
    const s=S();
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
    itemHandleHit, selectionRotateHandleHit, hitTest,
    applySmartGuides, alignOpeningToWall, alignWallMountedToWall,
    resizeItemFromCorner, applyGroupRotation, marqueeSelection,
    updateMobileSelectionChip, setSelection, select, toggleSelection, selectedObjectList,
    setTool, setView, addObjectToPlan
  });
})();
