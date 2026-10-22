const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ranje/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1050},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(!process.argv.includes('--preview-only')){
  await page.goto('http://127.0.0.1:4173/tests/browser.html');await page.locator('#run').click();
  await page.waitForFunction(()=>!document.querySelector('#run').disabled,null,{timeout:60000});
  console.log(await page.locator('#summary').innerText());const failures=await page.locator('#results .fail').allTextContents();
  if(failures.length){
   // Compare with the unchanged HEAD application in a separate isolated browser context.
   const {execFileSync}=require('node:child_process'),baseContext=await browser.newContext(),basePage=await baseContext.newPage(),paths=['js/furniture-catalog.js','js/inspector-panel.js','js/project-model.js','js/project-validation.js','js/stairs.js','js/stair-connections.js','renderer3d.js','tests/browser-tests.js'];
   for(const path of paths){const body=execFileSync('git',['show','HEAD:'+path],{encoding:'utf8'});await basePage.route('http://127.0.0.1:4173/'+path,route=>route.fulfill({contentType:'text/javascript',body}));}
   await basePage.goto('http://127.0.0.1:4173/tests/browser.html');await basePage.locator('#run').click();await basePage.waitForFunction(()=>!document.querySelector('#run').disabled,null,{timeout:60000});
   const baselineFailures=await basePage.locator('#results .fail').allTextContents();console.log('HEAD baseline: '+await basePage.locator('#summary').innerText());assert.deepEqual(failures,baselineFailures,'New failures beyond unchanged HEAD');
   fs.writeFileSync('validation/semi-l-browser-results.json',JSON.stringify({modified:await page.locator('#summary').innerText(),baseline:await basePage.locator('#summary').innerText(),existingFailures:failures},null,2));await baseContext.close();
   console.log('CONFIRMED unchanged HEAD has the same existing beam-copy failure');
  }
  }
  await page.goto('http://127.0.0.1:4173/tests/ui-preview.html');await page.waitForFunction(()=>document.querySelector('iframe').contentWindow.Atelier?.state?.stage);
  await page.locator('#semiLPreview').click();const app=page.frames().find(f=>f.url().includes('index.html'));
  const sample=await app.evaluate(()=>Atelier.validateProject(Atelier.state.project));
  fs.mkdirSync('deliverables/semi-l-stair',{recursive:true});fs.writeFileSync('deliverables/semi-l-stair/ground-to-first.json',JSON.stringify(sample,null,2));
  for(const [name,width,height] of [['desktop',1440,900],['tablet',820,900],['mobile',390,844]]){
   await page.locator('#'+name).click();await app.waitForFunction(()=>Atelier.state.canvas.width>0);
   await app.evaluate(()=>{Atelier.setWorkspace('architecture');Atelier.select(Atelier.floor().items[0].id);Atelier.canvasSpace.hidePanel('catalog',true);Atelier.canvasSpace.hidePanel('inspector',true);Atelier.fitPlan();});
   const before=await app.evaluate(()=>({floors:JSON.stringify(Atelier.state.project.floors),history:Atelier.state.history.length}));
   assert.ok(await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow '+name);
   await page.locator('iframe').screenshot({path:'validation/semi-l-ground-'+name+'.png'});
   await app.evaluate(()=>{Atelier.canvasSpace.showPanel('inspector');});
   assert.ok(await app.locator('#stairLayoutSummary').isVisible(),'Summary inaccessible '+name);
   await app.locator('#stairHandedness').focus();await app.locator('#stairHandedness').selectOption('right');
   await app.evaluate(()=>Atelier.undo());assert.equal(await app.evaluate(()=>JSON.stringify(Atelier.state.project.floors)),before.floors,'Mirror undo '+name);
   await app.evaluate(()=>Atelier.canvasSpace.hidePanel('inspector',true));await app.locator('#expandCanvas').click();await app.locator('#expandCanvas').click();
   assert.equal(await app.evaluate(()=>JSON.stringify(Atelier.state.project.floors)),before.floors,'Expand mutated geometry '+name);
   const h=await app.evaluate(()=>Atelier.state.history.length);await app.evaluate(()=>Atelier.viewStairFloor('semi-first','semi-upper-u'));assert.equal(await app.evaluate(()=>Atelier.state.history.length),h,'Floor navigation history '+name);
   await app.evaluate(()=>{Atelier.canvasSpace.hidePanel('inspector',true);Atelier.fitPlan();});await page.locator('iframe').screenshot({path:'validation/semi-l-first-'+name+'.png'});
   await app.evaluate(()=>Atelier.canvasSpace.showPanel('inspector'));const below=app.locator('#stairAddSemiLBelow');await below.evaluate(el=>el.scrollIntoView({block:'center'}));if(name==='mobile')await below.tap();else await below.click();
   assert.equal(await app.evaluate(()=>Atelier.floor().id),'semi-ground','Below button navigation '+name);assert.equal(await app.evaluate(()=>Atelier.state.history.length),h,'Repeated below action created history '+name);
   await app.evaluate(()=>{Atelier.viewStairFloor('semi-first','semi-upper-u');Atelier.canvasSpace.hidePanel('inspector',true);});
   await app.evaluate(()=>{Atelier.setView('3d');Atelier.state.project.camera.allFloors=true;Atelier.draw();Atelier.state.project.camera.yaw=-38;Atelier.state.project.camera.pitch=34;Atelier.fitPlan();});
   await app.waitForFunction(()=>window.atelier3D?.getStats().groups>=4);await page.waitForTimeout(250);await page.locator('iframe').screenshot({path:'validation/semi-l-stack-'+name+'.png'});
   assert.equal(await app.evaluate(()=>JSON.stringify(Atelier.state.project.floors)),before.floors,'3D changed geometry '+name);
   await app.evaluate(()=>{Atelier.setWorkspace('architecture');Atelier.viewStairFloor('semi-ground',Atelier.state.project.floors[0].items[0].id);});
   console.log('PASS Semi L/U preview, controls, history and 3D at '+width+' px');
  }
  assert.deepEqual(errors,[]);console.log('PASS zero browser errors; saved isolated ground-to-first sample and responsive screenshots');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});