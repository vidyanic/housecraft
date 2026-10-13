const {chromium}=require('C:/Users/ranje/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/ui-preview.html');await page.waitForTimeout(600);
  const app=page.frames().find(f=>f.url().includes('index.html'));
  await app.evaluate(()=>{
   const A=window.Atelier,p=A.deep(A.DEFAULT);p.name='Copy connection diagnostics';p.layoutValidated=true;p.activeFloor=0;
   p.floors=[{id:'reference-floor',name:'Ground floor',elevation:0,rooms:[],items:[],dimensions:[],walls:[{id:'ref-wall',type:'wall',x1:0,y1:0,x2:550,y2:0,thickness:15,height:300},{id:'ref-side',type:'wall',x1:550,y1:0,x2:550,y2:350,thickness:15,height:300}],columns:[{id:'column-c1',type:'column',tag:'C1',name:'Column C1',x:85,y:85,w:30,d:30,height:300,material:'M25'}],beams:[{id:'beam-b4',type:'beam',tag:'B4',name:'Beam B4',x1:100,y1:100,x2:450,y2:180,width:25,depth:35,startColumnId:'column-c1',endColumnId:'',material:'M25'}],loads:[{id:'point-p2',type:'load',name:'Point load P2',x:350,y:260,value:10,case:'dead',columnId:''}],slabs:[],structuralWalls:[],grids:[]}];
   A.state.project=A.normalizeProject(p);A.floor().beams[0].endColumnId='missing-column-C7';A.floor().loads[0].columnId='missing-column-C8';A.state.history=[];A.state.future=[];A.state.selected=null;A.state.selectedIds.clear();A.setWorkspace('structure');A.syncUI();A.fitPlan();
  });
  for(const [name,width,height] of [['desktop',1440,900],['tablet',820,900],['mobile',390,844]]){
   await page.evaluate(({width,height})=>{const frame=document.querySelector('iframe');frame.style.width=width+'px';frame.style.height=height+'px';},{width,height});
   await app.evaluate(()=>{Atelier.select(null);Atelier.fitPlan();});const before=await app.evaluate(()=>JSON.stringify(Atelier.state.project));
   await app.locator('#copyCompleteStructure').click();await page.waitForTimeout(name==='desktop'?1900:150);
   assert.equal(await app.locator('.structure-copy-issue').count(),2);assert.equal(await app.locator('#applyStructureCopy').isDisabled(),true);
   assert.ok(await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Dialog overflow at '+width);
   await page.locator('iframe').screenshot({path:'validation/structure-copy-issues-'+name+'.png'});
   await app.locator('[data-show-copy-issue="0"]').click();await page.waitForTimeout(120);
   assert.equal(await app.evaluate(()=>Atelier.state.selected),'beam-b4');assert.equal(await app.evaluate(()=>Atelier.state.structuralIssueFocus.field),'endColumnId');assert.equal(await app.evaluate(()=>Atelier.state.history.length),0);
   assert.equal(await app.evaluate(()=>JSON.stringify(Atelier.state.project)),before);assert.ok(await app.evaluate(()=>{const q=Atelier.worldToScreen({x:450,y:180});return q.x>0&&q.x<Atelier.state.canvas.clientWidth&&q.y>0&&q.y<Atelier.state.canvas.clientHeight;}),'Bad endpoint outside canvas');
   await page.locator('iframe').screenshot({path:'validation/structure-copy-highlight-'+name+'.png'});
   await app.locator('#copyCompleteStructure').click();await app.locator('[data-edit-copy-issue="0"]').click();await page.waitForTimeout(120);
   assert.equal(await app.evaluate(()=>document.activeElement.dataset.structKey),'endColumnId');assert.equal(await app.locator('[data-struct-key=endColumnId]').inputValue(),'missing-column-C7');
   assert.equal(await app.locator('[data-struct-key=endColumnId]').getAttribute('aria-invalid'),'true');await page.locator('iframe').screenshot({path:'validation/structure-copy-repair-'+name+'.png'});
  }
  await app.locator('[data-struct-key=endColumnId]').selectOption('');await app.locator('#saveStructEntity').click();assert.equal(await app.evaluate(()=>Atelier.state.history.length),1);
  await app.evaluate(()=>{const issue=Atelier.structuralReferenceIssues()[0];Atelier.focusStructuralIssue(issue,{edit:true});});await app.locator('[data-struct-key=columnId]').selectOption('');await app.locator('#saveStructEntity').click();assert.equal(await app.evaluate(()=>Atelier.structuralReferenceIssues().length),0);
  await app.locator('#copyCompleteStructure').click();assert.equal(await app.locator('#applyStructureCopy').isDisabled(),false);await app.locator('#applyStructureCopy').click();assert.equal(await app.evaluate(()=>Atelier.state.project.floors.length),2);
  assert.deepEqual(errors,[]);console.log('PASS detailed copy issue list, beam endpoint highlight, focused repair fields, explicit repair/copy and no navigation history at 1440/820/390 px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
