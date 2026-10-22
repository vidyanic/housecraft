/** Adaptive studio shell. Existing editors retain their validation and undo handlers. */
(function () {
  'use strict';
  const A=window.Atelier, $=A.$, esc=A.escapeHtml;
  let initialized=false, inspectorKey='', inspectorSelection='', activeSheet='', treeSignature='', contextKey='';
  let structureCopyDialog=null;
  const create=(tag,cls,html='')=>{const el=document.createElement(tag);el.className=cls;el.innerHTML=html;return el;};
  const button=(label,id,icon)=>`<button class="button" id="${id}">${icon?A.icon(icon):''}<span>${label}</span></button>`;
  const medium=()=>innerWidth<1200;
  function showPanel(panel){
    if(A.canvasSpace){A.canvasSpace.showPanel(panel);return;}
    const ws=$('#workspace');ws.classList.remove(panel==='catalog'?'hide-catalog':'hide-inspector');
    A.setMobileTab(panel);A.resizeCanvas();window.atelier3D?.resize();syncShell();
  }
  function showLibrary(page='library',reveal=true){
    $('#catalogPanel').dataset.page=page;
    $('#libraryTabs').querySelectorAll('button').forEach(b=>{const on=b.dataset.library===page;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
    $('#catalogPanel .panel-title').textContent=page==='library'?'Object library':'Objects on this floor';
    $('#treeSearch').value='';renderTree(true);if(reveal)showPanel('catalog');
  }
  function renderTree(force=false){
    const objects=[...A.allEntities(),...(A.floor().grids||[])],q=$('#treeSearch')?.value.toLowerCase()||'';
    const signature=JSON.stringify([A.floor().id,A.state.selected,q,objects.map(o=>[o.id,o.name,o.tag,o.type])]);
    if(!force&&signature===treeSignature)return;treeSignature=signature;
    const list=$('#studioObjectList');if(!list)return;
    list.innerHTML=objects.filter(o=>(o.name||o.tag||o.type||'').toLowerCase().includes(q)).map(o=>`<button class="tree-row ${o.id===A.state.selected?'active':''}" data-studio-entity="${esc(o.id)}" aria-pressed="${o.id===A.state.selected}"><span class="tree-symbol">${A.icon(o.type==='column'?'i-pillar':o.type==='beam'?'i-beam':o.type==='wall'?'i-wall':o.type==='room'?'i-room':'i-cube')}</span><span><strong>${esc(o.name||o.tag||o.type)}</strong><small>${esc(o.type)}</small></span></button>`).join('')||'<div class="studio-empty">No matching objects. Draw on the canvas or add from the library.</div>';
    list.querySelectorAll('button').forEach(b=>b.onclick=()=>{const id=b.dataset.studioEntity;if(A.floor().grids?.some(g=>g.id===id)){A.setWorkspace('structure');A.selectStructural(id);}else A.select(id);showPanel('inspector');});
  }
  function sectionName(el){return el.querySelector('.section-title,summary')?.textContent.toLowerCase()||'';}
  function prepareInspector(){
    if(!initialized)return;
    const body=$('#inspectorBody'),struct=!!body.querySelector('[data-structural-editor]'),selected=!!A.state.selected&&A.state.inspectorMode!=='project';
    const key=struct?'structure':A.state.viewMode==='3d'?'3d':selected?'selection':'project';
    const tabs=struct?[...(selected?[['member','Member']]:[]),['model','Model'],['basis','Basis'],['review','Review'],['results','Results'],['project','Project']]:key==='3d'?[['view','View'],['sun','Sun'],['project','Project'],...(selected?[['properties','Object']]:[])]:selected?[['properties','Properties'],['checks','Checks'],['project','Project']]:[['project','Project'],['checks','Checks']];
    if(key!==inspectorKey||selected&&inspectorSelection!==A.state.selected){activeSheet=struct?(selected?'member':'model'):key==='3d'?(selected?'properties':'view'):selected?'properties':'project';inspectorKey=key;}
    inspectorSelection=selected?A.state.selected:'';
    if(!tabs.some(t=>t[0]===activeSheet))activeSheet=tabs[0][0];
    const root=struct?body.firstElementChild:body;
    [...root.children].forEach(el=>{
      const name=sectionName(el);let sheet;
      if(struct){sheet=el.dataset.projectSettings?'project':el.id==='structEntity'||el.dataset.copyFloor?'member':name.includes('design basis')?'basis':name.includes('propos')?'review':name.includes('calculation results')?'results':'model';if(el.querySelector('#structAnalyze')||name.startsWith('schedule'))el.dataset.studioToolbar='true';}
      else sheet=name.includes('3d camera')?'view':name.includes('sun &')?'sun':name.includes('layout check')||name.includes('plan readiness')?'checks':selected?'properties':'project';
      el.dataset.sheet=sheet;
      if(el.matches('.empty-selection'))el.dataset.studioIntro='true';
    });
    if(!struct&&!selected&&A.state.viewMode==='plan'){const settings=[...root.children].find(el=>sectionName(el).includes('drawing settings'));if(settings&&root.firstElementChild!==settings)root.prepend(settings);}
    const nav=$('#propertyTabs');nav.innerHTML=tabs.map(([id,label])=>`<button role="tab" id="sheet-${id}" data-sheet-tab="${id}" aria-selected="${id===activeSheet}" tabindex="${id===activeSheet?0:-1}" aria-controls="inspectorBody">${label}</button>`).join('');
    nav.querySelectorAll('button').forEach(b=>b.onclick=()=>chooseSheet(b.dataset.sheetTab));
    applySheet();
    if(struct&&activeSheet==='basis'){const d=$('#structBasis')?.closest('details');if(d)d.open=true;}
    syncShell();
  }
  function applySheet(){
    const root=$('#inspectorBody [data-structural-editor]')||$('#inspectorBody');
    [...root.children].forEach(el=>{if(el.dataset.sheet)el.hidden=el.dataset.sheet!==activeSheet||el.dataset.studioToolbar==='true'||el.dataset.studioIntro==='true';});
    $('#propertyTabs').querySelectorAll('button').forEach(b=>{const on=b.dataset.sheetTab===activeSheet;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
    $('#inspectorBody').setAttribute('role','tabpanel');$('#inspectorBody').setAttribute('aria-labelledby','sheet-'+activeSheet);
    $('#inspectorBody').querySelector('[data-studio-empty]')?.remove();
    if(![...root.children].some(el=>!el.hidden)){
      const empty=create('div','studio-empty',activeSheet==='results'?'Run Screening or Modal analysis in the toolbar to see calculation results.':activeSheet==='checks'?'Select an object to review its layout checks.':'Choose an object from the canvas or the Objects list to edit its properties.');empty.dataset.studioEmpty='true';root.append(empty);
    }
  }
  function chooseSheet(key){
    if(key==='project'&&inspectorKey==='structure'){openProjectSettings();return;}
    if(['project','view','sun'].includes(key)&&A.state.selected&&A.state.inspectorMode!=='project'&&['selection','3d'].includes(inspectorKey)){
      A.state.inspectorMode='project';activeSheet=key;A.renderInspector();return;
    }
    activeSheet=key;applySheet();$('#inspectorBody').scrollTop=0;
    if(key==='basis'){const d=$('#structBasis')?.closest('details');if(d)d.open=true;}
  }
  function openProperties(){A.state.inspectorMode=null;A.renderInspector();showPanel('inspector');}
  function openProjectSettings(){A.state.inspectorMode='project';A.renderInspector();activeSheet='project';applySheet();showPanel('inspector');$('#inspectorBody').scrollTop=0;}
  function syncShell(){
    if(!initialized)return;
    const s=A.state,ws=$('#workspace'),discipline=s.viewMode==='3d'?'3d':s.workspace||'architecture';
    document.body.dataset.studioView=discipline;
    const keyboard=$('#moveKeyboardBtn');if(keyboard){keyboard.disabled=discipline==='3d'||A.readOnly;if(keyboard.disabled)A.closeMoveKeyboard?.();}
    // One breakpoint policy for both direct panel buttons and close actions.
    const panel=ws.dataset.mobileTab||'stage';
    $('#tabBtnCatalog').classList.toggle('active',!ws.classList.contains('hide-catalog')&&(!medium()||panel==='catalog'));
    $('#tabBtnInspector').classList.toggle('active',!ws.classList.contains('hide-inspector')&&(!medium()||panel==='inspector'));
    $('#tabBtnCatalog').setAttribute('aria-pressed',String($('#tabBtnCatalog').classList.contains('active')));
    $('#tabBtnInspector').setAttribute('aria-pressed',String($('#tabBtnInspector').classList.contains('active')));
    const structureButton=$('#structureBtn');if(structureButton){const shown=s.structureOnly3D||s.project.showStructure!==false;structureButton.classList.toggle('active',shown);structureButton.setAttribute('aria-pressed',String(shown));structureButton.setAttribute('aria-label',shown?'Hide structure':'Show structure');structureButton.title=shown?'Hide structure':'Show structure';}
    const k=[discipline,s.selected,!!s.structuralReport,s.tool,!!s.multiSelect,s.transform3DMode,A.structuralLayers.interior,!!s.wallPlotGuide,!!s.structureOnly3D,s.project.showStructure!==false,!!window.atelier3D?.isWalking?.()].join(':');
    if(k!==contextKey){contextKey=k;renderContext(discipline);}
    const select=$('#studioFloor');const signature=s.project.floors.map(f=>f.id+f.name).join('|');
    if(select.dataset.signature!==signature){select.innerHTML=s.project.floors.map((f,i)=>`<option value="${i}">${esc(f.name)}</option>`).join('');select.dataset.signature=signature;}
    select.value=s.project.activeFloor;
    $('#undoBtn').disabled=!s.history.length;$('#redoBtn').disabled=!s.future.length;
    $('.view-switch').querySelectorAll('button').forEach(b=>{const on=b.dataset.view==='3d'?discipline==='3d':b.dataset.workspace===discipline;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
    $('#studioSelection').textContent=A.findEntity(s.selected)?.name||A.findEntity(s.selected)?.tag||(s.selectedIds.size>1?s.selectedIds.size+' selected':'No selection');
    const selected=A.findEntity(s.selected),actions=$('#selectionActions');actions.hidden=!s.selected||s.inspectorMode==='project';
    if(actions.dataset.selection!==s.selected){actions.dataset.selection=s.selected||'';actions.replaceChildren();if(selected&&!['column','beam','slab','load','structural-wall'].includes(selected.type)){actions.append(commandButton('Duplicate',A.duplicateSelected,'i-cube'));if(A.floor().items.includes(selected))actions.append(commandButton('Rotate',A.rotateSelected,'i-undo'));}actions.append(commandButton('Copy to floor',()=>{openProperties();$('#copyTargetFloor')?.scrollIntoView({block:'center'});$('#copyTargetFloor')?.focus();},'i-cube'));actions.append(commandButton('Delete',A.deleteSelected,'i-close'));}
    renderTree();
  }
  function commandButton(label,action,icon){const el=create('button','task-button',icon?A.icon(icon)+'<span>'+label+'</span>':label);el.onclick=action;return el;}
  function initMoveKeyboard(tools){
    const launch=create('button','tool','<span aria-hidden="true">⌨</span><span>Keyboard</span>');launch.id='moveKeyboardBtn';launch.title='Open keyboard and precise move arrows';launch.setAttribute('aria-label',launch.title);launch.setAttribute('aria-controls','moveKeyboard');launch.setAttribute('aria-expanded','false');tools.prepend(launch);
    const panel=create('section','move-keyboard','<div class="move-keyboard-head"><strong>Precise move</strong><button type="button" id="closeMoveKeyboard" aria-label="Close move keyboard">×</button></div><label>Move step<select id="moveKeyboardStep"><option value="1">1 cm</option><option value="5">5 cm</option><option value="grid">Grid step</option></select></label><input id="moveKeyboardInput" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-label="Keyboard arrow input" aria-describedby="moveKeyboardHint" placeholder="Tap for keyboard"><p id="moveKeyboardHint">Select objects, then use arrows. Touch arrows work without a keyboard.</p><div class="move-keyboard-arrows"><button type="button" data-nudge="ArrowUp" aria-label="Move selection up">↑</button><button type="button" data-nudge="ArrowLeft" aria-label="Move selection left">←</button><button type="button" data-nudge="ArrowDown" aria-label="Move selection down">↓</button><button type="button" data-nudge="ArrowRight" aria-label="Move selection right">→</button></div>');
    panel.id='moveKeyboard';panel.hidden=true;panel.setAttribute('aria-label','Precise move keyboard');$('#stage').append(panel);
    const input=$('#moveKeyboardInput');let repeatTimer=null,owner=null;
    function place(){if(panel.hidden)return;const rect=$('#stage').getBoundingClientRect(),viewport=window.visualViewport,visibleBottom=viewport?viewport.offsetTop+viewport.height:innerHeight;panel.style.bottom=Math.max(64,rect.bottom-visibleBottom+12)+'px';panel.style.maxHeight=Math.max(120,Math.min(rect.bottom,visibleBottom)-rect.top-24)+'px';}
    window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);window.addEventListener('resize',place);
    A.moveKeyboardStep=()=>$('#moveKeyboardStep').value==='grid'?A.gridStep():Number($('#moveKeyboardStep').value);
    function stop(cancel=false){clearTimeout(repeatTimer);repeatTimer=null;owner=null;if(cancel&&A.state.nudgeActive)A.cancelInteraction();else A.finishNudge();}
    function close(returnFocus=false){stop();panel.hidden=true;launch.setAttribute('aria-expanded','false');if(panel.contains(document.activeElement))document.activeElement.blur();if(returnFocus)launch.focus({preventScroll:true});}
    A.closeMoveKeyboard=close;
    launch.onclick=()=>{
      if(!panel.hidden){close(true);return;}
      A.canvasSpace?.revealCanvas();panel.hidden=false;place();launch.setAttribute('aria-expanded','true');input.focus({preventScroll:true});
      try{navigator.virtualKeyboard?.show();}catch{}
    };
    $('#closeMoveKeyboard').onclick=()=>close(true);
    input.oninput=()=>{input.value='';};input.addEventListener('blur',()=>A.finishNudge());
    input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.blur();}});
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}});
    for(const arrow of panel.querySelectorAll('[data-nudge]')){
      arrow.addEventListener('pointerdown',event=>{
        if(event.button!==0||owner!==null)return;
        event.preventDefault();A.finishNudge();owner=event.pointerId;arrow.setPointerCapture(owner);
        const move=()=>{A.nudgeSelection(arrow.dataset.nudge,A.moveKeyboardStep());repeatTimer=setTimeout(move,90);};
        A.nudgeSelection(arrow.dataset.nudge,A.moveKeyboardStep());repeatTimer=setTimeout(move,350);
      });
      arrow.addEventListener('pointerup',event=>{if(owner===event.pointerId)stop();});
      arrow.addEventListener('pointercancel',event=>{if(owner===event.pointerId)stop(true);});
      arrow.addEventListener('lostpointercapture',event=>{if(owner===event.pointerId)stop(true);});
      arrow.onclick=event=>{if(event.detail===0){A.nudgeSelection(arrow.dataset.nudge,A.moveKeyboardStep());A.finishNudge();}};
    }
    window.addEventListener('blur',()=>stop());document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  }
  function renderContext(discipline){
    const tools=$('#toolrail'),commands=$('#contextCommands');commands.replaceChildren();
    tools.querySelectorAll('[data-tool]').forEach(b=>{const t=b.dataset.tool;b.hidden=discipline==='3d'||discipline==='structure'&&!['select','pan','column','beam'].includes(t)||discipline==='services'&&!['select','pan','dimension'].includes(t)||discipline==='architecture'&&['column','beam'].includes(t);b.setAttribute('aria-pressed',String(t===A.state.tool));b.draggable=discipline==='structure'&&['column','beam'].includes(t);b.style.touchAction=b.draggable?'none':'';});
    if(['architecture','services'].includes(discipline)){
      const multi=commandButton(A.state.multiSelect?'Finish selecting':'Select multiple',()=>{A.setTool('select');A.state.multiSelect=!A.state.multiSelect;A.setMobileTab('stage');A.canvasSpace?.revealCanvas();renderContext(discipline);A.showHint(A.state.multiSelect?'Tap objects to add or remove · Finish selecting to move the selection':'Drag selected objects to move');});multi.setAttribute('aria-pressed',String(!!A.state.multiSelect));multi.id='multiSelectObjects';commands.append(multi);commands.append(commandButton('Next overlapping element',A.cycleOverlapSelection));
    }else A.state.multiSelect=false;
    if(discipline==='structure'){
      const copy=commandButton('Copy structure',openStructureCopy,'i-copy');copy.id='copyCompleteStructure';commands.append(copy);
      const stack=commandButton('Building stack',A.viewStructuralStack,'i-cube');stack.id='viewStructuralStack';stack.dataset.viewerNavigation='true';commands.append(stack);
      const guides=commandButton('Layout guides',()=>{chooseSheet('model');showPanel('inspector');$('#structGuide')?.scrollIntoView({block:'center'});});guides.id='structLayoutGuides';commands.append(guides);
      const interior=commandButton(A.structuralLayers.interior?'Hide interior':'Show interior',()=>{A.structuralLayers.interior=!A.structuralLayers.interior;A.renderInspector();A.draw();renderContext('structure');});interior.id='structInteriorToggle';interior.setAttribute('aria-pressed',String(A.structuralLayers.interior));commands.append(interior);
      for(const [type,label] of [['slab','Slab'],['structural-wall','RC wall'],['load','Load'],['grid','Grid']]){const button=commandButton(label,()=>A.addStructuralObject(type),'i-grid');button.dataset.structAdd=type;button.draggable=true;button.style.touchAction='none';button.title='Click to add · drag onto the plan';commands.append(button);};
      commands.append(commandButton('Screening',()=>{$('#structAnalyze')?.click();activeSheet='results';prepareInspector();showPanel('inspector');}));
      const improve=commandButton('Analyze & improve',()=>{A.proposeStructuralFixes('building');chooseSheet('review');showPanel('inspector');});improve.id='structImproveBuilding';commands.append(improve);
      commands.append(commandButton('Modal analysis',()=>{$('#structDynamic')?.click();activeSheet='results';prepareInspector();showPanel('inspector');}));
    }else if(discipline==='architecture'){
      const square=commandButton('Square walls 90°',A.squareWalls,'i-wall');square.id='squareWalls';square.title='Align current-floor walls to plot axes, keeping joined corners and locked walls';commands.append(square);
      const guide=commandButton('Plot-axis guide',()=>{const focused=document.activeElement===guide;A.state.wallPlotGuide=!A.state.wallPlotGuide;A.draw();renderContext('architecture');if(focused)$('#wallPlotGuide').focus();A.showHint(A.state.wallPlotGuide?'Draw or edit walls parallel to plot width (X) or length (Y) · Alt temporarily positions freely':'Free wall drawing and editing');});guide.id='wallPlotGuide';guide.setAttribute('aria-pressed',String(!!A.state.wallPlotGuide));guide.title='Guide new walls and existing wall endpoints/rotation parallel to plot width (X) or length/depth (Y)';commands.append(guide);
      if(A.findEntity(A.state.selected)?.type==='wall')for(const [axis,label] of [['width','Parallel to width'],['length','Parallel to length']]){const b=commandButton(label,()=>A.alignSelectedWall(axis),'i-wall');b.id='wallParallel-'+axis;b.disabled=!A.canTransform(A.findEntity(A.state.selected));b.title='Align selected wall to plot '+axis+', retaining its start and length';commands.append(b);}
      commands.append(commandButton('Trace rooms',A.deriveRooms,'i-room'));
    }
    else if(discipline==='services'){
      for(const [type,label] of [['cold-water-pipe','Water pipe'],['waste-pipe','Drain'],['electrical-wire','Wiring']]){const spec=A.CATALOG.find(o=>o.type===type);if(spec)commands.append(commandButton(label,()=>A.addObjectToPlan(type),'i-dimension'));}
      const o=A.findEntity(A.state.selected);if(o&&A.isServiceRoute(o))commands.append(commandButton('Draw route',()=>A.startServiceRoute(o),'i-dimension'));
    }else{
      const structure=commandButton(A.state.structureOnly3D?'Show whole building':'Structure only',()=>{A.state.structureOnly3D=!A.state.structureOnly3D;window.atelier3D?.requestRebuild();A.draw();renderContext('3d');});structure.id='structureOnly3D';structure.dataset.viewerNavigation='true';structure.setAttribute('aria-pressed',String(!!A.state.structureOnly3D));commands.append(structure);
      const walkButton=commandButton(window.atelier3D?.isWalking?.()?'Exit walk':'Walk-through',()=>{window.atelier3D?.setWalk(!window.atelier3D.isWalking());A.canvasSpace?.revealCanvas();},'i-pan');walkButton.id='walkToggle';walkButton.dataset.viewerNavigation='true';walkButton.setAttribute('aria-pressed',String(!!window.atelier3D?.isWalking?.()));commands.append(walkButton);
      for(const [preset,label] of [['dollhouse','Dollhouse'],['top','Top'],['front','Front']]){const button=commandButton(label,()=>A.setCameraPreset(preset),'i-cube');button.dataset.viewerNavigation='true';commands.append(button);}
      for(const [mode,label,hint] of [['orbit','Orbit','Drag to orbit · Shift-drag an object to move'],['move','Move objects','Drag an unlocked object to move · Escape cancels'],['rotate','Rotate objects','Drag horizontally to rotate · Shift snaps to 15° · Escape cancels'],['scale','Scale objects','Drag horizontally for uniform scale · Escape cancels']]){const button=commandButton(label,()=>{window.atelier3D?.setManipulationMode(mode);A.setMobileTab('stage');A.canvasSpace?.revealCanvas();renderContext('3d');A.showHint(hint);});if(mode==='orbit')button.dataset.viewerNavigation='true';button.setAttribute('aria-pressed',String((A.state.transform3DMode||'orbit')===mode));button.disabled=mode!=='orbit'&&!!A.state.project.camera.allFloors;commands.append(button);}
    }
  }
  function dialog(id,title,content){
    const backdrop=create('div','modal-backdrop');backdrop.id=id;backdrop.dataset.studioDialog='true';
    backdrop.innerHTML=`<div class="modal studio-dialog" role="dialog" aria-modal="true" aria-labelledby="${id}-title"><div class="modal-header"><div><div class="eyebrow">Atelier Plan</div><h2 id="${id}-title">${title}</h2></div><button class="button" data-studio-close="${id}" aria-label="Close ${title}">Close</button></div>${content}</div>`;
    document.body.append(backdrop);let opener;
    const close=()=>{backdrop.classList.remove('show');if(opener?.closest('[inert]'))opener=$('#reveal-project')||$('#mobileMenuBtn');opener?.focus();};backdrop.querySelector('[data-studio-close]').onclick=close;
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
    backdrop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}if(e.key==='Tab'){const els=[...backdrop.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.getClientRects().length),first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});
    return {el:backdrop,open(){opener=document.activeElement;if(opener===document.body||!opener?.getClientRects().length)opener=$('#mobileMenuBtn');backdrop.classList.add('show');backdrop.querySelector('input,select,button')?.focus();},close};
  }
  function openStructureCopy(){
    if(A.readOnly)return;
    if(A.state.pointerBackup)A.cancelInteraction();
    const source=A.floor(),keys=A.structuralCollections,signature=JSON.stringify([source.diaphragm,...keys.map(k=>source[k])]);
    if(!keys.some(k=>source[k]?.length)){A.showToast('Add structure to the current floor before copying');return;}
    structureCopyDialog||=dialog('structureCopyModal','Copy complete structure','<div id="structureCopyBody" data-structural-editor></div>');
    const body=$('#structureCopyBody'),floors=A.state.project.floors.filter(f=>f.id!==source.id),empty=floors.filter(f=>!keys.some(k=>f[k]?.length)),gap=A.structuralBasis(A.state.project).storeyHeight;
    body.innerHTML=`<p>Copy all structure from <strong>${esc(source.name)}</strong> at the same X/Y position. Each floor gets independent members and beam/column connections.</p><p class="struct-note">${keys.map(k=>`${source[k]?.length||0} ${k==='structuralWalls'?'RC walls':k}`).join(' · ')}</p><fieldset class="structure-copy-targets"><legend>Existing destination floors</legend>${floors.map(f=>{const occupied=keys.some(k=>f[k]?.length);return `<label><input type="checkbox" data-structure-copy-floor="${esc(f.id)}" ${occupied?'disabled':''}> ${esc(f.name)} · ${esc(A.formatLength(f.elevation))}${occupied?' · already has structure':''}</label>`;}).join('')||'<p>No other floors yet. Create new levels below.</p>'}</fieldset><div class="structure-copy-fields"><label>New floors above the highest level<input id="structureCopyLevels" type="number" min="0" max="20" step="1" value="${empty.length?0:1}"></label><label>Floor-to-floor height (${esc(A.unitLabel())})<input id="structureCopyGap" type="text" value="${esc(A.displayValue(gap))}" data-cm="${gap}" data-original="${esc(A.displayValue(gap))}"></label></div><p class="struct-note">Copies columns, beams, slabs, RC walls, point loads, grids and the diaphragm assumption. Existing architecture and roof-level flags stay in place. Member sizes, heights and loads remain as drawn.</p><p id="structureCopySummary" role="status"></p><p id="structureCopyError" class="struct-error" role="alert"></p><div class="struct-actions"><button class="button" id="applyStructureCopy">Copy structure</button><button class="button primary" id="copyStructureAndView">Copy & view building</button></div>`;
    const issueList=create('div','structure-copy-issues');issueList.id='structureCopyIssues';body.querySelector('.structure-copy-targets').before(issueList);
    const showIssues=issues=>{
      issueList.hidden=!issues.length;
      issueList.innerHTML=issues.length?`<p><strong>${issues.length} broken column connection(s) on ${esc(source.name)}</strong></p><p>Open an affected member below to choose the correct column or explicitly make the connection free.</p>${issues.map((i,index)=>`<section class="structure-copy-issue"><strong>${esc(i.member)} · ${esc(i.label)}</strong><p>${esc(i.message)}</p><div class="struct-actions"><button class="button" data-show-copy-issue="${index}">Show on plan</button><button class="button" data-edit-copy-issue="${index}">Edit connection</button></div></section>`).join('')}`:'';
      issueList.querySelectorAll('[data-show-copy-issue],[data-edit-copy-issue]').forEach(button=>button.onclick=()=>{const edit=button.dataset.editCopyIssue!=null,index=Number(edit?button.dataset.editCopyIssue:button.dataset.showCopyIssue);structureCopyDialog.close();A.focusStructuralIssue(issues[index],{edit});});
      $('#applyStructureCopy').disabled=!!issues.length;$('#copyStructureAndView').disabled=!!issues.length;
    };
    const refresh=()=>{const n=Number($('#structureCopyLevels').value),selected=body.querySelectorAll('[data-structure-copy-floor]:checked').length,total=selected+(Number.isInteger(n)&&n>0?n:0);$('#structureCopySummary').textContent=`${total} destination floor(s) · copies form one Undo action. Existing structure is protected from overlapping copies.`;};
    body.oninput=refresh;body.onchange=refresh;refresh();
    const apply=view=>{
      try{
        if(A.floor().id!==source.id||signature!==JSON.stringify([A.floor().diaphragm,...keys.map(k=>A.floor()[k])]))throw Error('Source structure changed. Close and reopen this copy option.');
        const input=$('#structureCopyGap'),height=input.value===input.dataset.original?Number(input.dataset.cm):A.toCm(input.value);
        A.copyStructureToFloors({targetIds:[...body.querySelectorAll('[data-structure-copy-floor]:checked')].map(el=>el.dataset.structureCopyFloor),newFloors:Number($('#structureCopyLevels').value),gap:height});structureCopyDialog.close();if(view)A.viewStructuralStack();
      }catch(error){$('#structureCopyError').textContent=error.message;if(error.structuralIssues)showIssues(error.structuralIssues);}
    };
    $('#applyStructureCopy').onclick=()=>apply(false);$('#copyStructureAndView').onclick=()=>apply(true);showIssues(A.structuralReferenceIssues(source));structureCopyDialog.open();
  }
  function initStudioUI(){
    initialized=true;document.body.classList.add('studio');
    const app=$('.app'),ws=$('#workspace');
    const nav=create('div','workspace-navigation',`<div class="level-picker"><label for="studioFloor">Floor</label><select id="studioFloor"></select><button class="button" id="studioAddFloor" aria-label="Add floor" title="Add floor">+</button></div>`);
    nav.prepend($('.view-switch'));app.insertBefore(nav,ws);$('.view-switch').setAttribute('role','tablist');$('.view-switch').setAttribute('aria-label','Workspaces');$('.view-switch').querySelectorAll('button').forEach(b=>b.setAttribute('role','tab'));
    const tasks=create('div','studio-taskbar','<div id="contextCommands" class="context-commands"></div><div class="task-panel-actions"></div>');tasks.prepend($('#toolrail'));tasks.lastElementChild.append($('#panelSwitchTabs'));app.insertBefore(tasks,ws);
    initMoveKeyboard($('#toolrail'));
    $('#tabBtnCatalog').querySelector('span').textContent='Library';$('#tabBtnCatalog').title='Open object library';$('#tabBtnInspector').title='Open properties';
    const actions=$('.top-actions');actions.prepend(create('button','button command-launch','Search commands <kbd>Ctrl K</kbd>'));$('.command-launch').id='commandBtn';
    $('#objectsBtn').textContent='Objects';$('#objectsBtn').classList.remove('desktop-only');$('#objectsBtn').onclick=()=>showLibrary('objects');
    $('#exportBtn').innerHTML=A.icon('i-download')+'<span>Export</span>';$('#exportBtn').title='Export drawings, project and calculations';$('#exportBtn').classList.remove('desktop-only');$('#projectsBtn').classList.remove('desktop-only');$('#projectsBtn').textContent='Projects';
    $('#importBtn').hidden=true;
    $('#mobileMenuBtn').innerHTML=A.icon('i-more');$('#mobileMenuBtn').setAttribute('aria-label','Project menu');$('#mobileMenuBtn').title='Project menu';
    $('#mobileMenuPopover').setAttribute('aria-label','Project actions');
    $('#menuHelp').onclick=()=>{$('#mobileMenuPopover').classList.remove('show');$('#helpBtn').click();};
    $('#menuObjects').onclick=()=>{$('#mobileMenuPopover').classList.remove('show');showLibrary('objects');};
    const exportDialog=dialog('studioExport','Export & print','<div id="exportOptions"></div>');
    const planning=$('#planningTools');planning.querySelector('details').open=true;$('#exportOptions').append(planning);
    planning.querySelector('summary').hidden=true;planning.querySelector('#traceRoomsBtn').hidden=true;
    const floorView=$('#floorViewMode');const viewControls=create('div','studio-floor-display');viewControls.append(floorView);nav.append(viewControls);
    planning.prepend(commandButton('Project file · JSON',A.exportProject,'i-download'));$('#exportBtn').onclick=()=>exportDialog.open();$('#menuExport').onclick=()=>{$('#mobileMenuPopover').classList.remove('show');exportDialog.open();};
    const calculation=commandButton('Structural calculations · JSON',()=>{const report=A.engineeringReport(A.state.project,!!A.state.structuralReport?.dynamic),url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='atelier-structural-calculations.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'i-download');planning.append(calculation);
    const tabs=create('div','property-tabs');tabs.id='propertyTabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Property sheets');$('#inspectorPanel').insertBefore(tabs,$('#inspectorBody'));
    const selectionActions=create('div','selection-actions');selectionActions.id='selectionActions';selectionActions.setAttribute('aria-label','Selected object actions');$('#inspectorPanel').insertBefore(selectionActions,$('#inspectorBody'));
    const back=create('button','button inspector-back','← Selected object');back.id='inspectorBack';back.onclick=openProperties;$('#inspectorPanel .panel-head').append(back);
    const libtabs=create('div','library-tabs','<button role="tab" class="active" data-library="library" aria-selected="true">Library</button><button role="tab" data-library="objects" aria-selected="false">Objects</button>');libtabs.id='libraryTabs';libtabs.setAttribute('role','tablist');libtabs.setAttribute('aria-label','Library panels');$('#catalogPanel .panel-head').after(libtabs);libtabs.querySelectorAll('button').forEach(b=>b.onclick=()=>showLibrary(b.dataset.library));
    const tree=create('div','studio-tree','<div class="catalog-search"><input id="treeSearch" aria-label="Search objects on this floor" placeholder="Find an object…"></div><div id="studioObjectList"></div>');$('#catalogPanel').append(tree);$('#catalogPanel').dataset.page='library';$('#treeSearch').oninput=()=>renderTree(true);
    $('#catalogSearch').placeholder='Search objects…';$('#catalogSearch').setAttribute('aria-label','Search object library');$('#categorySelect').parentElement.style.display='block';$('#categorySelect').previousElementSibling?.removeAttribute('hidden');
    $('#catalogPanel .eyebrow').textContent='Build & organize';$('#catalogPanel .panel-title').textContent='Object library';$('#inspectorPanel .eyebrow').textContent='Properties & review';
    const status=create('span','studio-selection');status.id='studioSelection';$('.status').append(status);
    // One-click switching: desktop docks, tablet side panel, mobile full-width sheets.
    A.setMobileTab=tab=>{ws.dataset.mobileTab=tab;A.$$('.mobile-tab').forEach(b=>{const on=b.dataset.nav===tab;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});if(tab==='stage'){A.resizeCanvas();window.atelier3D?.resize();}syncShell();};
    window.setMobileTab=A.setMobileTab;
    A.toggleDesktopPanel=panel=>{if(medium()){A.setMobileTab(ws.dataset.mobileTab===panel?'stage':panel);return;}ws.classList.toggle(panel==='catalog'?'hide-catalog':'hide-inspector');A.resizeCanvas();window.atelier3D?.resize();syncShell();};
    $('#tabBtnCatalog').onclick=()=>showLibrary('library');$('#tabBtnInspector').onclick=()=>{if(medium()&&ws.dataset.mobileTab==='inspector')A.setMobileTab('stage');else showPanel('inspector');};
    $('#closeCatalogBtn').onclick=()=>{if(medium())A.setMobileTab('stage');else{ws.classList.add('hide-catalog');syncShell();}};
    $('#closeInspectorBtn').onclick=()=>{if(medium())A.setMobileTab('stage');else{ws.classList.add('hide-inspector');syncShell();}};
    $('#mobNavCanvas').onclick=()=>A.setMobileTab('stage');$('#mobNavCatalog').onclick=()=>showLibrary(A.state.workspace==='structure'?'objects':'library');$('#mobNavInspector').onclick=()=>showPanel('inspector');
    $('#mobNavHelp').querySelector('span').textContent='Objects';$('#mobNavHelp').querySelector('use').setAttribute('href','#i-search');$('#mobNavHelp').onclick=()=>showLibrary('objects');
    $('#mobNavFloors').hidden=true;$('#chipEditBtn').onclick=openProperties;
    $('#studioFloor').onchange=e=>{const p=A.state.project;p.activeFloor=Number(e.target.value);A.state.selected=null;A.state.selectedIds.clear();A.state.inspectorMode=null;A.syncUI();A.fitPlan();A.queueSave();};$('#studioAddFloor').onclick=A.openFloorModal;
    window.addEventListener('atelier:walk-change',syncShell);
    const oldSelect=A.select;A.select=id=>{A.state.inspectorMode=null;oldSelect(id);if(!A.readOnly&&!medium()&&id)showPanel('inspector');prepareInspector();};
    const oldStructuralSelect=A.selectStructural;A.selectStructural=id=>{A.state.inspectorMode=null;oldStructuralSelect(id);prepareInspector();};
    const oldInspector=A.renderInspector;A.renderInspector=()=>{oldInspector();prepareInspector();};
    const oldDraw=A.draw;A.draw=()=>{oldDraw();if(!(A.state.pointerBackup&&(A.state.interaction?.activated||A.state.nudgeActive)))syncShell();};
    const oldQueue=A.queueSave;A.queueSave=()=>{oldQueue();syncShell();};
    const oldWorkspace=A.setWorkspace;A.setWorkspace=next=>{A.state.inspectorMode=null;oldWorkspace(next);A.setMobileTab('stage');showLibraryContext();prepareInspector();};
    const oldView=A.setView;A.setView=next=>{A.state.inspectorMode=next==='3d'?'project':null;oldView(next);A.setMobileTab('stage');prepareInspector();};
    const oldTool=A.setTool;A.setTool=next=>{if(A.state.workspace==='structure'&&!['select','pan','column','beam'].includes(next)){A.showToast('Use the structural creation tools above the canvas');return;}oldTool(next);if(medium())A.setMobileTab('stage');syncShell();};
    // Local editor callbacks also rerender the body. Observe only its immediate child replacement.
    new MutationObserver(()=>{if($('#inspectorBody').firstElementChild&&!$('#inspectorBody').firstElementChild.dataset.sheet&&!$('#inspectorBody').firstElementChild.hasAttribute('data-structural-editor'))prepareInspector();else if($('#inspectorBody [data-structural-editor]')?.firstElementChild&&!$('#inspectorBody [data-structural-editor]').firstElementChild.dataset.sheet)prepareInspector();}).observe($('#inspectorBody'),{childList:true});
    $('#inspectorBack').hidden=true;
    const sheetObserver=new MutationObserver(()=>{$('#inspectorBack').hidden=A.state.inspectorMode!=='project'||(!A.state.selected&&A.state.workspace!=='structure');$('#inspectorBack').textContent=A.state.workspace==='structure'&&!A.state.selected?'← Structure properties':'← Selected object';});sheetObserver.observe($('#inspectorBody'),{childList:true});
    const palette=dialog('commandPalette','Search commands','<input id="commandSearch" aria-label="Search commands and objects" placeholder="Search tools, workspaces, objects…" autocomplete="off"><div id="commandResults"></div><p class="studio-note">↑ ↓ to choose · Enter to run · Esc to close · Alt 1–4 switches workspace</p>');
    const commands=()=>[
      {label:'Project settings · front side, site, labels & location',run:openProjectSettings},
      ...[['architecture','Architecture'],['structure','Structure'],['services','Services'],['3d','3D view']].map(([id,label])=>({label:'Workspace: '+label,run:()=>id==='3d'?A.setView('3d'):A.setWorkspace(id)})),
      ...[['room','Draw room'],['wall','Draw wall'],['roof','Draw roof'],['dimension','Draw dimension'],['select','Select'],['pan','Pan']].map(([id,label])=>({label,run:()=>{A.setWorkspace('architecture');A.setTool(id);}})),
      {label:'Open object library',run:()=>showLibrary('library')},{label:'Find objects on this floor',run:()=>showLibrary('objects')},{label:'Properties',run:openProperties},{label:'Export & print',run:()=>exportDialog.open()},{label:'Save project',run:A.saveProject},{label:'Projects & recovery',run:A.openLibrary},{label:'Add floor',run:A.openFloorModal},{label:'Manage floors · delete, order & elevation',run:A.openFloorModal},{label:'Fit drawing',run:A.fitPlan},{label:'Help & shortcuts',run:()=>$('#helpBtn').click()},
      ...A.allEntities().map(o=>({label:'Object: '+(o.name||o.tag||o.type),run:()=>{A.select(o.id);showPanel('inspector');}}))
    ];
    let matches=[],choice=0;
    const paintCommands=()=>{const query=$('#commandSearch').value.toLowerCase();matches=commands().filter(c=>c.label.toLowerCase().includes(query)).slice(0,30);choice=0;$('#commandResults').innerHTML=matches.map((c,i)=>`<button class="command-result ${i===choice?'active':''}" data-command="${i}">${esc(c.label)}<span>↵</span></button>`).join('')||'<div class="studio-empty">No matching command or object.</div>';$('#commandResults').querySelectorAll('button').forEach(b=>b.onclick=()=>{const c=matches[Number(b.dataset.command)];palette.close();c.run();});};
    $('#commandBtn').onclick=()=>{palette.open();$('#commandSearch').value='';paintCommands();};$('#commandSearch').oninput=paintCommands;
    for(const [label,run] of [['Search commands',()=>$('#commandBtn').click()],['Redo last change',A.redo]]){const item=commandButton(label,()=>{$('#mobileMenuPopover').classList.remove('show');run();});item.className='menu-item';$('#mobileMenuPopover').append(item);}
    $('#commandSearch').onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();choice=(choice+(e.key==='ArrowDown'?1:-1)+matches.length)%Math.max(1,matches.length);$('#commandResults').querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===choice));$('#commandResults').children[choice]?.scrollIntoView({block:'nearest'});}if(e.key==='Enter'&&matches[choice]){e.preventDefault();palette.close();matches[choice].run();}};
    document.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopImmediatePropagation();$('#commandBtn').click();return;}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopImmediatePropagation();A.saveProject();return;}
      if(e.altKey&&['1','2','3','4'].includes(e.key)&&!$('.modal-backdrop.show')){e.preventDefault();e.stopImmediatePropagation();const id=['architecture','structure','services','3d'][Number(e.key)-1];id==='3d'?A.setView('3d'):A.setWorkspace(id);return;}
      const nav=e.target.closest?.('.view-switch,.property-tabs,.library-tabs');if(nav&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();const buttons=[...nav.querySelectorAll('button')].filter(b=>!b.hidden),i=buttons.indexOf(e.target),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();(nav.classList.contains('property-tabs')?$('#propertyTabs').querySelectorAll('button')[next]:buttons[next])?.focus();}
      if(e.key==='Escape'&&$('#mobileMenuPopover').classList.contains('show')){$('#mobileMenuPopover').classList.remove('show');$('#mobileMenuBtn').focus();e.preventDefault();e.stopImmediatePropagation();}
    },true);
    A.studioUI={showLibrary,showPanel,chooseSheet,openExport:()=>exportDialog.open(),sync:syncShell};
    A.$$('[data-workspace]').forEach(b=>b.onclick=()=>A.setWorkspace(b.dataset.workspace));
    A.renderInspector();A.setMobileTab('stage');syncShell();A.resizeCanvas();setTimeout(A.fitPlan,100);
  }
  function showLibraryContext(){
    if(A.state.workspace==='structure'){showLibrary('objects',false);return;}
    showLibrary('library',false);
    // Keep both plumbing and electrical fixtures discoverable in Services.
    A.renderCatalog($('#catalogSearch').value,'all');
    if(A.state.workspace==='services'){
      $('#objectGrid').querySelectorAll('[data-object]').forEach(el=>{el.hidden=!A.CATALOG.find(o=>o.type===el.dataset.object)?.system;});
      $('#objectGrid').querySelectorAll('.cat-group-head').forEach(el=>{el.hidden=![...el.nextElementSibling.children].some(card=>!card.hidden);});
    }
  }
  Object.assign(A,{initStudioUI,openProjectSettings,openStructureCopy});
})();
