// Read-only model probes and CPU microbenchmarks; no browser or saved-project access.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..');
const el=()=>({style:{},appendChild(){},classList:{add(){},remove(){}}});
const ctx={window:{},console,document:{createElement:el,body:el(),querySelector(){return null;}},addEventListener(){},localStorage:{getItem(){return null;}}};
vm.createContext(ctx);
function load(file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});ctx.Atelier=ctx.window.Atelier;}
for(const file of ['utilities','constants','furniture-catalog','structural-model','project-model','project-validation','app-state','architecture','canvas-drawing','pointer-interaction','object-operations','services'])load('js/'+file+'.js');
const A=ctx.window.Atelier;
vm.runInContext('Atelier.cornerBoundsReference=o=>{const pts=Atelier.rotatedRect(o),xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};};',ctx);
A.renderInspector=A.draw=A.queueSave=A.showToast=A.showHint=A.updateCounts=()=>{};
function fixture(items=[]){A.state.project={unit:'cm',snap:false,activeFloor:0,floors:[{items,rooms:[],walls:[],dimensions:[],columns:[],beams:[],slabs:[],loads:[],structuralWalls:[],grids:[]}]};A.state.history=[];A.state.future=[];A.state.selectedIds=new Set();}
const findings={};
let o={id:'item',type:'table',x:0,y:0,w:100,d:50,height:80,rotation:0};fixture([o]);
A.resizeItemFromCorner({id:o.id,original:A.deep(o),corner:2,keepRatio:true},{x:150,y:50});
findings.aspectResize={expectedFixedCorner:{x:0,y:0},actualFixedCorner:{x:o.x,y:o.y},size:{w:o.w,d:o.d}};
o={id:'item',type:'table',x:0,y:0,w:100,d:50,height:80,rotation:0};fixture([o]);A.state.project.snap=true;
A.resizeItemFromCorner({id:o.id,original:A.deep(o),corner:2,keepRatio:false},{x:100.4,y:50.4});
findings.snappedResize={expectedFixedCorner:{x:0,y:0},actualFixedCorner:{x:o.x,y:o.y},size:{w:o.w,d:o.d}};
o={id:'small',type:'socket-point',x:0,y:0,w:10,d:5,height:10,rotation:0};fixture([o]);
A.resizeItemFromCorner({id:o.id,original:A.deep(o),corner:2},{x:11,y:6});findings.smallFixtureResize={w:o.w,d:o.d};
o={id:'item',type:'table',x:0,y:0,w:100,d:50,height:80,rotation:0};fixture([o]);A.state.selected=o.id;
A.scaleSelected(NaN);findings.invalidScale={finite:Number.isFinite(o.w),serializedWidth:JSON.parse(JSON.stringify(o)).w};
fixture([{id:'a',type:'chair',x:0,y:0,w:10,d:10},{id:'b',type:'chair',x:20,y:0,w:10,d:10}]);
A.select('a');A.toggleSelection('b');A.toggleSelection('b');findings.groupDeselect={primary:A.state.selected,selectedIds:[...A.state.selectedIds]};
fixture();A.floor().grids.push({id:'axis',type:'grid',axis:'x',position:100});findings.gridLookup={entityFound:!!A.findEntity('axis'),inAllEntities:A.allEntities().some(o=>o.id==='axis')};
o={id:'item',type:'chair',x:0,y:0,w:40,d:40,height:80,rotation:0};fixture([o]);A.state.selected=o.id;A.createCopies([o]);
findings.copyWithoutName={hasOwnName:Object.hasOwn(A.floor().items[1],'name')};
const route={id:'route',type:'cold-water-pipe',shape:'service-route',system:'cold-water',x:0,y:0,w:100,d:10,height:2.5,elevation:0,rotation:0,routePoints:[{x:0,y:0,z:0},{x:1,y:0,z:100}]};fixture([route]);A.state.selected=route.id;
const lengthBefore=A.serviceLength(route);A.scaleSelected(200);findings.routeScale={beforeLength:lengthBefore,afterLength:A.serviceLength(route),expectedUniformLength:lengthBefore*2,verticalDelta:A.serviceWorldPoints(route)[1].z};
function bench(fn,iterations=25){for(let i=0;i<5;i++)fn();const times=[];for(let i=0;i<iterations;i++){const start=performance.now();fn();times.push(performance.now()-start);}times.sort((a,b)=>a-b);return{medianMs:+times[Math.floor(times.length/2)].toFixed(3),p95Ms:+times[Math.floor(times.length*.95)].toFixed(3)};}
const timings=[];
for(const n of [100,500,1000]){
 const items=Array.from({length:n},(_,i)=>({id:'item-'+i,type:'chair',x:(i%50)*100,y:Math.floor(i/50)*100,w:50,d:50,height:80,rotation:0}));fixture(items);A.state.project.snap=true;
 A.floor().walls=Array.from({length:n},(_,i)=>({id:'wall-'+i,type:'wall',x1:i*100,y1:0,x2:i*100,y2:1000,thickness:10}));
 const rotated=items.map((o,i)=>({...o,rotation:i%24*15}));
 timings.push({entitiesPerCollection:n,jsonBytes:JSON.stringify(A.state.project).length,
  stringify:bench(()=>JSON.stringify(A.state.project)),
  armAndClick:bench(()=>{A.armEdit();A.commitEdit();}),
  analyticBounds:bench(()=>rotated.forEach(o=>A.itemAabb(o,0))),
  cornerBoundsReference:bench(()=>rotated.forEach(A.cornerBoundsReference)),
  groupLookup:bench(()=>items.forEach(o=>A.findEntity(o.id))),
  smartGuides:bench(()=>A.applySmartGuides([items[0]])),
  wallFaces:bench(()=>A.wallFaces(A.floor()),10)});
}
const result={environment:{node:process.version,platform:process.platform},scope:'Node CPU microbenchmarks; excludes canvas, DOM, GPU and browser scheduling. Synthetic fixtures, not FPS measurements.',findings,timings};
const json=JSON.stringify(result,null,2),outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0){fs.writeFileSync(path.resolve(root,process.argv[outputIndex+1]),json);console.log('Saved CPU probes to '+process.argv[outputIndex+1]);}else console.log(json);
