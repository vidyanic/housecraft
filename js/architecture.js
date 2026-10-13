/** Connected walls, hosted openings, associative dimensions and closed wall faces. */
(function () {
  'use strict';
  const A=window.Atelier, previous=new WeakMap(), openingPrevious=new WeakMap(),pendingRooms=new WeakSet();
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const point=(w,end)=>({x:w['x'+end],y:w['y'+end]});
  function wallAlignmentError(message,wallIds){const error=Error(message);error.wallIds=[...new Set(wallIds)];return error;}
  function rejectCollapsedWalls(f){const walls=f.walls.filter(w=>Math.hypot(w.x2-w.x1,w.y2-w.y1)<1);if(walls.length)throw wallAlignmentError('Alignment would collapse a wall. Adjust its endpoints or delete it, then retry.',walls.map(w=>w.id));}
  function showWallAlignmentError(error){
    const wall=A.floor().walls.find(w=>error.wallIds?.includes(w.id));
    if(wall){A.state.inspectorMode=null;A.setTool('select');A.select(wall.id);A.canvasSpace?.revealCanvas();const s=A.state;s.scale=Math.min(s.scale,Math.max(40,s.canvas.clientWidth-80)/Math.max(1,Math.abs(wall.x2-wall.x1)),Math.max(40,s.canvas.clientHeight-120)/Math.max(1,Math.abs(wall.y2-wall.y1)));s.offset={x:s.canvas.clientWidth/2-(wall.x1+wall.x2)/2*s.scale,y:s.canvas.clientHeight/2-(wall.y1+wall.y2)/2*s.scale};A.updateZoom();A.draw();}
    A.showToast((wall?(wall.name||'Wall '+(A.floor().walls.indexOf(wall)+1))+' selected. ':'')+error.message);
  }
  // Plot width follows plan X, plot length/depth follows plan Y; north is a compass annotation.
  function wallGuidePoint(start,target,free=false){
    const x=free?target.x:A.snap(target.x),y=free?target.y:A.snap(target.y);
    if(!A.state.wallPlotGuide||free)return {x,y};
    return Math.abs(x-start.x)>=Math.abs(y-start.y)?{x,y:start.y}:{x:start.x,y};
  }
  function squareWallFloor(source){
    const f=A.deep(source),nodes=[],ends=[],horizontal=new Map(f.walls.map(w=>[w.id,Math.abs(w.x2-w.x1)>=Math.abs(w.y2-w.y1)]));
    for(const w of f.walls)for(const end of [1,2]){const p=point(w,end);let i=nodes.findIndex(n=>distance(n,p)<.2);if(i<0){i=nodes.length;nodes.push(p);}ends.push({w,end,i});}
    const junctions=[];
    for(const e of ends)for(let k=0;k<ends.length;k+=2){const host=ends[k],w=host.w;if(w===e.w)continue;const p=point(e.w,e.end),dx=w.x2-w.x1,dy=w.y2-w.y1,len2=dx*dx+dy*dy;if(!len2)continue;const t=((p.x-w.x1)*dx+(p.y-w.y1)*dy)/len2;
      if(t>0&&t<1&&distance(p,{x:w.x1+t*dx,y:w.y1+t*dy})<.2)junctions.push({i:e.i,host:host.i,axis:horizontal.get(w.id)?'y':'x',pin:w.locked&&Math.abs(dx)>1e-7&&Math.abs(dy)>1e-7});
    }
    const solve=axis=>{
      const parent=nodes.map((_,i)=>i),root=i=>{while(parent[i]!==i)i=parent[i];return i;},join=(a,b)=>{parent[root(b)]=root(a);};
      for(let k=0;k<ends.length;k+=2){const a=ends[k],b=ends[k+1],w=a.w;if(w.locked)continue;if(axis===(horizontal.get(w.id)?'y':'x'))join(a.i,b.i);}
      for(const j of junctions)if(!j.pin&&axis===j.axis)join(j.i,j.host);
      const groups=new Map();nodes.forEach((p,i)=>{const key=root(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
      for(const ids of groups.values()){
        const fixed=ends.filter(e=>e.w.locked&&ids.includes(e.i)).map(e=>e.w[axis+e.end]);
        fixed.push(...junctions.filter(j=>j.pin&&ids.includes(j.i)).map(j=>nodes[j.i][axis]));
        if(fixed.some(v=>Math.abs(v-fixed[0])>1e-7))throw wallAlignmentError('Locked walls prevent right-angle alignment. Unlock the affected walls first.',ends.filter(e=>e.w.locked&&ids.includes(e.i)).map(e=>e.w.id));
        const value=fixed.length?fixed[0]:ids.reduce((sum,i)=>sum+nodes[i][axis],0)/ids.length;
        for(const e of ends)if(ids.includes(e.i))e.w[axis+e.end]=value;
      }
    };
    solve('x');solve('y');
    rejectCollapsedWalls(f);
    return f;
  }
  function squareWalls(){
    if(A.state.workspace!=='architecture'||A.state.viewMode!=='plan')return;
    if(A.state.interaction)A.cancelInteraction();
    try{
      const p=A.deep(A.state.project),index=p.activeFloor,original=A.floor(),f=squareWallFloor(original);
      if(JSON.stringify(f.walls)===JSON.stringify(original.walls)){A.showToast('Walls are already aligned to plot axes');return;}
      p.floors[index]=f;syncArchitecture(f);A.validateProject(p);
      A.checkpoint();A.state.project=p;A.syncUI();A.queueSave();A.showToast('Walls aligned to 90° · Undo restores the previous layout');
    }catch(error){showWallAlignmentError(error);}
  }
  function alignSelectedWall(axis){
    const original=A.findEntity(A.state.selected);if(A.state.workspace!=='architecture'||original?.type!=='wall'||!A.canTransform(original))return;
    if(A.state.interaction)A.cancelInteraction();
    try{const p=A.deep(A.state.project),f=p.floors[p.activeFloor],w=f.walls.find(w=>w.id===original.id),length=distance(point(w,1),point(w,2));syncArchitecture(f);
      if(axis==='width'){w.x2=w.x1+(w.x2<w.x1?-length:length);w.y2=w.y1;}else{w.y2=w.y1+(w.y2<w.y1?-length:length);w.x2=w.x1;}
      syncArchitecture(f);rejectCollapsedWalls(f);
      const movedLocks=f.walls.filter(w=>w.locked&&JSON.stringify(w)!==JSON.stringify(A.floor().walls.find(o=>o.id===w.id)));if(movedLocks.length)throw wallAlignmentError('A joined locked wall prevents alignment. Unlock it first.',movedLocks.map(w=>w.id));
      A.validateProject(p);if(JSON.stringify(f)===JSON.stringify(A.floor()))return;A.checkpoint();A.state.project=p;A.syncUI();A.queueSave();
    }catch(error){showWallAlignmentError(error);}
  }
  function polygonArea(points){return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0))/2;}
  function pointInPolygon(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;}return inside;}
  function hostOpening(o,f=A.floor(),threshold=90){
    if(!['door','window'].includes(o.shape||o.type))return;
    if(o.freePlacement)return false;
    const existing=f.walls.find(w=>w.id===o.hostWallId);
    if(existing){const dx=existing.x2-existing.x1,dy=existing.y2-existing.y1,len=Math.hypot(dx,dy);if(len){o.wallOffset=((o.x+o.w/2-existing.x1)*dx+(o.y+o.d/2-existing.y1)*dy)/len;updateOpening(o,existing);return true;}}
    const center={x:o.x+o.w/2,y:o.y+o.d/2};let best;
    for(const w of f.walls){const dx=w.x2-w.x1,dy=w.y2-w.y1,len=Math.hypot(dx,dy);if(len<o.w)continue;
      const offset=Math.max(o.w/2,Math.min(len-o.w/2,((center.x-w.x1)*dx+(center.y-w.y1)*dy)/len));
      const p={x:w.x1+dx*offset/len,y:w.y1+dy*offset/len},dist=distance(center,p);
      if(!best||dist<best.dist)best={w,offset,dist};
    }
    if(best&&best.dist<threshold){o.hostWallId=best.w.id;o.wallOffset=best.offset;updateOpening(o,best.w);return true;}
    delete o.hostWallId;delete o.wallOffset;return false;
  }
  function updateOpening(o,w){
    const dx=w.x2-w.x1,dy=w.y2-w.y1,len=Math.hypot(dx,dy);if(!len)return;
    o.w=Math.min(o.w,len);o.d=Math.max(4,(w.thickness||10)+4);
    o.wallOffset=Math.max(Math.min(o.w/2,len/2),Math.min(len-o.w/2,o.wallOffset||0));
    const offset=Math.max(0,Math.min(len,o.wallOffset));
    o.x=w.x1+dx*offset/len-o.w/2;o.y=w.y1+dy*offset/len-o.d/2;
    o.rotation=Math.atan2(dy,dx)*180/Math.PI;
  }
  function setOpeningAttachment(o,attached){
    if(!A.canTransform(o)||!['door','window'].includes(o.shape||o.type))return;
    const next={...o,freePlacement:!attached};delete next.hostWallId;delete next.wallOffset;
    if(attached&&!hostOpening(next)){A.showToast('Move the opening closer to a wall before attaching');return;}
    A.checkpoint();delete o.hostWallId;delete o.wallOffset;Object.assign(o,next);
    A.queueSave();A.renderInspector();A.draw();
  }
  function anchorPoint(anchor,f){
    const o=[...f.walls,...f.items,...f.rooms,...(f.columns||[]),...(f.beams||[])].find(o=>o.id===anchor.entityId);
    if(!o)return null;
    if(o.x1!==undefined)return point(o,anchor.end);
    const x=(anchor.corner===1||anchor.corner===2?o.w:0)-o.w/2,y=(anchor.corner>=2?o.d:0)-o.d/2,angle=(o.rotation||0)*Math.PI/180;
    return {x:o.x+o.w/2+x*Math.cos(angle)-y*Math.sin(angle),y:o.y+o.d/2+x*Math.sin(angle)+y*Math.cos(angle)};
  }
  function attachDimension(d,f=A.floor()){
    for(const end of [1,2]){const p=point(d,end);let best;
      for(const o of [...f.walls,...f.items,...f.rooms,...(f.columns||[]),...(f.beams||[])])for(const corner of o.x1!==undefined?[1,2]:[0,1,2,3]){
        const anchor=o.x1!==undefined?{entityId:o.id,end:corner}:{entityId:o.id,corner};
        const candidate=anchorPoint(anchor,f),dist=distance(p,candidate);
        if(!best||dist<best.dist)best={anchor,candidate,dist};
      }
      if(best&&best.dist<=30)d['anchor'+end]={...best.anchor,dx:p.x-best.candidate.x,dy:p.y-best.candidate.y};
    }
  }
  function wallFaces(f){
    const segments=f.walls.filter(w=>Math.hypot(w.x2-w.x1,w.y2-w.y1)>.1).map(w=>({w,ts:[0,1],minX:Math.min(w.x1,w.x2),maxX:Math.max(w.x1,w.x2),minY:Math.min(w.y1,w.y2),maxY:Math.max(w.y1,w.y2)}));
    if(segments.length>1000)throw new Error('Room tracing supports up to 1,000 walls.');
    const ordered=[...segments].sort((a,b)=>a.minX-b.minX);
    for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
      const a=ordered[i],b=ordered[j];if(b.minX>a.maxX+.000001)break;if(b.minY>a.maxY+.000001||b.maxY<a.minY-.000001)continue;
      const r={x:a.w.x2-a.w.x1,y:a.w.y2-a.w.y1},s={x:b.w.x2-b.w.x1,y:b.w.y2-b.w.y1},q={x:b.w.x1-a.w.x1,y:b.w.y1-a.w.y1},cross=r.x*s.y-r.y*s.x;
      if(Math.abs(cross)<1e-8)continue;
      const t=(q.x*s.y-q.y*s.x)/cross,u=(q.x*r.y-q.y*r.x)/cross;
      if(t>=-1e-6&&t<=1+1e-6&&u>=-1e-6&&u<=1+1e-6){a.ts.push(Math.max(0,Math.min(1,t)));b.ts.push(Math.max(0,Math.min(1,u)));}
    }
    const nodes=new Map(),edges=[];
    function node(p){const key=`${Math.round(p.x*10)},${Math.round(p.y*10)}`;if(!nodes.has(key))nodes.set(key,{...p,key,out:[]});return nodes.get(key);}
    for(const {w,ts} of segments){const sorted=[...new Set(ts)].sort((a,b)=>a-b);for(let i=1;i<sorted.length;i++){
      const at=t=>node({x:w.x1+(w.x2-w.x1)*t,y:w.y1+(w.y2-w.y1)*t}),a=at(sorted[i-1]),b=at(sorted[i]);if(a===b)continue;
      const e={a,b,wallId:w.id},reverse={a:b,b:a,wallId:w.id};e.reverse=reverse;reverse.reverse=e;a.out.push(e);b.out.push(reverse);edges.push(e,reverse);
    }}
    for(const n of nodes.values())n.out.sort((a,b)=>Math.atan2(a.b.y-n.y,a.b.x-n.x)-Math.atan2(b.b.y-n.y,b.b.x-n.x));
    const used=new Set(),faces=[];
    for(const start of edges){if(used.has(start))continue;let e=start;const points=[],wallIds=[];
      for(let steps=0;steps<=edges.length;steps++){if(used.has(e))break;used.add(e);points.push({x:e.a.x,y:e.a.y});wallIds.push(e.wallId);const outgoing=e.b.out,idx=outgoing.indexOf(e.reverse);e=outgoing[(idx-1+outgoing.length)%outgoing.length];if(e===start)break;}
      const signed=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0)/2;
      if(e===start&&signed>100)faces.push({points,wallIds:[...new Set(wallIds)].sort()});
    }return faces;
  }
  function updateDerivedRooms(f,create=false){
    if(!create&&!f.rooms.some(r=>r.boundaryWallIds))return;
    const existing=f.rooms.filter(r=>r.boundaryWallIds),manual=f.rooms.filter(r=>!r.boundaryWallIds),faces=wallFaces(f),result=[];
    for(const face of faces){const key=face.wallIds.join('|'),old=existing.find(r=>r.boundaryWallIds.join('|')===key);if(!create&&!old)continue;
      const xs=face.points.map(p=>p.x),ys=face.points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,d=Math.max(...ys)-y;
      if(!old&&manual.some(r=>Math.abs(r.x-x)<5&&Math.abs(r.y-y)<5&&Math.abs(r.w-w)<5&&Math.abs(r.d-d)<5))continue;
      result.push({...old,id:old?.id||A.uid(),type:'room',name:old?.name||`Traced room ${result.length+1}`,x,y,w,d,polygon:face.points,boundaryWallIds:face.wallIds,color:old?.color||'#eee7d9',floorMaterial:old?.floorMaterial||'Wood',ceilingHeight:old?.ceilingHeight||280});
    }
    f.rooms=[...manual,...result];return result.length;
  }
  function syncArchitecture(f=A.floor()){
    if(!f)return;
    const old=previous.get(f);
    if(old)for(const w of f.walls){const before=old.get(w.id);if(!before)continue;
      for(const end of [1,2]){const from=point(before,end),to=point(w,end);if(distance(from,to)<.001)continue;
        for(const neighbor of f.walls){if(neighbor===w)continue;const original=old.get(neighbor.id);if(!original)continue;for(const otherEnd of [1,2])if(distance(from,point(original,otherEnd))<.2){neighbor['x'+otherEnd]=to.x;neighbor['y'+otherEnd]=to.y;}}
      }
    }
    const changed=!old||f.walls.length!==old.size||f.walls.some(w=>{const o=old.get(w.id);return !o||['x1','x2','y1','y2','thickness'].some(k=>w[k]!==o[k]);});
    if(changed){if(A.state.pointerBackup)pendingRooms.add(f);else updateDerivedRooms(f);previous.set(f,new Map(f.walls.map(w=>[w.id,{...w}])));}
    if(!A.state.pointerBackup&&pendingRooms.has(f)){pendingRooms.delete(f);updateDerivedRooms(f);}
    const oldOpenings=openingPrevious.get(f)||new Map();
    for(const o of f.items)if(['door','window'].includes(o.shape||o.type)){
      const prior=oldOpenings.get(o.id);
      if(!changed&&prior&&(Math.abs(prior.x-o.x)>.001||Math.abs(prior.y-o.y)>.001||prior.rotation!==o.rotation))hostOpening(o,f);
      const wall=f.walls.find(w=>w.id===o.hostWallId);
      if(wall)updateOpening(o,wall);else if(o.hostWallId){delete o.hostWallId;delete o.wallOffset;}else if(!old)hostOpening(o,f,20);
    }
    openingPrevious.set(f,new Map(f.items.filter(o=>['door','window'].includes(o.shape||o.type)).map(o=>[o.id,{x:o.x,y:o.y,rotation:o.rotation}])));
    for(const d of f.dimensions)for(const end of [1,2]){const anchor=d['anchor'+end];if(!anchor)continue;const p=anchorPoint(anchor,f);if(p){d['x'+end]=p.x+(anchor.dx||0);d['y'+end]=p.y+(anchor.dy||0);}else delete d['anchor'+end];}
  }
  function deriveRooms(){A.checkpoint();try{const count=updateDerivedRooms(A.floor(),true);A.syncUI();A.queueSave();A.showToast(`${count} closed rooms traced from walls`);}catch(err){A.showToast(err.message);}}
  Object.assign(A,{alignSelectedWall,wallGuidePoint,squareWallFloor,squareWalls,polygonArea,pointInPolygon,hostOpening,setOpeningAttachment,attachDimension,syncArchitecture,wallFaces,deriveRooms,roomArea:r=>r.polygon?polygonArea(r.polygon):r.w*r.d});
})();
