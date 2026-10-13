/** Building coordination and conservative beam load screening; not reinforcement design. */
(function(){
 'use strict';const A=window.Atelier;
 function beamLoadScreen(f,b,p){
  const basis=A.structuralBasis(p),L=Math.hypot(b.x2-b.x1,b.y2-b.y1)/100;
  if(L<.01)return{moment:0,shear:0,lineLoad:0,method:'Zero span'};
  const ux=(b.x2-b.x1)/(L*100),uy=(b.y2-b.y1)/(L*100);let dead=(b.width||25)*(b.depth||35)/10000*basis.concreteDensity,live=0;
  for(const s of A.slabPanels(f,p)){
   const along=s.polygon.map(q=>(q.x-b.x1)*ux+(q.y-b.y1)*uy),across=s.polygon.map(q=>-(q.x-b.x1)*uy+(q.y-b.y1)*ux);
   if(Math.max(...along)<0||Math.min(...along)>L*100||Math.min(...across)>1||Math.max(...across)<-1)continue;
   // Full perpendicular panel extent is a conservative envelope, not a load allocation.
   const width=(Math.max(...across)-Math.min(...across))/100;
   dead+=width*(s.thickness/100*basis.concreteDensity+s.deadLoad);live+=width*s.liveLoad;
  }
  for(const w of f.walls||[]){const dist=q=>Math.abs(-(q.x-b.x1)*uy+(q.y-b.y1)*ux),t=q=>(q.x-b.x1)*ux+(q.y-b.y1)*uy;
   if(dist({x:w.x1,y:w.y1})<=Math.max(1,(w.thickness||15)/2)&&dist({x:w.x2,y:w.y2})<=Math.max(1,(w.thickness||15)/2)){
    const overlap=Math.max(0,Math.min(L*100,Math.max(t({x:w.x1,y:w.y1}),t({x:w.x2,y:w.y2})))-Math.max(0,Math.min(t({x:w.x1,y:w.y1}),t({x:w.x2,y:w.y2}))));
    dead+=overlap/(L*100)*(w.thickness||15)/100*(w.height||basis.storeyHeight)/100*basis.masonryDensity;
   }
  }
  const lineLoad=1.5*(dead+live),cant=b.supportCondition==='cantilever',d=A.effectiveDepth(b)*10,fck=+(b.material?.match(/M(\d+)/)?.[1]||25);
  return{dead,live,lineLoad,spanM:L,moment:lineLoad*L*L/(cant?2:8),shear:lineLoad*L/(cant?1:2),sectionLimit:.133*fck*(b.width||25)*10*d*d/1e6,method:'Full intersecting panel-width envelope plus collinear wall and beam weight; continuous spans screened as simply supported. Point/transfer/equipment loads and reinforcement capacity require review.'};
 }
 function structuralAudit(p){
  const basis=A.structuralBasis(p),floors=[...p.floors].sort((a,b)=>a.elevation-b.elevation),issues=[],levels=[];
  const add=(f,o,code,message,status='review',field)=>issues.push({floorId:f.id,entityId:o?.id,code,message,status,field});
  const base=floors[0],bounds=A.getHouseFootprintBounds?.(base),originX=p.builtUp?.originX??bounds?.minX,originY=p.builtUp?.originY??bounds?.minY;
  const boundary=Number.isFinite(originX)&&Number.isFinite(originY)&&p.site?.width>0&&p.site?.depth>0?{x:originX,y:originY,width:p.site.width,depth:p.site.depth}:null;
  if(!boundary)add(base,null,'boundary','Confirm plot origin in built-up settings; footing boundary checks need a located plot rectangle.');
  else if(p.builtUp?.originX==null||p.builtUp?.originY==null)add(base,null,'boundary-origin','Plot origin follows the displayed building envelope. Confirm its location against a boundary survey before using footing clearance results.');
  for(let i=0;i<floors.length;i++){
   const f=floors[i],next=floors[i+1],height=next?next.elevation-f.elevation:basis.storeyHeight;
   levels.push({floorId:f.id,name:f.name||f.id,elevation:f.elevation,height,columns:f.columns?.length||0,beams:f.beams?.length||0,roof:!!f.isRoof});
   if(height<=0)add(f,null,'levels','Coincident floor elevations require manual correction.','fail');
   if(!f.columns?.length)add(f,null,'unmodelled-storey',`${f.name||f.id}: no columns modelled. Confirm whether this floor needs framing; floor count alone does not add a load-bearing storey.`);
   if(f.isRoof&&next)add(f,null,'roof','Roof flag is set below another floor; verify seismic live-load exclusion.');
   for(let j=0;j<(f.columns||[]).length;j++)for(let k=j+1;k<f.columns.length;k++){
    const a=f.columns[j],c=f.columns[k],q=A.structuralCenter(a),r=A.structuralCenter(c);
    if(Math.hypot(q.x-r.x,q.y-r.y)<1)add(f,c,'duplicate-column',`${c.tag||c.id}: coincident with ${a.tag||a.id}. Review duplicate supports and loads; no automatic deletion.`,'fail');
    else if(i===0&&Math.abs(q.x-r.x)<((a.footingWidth||120)+(c.footingWidth||120))/2&&Math.abs(q.y-r.y)<((a.footingDepth||120)+(c.footingDepth||120))/2)add(f,c,'footing-overlap',`${c.tag||c.id}: possible footing overlap with ${a.tag||a.id}; review surveyed geometry and combined footing design.`);
   }
   for(const c of f.columns||[]){
    const q=A.structuralCenter(c);
    if(Math.abs((c.height||basis.storeyHeight)-height)>=1)add(f,c,'height',`${c.tag||c.id}: column height ${(c.height||basis.storeyHeight).toFixed(1)} cm differs from storey ${height.toFixed(1)} cm.`, 'review','height');
    if(i){const near=floors[i-1].columns.filter(d=>Math.hypot(A.structuralCenter(d).x-q.x,A.structuralCenter(d).y-q.y)<=5);if(near.length!==1)add(f,c,'stack',`${c.tag||c.id}: ${near.length?'ambiguous':'missing'} support below within 5 cm; review transfer load path.`);else if(Math.hypot(A.structuralCenter(near[0]).x-q.x,A.structuralCenter(near[0]).y-q.y)>=1)add(f,c,'stack',`${c.tag||c.id}: small stack offset; preview alignment.`);}
    if((c.height||basis.storeyHeight)/Math.min(c.w,c.d)>12)add(f,c,'slender',`${c.tag||c.id}: height/minimum section exceeds 12; effective length and biaxial/slender design required.`);
    if(i===0&&boundary){const angle=(c.rotation||0)*Math.PI/180,fw=c.footingWidth||120,fd=c.footingDepth||120,hx=(Math.abs(Math.cos(angle))*fw+Math.abs(Math.sin(angle))*fd)/2,hy=(Math.abs(Math.sin(angle))*fw+Math.abs(Math.cos(angle))*fd)/2;
     const clearance=Math.min(q.x-hx-boundary.x,q.y-hy-boundary.y,boundary.x+boundary.width-q.x-hx,boundary.y+boundary.depth-q.y-hy),target=basis.footingClearance??30.48;
     if(clearance<target)add(f,c,'footing',`${c.tag||c.id}: footing edge clearance ${clearance.toFixed(1)} cm; target ${target.toFixed(2)} cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.`,clearance<0&&p.builtUp?.originX!=null&&p.builtUp?.originY!=null?'fail':'review');
    }
   }
   for(const b of f.beams||[]){
    if(b.ceilingHeight!=null&&Math.abs(b.ceilingHeight-height)>=1)add(f,b,'beam-height',`${b.tag||b.id}: displayed beam level differs from storey height; preview stacking correction.`,'review','ceilingHeight');
    for(const [field,x,y] of [['startColumnId','x1','y1'],['endColumnId','x2','y2']]){
     const c=f.columns.find(c=>c.id===b[field]);
     if(c){if(Math.hypot(A.structuralCenter(c).x-b[x],A.structuralCenter(c).y-b[y])>.01)add(f,b,'joint-offset',`${b.tag||b.id}: ${field} geometry differs from its explicit column.`, 'review',field);}
     else if(!(b.supportCondition==='cantilever'&&!b[field]&&f.columns.some(c=>c.id===b[field==='endColumnId'?'startColumnId':'endColumnId'])))add(f,b,'joint',`${b.tag||b.id}: ${field} is ${b[field]?'missing':'unconnected'}; confirm joint/support type.`, 'review',field);
    }
    if(Math.min(Math.abs(b.x2-b.x1),Math.abs(b.y2-b.y1))>0.01&&Math.min(Math.abs(b.x2-b.x1),Math.abs(b.y2-b.y1))<=5)add(f,b,'square',`${b.tag||b.id}: nearly axis aligned; preview small 90° correction.`);
    if(Math.hypot(b.x2-b.x1,b.y2-b.y1)<1)add(f,b,'zero-span',`${b.tag||b.id}: collapsed beam.`, 'fail');
    add(f,b,'beam-design',`${b.tag||b.id}: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.`);
   }
  }
  return{floorCount:floors.length,heightCm:Math.max(...floors.map(f=>f.elevation+Math.max(basis.storeyHeight,...(f.columns||[]).map(c=>c.height||basis.storeyHeight))))-base.elevation,levels,boundary,issues};
 }
 Object.assign(A,{beamLoadScreen,structuralAudit});
})();
