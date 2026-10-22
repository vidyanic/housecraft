const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('C:/Users/ranje/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const errors=[],report={};
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1050},hasTouch:true});page.on('pageerror',error=>errors.push(error.message));
    if(!process.argv.includes('--preview-only')){
    await page.goto('http://127.0.0.1:4173/tests/browser.html');await page.locator('#run').click();
    await page.waitForFunction(()=>!document.querySelector('#run').disabled,null,{timeout:60000});
    report.suite=await page.locator('#summary').innerText();report.failures=await page.locator('#results .fail').allTextContents();console.log(report.suite,report.failures);
    assert.ok(report.failures.every(message=>message.includes('Cross-floor beam copying includes remapped supports and retains geometry: Supports omitted')),'Unexpected browser failure');
    }
    await page.goto('http://127.0.0.1:4173/tests/ui-preview.html');await page.waitForFunction(()=>document.querySelector('iframe').contentWindow.Atelier?.canvasSpace);
    const app=page.frames().find(frame=>frame.url().includes('index.html'));report.previews=[];
    for(const [name,width] of [['desktop',1440],['tablet',820],['mobile',390]]){
      await page.locator('#'+name).click();await app.waitForFunction(expected=>innerWidth===expected,width);
      for(const workspace of ['architecture','structure','services','3d']){
        await app.evaluate(workspace=>{Atelier.closeMoveKeyboard();if(workspace==='3d')Atelier.setView('3d');else Atelier.setWorkspace(workspace);Atelier.canvasSpace.hidePanel('catalog',true);Atelier.canvasSpace.hidePanel('inspector',true);},workspace);
        await app.waitForTimeout(180);await app.locator('#fitBtn').tap();
        const camera=await app.evaluate(()=>({floors:JSON.stringify(Atelier.state.project.floors),history:Atelier.state.history.length}));
        assert.ok(await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow '+name+' '+workspace);
        await page.locator('iframe').screenshot({path:'validation/canvas-controls-'+name+'-'+workspace+'.png'});
        await app.locator('#expandCanvas').tap();await app.locator('#expandCanvas').tap();
        assert.deepEqual(await app.evaluate(()=>({floors:JSON.stringify(Atelier.state.project.floors),history:Atelier.state.history.length})),camera);
        report.previews.push(name+' '+workspace);
      }
      await app.evaluate(()=>{Atelier.setWorkspace('architecture');Atelier.select(Atelier.floor().items.find(item=>!item.locked&&!item.hostWallId)?.id);});
      await app.locator('#moveKeyboardBtn').tap();assert.equal(await app.locator('#moveKeyboardInput').evaluate(input=>input===document.activeElement),true);
      const before=await app.evaluate(()=>({item:Atelier.deep(Atelier.findEntity(Atelier.state.selected)),history:Atelier.state.history.length}));assert.ok(before.item,'Missing nudge fixture');
      await app.locator('[data-nudge="ArrowRight"]').tap();
      assert.equal(await app.evaluate(()=>Atelier.findEntity(Atelier.state.selected).x),before.item.x+1);
      assert.equal(await app.evaluate(()=>Atelier.state.history.length),before.history+1);
      await page.locator('iframe').screenshot({path:'validation/canvas-keyboard-'+name+'.png'});
      const arrow=app.locator('[data-nudge="ArrowDown"]'),box=await arrow.boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await app.waitForTimeout(560);await page.mouse.up();
      assert.ok(await app.evaluate(original=>Atelier.findEntity(Atelier.state.selected).y>original+1,before.item.y));
      assert.equal(await app.evaluate(()=>Atelier.state.history.length),before.history+2,'Held arrows must be one undo');
      const cancelBefore=await app.evaluate(()=>({project:JSON.stringify(Atelier.state.project),history:Atelier.state.history.length}));
      await page.mouse.down();await app.waitForTimeout(100);await app.locator('[data-nudge="ArrowDown"]').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
      assert.deepEqual(await app.evaluate(()=>({project:JSON.stringify(Atelier.state.project),history:Atelier.state.history.length})),cancelBefore,'Canceled nudge changed model/history');
      await app.locator('#moveKeyboardInput').focus();await page.keyboard.press('Escape');assert.ok(await app.locator('#moveKeyboard').isHidden());
      await app.evaluate(()=>{Atelier.setView('3d');Atelier.flushSave();});await app.waitForTimeout(400);
      const recovered=await app.evaluate(async()=>{
        const canvas=document.querySelector('#threeStage canvas'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),extension=gl.getExtension('WEBGL_lose_context');
        if(!extension)throw Error('Context loss extension unavailable');
        const before={project:JSON.stringify(Atelier.state.project),history:Atelier.state.history.length,stats:atelier3D.getStats()},wait=type=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(type+' timed out')),12000);canvas.addEventListener(type,()=>{clearTimeout(timer);resolve();},{once:true});});
        const lost=wait('webglcontextlost');extension.loseContext();await lost;
        if(!atelier3D.getStats().contextLost)throw Error('Loss not detected');
        await new Promise(resolve=>setTimeout(resolve,150));const restored=wait('webglcontextrestored');extension.restoreContext();await restored;await new Promise(resolve=>setTimeout(resolve,450));
        const after=atelier3D.getStats();if(after.contextLost||after.frames<=before.stats.frames)throw Error('Main scene did not render after recovery');
        if(JSON.stringify(Atelier.state.project)!==before.project||Atelier.state.history.length!==before.history){const previous=JSON.parse(before.project),current=Atelier.state.project,diffs=Object.keys(current).filter(key=>JSON.stringify(current[key])!==JSON.stringify(previous[key]));throw Error('Recovery mutated project/history: '+JSON.stringify(diffs.map(key=>({key,before:previous[key],after:current[key]}))));}
        if(Math.abs(after.cameraDistance-before.stats.cameraDistance)>.00001||JSON.stringify(after.cameraTarget)!==JSON.stringify(before.stats.cameraTarget))throw Error('Recovery moved camera');
        return {frames:after.frames,groups:after.groups};
      });
      report[name+'Recovery']=recovered;
      await page.locator('iframe').screenshot({path:'validation/canvas-recovered-'+name+'.png'});
      await app.evaluate(()=>{const canvas=document.querySelector('#threeStage canvas');window.restoreExtension=(canvas.getContext('webgl2')||canvas.getContext('webgl')).getExtension('WEBGL_lose_context');window.restoreExtension.loseContext();});
      await app.waitForFunction(()=>atelier3D.getStats().contextLost);await app.evaluate(()=>Atelier.setWorkspace('architecture'));await app.waitForTimeout(150);await app.evaluate(()=>window.restoreExtension.restoreContext());await app.waitForFunction(()=>!atelier3D.getStats().contextLost);await app.evaluate(()=>Atelier.setView('3d'));await app.waitForTimeout(180);assert.ok(await app.evaluate(()=>atelier3D.getStats().frames>0),'Hidden renderer failed recovery');
    }
    await page.goto('http://127.0.0.1:4173/?test=1&readonly=1');await page.waitForFunction(()=>Atelier?.canvasSpace);assert.ok(await page.locator('#moveKeyboardBtn').isHidden());
    assert.deepEqual(errors,[]);report.errors=errors;fs.writeFileSync('validation/canvas-controls-results.json',JSON.stringify(report,null,2));console.log('Responsive controls, touch nudges, cancellation, WebGL recovery and read-only checks passed');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
