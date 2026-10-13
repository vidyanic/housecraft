const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname,'..');
process.chdir(root);
const context = { window:{}, console, localStorage:{ getItem(){return null;} }, document:{querySelector(){return null;}} };
vm.createContext(context);
function load(file){vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});context.Atelier=context.window.Atelier;}
load('js/utilities.js');
const A=context.Atelier; A.state={project:{unit:'ft'}};
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('Imperial lengths and signed round trips',()=>{
  assert.equal(A.toCm('6″'),15.24);assert.equal(A.toCm('5′ 4″'),162.56);
  assert.equal(A.toCm('-0′ 6″'),-15.24);
  assert.equal(A.formatLength(-60.96),'-2′ 0″');
  for(const cm of [-600,-60.96,-15.24,0,15.24,162.56]) assert.ok(Math.abs(A.toCm(A.formatLength(cm))-cm)<1.28);
  assert.ok(Number.isNaN(A.toCm('bad')));assert.ok(Number.isNaN(A.toCm('')));
});
for(const f of ['js/constants.js','js/furniture-catalog.js','js/structural-model.js','default-layout.js','js/project-model.js','js/project-validation.js','js/app-state.js'])load(f);
load('js/services.js');load('js/stairs.js');load('js/canvas-drawing.js');
test('Three-sided stair has equal rises/going, clear landings and mirrored start-side layouts',()=>{
 const spec=A.CATALOG.find(o=>o.type==='three-side-stairs');
 assert.equal(A.stairFormatLength(304.8/18),'6.67″');assert.equal(A.stairFormatLength(26.67),'10.5″');
 for(const side of ['long','short'])for(const hand of ['left','right']){const o={...spec,stairStartSide:side,stairHandedness:hand},before=JSON.stringify(o),l=A.threeSideStairLayout(o);assert.equal(JSON.stringify(o),before);assert.equal(l.total,side==='long'?18:17);assert.equal(l.counts.join(','),side==='long'?'7,4,7':'5,7,5');assert.ok(l.riser>=14&&l.riser<=18&&l.going>=25&&l.comfort>=60&&l.comfort<=65);assert.ok(l.landingAlong>=91.44-1e-7&&l.landingAcross>=91.44-1e-7);assert.equal(l.parts.filter(p=>p.kind==='landing').length,2);assert.equal(l.parts.filter(p=>p.kind==='tread').length,l.total-3);assert.equal(l.parts[0].kind,'entrance');assert.equal(l.parts.at(-1).kind,'exit');assert.equal(l.parts[0].z,0);assert.equal(l.parts.at(-1).z,304.8);for(const p of l.parts){assert.ok(p.x-p.w/2>=-o.w/2-1e-7&&p.x+p.w/2<=o.w/2+1e-7);assert.ok(p.y-p.d/2>=-o.d/2-1e-7&&p.y+p.d/2<=o.d/2+1e-7);}const levels=l.parts.map(p=>p.z);for(let i=1;i<levels.length;i++)assert.ok(Math.abs(levels[i]-levels[i-1]-l.riser)<1e-7);for(let i=0;i<l.parts.length;i++)for(let j=i+1;j<l.parts.length;j++){const a=l.parts[i],b=l.parts[j];if(a.kind==='entrance'&&b.kind==='exit')continue;const overlapX=Math.min(a.x+a.w/2,b.x+b.w/2)-Math.max(a.x-a.w/2,b.x-b.w/2),overlapY=Math.min(a.y+a.d/2,b.y+b.d/2)-Math.max(a.y-a.d/2,b.y-b.d/2);assert.ok(overlapX<1e-7||overlapY<1e-7,'Stair/platform footprints overlap');}}
 const clockwise=A.threeSideStairLayout({...spec,stairStartSide:'long',stairHandedness:'right'}),[a,b,c]=clockwise.path;assert.ok((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)>0,'Long-side ascent must turn clockwise');
 assert.throws(()=>A.threeSideStairLayout({...spec,w:150,d:150}));const swapped=A.threeSideStairLayout({...spec,w:spec.d,d:spec.w});assert.equal(swapped.alongX,true);
 const p=A.deep(A.DEFAULT);p.floors[0].items.push({...spec,id:'test-new-stair',x:0,y:0,rotation:0});assert.equal(A.validateProject(p).floors[0].items.at(-1).stairStartSide,'short');for(const changes of [{stairStartSide:'bad'},{stairHandedness:'bad'},{stairWidth:-1},{stairTargetRiser:'bad'},{stairLandingMin:-1}]){const bad=A.deep(p);Object.assign(bad.floors[0].items.at(-1),changes);assert.throws(()=>A.validateProject(bad));}
});
test('Rotated bounds match transformed corners including clearance and degenerate sizes',()=>{
 for(const rotation of [-180,-45,0,30,90,180,359])for(const [w,d] of [[100,50],[0,50],[10,5],[-20,30]]){
  const o={x:-30,y:70,w,d,rotation},points=A.rotatedRect(o),box=A.itemAabb(o,7),expected={minX:Math.min(...points.map(p=>p.x))-7,maxX:Math.max(...points.map(p=>p.x))+7,minY:Math.min(...points.map(p=>p.y))-7,maxY:Math.max(...points.map(p=>p.y))+7};
  for(const key of Object.keys(expected))assert.ok(Math.abs(box[key]-expected[key])<1e-9,key+' bounds changed at '+rotation);
 }
});
test('Service routes preserve bends, vertical lengths and serialization',()=>{
 const src=A.CATALOG.find(o=>o.type==='cold-water-pipe'),o={...src,id:'service-test',x:0,y:0,rotation:0};A.initServiceObject(o,src);
 A.setServicePath(o,[{x:0,y:0,z:3},{x:300,y:0,z:3},{x:300,y:0,z:103},{x:300,y:200,z:103}]);
 assert.equal(A.serviceLength(o),600);assert.ok(A.serviceHit(o,{x:150,y:2},5));assert.ok(!A.serviceHit(o,{x:150,y:100},5));
 const project={floors:[{id:'service-floor',items:[o]}]};assert.equal(A.validateProject(project).floors[0].items[0].routePoints.length,4);
 const before=JSON.stringify(o);assert.throws(()=>A.setServicePath(o,[{x:0,y:0,z:0},{x:0,y:0,z:0}]));assert.equal(JSON.stringify(o),before);
 const malformed=JSON.parse(JSON.stringify(project));malformed.floors[0].items[0].routePoints[0].z='bad';assert.throws(()=>A.validateProject(malformed));
 assert.equal(A.CATALOG.filter(o=>o.system).length,19);
});
test('Default project passes validation without mutation',()=>{
 const before=JSON.stringify(A.DEFAULT); const p=A.validateProject(A.DEFAULT);
 assert.equal(JSON.stringify(A.DEFAULT),before);assert.ok(p.floors.length);
 assert.equal(JSON.stringify(A.validateProject(JSON.parse(JSON.stringify(p)))),JSON.stringify(p));
});
test('Site JSON migration keeps labels, front edge and centimetre lengths through round trips',()=>{
 const p=A.deep(A.DEFAULT);p.site={width:1000,depth:600,north:'Main road',west:{label:'Neighbour',status:'closed',length:600},sideLabels:{south:{label:'Rear',note:'Garden',visible:false}},frontSide:'NORTH'};
 const before=JSON.stringify(p),validated=A.validateProject(p);assert.equal(JSON.stringify(p),before);assert.equal(validated.site.sides.north.direction,'Main road');assert.equal(validated.site.sides.west.measurement,600);assert.equal(validated.site.sides.south.direction,'Rear');assert.equal(validated.site.frontSide,'north');
 assert.equal(JSON.stringify(A.validateProject(validated)),JSON.stringify(validated));const normalized=A.normalizeProject(validated);assert.equal(normalized.site.sides.south.visible,false);assert.ok(A.siteSideText(normalized.site,'north').startsWith('FRONT'));
 const partial=A.deep(A.DEFAULT);partial.site.sides={north:{note:'Road'},east:{measurement:600}};const site=A.validateProject(partial).site;assert.equal(A.siteSideDefinition(site,'north').direction,'NORTH');assert.equal(A.siteSideDefinition(site,'east').showMeasurement,true);
 for(const mutate of [p=>p.site.frontSide='bad',p=>p.site.width=-10,p=>p.site.sides.west.measurement='6 m']){const bad=A.deep(normalized);mutate(bad);assert.throws(()=>A.validateProject(bad));}
});
test('Reject malformed projects before replacement',()=>{
 const original=JSON.stringify(A.state.project);
 for(const p of [{floors:[]},{floors:[{items:'bad'}]},{floors:[{items:[{x:0,y:0,w:-1,d:2}]}]}])assert.throws(()=>A.validateProject(p));
 const p=A.deep(A.DEFAULT);p.activeFloor=-1;assert.throws(()=>A.validateProject(p));
 const duplicate=A.deep(A.DEFAULT);duplicate.floors[0].items[0].id=duplicate.floors[0].rooms[0].id;assert.throws(()=>A.validateProject(duplicate));
 for(const basis of [{soilClass:'invalid'},{bearingKpa:-1},{columnStiffness:2},{soilVerified:'no'}]){const bad=A.deep(A.DEFAULT);bad.structuralBasis=basis;assert.throws(()=>A.validateProject(bad));}
 const badLoad=A.deep(A.DEFAULT);badLoad.floors[0].loads=[{id:'bad-load',case:'dead',value:-10,x:0,y:0}];assert.throws(()=>A.validateProject(badLoad));
 assert.equal(JSON.stringify(A.state.project),original);
});
load('js/architecture.js');load('js/structural-analysis.js');
load('js/stair-connections.js');
test('Derived stair openings subtract complete, partial and rotated cutouts without covering the route',()=>{
 const poly=[{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}],area=parts=>parts.reduce((s,p)=>s+A.polygonArea(p),0);
 assert.equal(area(A.subtractStairOpening(poly,[{x:50,y:50},{x:150,y:50},{x:150,y:150},{x:50,y:150}])),30000);assert.equal(area(A.subtractStairOpening(poly,poly)),0);
 assert.ok(Math.abs(area(A.subtractStairOpening(poly,[{x:100,y:-50},{x:250,y:100},{x:100,y:250},{x:-50,y:100}]))-5000)<1e-7);
 const spec=A.CATALOG.find(o=>o.type==='three-side-stairs'),o={...spec,id:'stair',x:0,y:0,rotation:90,stairUpperFloorId:'upper'},source={id:'lower',elevation:0,items:[o]},upper={id:'upper',elevation:304.8,items:[]},connection=A.stairConnections(upper,{floors:[source,upper]})[0];assert.equal(connection.opening.length,4);assert.equal(connection.platform.length,4);assert.equal(connection.mismatch,false);assert.ok(Math.abs(A.polygonArea(connection.platform)-connection.layout.bridgeWidth*91.44)<1e-7);const next={...o};const a=A.worldStairPoint(o,connection.layout.end),b=A.worldStairPoint(next,A.threeSideStairLayout(next).start);assert.ok(A.pointInPolygon(a,connection.platform)&&A.pointInPolygon(b,connection.platform));assert.ok(o.height-8.5>=220,'Stacked parallel flight headroom below reference');
});
test('Right-angle alignment preserves connected corners, locks and clone purity',()=>{
 const floor={walls:[{id:'a',x1:0,y1:0,x2:400,y2:12},{id:'b',x1:400,y1:12,x2:410,y2:300},{id:'c',x1:410,y1:300,x2:8,y2:310},{id:'d',x1:8,y1:310,x2:0,y2:0}]},before=JSON.stringify(floor),next=A.squareWallFloor(floor);
 assert.equal(JSON.stringify(floor),before);for(let i=0;i<4;i++){const w=next.walls[i],n=next.walls[(i+1)%4];assert.ok(w.x1===w.x2||w.y1===w.y2);assert.equal(w.x2,n.x1);assert.equal(w.y2,n.y1);}assert.equal(next.walls[0].y1,6);
 floor.walls[0].locked=true;assert.deepEqual(JSON.parse(JSON.stringify(A.squareWallFloor(floor).walls[0])),floor.walls[0]);
 assert.throws(()=>A.squareWallFloor({walls:[{id:'tiny',x1:0,y1:0,x2:.5,y2:0}]}),/collapse/);
 assert.throws(()=>A.squareWallFloor({walls:[{id:'a',x1:0,y1:0,x2:500,y2:0},{id:'bad',x1:500,y1:0,x2:500,y2:400},{id:'c',x1:500,y1:400,x2:0,y2:0}]}),error=>error.wallIds.includes('bad')&&/collapse/.test(error.message));
 const blocked={walls:[{id:'pin1',locked:true,x1:0,y1:0,x2:-100,y2:0},{id:'join',x1:0,y1:0,x2:400,y2:10},{id:'pin2',locked:true,x1:400,y1:10,x2:400,y2:100}]};assert.throws(()=>A.squareWallFloor(blocked),/Locked/);
 const tee=A.squareWallFloor({walls:[{id:'host',x1:0,y1:0,x2:400,y2:12},{id:'tee',x1:200,y1:6,x2:210,y2:200}]});assert.equal(tee.walls[1].y1,tee.walls[0].y1);assert.equal(tee.walls[1].x1,tee.walls[1].x2);
});
test('Plot-axis wall guide uses plan axes independently of compass and grid',()=>{
 const old=A.snap;A.snap=n=>n;A.state.wallPlotGuide=true;
 try{assert.equal(JSON.stringify(A.wallGuidePoint({x:10,y:20},{x:200,y:100})),JSON.stringify({x:200,y:20}));assert.equal(JSON.stringify(A.wallGuidePoint({x:10,y:20},{x:-20,y:-200})),JSON.stringify({x:10,y:-200}));assert.equal(A.wallGuidePoint({x:10,y:20},{x:200,y:100},true).y,100);A.state.wallPlotGuide=false;assert.equal(A.wallGuidePoint({x:10,y:20},{x:200,y:100}).y,100);}finally{A.snap=old;A.state.wallPlotGuide=false;}
});
function floorFixture(){return {id:'floor-test',name:'Test',elevation:0,rooms:[],items:[],dimensions:[],columns:[],beams:[],walls:[
 {id:'a',type:'wall',x1:0,y1:0,x2:400,y2:0,thickness:10,height:280},
 {id:'b',type:'wall',x1:400,y1:0,x2:400,y2:300,thickness:10,height:280},
 {id:'c',type:'wall',x1:400,y1:300,x2:0,y2:300,thickness:10,height:280},
 {id:'d',type:'wall',x1:0,y1:300,x2:0,y2:0,thickness:10,height:280}]};}
test('Wall faces trace real closed rooms and partition intersections',()=>{
 const f=floorFixture();assert.equal(A.wallFaces(f).length,1);assert.equal(A.polygonArea(A.wallFaces(f)[0].points),120000);
 f.walls.push({id:'partition',x1:200,y1:0,x2:200,y2:300});assert.equal(A.wallFaces(f).length,2);
 assert.equal(A.wallFaces(f).reduce((sum,face)=>sum+A.polygonArea(face.points),0),120000);
 f.walls.pop();f.walls.pop();assert.equal(A.wallFaces(f).length,0);
});
test('Hosted openings, joined corners, and attached dimensions follow edits',()=>{
 const f=floorFixture(),o={id:'door',type:'door',shape:'door',x:150,y:-5,w:90,d:10,rotation:0};f.items.push(o);A.hostOpening(o,f);
 const d={id:'dim',type:'dimension',x1:0,y1:-20,x2:400,y2:-20};f.dimensions.push(d);A.attachDimension(d,f);A.syncArchitecture(f);
 assert.equal(o.hostWallId,'a');f.walls[0].y1=50;f.walls[0].y2=50;A.syncArchitecture(f);
 assert.equal(f.walls[1].y1,50);assert.equal(f.walls[3].y2,50);assert.equal(o.y+o.d/2,50);assert.equal(d.y1,30);
 f.walls=f.walls.filter(w=>w.id!=='a');A.syncArchitecture(f);assert.equal(o.hostWallId,undefined);
});
test('Structural overload remains visible and fails the modeled check',()=>{
 const f=floorFixture();f.columns=[{id:'column',x:0,y:0,w:10,d:10,height:300,material:'RCC M20',steelGrade:'Fe415',rebarSpec:'4-T8'}];
 f.loads=[{id:'overload',case:'dead',value:1000,columnId:'column',x:0,y:0}];
 const p={floors:[f],activeFloor:0};const report=A.analyzeStructure(f,p);
 assert.ok(report.columnDetails[0].utilization>100);assert.equal(report.columnDetails[0].status,'fail');assert.equal(report.summary.status,'fail');
 assert.equal(A.analyzeStructure(f,p),report);f.items.push({id:'furniture',x:20,y:30,w:50,d:50});assert.equal(A.analyzeStructure(f,p),report);f.columns[0].w=40;assert.notEqual(A.analyzeStructure(f,p),report);
});
test('Solar coordinates preserve equator, Greenwich and UTC zero values',()=>{
 const solar=A.calculateSolarPosition({location:{latitude:0,longitude:0,timezone:0},time:12,week:12});assert.ok(solar.solarAltitude>85);
});
for(const file of [...fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f),'renderer3d.js','server.cjs'])new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
console.log(`${passed} regression groups passed; all application scripts parsed.`);
