/** Adaptive studio shell. Existing editors retain their validation and undo handlers. */
(function () {
  'use strict';
  const A=window.Atelier, $=A.$, esc=A.escapeHtml;
  let initialized=false, inspectorKey='', inspectorSelection='', activeSheet='', treeSignature='', contextKey='';
  const create=(tag,cls,html='')=>{const el=document.createElement(tag);el.className=cls;el.innerHTML=html;return el;};
  const button=(label,id,icon)=>`<button class="button" id="${id}">${icon?A.icon(icon):''}<span>${label}</span></button>`;
  const medium=()=>innerWidth<1200;
  function showPanel(panel){
    const ws=$('#workspace');ws.classList.remove(panel==='catalog'?'hide-catalog':'hide-inspector');
    A.setMobileTab(panel);A.resizeCanvas();window.atelier3D?.resize();syncShell();
  }
  function showLibrary(page='library'){
    $('#catalogPanel').dataset.page=page;
    $('#libraryTabs').querySelectorAll('button').forEach(b=>{const on=b.dataset.library===page;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
    $('#catalogPanel .panel-title').textContent=page==='library'?'Object library':'Objects on this floor';
    $('#treeSearch').value='';renderTree(true);showPanel('catalog');
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
    const tabs=struct?[...(selected?[['member','Member']]:[]),['model','Model'],['basis','Basis'],['review','Review'],['results','Results']]:key==='3d'?[['view','View'],['sun','Sun'],['project','Project'],...(selected?[['properties','Object']]:[])]:selected?[['properties','Properties'],['checks','Checks'],['project','Project']]:[['project','Project'],['checks','Checks']];
    if(key!==inspectorKey||selected&&inspectorSelection!==A.state.selected){activeSheet=struct?(selected?'member':'model'):key==='3d'?(selected?'properties':'view'):selected?'properties':'project';inspectorKey=key;}
    inspectorSelection=selected?A.state.selected:'';
    if(!tabs.some(t=>t[0]===activeSheet))activeSheet=tabs[0][0];
    const root=struct?body.firstElementChild:body;
    [...root.children].forEach(el=>{
      const name=sectionName(el);let sheet;
      if(struct){sheet=el.id==='structEntity'?'member':name.includes('design basis')?'basis':name.includes('propos')?'review':name.includes('calculation results')?'results':'model';if(el.querySelector('#structAnalyze')||name.startsWith('schedule'))el.dataset.studioToolbar='true';}
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
    if(['project','view','sun'].includes(key)&&A.state.selected&&A.state.inspectorMode!=='project'&&['selection','3d'].includes(inspectorKey)){
      A.state.inspectorMode='project';activeSheet=key;A.renderInspector();return;
    }
    activeSheet=key;applySheet();$('#inspectorBody').scrollTop=0;
    if(key==='basis'){const d=$('#structBasis')?.closest('details');if(d)d.open=true;}
  }
  function openProperties(){A.state.inspectorMode=null;A.renderInspector();showPanel('inspector');}
  function syncShell(){
    if(!initialized)return;
    const s=A.state,ws=$('#workspace'),discipline=s.viewMode==='3d'?'3d':s.workspace||'architecture';
    document.body.dataset.studioView=discipline;
    // One breakpoint policy for both direct panel buttons and close actions.
    const panel=ws.dataset.mobileTab||'stage';
    $('#tabBtnCatalog').classList.toggle('active',!ws.classList.contains('hide-catalog')&&(!medium()||panel==='catalog'));
    $('#tabBtnInspector').classList.toggle('active',!ws.classList.contains('hide-inspector')&&(!medium()||panel==='inspector'));
    $('#tabBtnCatalog').setAttribute('aria-pressed',String($('#tabBtnCatalog').classList.contains('active')));
    $('#tabBtnInspector').setAttribute('aria-pressed',String($('#tabBtnInspector').classList.contains('active')));
    const k=[discipline,s.selected,!!s.structuralReport,s.tool].join(':');
    if(k!==contextKey){contextKey=k;renderContext(discipline);}
    const select=$('#studioFloor');const signature=s.project.floors.map(f=>f.id+f.name).join('|');
    if(select.dataset.signature!==signature){select.innerHTML=s.project.floors.map((f,i)=>`<option value="${i}">${esc(f.name)}</option>`).join('');select.dataset.signature=signature;}
    select.value=s.project.activeFloor;
    $('#undoBtn').disabled=!s.history.length;$('#redoBtn').disabled=!s.future.length;
    $('.view-switch').querySelectorAll('button').forEach(b=>{const on=b.dataset.view==='3d'?discipline==='3d':b.dataset.workspace===discipline;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
    $('#studioSelection').textContent=A.findEntity(s.selected)?.name||A.findEntity(s.selected)?.tag||(s.selectedIds.size>1?s.selectedIds.size+' selected':'No selection');
    const selected=A.findEntity(s.selected),actions=$('#selectionActions');actions.hidden=!s.selected||s.inspectorMode==='project';
    if(actions.dataset.selection!==s.selected){actions.dataset.selection=s.selected||'';actions.replaceChildren();if(selected&&!['column','beam','slab','load','structural-wall'].includes(selected.type)){actions.append(commandButton('Duplicate',A.duplicateSelected,'i-cube'));if(A.floor().items.includes(selected))actions.append(commandButton('Rotate',A.rotateSelected,'i-undo'));}actions.append(commandButton('Delete',A.deleteSelected,'i-close'));}
    renderTree();
  }
  function commandButton(label,action,icon){const el=create('button','task-button',icon?A.icon(icon)+'<span>'+label+'</span>':label);el.onclick=action;return el;}
  function renderContext(discipline){
    const tools=$('#toolrail'),commands=$('#contextCommands');commands.replaceChildren();
    tools.querySelectorAll('[data-tool]').forEach(b=>{const t=b.dataset.tool;b.hidden=discipline==='3d'||discipline==='structure'&&!['select','pan'].includes(t)||discipline==='services'&&!['select','pan','dimension'].includes(t)||discipline==='architecture'&&['column','beam'].includes(t);b.setAttribute('aria-pressed',String(t===A.state.tool));});
    if(discipline==='structure'){
      for(const [type,label] of [['column','Column'],['beam','Beam'],['slab','Slab'],['structural-wall','RC wall'],['load','Load'],['grid','Grid']])commands.append(commandButton(label,()=>A.addStructuralObject(type),'i-'+(type==='column'?'pillar':type==='beam'?'beam':'grid')));
      commands.append(commandButton('Screening',()=>{$('#structAnalyze')?.click();activeSheet='results';prepareInspector();showPanel('inspector');}));
      commands.append(commandButton('Modal analysis',()=>{$('#structDynamic')?.click();activeSheet='results';prepareInspector();showPanel('inspector');}));
    }else if(discipline==='architecture')commands.append(commandButton('Trace rooms',A.deriveRooms,'i-room'));
    else if(discipline==='services'){
      for(const [type,label] of [['cold-water-pipe','Water pipe'],['waste-pipe','Drain'],['electrical-wire','Wiring']]){const spec=A.CATALOG.find(o=>o.type===type);if(spec)commands.append(commandButton(label,()=>A.addObjectToPlan(type),'i-dimension'));}
      commands.append(commandButton('All services',()=>showLibrary('library'),'i-catalog'));
      const o=A.findEntity(A.state.selected);if(o&&A.isServiceRoute(o))commands.append(commandButton('Draw route',()=>A.startServiceRoute(o),'i-dimension'));
    }else for(const [preset,label] of [['dollhouse','Dollhouse'],['top','Top'],['front','Front']])commands.append(commandButton(label,()=>A.setCameraPreset(preset),'i-cube'));
  }
  function dialog(id,title,content){
    const backdrop=create('div','modal-backdrop');backdrop.id=id;backdrop.dataset.studioDialog='true';
    backdrop.innerHTML=`<div class="modal studio-dialog" role="dialog" aria-modal="true" aria-labelledby="${id}-title"><div class="modal-header"><div><div class="eyebrow">Atelier Plan</div><h2 id="${id}-title">${title}</h2></div><button class="button" data-studio-close="${id}" aria-label="Close ${title}">Close</button></div>${content}</div>`;
    document.body.append(backdrop);let opener;
    const close=()=>{backdrop.classList.remove('show');opener?.focus();};backdrop.querySelector('[data-studio-close]').onclick=close;
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
    backdrop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}if(e.key==='Tab'){const els=[...backdrop.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.getClientRects().length),first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});
    return {el:backdrop,open(){opener=document.activeElement;if(opener===document.body||!opener?.getClientRects().length)opener=$('#mobileMenuBtn');backdrop.classList.add('show');backdrop.querySelector('input,select,button')?.focus();},close};
  }
  function initStudioUI(){
    initialized=true;document.body.classList.add('studio');
    const app=$('.app'),ws=$('#workspace');
    const nav=create('div','workspace-navigation',`<div class="level-picker"><label for="studioFloor">Floor</label><select id="studioFloor"></select><button class="button" id="studioAddFloor" aria-label="Add floor" title="Add floor">+</button></div>`);
    nav.prepend($('.view-switch'));app.insertBefore(nav,ws);$('.view-switch').setAttribute('role','tablist');$('.view-switch').setAttribute('aria-label','Workspaces');$('.view-switch').querySelectorAll('button').forEach(b=>b.setAttribute('role','tab'));
    const tasks=create('div','studio-taskbar','<div id="contextCommands" class="context-commands"></div><div class="task-panel-actions"></div>');tasks.prepend($('#toolrail'));tasks.lastElementChild.append($('#panelSwitchTabs'));app.insertBefore(tasks,ws);
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
    const modelViewLabel=planning.querySelector('label[for="floorViewMode"]'),floorView=$('#floorViewMode');const viewControls=create('div','studio-floor-display');viewControls.append(modelViewLabel,floorView);nav.append(viewControls);
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
    const oldSelect=A.select;A.select=id=>{A.state.inspectorMode=null;oldSelect(id);if(!medium()&&id)showPanel('inspector');prepareInspector();};
    const oldStructuralSelect=A.selectStructural;A.selectStructural=id=>{A.state.inspectorMode=null;oldStructuralSelect(id);prepareInspector();};
    const oldInspector=A.renderInspector;A.renderInspector=()=>{oldInspector();prepareInspector();};
    const oldDraw=A.draw;A.draw=()=>{oldDraw();syncShell();};
    const oldQueue=A.queueSave;A.queueSave=()=>{oldQueue();syncShell();};
    const oldWorkspace=A.setWorkspace;A.setWorkspace=next=>{A.state.inspectorMode=null;oldWorkspace(next);A.setMobileTab('stage');showLibraryContext();prepareInspector();};
    const oldView=A.setView;A.setView=next=>{A.state.inspectorMode=next==='3d'?'project':null;oldView(next);A.setMobileTab('stage');prepareInspector();};
    const oldTool=A.setTool;A.setTool=next=>{if(A.state.workspace==='structure'&&!['select','pan'].includes(next)){A.showToast('Use the structural creation tools above the canvas');return;}oldTool(next);if(medium())A.setMobileTab('stage');syncShell();};
    // Local editor callbacks also rerender the body. Observe only its immediate child replacement.
    new MutationObserver(()=>{if($('#inspectorBody').firstElementChild&&!$('#inspectorBody').firstElementChild.dataset.sheet&&!$('#inspectorBody').firstElementChild.hasAttribute('data-structural-editor'))prepareInspector();else if($('#inspectorBody [data-structural-editor]')?.firstElementChild&&!$('#inspectorBody [data-structural-editor]').firstElementChild.dataset.sheet)prepareInspector();}).observe($('#inspectorBody'),{childList:true});
    $('#inspectorBack').hidden=true;
    const sheetObserver=new MutationObserver(()=>{$('#inspectorBack').hidden=A.state.inspectorMode!=='project'||!A.state.selected;});sheetObserver.observe($('#inspectorBody'),{childList:true});
    const palette=dialog('commandPalette','Search commands','<input id="commandSearch" aria-label="Search commands and objects" placeholder="Search tools, workspaces, objects…" autocomplete="off"><div id="commandResults"></div><p class="studio-note">↑ ↓ to choose · Enter to run · Esc to close · Alt 1–4 switches workspace</p>');
    const commands=()=>[
      ...[['architecture','Architecture'],['structure','Structure'],['services','Services'],['3d','3D view']].map(([id,label])=>({label:'Workspace: '+label,run:()=>id==='3d'?A.setView('3d'):A.setWorkspace(id)})),
      ...[['room','Draw room'],['wall','Draw wall'],['roof','Draw roof'],['dimension','Draw dimension'],['select','Select'],['pan','Pan']].map(([id,label])=>({label,run:()=>{A.setWorkspace('architecture');A.setTool(id);}})),
      {label:'Open object library',run:()=>showLibrary('library')},{label:'Find objects on this floor',run:()=>showLibrary('objects')},{label:'Properties',run:openProperties},{label:'Export & print',run:()=>exportDialog.open()},{label:'Save project',run:A.saveProject},{label:'Projects & recovery',run:A.openLibrary},{label:'Add floor',run:A.openFloorModal},{label:'Fit drawing',run:A.fitPlan},{label:'Help & shortcuts',run:()=>$('#helpBtn').click()},
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
    if(A.state.workspace==='structure'){showLibrary('objects');A.setMobileTab('stage');return;}
    showLibrary('library');A.setMobileTab('stage');
    // Keep both plumbing and electrical fixtures discoverable in Services.
    A.renderCatalog($('#catalogSearch').value,'all');
    if(A.state.workspace==='services'){
      $('#objectGrid').querySelectorAll('[data-object]').forEach(el=>{el.hidden=!A.CATALOG.find(o=>o.type===el.dataset.object)?.system;});
      $('#objectGrid').querySelectorAll('.cat-group-head').forEach(el=>{el.hidden=![...el.nextElementSibling.children].some(card=>!card.hidden);});
    }
  }
  Object.assign(A,{initStudioUI});
})();
