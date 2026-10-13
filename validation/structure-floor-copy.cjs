const {chromium}=require('C:/Users/ranje/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/tests/ui-preview.html');await page.waitForTimeout(600);
  const app=page.frames().find(f=>f.url().includes('index.html'));
  await app.evaluate(()=>{
   const A=window.Atelier,p=A.deep(A.DEFAULT),columns=[[0,0],[600,0],[600,400],[0,400]].map(([x,y],i)=>({id:'stack-c'+i,type:'column',tag:'C'+(i+1),name:'Column '+(i+1),x:x-15,y:y-15,w:30,d:30,height:300,material:'M25',steelGrade:'Fe500',rebarSpec:'8-T16'}));
   const beams=columns.map((c,i)=>{const next=columns[(i+1)%4],a=A.structuralCenter(c),b=A.structuralCenter(next);return{id:'stack-b'+i,type:'beam',tag:'B'+(i+1),name:'Beam '+(i+1),x1:a.x,y1:a.y,x2:b.x,y2:b.y,width:25,depth:35,ceilingHeight:300,startColumnId:c.id,endColumnId:next.id,material:'M25',steelGrade:'Fe500',rebarSpec:'Top: 2-T16, Bottom: 2-T16'};});
   p.name='Complete structural building';p.layoutValidated=true;p.activeFloor=0;p.site.width=p.builtUp.width=600;p.site.depth=p.builtUp.depth=400;p.floors=[{id:'stack-ground',name:'Ground floor',elevation:0,rooms:[],walls:[],items:[],dimensions:[],columns,beams,slabs:[{id:'stack-slab',type:'slab',name:'Floor slab',x:0,y:0,w:600,d:400,thickness:15,deadLoad:1,liveLoad:2}],loads:[],structuralWalls:[],grids:[],diaphragm:'rigid'}];
   A.state.project=A.normalizeProject(p);A.state.history=[];A.state.future=[];A.state.selected=null;A.state.selectedIds.clear();A.setWorkspace('structure');A.syncUI();A.fitPlan();
  });
  for(const [name,width,height] of [['desktop',1440,900],['tablet',820,900],['mobile',390,844]]){
   await page.evaluate(({width,height})=>{const frame=document.querySelector('iframe');frame.style.width=width+'px';frame.style.height=height+'px';},{width,height});
   await app.locator('#copyCompleteStructure').click();await app.locator('#structureCopyLevels').fill('2');await page.waitForTimeout(name==='desktop'?2200:160);
   assert.equal(await app.evaluate(()=>Atelier.state.history.length),0);
   assert.ok(await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Dialog overflow at '+width);
   const modal=await app.locator('#structureCopyModal .modal').boundingBox(),frame=await page.locator('iframe').boundingBox();assert.ok(modal.x>=frame.x&&modal.x+modal.width<=frame.x+width+1,'Modal clipped at '+width);
   await page.locator('iframe').screenshot({path:'validation/structure-copy-'+name+'.png'});
   await app.locator('#structureCopyLevels').focus();await page.keyboard.press('Escape');assert.equal(await app.locator('#structureCopyModal').evaluate(el=>el.classList.contains('show')),false);assert.equal(await app.evaluate(()=>document.activeElement.id),'copyCompleteStructure');
  }
  await page.evaluate(()=>{const frame=document.querySelector('iframe');frame.style.width='1440px';frame.style.height='900px';});
  await app.locator('#copyCompleteStructure').click();await app.locator('#structureCopyLevels').fill('2');await app.locator('#copyStructureAndView').click();await page.waitForTimeout(450);
  assert.equal(await app.evaluate(()=>Atelier.state.project.floors.length),3);assert.equal(await app.evaluate(()=>Atelier.state.history.length),1);assert.equal(await app.evaluate(()=>atelier3D.getStats().groups),27);
  await app.evaluate(()=>{Atelier.setCameraPreset('dollhouse');Atelier.fitPlan();});await page.waitForTimeout(2200);
  await page.locator('iframe').screenshot({path:'validation/structure-building-stack-desktop.png'});
  await app.locator('#expandCanvas').click();await page.waitForTimeout(150);await page.locator('iframe').screenshot({path:'validation/structure-building-stack-expanded.png'});await app.locator('#expandCanvas').click();
  for(const [name,width,height] of [['tablet',820,900],['mobile',390,844]]){await page.evaluate(({width,height})=>{const frame=document.querySelector('iframe');frame.style.width=width+'px';frame.style.height=height+'px';},{width,height});await app.evaluate(()=>{Atelier.canvasSpace.hidePanel('inspector',true);Atelier.fitPlan();});await page.waitForTimeout(200);await page.locator('iframe').screenshot({path:'validation/structure-building-stack-'+name+'.png'});}
  assert.deepEqual(errors,[]);console.log('PASS structure-copy dialog 1440/820/390 px, keyboard Escape/focus, one Undo, three elevated 3D structural floors, Expand');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
