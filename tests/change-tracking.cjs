const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const handlers={},timers=new Map();let timerId=0,writes=0;
const status={textContent:'Saved locally',style:{setProperty(){}},classList:{add(){},remove(){}}};
const A={storagePrefix:'test:',deep:o=>JSON.parse(JSON.stringify(o)),normalizeProject:o=>o,
  DEFAULT:{name:'Test',projectId:'test',snap:true,floors:[{items:[{id:'chair',type:'chair',x:0,y:0,w:20,d:20}],rooms:[],walls:[],dimensions:[] }],activeFloor:0},
  $:()=>status,draw(){},renderInspector(){},select(id){this.state.selected=id;this.state.selectedIds=new Set(id?[id]:[]);},
  wallHandleHit:()=>null,beamHandleHit:()=>null,itemHandleHit:()=>null,selectionRotateHandleHit:()=>false,
  hitTest(){return this.floor().items[0];},snap:n=>Math.round(n/10)*10,applySmartGuides(){},hostOpening(){},formatLength:String};
const context={window:{Atelier:A},addEventListener(){},localStorage:{getItem:()=>null,setItem(){writes++;}},
  setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},console};
vm.createContext(context);
function load(file,transform=s=>s){vm.runInContext(transform(fs.readFileSync(path.join(root,file),'utf8')),context,{filename:file});}
load('js/app-state.js');load('js/persistence.js');
// Load the production movement constraints while retaining this fixture's UI stubs.
const pointerStubs=Object.fromEntries(['select','hitTest','itemHandleHit','selectionRotateHandleHit','applySmartGuides'].map(key=>[key,A[key]]));
load('js/pointer-interaction.js');Object.assign(A,pointerStubs);
// Expose the private event binder only within this test context.
load('js/ui-wiring.js',s=>s.replace('resizeCanvas, syncUnitPresentation,','bindCanvasPointerEvents, resizeCanvas, syncUnitPresentation,'));
const canvas={addEventListener(name,fn){handlers[name]=fn;},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0}),style:{}};
A.state.canvas=canvas;A.state.scale=1;A.state.offset={x:0,y:0};A.bindCanvasPointerEvents(canvas);
function pointer(name,x=0,y=0){handlers[name]({pointerId:1,clientX:x,clientY:y,button:0});}
function flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}
const redo=JSON.stringify({...A.state.project,name:'Redo'});A.state.future.push(redo);
pointer('pointerdown');assert.equal(A.state.pointerBackup.project,null);assert.equal(A.state.pointerBackup.history,undefined);pointer('pointerup');
assert.equal(A.state.selected,'chair');assert.equal(A.state.history.length,0);assert.equal(A.state.future[0],redo);assert.equal(timers.size,0);
pointer('pointerdown');pointer('pointermove',2);pointer('pointerup',2);
assert.equal(A.state.history.length,0);assert.equal(A.state.future[0],redo);assert.equal(timers.size,0);
pointer('pointerdown');pointer('pointermove',20);pointer('pointermove',0);pointer('pointerup');
assert.equal(A.state.history.length,0);assert.equal(A.state.future[0],redo);assert.equal(timers.size,0);
const before=JSON.stringify(A.state.project);
pointer('pointerdown');pointer('pointermove',20);pointer('pointermove',30);pointer('pointerup',30);
assert.equal(A.state.history.length,1);assert.equal(A.state.history[0],before);assert.equal(A.state.future.length,0);assert.equal(A.floor().items[0].x,30);assert.equal(timers.size,1);
flush();assert.equal(writes,1);flush();
A.queueSave();flush();assert.equal(writes,1);
A.state.project.name='Changed';A.queueSave();A.state.project.name='Test';A.queueSave();flush();assert.equal(writes,1);
A.state.future.push(redo);
const historyBefore=JSON.stringify(A.state.history);
A.state.editSession={checkpointed:false};A.checkpoint();A.state.editSession.checkpointed=true;A.queueSave();
assert.equal(JSON.stringify(A.state.history),historyBefore);assert.equal(A.state.future[0],redo);assert.equal(A.state.editSession.checkpointed,false);
A.checkpoint();A.state.editSession.checkpointed=true;A.state.project.name='Renamed';A.queueSave();
assert.equal(A.state.history.length,2);assert.equal(A.state.future.length,0);flush();flush();assert.equal(writes,2);
A.flushSave();assert.equal(writes,2);
load('js/editing-support.js');A.syncUI=()=>{};
const cancelBefore=JSON.stringify(A.state.project),cancelHistory=JSON.stringify(A.state.history);
A.state.future.push(redo);
pointer('pointerdown',30);pointer('pointermove',60);A.cancelInteraction();
assert.equal(JSON.stringify(A.state.project),cancelBefore);assert.equal(JSON.stringify(A.state.history),cancelHistory);assert.equal(A.state.future[0],redo);
console.log('PASS selection, snapped no-op, returned drag, real drag, redo preservation, unchanged field edits, autosave, close flush, and cancellation');
