/** Connected walls, hosted openings, associative dimensions and closed wall faces. */
(function () {
  'use strict';
  const A=window.Atelier, previous=new WeakMap(), openingPrevious=new WeakMap();
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const point=(w,end)=>({x:w['x'+end],y:w['y'+end]});
  function polygonArea(points){return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0))/2;}
  function pointInPolygon(p,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;}return inside;}
  function hostOpening(o,f=A.floor(),threshold=90){
    if(!['door','window'].includes(o.shape||o.type))return;
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
    o.wallOffset=Math.max(Math.min(o.w/2,len/2),Math.min(len-o.w/2,o.wallOffset||0));
    const offset=Math.max(0,Math.min(len,o.wallOffset));
    o.x=w.x1+dx*offset/len-o.w/2;o.y=w.y1+dy*offset/len-o.d/2;
    o.rotation=Math.atan2(dy,dx)*180/Math.PI;o.d=Math.max(4,(w.thickness||10)+4);
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
    const segments=f.walls.filter(w=>Math.hypot(w.x2-w.x1,w.y2-w.y1)>.1).map(w=>({w,ts:[0,1]}));
    if(segments.length>1000)throw new Error('Room tracing supports up to 1,000 walls.');
    for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
      const a=segments[i],b=segments[j],r={x:a.w.x2-a.w.x1,y:a.w.y2-a.w.y1},s={x:b.w.x2-b.w.x1,y:b.w.y2-b.w.y1},q={x:b.w.x1-a.w.x1,y:b.w.y1-a.w.y1},cross=r.x*s.y-r.y*s.x;
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
    if(changed){updateDerivedRooms(f);previous.set(f,new Map(f.walls.map(w=>[w.id,{...w}])));}
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
  Object.assign(A,{polygonArea,pointInPolygon,hostOpening,attachDimension,syncArchitecture,wallFaces,deriveRooms,roomArea:r=>r.polygon?polygonArea(r.polygon):r.w*r.d});
})();
