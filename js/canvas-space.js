/* Revealed controls are overlays: they never change the drawing surface bounds. */
(function(){
  'use strict';
  const A=window.Atelier;
  A.initCanvasSpace=function(){
    const $=A.$,ws=$('#workspace'),stage=$('#stage'),nav=$('.workspace-navigation');
    document.body.classList.add('canvas-space');
    const bottom=document.createElement('div');bottom.className='canvas-bottom';stage.append(bottom);
    bottom.append($('.level-picker'),$('.studio-floor-display'),$('.zoom-controls'));
    const expand=document.createElement('button');expand.id='expandCanvas';expand.className='button';expand.textContent='⤢ Expand canvas';expand.setAttribute('aria-pressed','false');bottom.append(expand);
    const surfaces={catalog:$('#catalogPanel'),inspector:$('#inspectorPanel'),project:$('.topbar'),tools:$('.studio-taskbar')};
    ws.append(surfaces.project);stage.append(surfaces.tools);
    const timers={},handles={},revealMode={};
    function hide(key,force=false){
      clearTimeout(timers[key]);
      if(!force&&$('.modal-backdrop.show'))return;
      if(!force&&surfaces[key].contains(document.activeElement))return;
      surfaces[key].classList.remove('space-open');surfaces[key].inert=true;handles[key].setAttribute('aria-expanded','false');
      if(key==='project')nav.classList.remove('space-open');
      if(key==='catalog'||key==='inspector'){ws.classList.add('hide-'+key);ws.dataset.mobileTab='stage';}
    }
    function show(key,mode='explicit'){
      clearTimeout(timers[key]);
      if(!surfaces[key].classList.contains('space-open')||mode==='explicit')revealMode[key]=mode;
      if(key==='catalog'||key==='inspector'){
        hide(key==='catalog'?'inspector':'catalog',true);
        ws.classList.remove('hide-'+key);ws.dataset.mobileTab=key;
      }
      surfaces[key].inert=false;surfaces[key].classList.add('space-open');handles[key].setAttribute('aria-expanded','true');
      if(key==='project')nav.classList.add('space-open');
      A.studioUI.sync();
    }
    function later(key){clearTimeout(timers[key]);timers[key]=setTimeout(()=>hide(key),450);}
    for(const [key,node] of Object.entries(surfaces)){
      if(!node.id)node.id='space-'+key;
      const handle=document.createElement('button');handle.className='space-handle space-'+key;handle.id='reveal-'+key;handle.textContent={catalog:'Library',inspector:'Properties',project:'Project',tools:'Tools'}[key];
      handle.setAttribute('aria-controls',node.id);handle.setAttribute('aria-expanded','false');handles[key]=handle;
      (key==='project'?nav:stage).append(handle);
      handle.onclick=e=>{if(node.classList.contains('space-open')&&revealMode[key]!=='hover')hide(key,true);else{show(key);if(e.detail===0)node.querySelector('button,input,select')?.focus();}};
      // Hover is progressive enhancement. Touch uses the same explicit toggle.
      const hover=e=>{if(e.pointerType==='mouse'&&matchMedia('(hover:hover)').matches)show(key,'hover');};
      handle.addEventListener('pointerenter',hover);node.addEventListener('pointerenter',hover);
      handle.addEventListener('pointerleave',()=>later(key));node.addEventListener('pointerleave',()=>later(key));
      node.addEventListener('focusin',()=>show(key));node.addEventListener('focusout',()=>later(key));
      hide(key,true);
    }
    // Tools remain visible in the compact layout; focus mode hides all surfaces.
    show('tools');
    function focus(on){
      document.body.classList.toggle('canvas-focus',on);expand.textContent=on?'↙ Restore workspace':'⤢ Expand canvas';expand.setAttribute('aria-pressed',String(on));
      Object.keys(surfaces).forEach(key=>hide(key,true));if(!on)show('tools');
      requestAnimationFrame(()=>{A.resizeCanvas();window.atelier3D?.resize();});
    }
    expand.onclick=()=>focus(!document.body.classList.contains('canvas-focus'));
    const view=document.createElement('button');view.className='button focus-view-controls';view.textContent='View controls';view.setAttribute('aria-expanded','false');bottom.insertBefore(view,expand);
    view.onclick=()=>{const open=bottom.classList.toggle('bottom-open');view.setAttribute('aria-expanded',String(open));};
    A.canvasSpace={showPanel:show,hidePanel:hide,focus};
    A.setMobileTab=key=>key==='stage'?['catalog','inspector'].forEach(k=>hide(k,true)):show(key);
    window.setMobileTab=A.setMobileTab;
    A.toggleDesktopPanel=key=>surfaces[key].classList.contains('space-open')?hide(key,true):show(key);
    $('#closeCatalogBtn').onclick=()=>{hide('catalog',true);handles.catalog.focus();};
    $('#closeInspectorBtn').onclick=()=>{hide('inspector',true);handles.inspector.focus();};
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||$('.modal-backdrop.show'))return;
      const key=Object.keys(surfaces).find(k=>surfaces[k].contains(e.target));
      if(key){hide(key,true);handles[key].focus();e.preventDefault();e.stopImmediatePropagation();}
      else if(document.body.classList.contains('canvas-focus')){focus(false);expand.focus();e.preventDefault();}
    },true);
    A.resizeCanvas();
  };
})();
