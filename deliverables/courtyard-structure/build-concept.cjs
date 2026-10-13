const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=__dirname,root=path.resolve(dir,'../..'),source='C:/Users/ranje/Downloads/65-35-ft-courtyard-house (14).json';
const raw=fs.readFileSync(source),original=JSON.parse(raw),clone=o=>JSON.parse(JSON.stringify(o)),round=n=>Math.round(n*100)/100;
fs.writeFileSync(path.join(dir,'original-reference.json'),raw);
const ctx={window:{},console};vm.createContext(ctx);for(const file of ['utilities','constants','furniture-catalog','structural-model','project-model','project-validation','frame-solver']){vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),ctx);ctx.Atelier=ctx.window.Atelier;}const A=ctx.Atelier;
const p=clone(original);p.projectId='courtyard-concept-20261012';p.name='Courtyard house — G+1 concept, future G+2 brief — NOT FOR CONSTRUCTION';p.activeFloor=1;p.layoutValidated=true;p.showStructure=true;p.framingMode=false;p.camera={...p.camera,allFloors:true,yaw:-38,pitch:38,zoom:.45,wallMode:'cutaway'};
// The JSON stores a building origin, but no surveyed site origin. Centre the stated plot on that envelope, explicitly as an assumption.
const site={x:round(p.builtUp.originX-(p.site.width-p.builtUp.width)/2),y:round(p.builtUp.originY-(p.site.depth-p.builtUp.depth)/2),w:p.site.width,h:p.site.depth};
const cx=site.x+site.w/2,cy=site.y+site.h/2,inset=150.48;
const xs=[site.x+inset,515,914.4,2*cx-914.4,2*cx-515,site.x+site.w-inset].map(round),ys=[site.y+inset,cy,site.y+site.h-inset].map(round);
const left=xs[0]-60,right=xs[5]+60,top=ys[0]-60,bottom=ys[2]+60,mid=ys[1],H=304.8;
p.site.frontSide='west';p.site.sides={west:{direction:'WEST',status:'open',note:'Vehicle entry — assumed survey alignment',showMeasurement:true},north:{direction:'NORTH',status:'open',showMeasurement:true},east:{direction:'EAST',status:'closed',showMeasurement:true},south:{direction:'SOUTH',status:'closed',showMeasurement:true}};
p.builtUp={...p.builtUp,originX:site.x,originY:site.y,width:site.w,depth:site.h};p.climate.courtyard=false;p.climate.preset='Lucknow — site climate verification pending';p.vastu.entry='West';
p.structuralBasis={...p.structuralBasis,storeyHeight:H,soilVerified:false,responseReduction:3,system:'CONCEPT: continuous RC frame + paired RC wall reservations; design unverified',finishLoad:1.5,liveLoad:2,slabThickness:15};
const notes=['Concept geometry only; no member, reinforcement, footing or earthquake safety certification.','Design brief includes one future occupied second floor plus its roof; future loads and foundations require engineering design now.','Original structure discarded at owner request. Source architecture retained separately; coordinated alternative changes rooms.','Assumed plot origin is centred on source built-up envelope; boundary survey and setbacks must be confirmed.','Column and beam sizes are coordination envelopes, not approved sizes. Reinforcement intentionally not specified.','240 cm footing rectangles are spatial reservations only, not designed foundations.','60 cm loaded perimeter slab extensions and additional 76.2 cm roof shade where space permits: do not treat as foundation counterweights.','No RC wall, column or beam may be removed for future partition changes.','Stair landing, guards and headroom require architectural/structural detailing; the 3D stair is a space reservation only.'];
p.conceptReview={date:'2026-10-12',status:'NOT FOR CONSTRUCTION',siteOriginAssumption:site,notes,sourceSha256:crypto.createHash('sha256').update(raw).digest('hex')};
let seq=0;const id=prefix=>prefix+'-'+(++seq),room=(name,x,y,w,d,extra={})=>({id:id('room'),type:'room',name,x:round(x),y:round(y),w:round(w),d:round(d),color:'#eee8da',opacity:1,floorMaterial:'Tile',ceilingHeight:H,...extra});
const f=p.floors[1];f.name='First floor — living / revised concept';f.rooms=[];f.walls=[];f.items=[];f.dimensions=[];
const roomAdd=(...args)=>{const r=room(...args);f.rooms.push(r);return r;};
roomAdd('Covered terrace',left+10,top+10,xs[1]-left-20,mid-top-20);
roomAdd('Children Room',xs[1]+10,top+10,xs[2]-xs[1]-20,mid-top-20);
roomAdd('Guest Room',xs[2]+10,ys[0]+10,xs[3]-xs[2]-20,mid-ys[0]-20);
roomAdd('Balcony',xs[3]+10,top+10,xs[4]-xs[3]-20,142);
roomAdd('Dining + Pooja',xs[3]+10,top+172,xs[4]-xs[3]-20,mid-top-182);
roomAdd('Kitchen',xs[4]+10,top+10,right-xs[4]-20,mid-top-20);
roomAdd('Covered terrace / utility',left+10,mid+10,xs[1]-left-20,199);
roomAdd('Master Toilet',left+10,mid+229,xs[1]-left-20,bottom-mid-239);
roomAdd('Bedroom access passage',xs[1]+10,mid+23,xs[2]-xs[1]-20,101,{color:'#e0ede8'});
roomAdd('Master Bedroom',xs[1]+10,mid+144,xs[2]-xs[1]-20,bottom-mid-154);
roomAdd('Private Living Room',xs[2]+10,mid+10,xs[3]-xs[2]-20,ys[2]-mid-20);
const bathX=xs[4]-207,bathY=bottom-200;
const living=roomAdd('Living + Entrance',xs[3]+10,mid+10,xs[4]-xs[3]-20,bottom-mid-20);
living.polygon=[{x:living.x,y:living.y},{x:xs[4]-10,y:living.y},{x:xs[4]-10,y:bathY-10},{x:bathX-10,y:bathY-10},{x:bathX-10,y:bottom-10},{x:living.x,y:bottom-10}];
roomAdd('Shared Toilet',bathX+10,bathY+10,xs[4]-bathX-20,bottom-bathY-20);
roomAdd('Open Stairs',xs[4]+10,mid+10,2043-xs[4]-20,bottom-mid-20);
const wall=(name,x1,y1,x2,y2,thickness=15)=>{const w={id:id('wall'),type:'wall',name,x1:round(x1),y1:round(y1),x2:round(x2),y2:round(y2),thickness,height:H,color:'#667268'};f.walls.push(w);return w;};
const northChildren=wall('North children wall',xs[1],top,xs[2],top),northGuest=wall('North guest wall',xs[2],ys[0],xs[3],ys[0]);
const balconyDoorWall=wall('Dining balcony wall',xs[3],top+162,xs[4],top+162),northKitchen=wall('North kitchen wall',xs[4],top,right,top);
const childrenWest=wall('Children west wall',xs[1],top,xs[1],mid),partitionA=wall('Bedroom / living division',xs[2],top,xs[2],bottom),partitionB=wall('Guest / dining division',xs[3],ys[0],xs[3],bottom),partitionC=wall('Kitchen / stair division',xs[4],top,xs[4],bottom);
const childrenSouth=wall('Children passage wall',xs[1],mid,xs[2],mid),guestSouth=wall('Guest living wall',xs[2],mid,xs[3],mid),kitchenSouth=wall('Kitchen stair wall',xs[4],mid,right,mid);
wall('Kitchen east wall',right,top,right,mid);wall('Stair east guard',2043,mid,2043,bottom).height=110;
const southMaster=wall('South master wall',xs[1],bottom,xs[2],bottom),southPrivate=wall('South private wall',xs[2],ys[2],xs[3],ys[2]),southLiving=wall('South living wall',xs[3],bottom,xs[4],bottom);
const masterWest=wall('Master west wall',xs[1],mid+134,xs[1],bottom),masterNorth=wall('Master passage wall',xs[1],mid+134,xs[2],mid+134);
wall('Ensuite west wall',left,mid+219,left,bottom);const ensuiteNorth=wall('Ensuite north wall',left,mid+219,xs[1],mid+219);wall('Ensuite south wall',left,bottom,xs[1],bottom);
const bathNorth=wall('Shared toilet north wall',bathX,bathY,xs[4],bathY),bathWest=wall('Shared toilet west wall',bathX,bathY,bathX,bottom);
const opening=(w,offset,width=90,type='door')=>{const len=Math.hypot(w.x2-w.x1,w.y2-w.y1),x=w.x1+(w.x2-w.x1)*offset/len,y=w.y1+(w.y2-w.y1)*offset/len;f.items.push({id:id(type),type,shape:type,name:type==='door'?'Door':'Window',x:x-width/2,y:y-9,w:width,d:18,height:type==='door'?210:120,elevation:type==='door'?0:90,rotation:Math.atan2(w.y2-w.y1,w.x2-w.x1)*180/Math.PI,hostWallId:w.id,wallOffset:offset,material:type==='door'?'Wood':'Glass',color:type==='door'?'#946846':'#a2c6ce',hingeSide:'left',swingSide:1,openAngle:30});};
opening(childrenSouth,230);opening(masterNorth,220);opening(partitionA,mid+75-top);opening(guestSouth,180);opening(partitionB,mid+76-ys[0],100);opening(partitionC,850-top,90);opening(partitionC,top+235-top,80);opening(balconyDoorWall,100,90);opening(masterWest,bottom-140-(mid+134),75);opening(bathNorth,100,75);
for(const w of [northChildren,northKitchen,southMaster,southLiving])opening(w,Math.hypot(w.x2-w.x1,w.y2-w.y1)/2,120,'window');opening(childrenWest,175,120,'window');
for(const w of [northGuest,southPrivate]){opening(w,78,85,'window');opening(w,Math.hypot(w.x2-w.x1,w.y2-w.y1)-78,85,'window');}
const stairs={id:id('stair'),type:'u-stairs',shape:'u-stairs',name:'Stair reservation — rise 304.8 cm, landing/headroom pending',x:1773,y:640,w:200,d:320,height:H,elevation:0,rotation:90,stairWidth:95,landingWidth:200,landingLength:100,landingDepth:100,stepCount:18,lowerStepCount:9,upperStepCount:9,material:'Concrete',color:'#adb8b3',underStorage:false};f.items.push(stairs);
// Retain movable furnishings that can fit, translating them with the associated room; leave the original in the reference file.
for(const item of original.floors[1].items.filter(i=>!['door','window','u-stairs','roof'].includes(i.shape||i.type))){const old=original.floors[1].rooms.find(r=>item.x+item.w/2>=r.x&&item.x+item.w/2<=r.x+r.w&&item.y+item.d/2>=r.y&&item.y+item.d/2<=r.y+r.d),dest=old&&f.rooms.find(r=>r.name===old.name);if(!dest||item.w>dest.w||item.d>dest.d)continue;const n=clone(item);n.x=dest.x+Math.max(0,Math.min(dest.w-n.w,item.x-old.x));n.y=dest.y+Math.max(0,Math.min(dest.d-n.d,item.y-old.y));delete n.hostWallId;f.items.push(n);}
const g=p.floors[0];g.name='Ground floor — open parking / garden';g.rooms=[];g.walls=[];g.items=[{...clone(stairs),id:id('stair')}];g.dimensions=[];
// Free-standing boundary walls are deliberately omitted from frame infill assumptions; west access remains open.
const roof=p.floors[2];roof.name='Roof level / future second floor reserved';roof.rooms=[];roof.walls=[];roof.items=[];roof.dimensions=[];
const panels=(fl,roofLevel=false)=>{fl.slabs=[];for(let ix=0;ix<5;ix++)for(let iy=0;iy<2;iy++){
  const x0=ix===0?left:xs[ix],x1=ix===4?right:xs[ix+1],y0=iy===0?top:ys[iy],y1=iy===1?bottom:ys[iy+1];
  // Stair opening: trim the south-east panel to its north landing strip. No fictitious slab over the flights.
  const end=ix===4&&iy===1?mid+25:y1;
  fl.slabs.push({id:id('slab'),type:'slab',name:'Coordination panel '+(ix+1)+(iy+1),x:x0,y:y0,w:x1-x0,d:end-y0,thickness:15,deadLoad:roofLevel?1.5:2.5,liveLoad:roofLevel||ix===0||ix===3||ix===4&&iy===1?3:2,color:'#bcc9c7'});
}};
function frame(fl,level){fl.elevation=level*H;fl.columns=[];fl.beams=[];fl.loads=[];fl.structuralWalls=[];fl.grids=[];fl.diaphragm='rigid';fl.isRoof=level===1;
 for(let iy=0;iy<3;iy++)for(let ix=0;ix<6;ix++){const tag=String.fromCharCode(65+ix)+(iy+1);fl.columns.push({id:id('column'),type:'column',tag,name:tag+' — coordination envelope only',x:xs[ix]-22.5,y:ys[iy]-22.5,w:45,d:45,height:H,shape:'rect',material:'RCC M30',steelGrade:'Fe500D',rebarSpec:'NOT DESIGNED — engineer to specify',footingWidth:240,footingDepth:240,footingThickness:50,baseSupport:'fixed',color:'#365c73',provenance:'manual'});}
 const beam=(a,b,name,cant=false)=>{fl.beams.push({id:id('beam'),type:'beam',tag:name,name:name+' — preliminary envelope',x1:a.x+a.w/2,y1:a.y+a.d/2,x2:b.x+b.w/2,y2:b.y+b.d/2,startColumnId:a.id,endColumnId:cant?'':b.id,width:30,depth:45,ceilingHeight:H,beamType:cant?'cantilever':'primary',material:'RCC M30',steelGrade:'Fe500D',rebarSpec:'NOT DESIGNED — engineer to specify',supportCondition:cant?'cantilever':'continuous',color:cant?'#a87832':'#365c73',provenance:'manual'});};
 for(let iy=0;iy<3;iy++)for(let ix=0;ix<5;ix++)beam(fl.columns[iy*6+ix],fl.columns[iy*6+ix+1],'X'+(iy+1)+'-'+(ix+1));
 for(let ix=0;ix<6;ix++)for(let iy=0;iy<2;iy++)beam(fl.columns[iy*6+ix],fl.columns[(iy+1)*6+ix],'Y'+(ix+1)+'-'+(iy+1));
 // Explicit short cantilever stubs extend boundary frame lines into the 60 cm occupied perimeter strip.
 for(let iy=0;iy<3;iy++)for(const ix of [0,5]){const a=fl.columns[iy*6+ix];beam(a,{x:(ix?right:left),y:ys[iy],w:0,d:0},'CX'+ix+iy,true);}
 for(let ix=0;ix<6;ix++)for(const iy of [0,2]){const a=fl.columns[iy*6+ix];beam(a,{x:xs[ix],y:iy?bottom:top,w:0,d:0},'CY'+ix+iy,true);}
 const rc=(x1,y1,x2,y2)=>fl.structuralWalls.push({id:id('rcwall'),type:'structural-wall',name:'Reserved RC wall — permanent; shell design required',x1,y1,x2,y2,thickness:20,height:H,color:'#af6450',material:'RCC M30',rebarSpec:'NOT DESIGNED'});
 for(const y of [ys[0],ys[2]])rc(cx-60,y,cx+60,y);
 for(const x of [xs[2],xs[3]]){rc(x,ys[0]+20,x,ys[0]+200);rc(x,ys[2]-200,x,ys[2]-20);}
 xs.forEach((position,i)=>fl.grids.push({id:id('grid'),type:'grid',axis:'x',position,name:String.fromCharCode(65+i)}));ys.forEach((position,i)=>fl.grids.push({id:id('grid'),type:'grid',axis:'y',position,name:String(i+1)}));panels(fl,level===1);
}
frame(g,0);frame(f,1);for(const key of ['columns','beams','loads','structuralWalls','grids','slabs'])roof[key]=[];roof.diaphragm='none';roof.isRoof=true;
function clearIdeaOneStair(fl){fl.beams=fl.beams.filter(b=>!/^Y[16]-/.test(b.tag));fl.slabs=fl.slabs.filter(s=>!(s.x===xs[4]&&s.y===mid));for(const [x,y,w,d]of [[xs[4],mid,2043-xs[4],690-mid],[xs[4],910,2043-xs[4],bottom-910],[xs[4],690,16,220]])fl.slabs.push({id:id('landing-slab'),type:'slab',name:'Stair-edge/landing reservation — support design pending',x,y,w,d,thickness:15,deadLoad:fl.isRoof?1.5:2.5,liveLoad:3,color:'#bcc9c7'});}
clearIdeaOneStair(g);clearIdeaOneStair(f);
// Sunshade is a roof-level reservation, independent of the 60 cm floor extension; no canopy crosses the site boundary.
const shade=(name,x,y,w,d)=>f.items.push({id:id('shade'),type:'roof',shape:'roof',name,x,y,w,d,height:10,elevation:H-10,color:'#d5b578',material:'Concrete'});
const chajja=76.2;
shade('2.5 ft north chajja — independent design pending',left-chajja,top-chajja,right-left+2*chajja,chajja);shade('2.5 ft south chajja — independent design pending',left-chajja,bottom,right-left+2*chajja,chajja);shade('2.5 ft west chajja — independent design pending',left-chajja,top,chajja,bottom-top);shade('2.5 ft east kitchen chajja — independent design pending',right,top,chajja,mid-top);
const future=clone(p);future.projectId+='-future';future.name='FUTURE G+2 load/space scenario — NOT FOR CONSTRUCTION';future.floors[1].isRoof=false;future.floors[1].slabs.forEach((s,i)=>{s.liveLoad=p.floors[0].slabs[i].liveLoad;s.deadLoad=2.5;});const ff=future.floors[2];ff.name='Future second floor — frame reservation only';frame(ff,2);ff.isRoof=true;clearIdeaOneStair(ff);ff.slabs.forEach(s=>{s.liveLoad=3;s.deadLoad=1.5;});
// Move current roof chajjas to future roof, so no duplicate shade is shown at the future occupied slab.
ff.items=future.floors[1].items.filter(i=>i.id.startsWith('shade-')).map(i=>({...clone(i),id:id('future-shade')}));future.floors[1].items=future.floors[1].items.filter(i=>!i.id.startsWith('shade-'));
for(const q of [p,future]){A.validateProject(q);A.normalizeProject(q);A.validateProject(q);}
fs.writeFileSync(path.join(dir,'proposed-current-G1.json'),JSON.stringify(p,null,2));fs.writeFileSync(path.join(dir,'future-G2-scenario.json'),JSON.stringify(future,null,2));
// Geometric checks are not structural capacity checks.
const checks=[];const check=(name,fn)=>{fn();checks.push(name);};
check('Original input remains byte-for-byte unchanged',()=>assert.equal(fs.readFileSync(source).toString(),raw.toString()));
check('No legacy column or beam IDs carried into either proposal',()=>{const oldIds=new Set(original.floors.flatMap(f=>[...f.columns,...f.beams].map(o=>o.id)));for(const q of [p,future])for(const f of q.floors)for(const o of [...f.columns,...f.beams])assert.ok(!oldIds.has(o.id));});
check('18 vertically aligned columns on each occupied storey',()=>{for(const fl of future.floors){assert.equal(fl.columns.length,18);fl.columns.forEach((c,i)=>{assert.equal(c.x,g.columns[i].x);assert.equal(c.y,g.columns[i].y);assert.equal(c.height,H);});}});
check('Frame and wall reservations symmetric about both plan axes',()=>{for(const x of xs)assert.ok(xs.some(v=>Math.abs(v-(2*cx-x))<.001));for(const y of ys)assert.ok(ys.some(v=>Math.abs(v-(2*cy-y))<.001));assert.equal(g.structuralWalls.length,6);});
check('All beam joints resolve; cantilever free ends remain free',()=>{for(const fl of future.floors){const ids=new Set(fl.columns.map(c=>c.id));for(const b of fl.beams){assert.ok(ids.has(b.startColumnId));assert.ok(b.supportCondition==='cantilever'?b.endColumnId==='':ids.has(b.endColumnId));}}});
check('240 cm footing reservations leave at least 30.48 cm to assumed plot boundary',()=>{for(const c of g.columns){assert.ok(c.x+c.w/2-120>=site.x+30.48-.001);assert.ok(c.x+c.w/2+120<=site.x+site.w-30.48+.001);assert.ok(c.y+c.d/2-120>=site.y+30.48-.001);assert.ok(c.y+c.d/2+120<=site.y+site.h-30.48+.001);}});
check('Roof shade outer edges stay within assumed plot',()=>{for(const i of f.items.filter(i=>i.id.startsWith('shade-'))){assert.ok(i.x>=site.x&&i.y>=site.y&&i.x+i.w<=site.x+site.w&&i.y+i.d<=site.y+site.h);}});
check('Stair rise meets each storey and rotated flight rectangle clears beams/columns',()=>{assert.equal(stairs.height,H);const box={x:1713,y:700,w:320,h:200};for(const c of f.columns)assert.ok(c.x+c.w<=box.x||c.x>=box.x+box.w||c.y+c.d<=box.y||c.y>=box.y+box.h);for(const b of f.beams){const minx=Math.min(b.x1,b.x2)-b.width/2,maxx=Math.max(b.x1,b.x2)+b.width/2,miny=Math.min(b.y1,b.y2)-b.width/2,maxy=Math.max(b.y1,b.y2)+b.width/2;assert.ok(maxx<=box.x||minx>=box.x+box.w||maxy<=box.y||miny>=box.y+box.h);}});
check('Future frame has no missing beam or vertically discontinuous column joints',()=>{const m=A.buildingFrame(future);assert.ok(m.issues.every(i=>i.message.includes('wall shell stiffness')));});
check('Hosted openings do not intersect columns or reserved RC walls in plan',()=>{for(const o of f.items.filter(i=>['door','window'].includes(i.type))){const w=f.walls.find(w=>w.id===o.hostWallId),len=Math.hypot(w.x2-w.x1,w.y2-w.y1),ux=(w.x2-w.x1)/len,uy=(w.y2-w.y1)/len,x=w.x1+ux*o.wallOffset,y=w.y1+uy*o.wallOffset,half=o.w/2;
 for(const c of f.columns){const q=A.structuralCenter(c),along=(q.x-x)*ux+(q.y-y)*uy,across=Math.abs((q.x-x)*uy-(q.y-y)*ux);assert.ok(across>c.w/2+w.thickness/2||Math.abs(along)>half+c.w/2,`${o.id} conflicts with ${c.tag}`);}
 for(const r of f.structuralWalls){const parallel=Math.abs((r.x2-r.x1)*uy-(r.y2-r.y1)*ux)<.01;if(!parallel)continue;const across=Math.abs((r.x1-x)*uy-(r.y1-y)*ux),t1=(r.x1-x)*ux+(r.y1-y)*uy,t2=(r.x2-x)*ux+(r.y2-y)*uy;assert.ok(across>r.thickness/2+w.thickness/2||Math.max(t1,t2)<-half||Math.min(t1,t2)>half,`${o.id} conflicts with RC wall`);}
}});
const loads=clone(future); // Separate load scenario: architectural partitions are carried by the slab immediately underneath them.
loads.floors[0].walls=clone(f.walls);loads.floors[1].walls=clone(f.walls);loads.floors[2].walls=[];
const gravity=A.gravityModel(loads);check('Future gravity bookkeeping balances (approximate tributary model only)',()=>assert.ok(gravity.balanceError<1e-7));
const reactions=[...gravity.floors.get(g.id).loads].map(([cid,r])=>({tag:g.columns.find(c=>c.id===cid).tag,serviceKN:round(r.dead+r.live),areaAt150KpaWith10PercentAllowance:round((r.dead+r.live)*1.1/150),squareSideCm:round(Math.sqrt((r.dead+r.live)*1.1/150)*100)}));
const area=r=>r.polygon?A.structuralArea(r.polygon)/929.0304:r.w*r.d/929.0304;
const audit={date:'2026-10-12',checks,site,xs,ys,baysX:xs.slice(1).map((x,i)=>round(x-xs[i])),baysY:ys.slice(1).map((y,i)=>round(y-ys[i])),columnsPerStorey:18,primaryBeamsPerStorey:23,cantileverStubsPerStorey:18,rcWallReservationsPerStorey:6,gravityBalanceError:gravity.balanceError,gravityCaveat:'Tributary bookkeeping, not plate/frame design. Assumed repeated future masonry layout + 1 kPa partition reserve in occupied slab superimposed dead loads; wall stiffness/foundation interaction uncomputed. Masonry overlap with RC walls is conservatively retained. Chajja self-weight and detailed stair/landing loads not included: reaction is not a complete design load.',reactions,originalRooms:original.floors[1].rooms.map(r=>({name:r.name,widthFt:round(r.w/30.48),depthFt:round(r.d/30.48),areaSqFt:round(area(r))})),proposedRooms:f.rooms.map(r=>({name:r.name,widthFt:round(r.w/30.48),depthFt:round(r.d/30.48),areaSqFt:round(area(r))})),issues:A.buildingFrame(future).issues,notes};
fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(audit,null,2));console.log(JSON.stringify({checks:checks.length,maxReactionKN:Math.max(...reactions.map(r=>r.serviceKN)),maxFootingTrialCm:Math.max(...reactions.map(r=>r.squareSideCm)),xs,ys},null,2));

// IDEA 2: keep source architecture and room IDs; only local balcony/stair/opening edits.
const minimal=clone(original);minimal.projectId='courtyard-idea2-20261012';minimal.name='Idea 2 — existing rooms / new frame — NOT FOR CONSTRUCTION';minimal.site=clone(p.site);minimal.builtUp=clone(p.builtUp);minimal.structuralBasis=clone(p.structuralBasis);minimal.camera=clone(p.camera);minimal.showStructure=true;minimal.layoutValidated=true;minimal.activeFloor=1;
minimal.conceptReview={...clone(p.conceptReview),idea:2,notes:[...notes,'Architecture retained with local balcony +25 cm shift, rotated stair within existing zone and entrance-door repositioning.','South support row at y=1130 cm requires eccentric/combined/raft foundation design. Centred pad footings do NOT meet the boundary-clearance brief.','Outer longitudinal beams omitted symmetrically to clear the rotated stair. Edge slabs, stair landing support and edge collectors need plate/frame design.','No uniform perimeter chajja: only fit 2.5 ft projections where the existing building leaves room inside the assumed plot.']};
const mY=[ys[0],round((ys[0]+1130)/2),1130],mapY=v=>v<=ys[1]?mY[0]+(v-ys[0])*(mY[1]-mY[0])/(ys[1]-ys[0]):mY[1]+(v-ys[1])*(mY[2]-mY[1])/(ys[2]-ys[1]);
for(let level=0;level<2;level++){
 const fl=minimal.floors[level];frame(fl,level);fl.name=level?'First floor — existing room arrangement':'Ground floor — west access / open use';
 for(const c of fl.columns)c.y=mapY(c.y+c.d/2)-c.d/2;
 for(const b of fl.beams){b.y1=mapY(b.y1);b.y2=mapY(b.y2);}
 // Preserve X symmetry and equal north/south treatment; inner four longitudinal frame lines remain continuous.
 fl.beams=fl.beams.filter(b=>!(/^Y[16]-/.test(b.tag)));
 for(const w of fl.structuralWalls){w.y1=mapY(w.y1);w.y2=mapY(w.y2);}
 // Keep RC walls in existing partition lines, not free-standing across the guest/private rooms.
 for(const w of fl.structuralWalls){if(w.y1===w.y2){w.y1=w.y2=w.y1<mY[1]?171.45:1173.48;}else if(w.y1<mY[1]){w.y1=221.45;w.y2=401.45;}else{w.y1=943.48;w.y2=1123.48;}}
 for(const grid of fl.grids)if(grid.axis==='y')grid.position=mapY(grid.position);
 for(const s of fl.slabs){const end=mapY(s.y+s.d);s.y=mapY(s.y);s.d=end-s.y;}
 for(const c of fl.columns){const cc=A.structuralCenter(c);c.foundationReservation={x:cc.x-120,y:Math.min(cc.y,site.y+site.h-30.48-120)-120,w:240,d:240,status:'SPACE ONLY; eccentric pads/straps/combined foundation not designed'};}
 // Rotation uses the actual model centre. Bounding footprint is x=1713..2033, y=750..950.
 const st=fl.items.find(i=>i.type==='u-stairs');if(st)Object.assign(st,{x:1773,y:690,w:200,d:320,height:H,rotation:90,stairWidth:95,landingWidth:200,landingLength:100,landingDepth:100,stepCount:18,lowerStepCount:9,upperStepCount:9,material:'Concrete',name:'Rotated stair reservation — landing/headroom design pending'});
 // Replace previous slabs with source floor footprint / roof concept, leaving the rotated stair well open.
 fl.slabs=[];const xb=[149,515,914.4,1287.6,1687,2054],yb=[152,mY[1],1178];
 const cut={x:1703,y:740,w:340,d:220};
 for(let i=0;i<5;i++)for(let j=0;j<2;j++){
  const x0=xb[i],x1=xb[i+1],y0=yb[j],y1=yb[j+1],ix0=Math.max(x0,cut.x),ix1=Math.min(x1,cut.x+cut.w),iy0=Math.max(y0,cut.y),iy1=Math.min(y1,cut.y+cut.d),rects=ix1>ix0&&iy1>iy0?[[x0,y0,x1-x0,iy0-y0],[x0,iy1,x1-x0,y1-iy1],[x0,iy0,ix0-x0,iy1-iy0],[ix1,iy0,x1-ix1,iy1-iy0]]:[[x0,y0,x1-x0,y1-y0]];
  for(const [x,y,w,d] of rects)if(w>.01&&d>.01)fl.slabs.push({id:id('minimal-slab'),type:'slab',name:'Concept slab / stair opening',x,y,w,d,thickness:15,deadLoad:level?1.5:2.5,liveLoad:3,color:'#bcc9c7'});
 }
}
const mf=minimal.floors[1];mf.rooms.find(r=>r.name==='Balcony').y+=25;mf.walls=mf.walls.filter(w=>Math.hypot(w.x2-w.x1,w.y2-w.y1)>1);
// Move the guest/private divider north by 62.54 cm, allowing the children's doorway to clear C2.
for(const w of mf.walls)for(const end of [1,2])if(Math.abs(w['y'+end]-637.54)<.02&&w['x'+end]>=914&&w['x'+end]<=1301)w['y'+end]=575;
const guestRoom=mf.rooms.find(r=>r.name==='Guest Room'),privateRoom=mf.rooms.find(r=>r.name==='Private Living Room');guestRoom.d=565-guestRoom.y;const privateBottom=privateRoom.y+privateRoom.d;privateRoom.y=585;privateRoom.d=privateBottom-585;
const childDoor=mf.items.find(i=>i.id==='3e429bd7-dab6-45b2-87b4-acf863d2f68b');childDoor.wallOffset=60;childDoor.y=635-childDoor.d/2;
const guestDoor=mf.items.find(i=>i.id==='2654b910-c1e2-44d3-877d-ac4ae484e191');guestDoor.wallOffset=520-mf.walls.find(w=>w.id===guestDoor.hostWallId).y1;guestDoor.y=520-guestDoor.d/2;
const entry=mf.items.find(i=>i.id==='dbd2a81f-4355-4d26-928e-1092d4a5ad61');if(entry){const w=mf.walls.find(w=>w.id===entry.hostWallId);entry.wallOffset=900-w.y1;entry.x=w.x1-entry.w/2;entry.y=900-entry.d/2;}
// Source openings may clash with NEW columns. Move only along their existing wall, at most 90 cm, and retain width.
const movedOpenings=[],unresolvedOpenings=[];
function blocked(fl,w,offset,width){const len=Math.hypot(w.x2-w.x1,w.y2-w.y1),ux=(w.x2-w.x1)/len,uy=(w.y2-w.y1)/len,x=w.x1+ux*offset,y=w.y1+uy*offset;
 for(const c of fl.columns){const q=A.structuralCenter(c),along=(q.x-x)*ux+(q.y-y)*uy,across=Math.abs((q.x-x)*uy-(q.y-y)*ux);if(across<c.w/2+w.thickness/2+3&&Math.abs(along)<width/2+c.w/2+3)return true;}
 for(const r of fl.structuralWalls){if(Math.abs((r.x2-r.x1)*uy-(r.y2-r.y1)*ux)>.1)continue;const cross=Math.abs((r.x1-x)*uy-(r.y1-y)*ux),a=(r.x1-x)*ux+(r.y1-y)*uy,b=(r.x2-x)*ux+(r.y2-y)*uy;if(cross<r.thickness/2+w.thickness/2+3&&Math.max(a,b)>-width/2-3&&Math.min(a,b)<width/2+3)return true;}return false;}
for(const o of mf.items.filter(i=>i.hostWallId)){
 const w=mf.walls.find(w=>w.id===o.hostWallId);if(!w)continue;const len=Math.hypot(w.x2-w.x1,w.y2-w.y1),base=o.wallOffset??((o.x+o.w/2-w.x1)*(w.x2-w.x1)+(o.y+o.d/2-w.y1)*(w.y2-w.y1))/len;
 let offset=null;for(let step=0;step<=90&&offset===null;step+=5)for(const sign of [1,-1]){const at=base+step*sign;if(at>=o.w/2+5&&at<=len-o.w/2-5&&!blocked(mf,w,at,o.w)){offset=at;break;}}
 if(offset===null){unresolvedOpenings.push(o.id);continue;}if(Math.abs(offset-base)>.1)movedOpenings.push({id:o.id,type:o.type,shiftCm:round(offset-base)});o.wallOffset=offset;o.x=w.x1+(w.x2-w.x1)*offset/len-o.w/2;o.y=w.y1+(w.y2-w.y1)*offset/len-o.d/2;
}
// Three local chajjas where measured free space permits them; no south/balcony overhang beyond boundary.
for(const [x,y,w,d,name] of [[513.08,220.98-76.2,396.24,76.2,'Children north chajja 2.5 ft'],[1955.8,289.56,76.2,396.24,'Kitchen east chajja 2.5 ft'],[1968.5,957.58,76.2,210.82,'Toilet east chajja 2.5 ft']])mf.items.push({id:id('minimal-shade'),type:'roof',shape:'roof',name,x,y,w,d,height:10,elevation:H-10,material:'Concrete',color:'#d5b578'});
const mr=minimal.floors[2];for(const key of ['rooms','walls','items','columns','beams','loads','structuralWalls','grids','slabs','dimensions'])mr[key]=[];mr.name='Roof / future second floor reserved';mr.isRoof=true;mr.diaphragm='none';
const westGate=minimal.floors[0].items.find(i=>i.id==='5992f089-62bc-4304-80b8-66e6ccf51d3e');if(westGate){const w=minimal.floors[0].walls.find(w=>w.id===westGate.hostWallId);westGate.w=330;westGate.wallOffset=500-w.y1;westGate.x=w.x1-westGate.w/2;westGate.y=500-westGate.d/2;westGate.name='West vehicle gate — 3.3 m clear opening concept';}
// Retain open-to-sky terraces/balcony in Idea 2. Source room locations are unchanged.
for(const cut of mf.rooms.filter(r=>/Open terrace|Balcony/.test(r.name))){const next=[];for(const s of mf.slabs){const x0=Math.max(s.x,cut.x),x1=Math.min(s.x+s.w,cut.x+cut.w),y0=Math.max(s.y,cut.y),y1=Math.min(s.y+s.d,cut.y+cut.d);if(x1<=x0||y1<=y0){next.push(s);continue;}for(const [x,y,w,d]of [[s.x,s.y,s.w,y0-s.y],[s.x,y1,s.w,s.y+s.d-y1],[s.x,y0,x0-s.x,y1-y0],[x1,y0,s.x+s.w-x1,y1-y0]])if(w>.01&&d>.01)next.push({...s,id:id('open-roof-panel'),x,y,w,d});}mf.slabs=next;}
A.normalizeProject(A.validateProject(minimal));A.validateProject(minimal);
const minimalIssues=A.buildingFrame(minimal).issues;assert.ok(minimalIssues.every(i=>i.message.includes('wall shell stiffness')));
assert.equal(unresolvedOpenings.length,0);
const bStair={x:1713,y:750,w:320,h:200};for(const fl of minimal.floors.slice(0,2)){for(const c of fl.columns)assert.ok(c.x+c.w<=bStair.x||c.x>=bStair.x+bStair.w||c.y+c.d<=bStair.y||c.y>=bStair.y+bStair.h);for(const b of fl.beams)assert.ok(Math.max(b.x1,b.x2)+b.width/2<=bStair.x||Math.min(b.x1,b.x2)-b.width/2>=bStair.x+bStair.w||Math.max(b.y1,b.y2)+b.width/2<=bStair.y||Math.min(b.y1,b.y2)-b.width/2>=bStair.y+bStair.h);}
for(const c of minimal.floors[0].columns){const r=c.foundationReservation;assert.ok(r.y>=site.y+30.48-.001&&r.y+r.d<=site.y+site.h-30.48+.001);}
const minimalAudit={...audit,idea:2,ys:mY,primaryBeamsPerStorey:23,roomChanges:'Balcony shifted 25 cm; guest/private divider moved north 62.54 cm, guest shortened and private living enlarged; other room rectangles unchanged.',balconyShiftCm:25,movedOpenings,unresolvedOpenings,sourceStructureDiscarded:true,notes:minimal.conceptReview.notes,issues:minimalIssues,proposedRooms:mf.rooms.map(r=>({name:r.name,widthFt:round(r.w/30.48),depthFt:round(r.d/30.48),areaSqFt:round(area(r))})),reactions:undefined,gravityBalanceError:undefined,gravityCaveat:'Idea 2 load capacity not analysed. Idea 1 reactions must not be used for this different frame.'};
minimalAudit.checks=['Application schema validation','Frame joints resolve except explicitly unsupported RC wall stiffness','No unresolved column/RC-wall clashes in checked hosted openings','Rotated stair footprint does not overlap columns or beams','Column footing SPACE rectangles remain at least 30.48 cm inside assumed boundary; capacity and eccentricity uncomputed'];
minimal.conceptReview.notes.push('Guest/private divider shifted north 62.54 cm to clear the children doorway from a column; guest shortened, private living enlarged.','RC wall zones moved to existing perimeter/partition lines. Geometric column symmetry does not establish stiffness/mass symmetry.');
for(const q of [p,minimal])for(const fl of q.floors){fl.slabs.forEach((s,i)=>s.name='S'+(i+1)+' · concept');fl.structuralWalls.forEach((w,i)=>w.name='RC'+(i+1)+' · reserved');}
fs.writeFileSync(path.join(dir,'idea-1-coordinated.json'),JSON.stringify(p,null,2));fs.writeFileSync(path.join(dir,'idea-2-minimal-change.json'),JSON.stringify(minimal,null,2));fs.writeFileSync(path.join(dir,'verification-idea2.json'),JSON.stringify(minimalAudit,null,2));console.log('Idea 2: local opening moves '+movedOpenings.length+'; unresolved openings '+unresolvedOpenings.length);
