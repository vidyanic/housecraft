const {chromium}=require('C:/Users/ranje/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  await page.goto('http://127.0.0.1:4173/tests/ui-preview.html');await page.waitForTimeout(700);
  const app=page.frames().find(f=>f.url().includes('index.html'));
  await app.evaluate(()=>{
   const A=window.Atelier,p=A.deep(A.DEFAULT);p.name='Structural layout verification';p.layoutValidated=true;p.activeFloor=0;
   p.floors=[{id:'drag-demo',name:'Ground floor',elevation:0,items:[],rooms:[],dimensions:[],walls:[{id:'ref',type:'wall',x1:0,y1:0,x2:600,y2:0,thickness:15,height:300},{id:'angle',type:'wall',x1:80,y1:100,x2:480,y2:300,thickness:15,height:300}],columns:[{id:'c1',type:'column',x:85,y:85,w:30,d:30,height:300,tag:'C1',material:'M25'},{id:'c2',type:'column',x:485,y:85,w:30,d:30,height:300,tag:'C2',material:'M25'}],beams:[{id:'b1',type:'beam',x1:100,y1:100,x2:500,y2:100,startColumnId:'c1',endColumnId:'c2',width:25,depth:35,tag:'B1',material:'M25'}]}];
   A.state.project=A.normalizeProject(p);A.state.history=[];A.state.future=[];A.state.selected=null;A.state.selectedIds.clear();A.setWorkspace('structure');A.state.structSnap=false;A.state.structGuide='free';A.syncUI();A.fitPlan();
  });
  await page.locator('iframe').scrollIntoViewIfNeeded();
  const source=await app.locator('#toolrail [data-tool=column]').boundingBox(),target=await app.locator('#planCanvas').boundingBox();
  const expected=await app.evaluate(({x,y})=>{const A=window.Atelier;return {point:A.screenToWorld({x,y}),count:A.floor().columns.length,history:A.state.history.length};},{x:target.width*.55,y:target.height*.65});
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width*.55,target.y+target.height*.65,{steps:18});await page.waitForTimeout(120);await page.mouse.up();
  const actual=await app.evaluate(()=>{const A=window.Atelier;return {point:A.structuralCenter(A.floor().columns.at(-1)),count:A.floor().columns.length,history:A.state.history.length,scale:A.state.scale};});
  assert.equal(actual.count,expected.count+1,'Real toolbar drag did not place a column');assert.equal(actual.history,expected.history+1);assert.ok(Math.hypot(actual.point.x-expected.point.x,actual.point.y-expected.point.y)<3/actual.scale,'Real drag drop coordinate mismatch');
  console.log('PASS Native mouse toolbar drag and drop position / one undo');
  await app.evaluate(()=>{const A=window.Atelier;A.state.structGuide='perpendicular';A.state.structSnap=false;const beam=A.addStructuralObject('beam',{x:150,y:50});if(Math.hypot(beam.x2-beam.x1,beam.y2-beam.y1)<15)throw Error('Perpendicular toolbar beam collapsed');A.undo();A.state.structGuide='auto';A.select('c1');A.alignColumnToWall();A.select(null);});
  console.log('PASS Perpendicular toolbar beam retains a nonzero span');
  for(const [name,width] of [['desktop',1440],['tablet',820],['mobile',390]]){
   await page.evaluate(width=>{const frame=document.querySelector('iframe');frame.style.width=width+'px';frame.style.height=(width===390?844:900)+'px';},width);
   await app.evaluate(()=>{const A=window.Atelier;A.state.structSnap=true;A.state.structGuide='auto';A.select(null);A.fitPlan();document.querySelector('#structLayoutGuides').click();});await page.waitForTimeout(250);
   assert.ok(await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Responsive overflow at '+width);
   await page.locator('iframe').screenshot({path:'validation/structure-layout-'+name+'.png'});
   if(width===1440){await app.locator('#expandCanvas').click();await page.waitForTimeout(180);assert.equal(await app.evaluate(()=>document.querySelector('#space-tools').inert),false);await page.locator('iframe').screenshot({path:'validation/structure-layout-expanded.png'});await app.locator('#expandCanvas').click();}
  }
  console.log('PASS Responsive layouts / guide access / Expand rail at 1440, 820, 390 px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
