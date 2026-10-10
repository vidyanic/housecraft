/* Persistent editing shell; hover previews never change canvas bounds. */
(function(){
  'use strict';
  const A=window.Atelier;
  A.initCanvasSpace=function(){
    const $=A.$,app=$('.app'),ws=$('#workspace'),stage=$('#stage'),nav=$('.workspace-navigation'),project=$('.topbar'),tools=$('.studio-taskbar');
    document.body.classList.add('canvas-space');app.prepend(project);ws.append(tools);
    nav.append($('.level-picker'),$('.studio-floor-display'),$('.canvas-actions'));$('.crumb').hidden=true;
    const help=$('#helpBtn');help.className='icon-button';help.innerHTML=A.icon('i-help');help.setAttribute('aria-label','Help and shortcuts');help.title='Help and shortcuts';$('#commandBtn').after(help);
    $('#objectsBtn').hidden=true;
    const bottom=document.createElement('div');bottom.className='canvas-bottom';ws.append(bottom);bottom.append($('.zoom-controls'));
    const expand=document.createElement('button');expand.id='expandCanvas';expand.className='button';expand.textContent='⤢ Expand canvas';expand.setAttribute('aria-pressed','false');bottom.append(expand);
    const surfaces={catalog:$('#catalogPanel'),inspector:$('#inspectorPanel'),project,navigation:nav,tools};
    const pinned={catalog:innerWidth>=1100||innerWidth<700,inspector:innerWidth>=700,project:true,navigation:true,tools:true},timers={},handles={};let savedPins=null;
    function layout(){for(const key of Object.keys(pinned))app.dataset[key+'Visible']=String(pinned[key]);for(const key of ['catalog','inspector'])ws.classList.toggle('hide-'+key,!pinned[key]);}
    function hide(key,explicit=false){
      if(key==='tools')return;
      clearTimeout(timers[key]);if(!explicit&&(pinned[key]||surfaces[key].contains(document.activeElement)||$('.modal-backdrop.show')))return;
      if(explicit)pinned[key]=false;
      surfaces[key].classList.remove('space-open');surfaces[key].inert=true;handles[key].hidden=false;handles[key].setAttribute('aria-expanded','false');layout();
    }
    function show(key,mode='explicit'){
      clearTimeout(timers[key]);if(key==='tools')return;
      if(mode==='explicit'&&!document.body.classList.contains('canvas-focus'))pinned[key]=true;
      if(innerWidth<1100&&(key==='catalog'||key==='inspector'))hide(key==='catalog'?'inspector':'catalog',true);
      surfaces[key].inert=false;surfaces[key].classList.add('space-open');handles[key].hidden=!!pinned[key];handles[key].setAttribute('aria-expanded','true');layout();A.studioUI.sync();
    }
    function later(key){clearTimeout(timers[key]);timers[key]=setTimeout(()=>hide(key),450);}
    for(const [key,node] of Object.entries(surfaces)){
      if(!node.id)node.id='space-'+key;
      if(key==='tools'){node.inert=false;node.classList.add('space-open');continue;}
      const handle=document.createElement('button');handle.className='space-handle space-'+key;handle.id='reveal-'+key;handle.textContent={catalog:'Library',inspector:'Properties',project:'Project',navigation:'Workspace'}[key];handle.setAttribute('aria-controls',node.id);handle.setAttribute('aria-expanded','false');handles[key]=handle;ws.append(handle);
      handle.onclick=e=>{show(key);if(e.detail===0)node.querySelector('button,input,select')?.focus();};
      const hover=e=>{if(e.pointerType==='mouse'&&matchMedia('(hover:hover)').matches)show(key,'hover');};
      handle.addEventListener('pointerenter',hover);node.addEventListener('pointerenter',hover);handle.addEventListener('pointerleave',()=>later(key));node.addEventListener('pointerleave',()=>later(key));node.addEventListener('focusout',()=>later(key));node.addEventListener('focusin',()=>clearTimeout(timers[key]));
      if(key==='project'||key==='navigation'){const close=document.createElement('button');close.className='icon-button chrome-hide';close.innerHTML='−';close.title='Hide '+(key==='project'?'project bar':'workspace bar');close.setAttribute('aria-label',close.title);close.onclick=()=>{hide(key,true);handle.focus();};node.append(close);}
      node.classList.toggle('space-open',pinned[key]);node.inert=!pinned[key];handle.hidden=pinned[key];
    }
    function focus(on){
      if(on){savedPins={...pinned};for(const key of Object.keys(handles))hide(key,true);}
      document.body.classList.toggle('canvas-focus',on);expand.textContent=on?'↙ Restore workspace':'⤢ Expand canvas';expand.setAttribute('aria-pressed',String(on));
      if(!on&&savedPins){Object.assign(pinned,savedPins);for(const key of Object.keys(handles)){surfaces[key].classList.toggle('space-open',pinned[key]);surfaces[key].inert=!pinned[key];handles[key].hidden=pinned[key];handles[key].setAttribute('aria-expanded',String(pinned[key]));}savedPins=null;}
      layout();requestAnimationFrame(()=>{A.resizeCanvas();window.atelier3D?.resize();});
    }
    expand.onclick=()=>focus(!document.body.classList.contains('canvas-focus'));
    A.canvasSpace={showPanel:show,hidePanel:hide,focus};
    A.setMobileTab=key=>{if(key!=='stage')show(key);};window.setMobileTab=A.setMobileTab;
    A.toggleDesktopPanel=key=>pinned[key]?hide(key,true):show(key);
    for(const [key,id] of [['catalog','closeCatalogBtn'],['inspector','closeInspectorBtn']]){const close=$('#'+id);close.title='Hide '+(key==='catalog'?'Library':'Properties');close.setAttribute('aria-label',close.title);close.onclick=()=>{hide(key,true);handles[key].focus();};}
    document.addEventListener('keydown',e=>{if(e.key!=='Escape'||$('.modal-backdrop.show'))return;const key=Object.keys(handles).find(k=>surfaces[k].contains(e.target));if(key&&!pinned[key]){hide(key,true);handles[key].focus();e.preventDefault();e.stopImmediatePropagation();}else if(document.body.classList.contains('canvas-focus')){focus(false);expand.focus();e.preventDefault();}},true);
    matchMedia('(max-width:1099px)').addEventListener('change',e=>{if(e.matches&&pinned.catalog&&pinned.inspector)hide('catalog',true);});
    layout();A.resizeCanvas();setTimeout(A.fitPlan,120);
  };
})();
