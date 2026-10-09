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
for(const f of ['js/constants.js','js/furniture-catalog.js','default-layout.js','js/project-model.js','js/project-validation.js','js/app-state.js'])load(f);
load('js/services.js');
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
test('Reject malformed projects before replacement',()=>{
 const original=JSON.stringify(A.state.project);
 for(const p of [{floors:[]},{floors:[{items:'bad'}]},{floors:[{items:[{x:0,y:0,w:-1,d:2}]}]}])assert.throws(()=>A.validateProject(p));
 const p=A.deep(A.DEFAULT);p.activeFloor=-1;assert.throws(()=>A.validateProject(p));
 const duplicate=A.deep(A.DEFAULT);duplicate.floors[0].items[0].id=duplicate.floors[0].rooms[0].id;assert.throws(()=>A.validateProject(duplicate));
 assert.equal(JSON.stringify(A.state.project),original);
});
load('js/architecture.js');load('js/structural-analysis.js');
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
 const p={floors:[f],activeFloor:0};const report=A.analyzeStructure(f,p);
 assert.ok(report.columnDetails[0].utilization>100);assert.equal(report.columnDetails[0].status,'fail');assert.equal(report.summary.status,'fail');
 assert.equal(A.analyzeStructure(f,p),report);f.items.push({id:'furniture',x:20,y:30,w:50,d:50});assert.equal(A.analyzeStructure(f,p),report);f.columns[0].w=40;assert.notEqual(A.analyzeStructure(f,p),report);
});
test('Solar coordinates preserve equator, Greenwich and UTC zero values',()=>{
 const solar=A.calculateSolarPosition({location:{latitude:0,longitude:0,timezone:0},time:12,week:12});assert.ok(solar.solarAltitude>85);
});
for(const file of [...fs.readdirSync('js').filter(f=>f.endsWith('.js')).map(f=>'js/'+f),'renderer3d.js','server.cjs'])new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
console.log(`${passed} regression groups passed; all application scripts parsed.`);
