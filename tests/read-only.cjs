const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ranje/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
 const page=await browser.newPage({hasTouch:true});
 await page.goto('http://127.0.0.1:4173/tests/browser.html');
 await page.click('#run');
 await page.waitForFunction(()=>!document.querySelector('#run').disabled,{},{timeout:60000});
 assert.deepEqual(await page.locator('.fail').allTextContents(),[]);
 console.log(await page.locator('#summary').innerText());
 // Serve a real exported project from the app fixture via an intercepted same-origin request.
 await page.goto('http://127.0.0.1:4173/?test=1');
 const fixture=await page.evaluate(()=>window.Atelier.state.project);
 fixture.name='Shared viewer fixture';
 await page.route('**/layouts/shared.json',route=>route.fulfill({json:fixture}));
 await page.evaluate(()=>localStorage.setItem('atelier-plan-test-project',JSON.stringify({sentinel:true})));
 for(const width of [1440,820,390]){
 await page.setViewportSize({width,height:900});
 await page.goto('http://127.0.0.1:4173/?test=1&readonly=1&layout=layouts/shared.json');
 await page.waitForFunction(()=>document.querySelector('#saveState')?.textContent.includes('Read-only'));
 assert.equal(await page.evaluate(()=>Atelier.state.project.name),'Shared viewer fixture');
 assert.equal(await page.locator('#projectName').isDisabled(),true);
 const before=await page.evaluate(()=>JSON.stringify(Atelier.floor()));
 await page.keyboard.press('w');await page.keyboard.press('Delete');await page.keyboard.press('Control+z');
 const canvas=page.locator('#planCanvas');const box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2+30);await page.mouse.up();
 assert.equal(await page.evaluate(()=>JSON.stringify(Atelier.floor())),before);
 assert.equal(await page.evaluate(()=>Atelier.state.history.length),0);
 await page.locator('#expandCanvas').click();
 await page.locator('#expandCanvas').focus();await page.keyboard.press('Enter');
 await page.locator('#fitBtn').tap();
 await page.screenshot({path:'validation/read-only-plan-'+width+'.png'});
 await page.evaluate(()=>{Atelier.saveProject();Atelier.queueSave();Atelier.flushSave();});
 assert.equal(await page.evaluate(()=>localStorage.getItem('atelier-plan-test-project')),'{"sentinel":true}');
 for(const workspace of ['structure','services','3d']){
 await page.evaluate(ws=>ws==='3d'?Atelier.setView('3d'):Atelier.setWorkspace(ws),workspace);
 assert.equal(await page.evaluate(()=>Atelier.state.tool),'pan');
 assert.equal(await page.evaluate(()=>Atelier.canTransform(Atelier.floor().items[0])),false);
 }
 await page.screenshot({path:'validation/read-only-'+width+'.png'});
 console.log('PASS read-only viewer '+width);
 }
 await page.goto('http://127.0.0.1:4173/?readonly=1&layout=missing.json');
 await page.waitForFunction(()=>document.body.textContent.includes('Shared layout could not be opened'));
 console.log('PASS unavailable layout fails closed');
 await page.goto('http://127.0.0.1:4173/tests/ui-preview.html');
 for(const width of [1440,820,390]){
 await page.setViewportSize({width:1600,height:1000});
 await page.evaluate(width=>{const frame=document.querySelector('iframe');frame.style.width=width+'px';frame.style.height='900px';},width);
 await page.locator('iframe').screenshot({path:'validation/publishing-ui-preview-'+width+'.png'});
 }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
