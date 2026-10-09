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
    return A.floor().items;
  }

  // ── Delete ───────────────────────────────────────────────────
  function deleteSelected() {
    const s=S(),ids=new Set(s.selectedIds.size?s.selectedIds:(s.selected?[s.selected]:[]));
    if(!ids.size) return;
    A.checkpoint();
    if(s.selectedIds.size){
      A.floor().items=A.floor().items.filter(o=>!ids.has(o.id));
      if(A.floor().columns) A.floor().columns=A.floor().columns.filter(o=>!ids.has(o.id));
      if(A.floor().beams) A.floor().beams=A.floor().beams.filter(o=>!ids.has(o.id));
    } else {
      for(const key of ['rooms','walls','items','dimensions','columns','beams','slabs','loads','structuralWalls']){
        if(!A.floor()[key]) continue;
        const i=A.floor()[key].findIndex(x=>x.id===s.selected);
        if(i>=0){A.floor()[key].splice(i,1);break}
      }
    }
    const count=ids.size;s.selected=null;s.selectedIds.clear();A.renderInspector();A.draw();A.updateCounts();A.queueSave();A.showToast(`${count} object${count===1?'':'s'} removed`);
  }

  // ── Nudge ────────────────────────────────────────────────────
  function nudgeEntity(o) {
    A.checkpoint();if(o.x!==undefined){o.x+=20;o.y+=20}else{o.x1+=20;o.y1+=20;o.x2+=20;o.y2+=20}A.draw();A.renderInspector();A.queueSave();
  }

  // ── Rotate wall 90° ──────────────────────────────────────────
  function rotateWall90() {
    const s=S(),o=A.findEntity(s.selected);if(!o||o.type!=='wall')return;
    A.checkpoint();const cx=(o.x1+o.x2)/2,cy=(o.y1+o.y2)/2,dx=o.x2-o.x1,dy=o.y2-o.y1;o.x1=cx+dy/2;o.y1=cy-dx/2;o.x2=cx-dy/2;o.y2=cy+dx/2;A.draw();A.renderInspector();A.queueSave();A.showToast('Wall rotated 90°');
  }

  // ── Clipboard ────────────────────────────────────────────────
  function selectedEntitiesForClipboard() { return S().selectedIds.size?A.selectedObjectList():[A.findEntity(S().selected)].filter(Boolean); }

  function copySelected() {
    const sources=selectedEntitiesForClipboard();if(!sources.length){A.showToast('Select an object to copy');return}
    S().copyBuffer=sources.map(A.deep);A.showToast(`${sources.length} object${sources.length===1?'':'s'} copied`);
  }

  function createCopies(sources, label='Duplicate created') {
    if(!sources.length) return;
    const s=S();
    A.checkpoint();const offsetCm=s.project.snap?A.gridStep():20;
    const copies=sources.map(base=>{const copy=A.deep(base);copy.id=A.uid();copy.name=copy.name?`${copy.name} copy`:copy.name;if(copy.x!==undefined){copy.x+=offsetCm;copy.y+=offsetCm}else{copy.x1+=offsetCm;copy.y1+=offsetCm;copy.x2+=offsetCm;copy.y2+=offsetCm}entityCollection(base).push(copy);return copy});
    const itemCopies=copies.filter(o=>A.floor().items.includes(o));
    if(itemCopies.length===copies.length)A.setSelection(itemCopies.map(o=>o.id),itemCopies[0]?.id);
    else{s.selectedIds.clear();s.selected=copies[0]?.id||null;A.renderInspector();A.draw()}
    A.updateCounts();A.queueSave();A.showToast(label);
  }

  function pasteClipboard() { if(!S().copyBuffer.length){A.showToast('Copy an object first');return}createCopies(S().copyBuffer,'Pasted'); }
  function duplicateSelected() { createCopies(selectedEntitiesForClipboard()); }

  // ── Rotate / scale ───────────────────────────────────────────
  function rotateSelected() {
    const s=S(),o=A.findEntity(s.selected);if(!o||o.rotation===undefined)return;
    A.checkpoint();o.rotation=((o.rotation||0)+90)%360;A.renderInspector();A.draw();A.queueSave();
  }

  function scaleSelected(percent) {
    const s=S(),o=A.findEntity(s.selected),factor=Math.max(.1,Math.min(5,percent/100));
    if(!o||!A.floor().items.includes(o)||factor===1)return;
    A.checkpoint();const cx=o.x+o.w/2,cy=o.y+o.d/2;o.w*=factor;o.d*=factor;o.height*=factor;o.x=cx-o.w/2;o.y=cy-o.d/2;A.renderInspector();A.draw();A.queueSave();A.showToast(`Scaled to ${Math.round(percent)}%`);
  }

  // ── Align to wall ────────────────────────────────────────────
  function alignSelectedToWall() {
    const s=S(),o=A.findEntity(s.selected);if(!o||!A.floor().items.includes(o)||!A.floor().walls.length)return;
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
    A.checkpoint();const i=A.floor().items.indexOf(o);A.floor().items.splice(i,1);A.floor().items.push(o);A.draw();A.queueSave();window.atelier3D?.requestRebuild();A.showToast('Brought to front');
  }

  function sendToBack() {
    const s=S(),o=A.findEntity(s.selected);if(!o||!A.floor().items.includes(o))return;
    A.checkpoint();const i=A.floor().items.indexOf(o);A.floor().items.splice(i,1);A.floor().items.unshift(o);A.draw();A.queueSave();window.atelier3D?.requestRebuild();A.showToast('Sent to back');
  }

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
        ctxMenu.appendChild(ctxItem('Rotate −90°',()=>{const o=A.findEntity(s.selected);if(o&&o.rotation!==undefined){A.checkpoint();o.rotation=((o.rotation||0)-90+360)%360;A.renderInspector();A.draw();A.queueSave()}}));
        ctxMenu.appendChild(ctxItem('Align to nearest wall',()=>alignSelectedToWall()));
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
    selectedEntitiesForClipboard, copySelected, createCopies, pasteClipboard, duplicateSelected,
    rotateSelected, scaleSelected, alignSelectedToWall,
    bringToFront, sendToBack, setupContextMenu
  });
})();
