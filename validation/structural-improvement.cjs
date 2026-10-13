const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/ranje/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(!process.argv.includes('--draft-only')){await page.goto('http://127.0.0.1:4173/tests/browser.html');await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('complete'),null,{timeout:60000});
  const summary=await page.locator('#summary').innerText(),failed=await page.locator('#results .fail').allTextContents();console.log(summary);assert.deepEqual(failed,[]);}
  await page.goto('http://127.0.0.1:4173/tests/ui-preview.html');await page.waitForTimeout(600);
  const app=page.frames().find(f=>f.url().includes('index.html')),draft=JSON.parse(fs.readFileSync('validation/structural-draft-input.json','utf8'));
  const result=await app.evaluate(draft=>{
   const A=window.Atelier,p=A.normalizeProject(A.validateProject(draft));A.state.project=p;A.state.history=[];A.state.future=[];A.state.selected=null;A.state.selectedIds.clear();A.state.structuralProposal=null;A.state.structuralReport=null;A.setWorkspace('structure');A.syncUI();A.fitPlan();
   const before=JSON.stringify(p),q=A.proposeStructuralFixes('building');if(JSON.stringify(p)!==before)throw Error('Preview mutated draft');if(!q.canApply)throw Error('Draft proposal blocked');
   const changes=A.deep(q.changes),notes=q.notes,beforeFailures=q.beforeFailures,afterFailures=q.afterFailures;
   if(!A.applyStructuralProposal())throw Error('Apply failed');if(A.state.history.length!==1)throw Error('Apply was not one undo');
   const improved=A.deep(A.state.project),report=A.engineeringReport(improved);A.undo();if(JSON.stringify(A.state.project)!==before)throw Error('Undo did not restore draft');A.redo();
   A.state.structuralReport=report;A.renderInspector();return{improved,report,changes,notes,beforeFailures,afterFailures};
  },draft);
  fs.writeFileSync('validation/structural-draft-improved.json',JSON.stringify(result.improved,null,2));
  fs.writeFileSync('validation/structural-draft-report.json',JSON.stringify(result,null,2));
  console.log('Draft: '+JSON.stringify({changes:result.changes.length,before:result.beforeFailures,after:result.afterFailures,floors:result.report.building.floorCount,issues:result.report.issues.length}));
  for(const [name,width,height] of [['desktop',1440,900],['tablet',820,900],['mobile',390,844]]){
   await page.evaluate(({width,height})=>{const frame=document.querySelector('iframe');frame.style.width=width+'px';frame.style.height=height+'px';},{width,height});
   await app.evaluate(()=>{Atelier.setWorkspace('structure');Atelier.canvasSpace.showPanel('inspector',true);Atelier.fitPlan();});
   await app.locator('#sheet-results').click();assert.ok(await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow '+width);
   await page.locator('iframe').screenshot({path:'validation/structural-improvement-'+name+'.png'});
   const history=await app.evaluate(()=>Atelier.state.history.length);await app.locator('[data-review-issue]').first().click();assert.equal(await app.evaluate(()=>Atelier.state.history.length),history);
   await app.evaluate(()=>{Atelier.canvasSpace.hidePanel('inspector',true);});await app.locator('#expandCanvas').click();await app.locator('#expandCanvas').click();
  }
  await app.evaluate(()=>{Atelier.proposeStructuralFixes('coordinate');Atelier.state.project.site.width+=1;if(Atelier.applyStructuralProposal())throw Error('Boundary change did not stale proposal');});
  await app.locator('#structImproveBuilding').click();assert.equal(await app.locator('#sheet-review').getAttribute('aria-selected'),'true');await app.evaluate(()=>{const q=Atelier.state.structuralProposal;q.candidate.structuralBasis.liveLoad+=1;if(Atelier.applyStructuralProposal())throw Error('Altered proposal applied');});assert.deepEqual(errors,[]);console.log('PASS draft preview/apply/undo/redo, 1440/820/390 layouts, issue navigation, Expand/Restore and boundary staleness');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
