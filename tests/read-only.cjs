const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ranje/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
 const page=await browser.newPage({hasTouch:true});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4173/tests/browser.html');
 await page.click('#run');
 await page.waitForFunction(()=>!document.querySelector('#run').disabled,{},{timeout:60000});
 assert.deepEqual(await page.locator('.fail').allTextContents(),[]);
 console.log(await page.locator('#summary').innerText());
 for(const tab of ['architecture','structure','services','3d','unknown']){
  await page.goto('http://127.0.0.1:4173/?test=1&tab='+tab);
  await page.waitForFunction(()=>document.querySelector('#expandCanvas'));
  assert.equal(await page.evaluate(()=>Atelier.state.viewMode),tab==='3d'?'3d':'plan');
  if(tab!=='3d')assert.equal(await page.evaluate(()=>Atelier.state.workspace||'architecture'),tab==='unknown'?'architecture':tab);
  else assert.equal(await page.evaluate(()=>Atelier.state.project.camera.allFloors),true);
  if(tab==='3d')assert.equal(await page.evaluate(()=>Atelier.state.project.camera.wallMode),'full');
  assert.equal(await page.locator('#projectName').isDisabled(),false);
  assert.equal(await page.locator('.topbar').evaluate(el=>el.inert),false);
 }
 console.log('PASS editable URL workspace selection and unknown-tab fallback');
 // Serve a real exported project from the app fixture via an intercepted same-origin request.
 await page.goto('http://127.0.0.1:4173/?test=1');
 const fixture=await page.evaluate(()=>window.Atelier.state.project);
 fixture.name='Shared viewer fixture';
 fixture.floors.push({id:'viewer-upper',name:'Viewer upper floor',elevation:300,rooms:[{id:'viewer-upper-room',type:'room',name:'Upper room',x:0,y:0,w:500,d:400,ceilingHeight:280,color:'#eee7d9',floorMaterial:'Wood'}],walls:[],items:[{...fixture.floors[0].items[0],id:'viewer-upper-bed'}],dimensions:[],columns:[],beams:[]});
 await page.route('**/layouts/shared.json',route=>route.fulfill({json:fixture}));
 await page.evaluate(()=>localStorage.setItem('atelier-plan-test-project',JSON.stringify({sentinel:true})));
 await page.goto('http://127.0.0.1:4173/?test=1&readonly=1');
 await page.waitForFunction(()=>document.querySelector('#readOnlyStatus'));
 assert.equal(await page.evaluate(()=>Atelier.state.project.name),await page.evaluate(()=>ATELIER_REFERENCE_LAYOUT.name));
 await checkCustomControls(page);
 console.log('PASS bare readonly URL and custom controls');
 for(const width of [1440,820,390]){
 await page.setViewportSize({width,height:900});
 await page.goto('http://127.0.0.1:4173/?test=1&readonly=1&tab=3d&layout=layouts/shared.json');
 await page.waitForFunction(()=>document.querySelector('#saveState')?.textContent.includes('Read-only'));
 assert.equal(await page.evaluate(()=>Atelier.state.project.name),'Shared viewer fixture');
 assert.equal(await page.locator('#projectName').isDisabled(),true);
 assert.equal(await page.evaluate(()=>Atelier.state.viewMode),'3d');
 assert.equal(await page.evaluate(()=>Atelier.state.project.camera.allFloors),true);
 assert.equal(await page.evaluate(()=>Atelier.state.project.camera.wallMode),'full');
 await checkToolbar(page,width);
 assert.equal(await page.locator('.topbar').evaluate(el=>el.inert),true);
 assert.equal(await page.locator('#catalogPanel').evaluate(el=>el.inert),true);
 assert.equal(await page.locator('#inspectorPanel').evaluate(el=>el.inert),true);
 assert.equal(await page.locator('#studioAddFloor').isVisible(),false);
 assert.equal((await page.locator('#threeTransformHint').innerText()).includes('move'),false);
 await page.screenshot({path:'validation/url-viewer-3d-'+width+'.png'});
 await page.evaluate(()=>Atelier.setWorkspace('architecture'));
 await page.locator('#studioFloor').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>Atelier.floor().id),'viewer-upper');
 await page.locator('#studioFloor').selectOption('0');
 await checkCustomControls(page);
 const before=await page.evaluate(()=>JSON.stringify(Atelier.floor()));
 await page.keyboard.press('w');await page.keyboard.press('Delete');await page.keyboard.press('Control+z');
 const canvas=page.locator('#planCanvas');const box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2+30);await page.mouse.up();
 assert.equal(await page.evaluate(()=>JSON.stringify(Atelier.floor())),before);
 assert.equal(await page.evaluate(()=>Atelier.state.history.length),0);
 await page.locator('#expandCanvas').click();
 await checkToolbar(page,width);
 await page.locator('#expandCanvas').focus();await page.keyboard.press('Enter');
 await page.locator('#fitBtn').tap();
 await page.screenshot({path:'validation/read-only-plan-'+width+'.png'});
 await page.evaluate(()=>{Atelier.saveProject();Atelier.queueSave();Atelier.flushSave();});
 assert.equal(await page.evaluate(()=>localStorage.getItem('atelier-plan-test-project')),'{"sentinel":true}');
 for(const workspace of ['structure','services','3d']){
 await page.evaluate(ws=>ws==='3d'?Atelier.setView('3d'):Atelier.setWorkspace(ws),workspace);
 assert.equal(await page.evaluate(()=>Atelier.state.tool),'pan');
 assert.equal(await page.evaluate(()=>Atelier.canTransform(Atelier.floor().items[0])),false);
 await checkCustomControls(page);
 }
 await page.evaluate(()=>Atelier.select(Atelier.floor().items[0].id));
 await page.waitForFunction(()=>document.querySelector('#aspectToggle')?.getAttribute('aria-disabled')==='true');
 assert.equal(await page.locator('#inspectorPanel').evaluate(el=>el.inert),true);
 await checkCustomControls(page);
 await page.evaluate(()=>Atelier.select(null));
 await page.screenshot({path:'validation/read-only-'+width+'.png'});
 console.log('PASS read-only viewer '+width);
 }
 await page.goto('http://127.0.0.1:4173/?readonly=1&layout=missing.json');
 await page.waitForFunction(()=>document.body.textContent.includes('Shared layout could not be opened'));
 console.log('PASS unavailable layout fails closed');
 assert.deepEqual(errors,[]);
 await page.goto('http://127.0.0.1:4173/tests/ui-preview.html');
 for(const width of [1440,820,390]){
 await page.setViewportSize({width:1600,height:1000});
 await page.evaluate(width=>{const frame=document.querySelector('iframe');frame.style.width=width+'px';frame.style.height='900px';},width);
 await page.locator('iframe').screenshot({path:'validation/publishing-ui-preview-'+width+'.png'});
 const frame=page.frames().find(frame=>frame.url().includes('index.html'));
 for(const workspace of ['architecture','structure','services','3d']){
  await frame.evaluate(workspace=>workspace==='3d'?Atelier.setView('3d'):Atelier.setWorkspace(workspace),workspace);
  await checkToolbar(frame,width);
  if(width===390){
   await frame.evaluate(()=>Atelier.canvasSpace.revealCanvas());
   await page.locator('iframe').screenshot({path:'validation/mobile-toolbar-'+workspace+'.png'});
  }
 }
 }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

async function checkCustomControls(page){
 const snapshot=()=>page.evaluate(()=>{const {camera,activeFloor,...layout}=Atelier.state.project;return JSON.stringify(layout);});
 const before=await snapshot();
 for(const toggle of await page.locator('.switch').all()){
  assert.equal(await toggle.getAttribute('aria-disabled'),'true');
  assert.equal(await toggle.getAttribute('tabindex'),'-1');
  await toggle.dispatchEvent('click');
  if(await toggle.isVisible())await toggle.click({force:true});
  if(await toggle.evaluate(el=>{el.focus();return document.activeElement===el;})){await page.keyboard.press('Enter');await page.keyboard.press('Space');}
 }
 for(const card of await page.locator('[data-object]').all()){
  assert.equal(await card.getAttribute('aria-disabled'),'true');
  assert.equal(await card.getAttribute('draggable'),'false');
  await card.dispatchEvent('click');
 }
 const card=page.locator('[data-object]').first();
 if(await card.count()&&await card.evaluate(el=>{el.focus();return document.activeElement===el;})){await page.keyboard.press('Enter');await page.keyboard.press('Space');}
 // Newly rendered and re-enabled controls must still be protected.
 await page.evaluate(()=>{const toggle=document.querySelector('.switch');if(toggle)toggle.tabIndex=0;document.querySelector('#saveBtn').disabled=false;});
 await page.waitForFunction(()=>document.querySelector('#saveBtn').disabled);
 assert.equal(await snapshot(),before);
 assert.equal(await page.evaluate(()=>Atelier.state.history.length),0);
}

async function checkToolbar(surface,width){
 const bounds=await surface.evaluate(()=>{
  const tool=document.querySelector('.studio-taskbar').getBoundingClientRect(),canvas=document.querySelector('#stage').getBoundingClientRect(),workspace=document.querySelector('#workspace').getBoundingClientRect();
  return {tool:{x:tool.x,y:tool.y,w:tool.width,h:tool.height,bottom:tool.bottom},canvas:{x:canvas.x,bottom:canvas.bottom},workspace:{bottom:workspace.bottom},overflow:document.documentElement.scrollWidth>innerWidth};
 });
 if(width<700){
  assert.equal(bounds.tool.x,0);assert.ok(bounds.tool.w>=width-2,'Mobile toolbar is not full width');
  assert.ok(Math.abs(bounds.tool.bottom-bounds.workspace.bottom)<2,'Toolbar is not at bottom');
  assert.ok(bounds.canvas.bottom<=bounds.tool.y+1,'Canvas overlaps bottom toolbar');
 }else assert.ok(bounds.tool.w<=65&&bounds.tool.h>200,'Desktop/tablet rail moved');
 assert.equal(bounds.overflow,false,'Viewport overflows horizontally');
}
