/**
 * js/object-operations.js — Object manipulation operations
 *
 * Clipboard (copy/paste), delete, duplicate, rotate, scale,
 * align-to-wall, z-ordering, nudge, and the right-click
 * context menu.
 *
 * Depends on: utilities.js, app-state.js, canvas-drawing.js,
 *             pointer-interaction.js
 */
(function () {
  'use strict';
  const A = window.Atelier;
  function S() { return A.state; }

  // ── Entity collection helper ─────────────────────────────────
  function entityCollection(o) {
    if(o.type==='room') return A.floor().rooms;
    if(o.type==='wall') return A.floor().walls;
    if(o.type==='dimension') return A.floor().dimensions;
    if(o.type==='column') return (A.floor().columns ||= []);
    if(o.type==='beam') return (A.floor().beams ||= []);
    if(o.type==='slab') return (A.floor().slabs ||= []);
    if(o.type==='load') return (A.floor().loads ||= []);
    if(o.type==='structural-wall') return (A.floor().structuralWalls ||= []);
    if(o.type==='grid') return (A.floor().grids ||= []);
    return A.floor().items;
  }

  // ── Delete ───────────────────────────────────────────────────
  function deleteSelected() {
    const s=S(),ids=new Set(s.selectedIds.size?s.selectedIds:(s.selected?[s.selected]:[]));
    if(!ids.size) return;
    if(Array.from(ids).some(id=>A.findEntity(id)?.locked)){A.showToast('Unlock selected objects before removing them');return;}
    A.checkpoint();
    if(s.selectedIds.size){
      A.floor().items=A.floor().items.filter(o=>!ids.has(o.id));
      if(A.floor().columns) A.floor().columns=A.floor().columns.filter(o=>!ids.has(o.id));
      if(A.floor().beams) A.floor().beams=A.floor().beams.filter(o=>!ids.has(o.id));
    } else {
      for(const key of ['rooms','walls','items','dimensions','columns','beams','slabs','loads','structuralWalls','grids']){
        if(!A.floor()[key]) continue;
        const i=A.floor()[key].findIndex(x=>x.id===s.selected);
        if(i>=0){A.floor()[key].splice(i,1);break}
      }
    }
    const count=ids.size;s.selected=null;s.selectedIds.clear();A.renderInspector();A.draw();A.updateCounts();A.queueSave();A.showToast(`${count} object${count===1?'':'s'} removed`);
  }

  // ── Nudge ────────────────────────────────────────────────────
  function nudgeEntity(o) {
    if(!A.canTransform(o))return;
    A.checkpoint();if(o.x!==undefined){o.x+=20;o.y+=20}else{o.x1+=20;o.y1+=20;o.x2+=20;o.y2+=20}A.draw();A.renderInspector();A.queueSave();
  }

  // ── Rotate wall 90° ──────────────────────────────────────────
  function rotateWall90() {
    const s=S(),o=A.findEntity(s.selected);if(!A.canTransform(o)||o.type!=='wall')return;
    A.checkpoint();const cx=(o.x1+o.x2)/2,cy=(o.y1+o.y2)/2,dx=o.x2-o.x1,dy=o.y2-o.y1;o.x1=cx+dy/2;o.y1=cy-dx/2;o.x2=cx-dy/2;o.y2=cy+dx/2;A.draw();A.renderInspector();A.queueSave();A.showToast('Wall rotated 90°');
  }

  // ── Clipboard ────────────────────────────────────────────────
  const structuralCollections=['columns','beams','slabs','structuralWalls','loads','grids'];
  function structuralReferenceIssues(floor=A.floor(),project=S().project,entities=null){
    const columns=new Set((floor.columns||[]).map(c=>c.id)),issues=[];
    const labels={startColumnId:'Start joint',endColumnId:'End joint',columnId:'Assigned column'};
    for(const o of entities||structuralCollections.flatMap(k=>floor[k]||[]))for(const [field,label] of Object.entries(labels)){
      const referenceId=o[field];if(!referenceId||columns.has(referenceId))continue;
      const other=(project.floors||[]).find(f=>f.id!==floor.id&&(f.columns||[]).some(c=>c.id===referenceId));
      const wrongType=structuralCollections.some(k=>k!=='columns'&&(floor[k]||[]).some(e=>e.id===referenceId));
      const member=o.tag||o.name||o.id,reason=other?`column belongs to ${other.name}, not ${floor.name}`:wrongType?'reference points to a non-column object':'column is missing or was deleted';
      issues.push({floorId:floor.id,entityId:o.id,field,label,referenceId,member,message:`${member} · ${label}: ${reason} (${referenceId}).`,guidance:`Choose an existing column in ${label}, or explicitly choose Unconnected if this connection should be free.`});
    }
    return issues;
  }
  function copyStructureToFloors({targetIds=[],newFloors=0,gap=300}={}){
    if(A.readOnly)throw Error('This layout is read-only.');
    if(S().pointerBackup)A.cancelInteraction();
    const p=S().project,source=A.floor();
    if(!Array.isArray(targetIds)||!Number.isInteger(newFloors)||newFloors<0||newFloors>20)throw Error('Choose destination floors and 0–20 new levels.');
    if(!structuralCollections.some(k=>source[k]?.length))throw Error('The current floor has no structure to copy.');
    const issues=structuralReferenceIssues(source,p);
    if(issues.length){const error=Error(`Cannot copy structure: ${issues.length} broken column connection(s). ${issues[0].message}`);error.structuralIssues=issues;throw error;}
    const targets=[...new Set(targetIds)];
    if(!targets.length&&!newFloors)throw Error('Choose a destination or add new levels.');
    for(const id of targets){const f=p.floors.find(f=>f.id===id);if(!f||f===source)throw Error('Choose a different existing destination floor.');if(structuralCollections.some(k=>f[k]?.length))throw Error(f.name+' already contains structure. Choose an empty structural floor.');}
    if(newFloors&&(!Number.isFinite(gap)||gap<=0))throw Error('Enter a positive floor-to-floor height.');
    if(p.floors.length+newFloors>100)throw Error('A project can contain at most 100 floors.');
    const candidate=A.deep(p),top=Math.max(...p.floors.map(f=>f.elevation));
    for(let i=1;i<=newFloors;i++){
      const elevation=top+i*gap;if(!Number.isFinite(elevation)||candidate.floors.some(f=>Math.abs(f.elevation-elevation)<.01))throw Error('New levels must have distinct finite elevations.');
      let number=p.floors.length+i,name='Floor '+number;while(candidate.floors.some(f=>f.name===name))name='Floor '+(++number);
      const f={id:A.uid(),name,elevation,rooms:[],walls:[],items:[],dimensions:[],isRoof:false};candidate.floors.push(f);targets.push(f.id);
    }
    const count=structuralCollections.reduce((n,k)=>n+(source[k]?.length||0),0);
    for(const id of targets){
      const destination=candidate.floors.find(f=>f.id===id),remap=new Map(structuralCollections.flatMap(k=>(source[k]||[]).map(o=>[o.id,A.uid()])));
      for(const key of structuralCollections)destination[key]=(source[key]||[]).map(o=>{
        const copy=A.deep(o);copy.id=remap.get(o.id);
        for(const ref of ['startColumnId','endColumnId','columnId'])if(copy[ref])copy[ref]=remap.get(copy[ref]);
        return copy;
      });
      destination.diaphragm=source.diaphragm||'none';
    }
    A.normalizeStructure(candidate);A.validateProject(candidate);A.checkpoint();S().project=candidate;S().structuralProposal=null;
    window.atelier3D?.requestRebuild();A.syncUI();A.queueSave();A.showToast(`Complete structure copied to ${targets.length} floor(s) at the same plan position`);
    return {targetIds:targets,count:count*targets.length};
  }
  function copySelectionToFloor(targetId){
    if(S().pointerBackup)A.cancelInteraction();
    const source=A.floor(),target=S().project.floors.find(f=>f.id===targetId),selected=selectedEntitiesForClipboard();
    if(!target||target===source||!selected.length)return [];
    const collections=['rooms','walls','items','dimensions','columns','beams','slabs','loads','structuralWalls','grids'];
    const entities=new Map(collections.flatMap(key=>(source[key]||[]).map(o=>[o.id,{o,key}]))),chosen=new Map();
    function include(id){if(chosen.has(id)||!entities.has(id))return;const record=entities.get(id);chosen.set(id,record);const o=record.o;for(const ref of ['hostWallId','startColumnId','endColumnId','columnId'])if(o[ref])include(o[ref]);for(const id of o.boundaryWallIds||[])include(id);for(const anchor of [o.anchor1,o.anchor2])if(anchor)include(anchor.entityId);}
    selected.forEach(o=>include(o.id));const remap=new Map([...chosen.keys()].map(id=>[id,A.uid()]));
    const candidate=A.deep(S().project),destination=candidate.floors.find(f=>f.id===targetId),copies=[];
    for(const {o,key} of chosen.values()){const copy=A.deep(o);copy.id=remap.get(o.id);delete copy.stairUpperFloorId;for(const ref of ['hostWallId','startColumnId','endColumnId','columnId'])if(copy[ref]){if(remap.has(copy[ref]))copy[ref]=remap.get(copy[ref]);else{delete copy[ref];if(ref==='hostWallId'){delete copy.wallOffset;copy.freePlacement=true;}}}for(const ref of ['anchor1','anchor2'])if(copy[ref]){if(remap.has(copy[ref].entityId))copy[ref].entityId=remap.get(copy[ref].entityId);else delete copy[ref];}if(copy.boundaryWallIds)copy.boundaryWallIds=copy.boundaryWallIds.map(id=>remap.get(id)).filter(Boolean).sort();(destination[key]||=[]).push(copy);copies.push(copy);}
    A.validateProject(candidate);A.checkpoint();for(const key of collections)target[key]=destination[key];
    A.bindBeamEnds?.(target);A.syncArchitecture?.(target);window.atelier3D?.requestRebuild();A.syncUI();A.queueSave();A.showToast(`${selected.length} selected object(s) copied to ${target.name} at the same plan position${copies.length>selected.length?' with linked objects':''}`);return copies;
  }
  function selectedEntitiesForClipboard() { return S().selectedIds.size?A.selectedObjectList():[A.findEntity(S().selected)].filter(Boolean); }

  function copySelected() {
    const sources=selectedEntitiesForClipboard();if(!sources.length){A.showToast('Select an object to copy');return}
    S().copyBuffer=sources.map(A.deep);A.showToast(`${sources.length} object${sources.length===1?'':'s'} copied`);
  }

  function createCopies(sources, label='Duplicate created') {
    if(!sources.length) return;
    const s=S();
    A.checkpoint();const offsetCm=s.project.snap?A.gridStep():20;
    const remap=new Map(sources.map(o=>[o.id,A.uid()]));
    const copies=sources.map(base=>{const copy=A.deep(base);copy.id=remap.get(base.id);delete copy.stairUpperFloorId;if(copy.name)copy.name+= ' copy';if(copy.x!==undefined){copy.x+=offsetCm;copy.y+=offsetCm}else if(copy.type==='grid')copy.position+=offsetCm;else{copy.x1+=offsetCm;copy.y1+=offsetCm;copy.x2+=offsetCm;copy.y2+=offsetCm}
      for(const key of ['hostWallId','startColumnId','endColumnId','columnId'])if(copy[key]&&remap.has(copy[key]))copy[key]=remap.get(copy[key]);
      for(const key of ['anchor1','anchor2'])if(copy[key]){const target=remap.get(copy[key].entityId);if(target)copy[key].entityId=target;else delete copy[key];}
      if(copy.boundaryWallIds){if(copy.boundaryWallIds.every(id=>remap.has(id)))copy.boundaryWallIds=copy.boundaryWallIds.map(id=>remap.get(id)).sort();else{delete copy.boundaryWallIds;delete copy.polygon;}}
      entityCollection(base).push(copy);return copy;});
    const itemCopies=copies.filter(o=>A.floor().items.includes(o));
    if(itemCopies.length===copies.length)A.setSelection(itemCopies.map(o=>o.id),itemCopies[0]?.id);
    else{s.selectedIds.clear();s.selected=copies[0]?.id||null;A.renderInspector();A.draw()}
    A.updateCounts();A.queueSave();A.showToast(label);
  }

  function pasteClipboard() { if(!S().copyBuffer.length){A.showToast('Copy an object first');return}createCopies(S().copyBuffer,'Pasted'); }
  function duplicateSelected() { createCopies(selectedEntitiesForClipboard()); }

  // ── Rotate / scale ───────────────────────────────────────────
  function moveSelectedDistance(distance) {
    if(!Number.isFinite(distance)||distance===0)return;
    const s=S(),objects=s.selectedIds.size?A.selectedObjectList():[A.findEntity(s.selected)],direction=A.movementDirection(s.moveConstraint,A.findEntity(s.selected));
    if(!direction||!objects.length||objects.some(o=>!A.canTransform(o)||o.hostWallId||!A.floor().items.includes(o)))return;
    if(objects.some(o=>!Number.isFinite(o.x+direction.x*distance)||!Number.isFinite(o.y+direction.y*distance)))return;
    A.checkpoint();objects.forEach(o=>{o.x+=direction.x*distance;o.y+=direction.y*distance;});A.queueSave();A.renderInspector();A.draw();
  }
  function rotateSelected(degrees=90) {
    if(typeof degrees!=='number')degrees=90;
    if(!Number.isFinite(degrees))return;
    const s=S(),o=A.findEntity(s.selected);if(!A.canTransform(o)||o.rotation===undefined)return;
    if((s.selectedIds.size?A.selectedObjectList():[o]).some(o=>o.hostWallId)){A.showToast('Detach openings from their walls before rotating');return;}
    if(s.selectedIds.size>1){const objects=A.selectedObjectList();if(objects.some(o=>!A.canTransform(o)))return;const b=A.selectionBounds(),angle=degrees*Math.PI/180;A.checkpoint();A.applyGroupRotation({ids:objects.map(o=>o.id),originals:Object.fromEntries(objects.map(o=>[o.id,A.deep(o)])),center:{x:b.cx,y:b.cy},startAngle:0},{x:b.cx+Math.cos(angle)*100,y:b.cy+Math.sin(angle)*100});A.draw();A.renderInspector();A.queueSave();return;}
    A.checkpoint();o.rotation=((o.rotation||0)+degrees+360)%360;A.renderInspector();A.draw();A.queueSave();
  }

  function scaleSelected(percent,mode='spatial') {
    if(!['spatial','footprint'].includes(mode))return;
    if(!Number.isFinite(percent)||percent<=0){A.showToast('Enter a positive scale percentage');return;}
    const s=S(),objects=s.selectedIds.size?A.selectedObjectList():[A.findEntity(s.selected)],factor=Math.max(.1,Math.min(5,percent/100));
    if(objects.some(o=>o?.hostWallId)){A.showToast('Use opening width or detach it before uniform scaling');return;}
    if(factor===1||objects.some(o=>!A.canTransform(o)||!A.floor().items.includes(o)))return;
    const b=A.movingBox(objects),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;
    A.checkpoint();objects.forEach(o=>{const ox=o.x+o.w/2,oy=o.y+o.d/2;o.w*=factor;o.d*=factor;if(mode==='spatial'){if(Number.isFinite(o.height))o.height*=factor;if(A.isServiceRoute?.(o))o.routePoints.forEach(p=>p.z*=factor);}o.x=cx+(ox-cx)*factor-o.w/2;o.y=cy+(oy-cy)*factor-o.d/2;});A.draw();A.renderInspector();A.queueSave();A.showToast(`Scaled ${mode==='footprint'?'footprint':'in 3D'} to ${Math.round(factor*100)}%`);
  }

  // ── Align to wall ────────────────────────────────────────────
  function editableItemSelection(){const objects=A.selectedObjectList();if(objects.length<2)return null;if(objects.some(o=>!A.canTransform(o)||o.hostWallId)){A.showToast('Unlock or detach selected objects before arranging them');return null;}return objects;}
  function alignSelection(axis,edge){
    if(!['x','y'].includes(axis)||!['start','center','end'].includes(edge))return;
    const objects=editableItemSelection();if(!objects)return;
    const boxes=objects.map(o=>({o,b:A.itemAabb(o)})),min=axis==='x'?'minX':'minY',max=axis==='x'?'maxX':'maxY';
    const low=Math.min(...boxes.map(v=>v.b[min])),high=Math.max(...boxes.map(v=>v.b[max])),target=edge==='start'?low:edge==='end'?high:(low+high)/2;
    const shifts=boxes.map(({o,b})=>({o,delta:target-(edge==='start'?b[min]:edge==='end'?b[max]:(b[min]+b[max])/2)}));
    if(shifts.every(v=>Math.abs(v.delta)<1e-8))return;A.checkpoint();shifts.forEach(({o,delta})=>o[axis]+=delta);A.queueSave();A.renderInspector();A.draw();
  }
  function distributeSelection(axis){
    if(!['x','y'].includes(axis))return;const objects=editableItemSelection();if(!objects||objects.length<3)return;
    const min=axis==='x'?'minX':'minY',max=axis==='x'?'maxX':'maxY',boxes=objects.map(o=>({o,b:A.itemAabb(o)})).sort((a,b)=>(a.b[min]+a.b[max])-(b.b[min]+b.b[max]));
    const start=boxes[0].b[min],end=boxes.at(-1).b[max],total=boxes.reduce((sum,v)=>sum+v.b[max]-v.b[min],0),gap=(end-start-total)/(boxes.length-1);
    if(gap<0){A.showToast('Spread objects apart before distributing equal gaps');return;}
    let cursor=start;const shifts=boxes.map(({o,b})=>{const delta=cursor-b[min];cursor+=b[max]-b[min]+gap;return{o,delta};});
    if(shifts.every(v=>Math.abs(v.delta)<1e-8))return;A.checkpoint();shifts.forEach(({o,delta})=>o[axis]+=delta);A.queueSave();A.renderInspector();A.draw();
  }
  function alignSelectedToWall() {
    const s=S(),o=A.findEntity(s.selected);if(!A.canTransform(o)||!A.floor().items.includes(o)||!A.floor().walls.length)return;
    if(['door','window'].includes(o.shape)){A.checkpoint();A.alignOpeningToWall(o)}
    else{
      const cx=o.x+o.w/2,cy=o.y+o.d/2;let best=null;
      A.floor().walls.forEach(w=>{const vx=w.x2-w.x1,vy=w.y2-w.y1,len=Math.hypot(vx,vy)||1,t=Math.max(0,Math.min(1,((cx-w.x1)*vx+(cy-w.y1)*vy)/(len*len))),px=w.x1+t*vx,py=w.y1+t*vy,dist=Math.hypot(cx-px,cy-py);if(!best||dist<best.dist)best={w,px,py,dist,len}});
      A.checkpoint();const ux=(best.w.x2-best.w.x1)/best.len,uy=(best.w.y2-best.w.y1)/best.len,nx=-uy,ny=ux,side=((cx-best.px)*nx+(cy-best.py)*ny)>=0?1:-1,gap=o.d/2+best.w.thickness/2+5,newCx=best.px+nx*side*gap,newCy=best.py+ny*side*gap;
      o.rotation=Math.atan2(uy,ux)*180/Math.PI;o.x=newCx-o.w/2;o.y=newCy-o.d/2;
    }
    A.renderInspector();A.draw();A.queueSave();A.showToast('Aligned to nearest wall');
  }

  // ── Z-ordering ───────────────────────────────────────────────
  function bringToFront() {
    const s=S(),o=A.findEntity(s.selected);if(!o||!A.floor().items.includes(o))return;
    reorderSelection(true);
  }

  function sendToBack() {
    const s=S(),o=A.findEntity(s.selected);if(!o||!A.floor().items.includes(o))return;
    reorderSelection(false);
  }
  function reorderSelection(front){const f=A.floor(),ids=new Set(S().selectedIds.size?S().selectedIds:[S().selected]),moving=f.items.filter(o=>ids.has(o.id)),rest=f.items.filter(o=>!ids.has(o.id));if(!moving.length||moving.some(o=>o.locked))return;const next=front?[...rest,...moving]:[...moving,...rest];if(next.every((o,i)=>o===f.items[i]))return;A.checkpoint();f.items=next;A.queueSave();A.draw();window.atelier3D?.requestRebuild();A.showToast(front?'Brought selection to front':'Sent selection to back');}

  // ── Context menu ─────────────────────────────────────────────
  const ctxMenu = document.createElement('div');
  ctxMenu.style.cssText='position:fixed;z-index:200;background:#fffefa;border:1px solid var(--line-strong);border-radius:8px;box-shadow:var(--shadow);padding:5px;min-width:184px;display:none;font-size:12px';
  document.body.appendChild(ctxMenu);

  function hideCtxMenu() { ctxMenu.style.display='none'; }
  addEventListener('pointerdown',e=>{if(!ctxMenu.contains(e.target))hideCtxMenu()},true);
  addEventListener('blur',hideCtxMenu);

  function ctxItem(label,fn,danger) {
    const b=document.createElement('button');b.textContent=label;
    b.style.cssText='display:block;width:100%;text-align:left;padding:7px 10px;background:transparent;border:0;border-radius:5px;cursor:pointer;color:'+(danger?'#b4472f':'#38443f');
    b.onmouseenter=()=>b.style.background='#f1efe8';b.onmouseleave=()=>b.style.background='transparent';
    b.onclick=()=>{hideCtxMenu();fn()};return b;
  }

  function ctxSep() { const s=document.createElement('div');s.style.cssText='height:1px;background:var(--line);margin:4px 6px';return s; }

  function setupContextMenu(canvas) {
    canvas.addEventListener('contextmenu', e=>{
      e.preventDefault();
      const s=S();if(s.viewMode==='3d')return;
      const p=A.pointerPos(e),hit=A.hitTest(p);ctxMenu.innerHTML='';
      if(hit&&A.floor().items.includes(hit)){
        if(!s.selectedIds.has(hit.id))A.select(hit.id);
        ctxMenu.appendChild(ctxItem('Duplicate',()=>duplicateSelected()));
        ctxMenu.appendChild(ctxItem('Rotate 90°',()=>rotateSelected()));
        ctxMenu.appendChild(ctxItem('Rotate −90°',()=>rotateSelected(-90)));
        if(s.selectedIds.size<2)ctxMenu.appendChild(ctxItem('Align to nearest wall',()=>alignSelectedToWall()));
        ctxMenu.appendChild(ctxSep());
        ctxMenu.appendChild(ctxItem('Bring to front',()=>bringToFront()));
        ctxMenu.appendChild(ctxItem('Send to back',()=>sendToBack()));
        ctxMenu.appendChild(ctxSep());
        ctxMenu.appendChild(ctxItem('Copy',()=>copySelected()));
        ctxMenu.appendChild(ctxItem('Delete',()=>deleteSelected(),true));
      } else {
        if(hit)A.select(hit.id);else A.select(null);
        ctxMenu.appendChild(ctxItem('Paste',()=>pasteClipboard()));
        ctxMenu.appendChild(ctxItem('Fit to plan',()=>A.fitPlan()));
        if(hit&&hit.type)ctxMenu.appendChild(ctxItem('Delete '+hit.type,()=>deleteSelected(),true));
      }
      ctxMenu.style.display='block';
      const rect=ctxMenu.getBoundingClientRect();
      ctxMenu.style.left=Math.min(e.clientX,innerWidth-rect.width-8)+'px';
      ctxMenu.style.top=Math.min(e.clientY,innerHeight-rect.height-8)+'px';
    });
  }

  Object.assign(A, {
    entityCollection, deleteSelected, nudgeEntity, rotateWall90,
    selectedEntitiesForClipboard, copySelected, copySelectionToFloor, copyStructureToFloors, structuralCollections, structuralReferenceIssues, createCopies, pasteClipboard, duplicateSelected,
    rotateSelected, scaleSelected, moveSelectedDistance, alignSelectedToWall, alignSelection, distributeSelection,
    bringToFront, sendToBack, setupContextMenu
  });
})();
