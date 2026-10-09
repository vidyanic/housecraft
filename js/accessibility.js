(function(){
 'use strict';const A=window.Atelier;let sequence=0;
 function enhance(){
   document.querySelectorAll('.field label').forEach(label=>{const input=label.closest('.field').querySelector('input,select');if(input&&!label.htmlFor){input.id ||= 'field-'+(++sequence);label.htmlFor=input.id;}});
   document.querySelectorAll('.switch').forEach(el=>{el.setAttribute('role','switch');el.setAttribute('aria-checked',String(el.classList.contains('on')));el.tabIndex=0;el.setAttribute('aria-label',el.closest('.toggle-row')?.querySelector('span')?.textContent||'Toggle setting');});
   document.querySelectorAll('.modal-backdrop .modal').forEach(el=>{el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',el.querySelector('h2,h3')?.textContent||'Dialog');});
   A.$('#saveState').setAttribute('role','status');A.$('#saveState').setAttribute('aria-live','polite');
   const o=A.findEntity(A.state.selected);if(o?.boundaryWallIds)A.$$('#inspectorBody [data-key]').forEach(input=>{if(['x','y','w','d'].includes(input.dataset.key))input.disabled=true;});
 }
 function renderObjectList(){const filter=A.$('#objectSearch').value.toLowerCase(),body=A.$('#objectList');body.innerHTML=A.allEntities().filter(o=>(o.name||o.tag||o.type).toLowerCase().includes(filter)).map(o=>`<button class="object-list-row" data-entity="${o.id}"><span>${A.escapeHtml(o.name||o.tag||o.type)}</span><small>${A.escapeHtml(o.type)}</small></button>`).join('')||'<p>No matching objects.</p>';body.querySelectorAll('button').forEach(b=>b.onclick=()=>{A.select(b.dataset.entity);A.$('#objectsModal').classList.remove('show');A.setMobileTab('inspector');});}
 function initAccessibility(){
   enhance();new MutationObserver(enhance).observe(A.$('#inspectorBody'),{childList:true,subtree:true});
   document.addEventListener('keydown',e=>{
     const modal=document.querySelector('.modal-backdrop.show');
     if(modal){if(e.key==='Escape'){modal.classList.remove('show');e.preventDefault();e.stopImmediatePropagation();return;}
       if(e.key==='Tab'){const controls=[...modal.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first?.focus();e.preventDefault();}}
     }
     if(e.target.matches('.switch')&&[' ','Enter'].includes(e.key)){e.preventDefault();e.target.click();enhance();}
   },true);
   document.querySelectorAll('.modal-backdrop').forEach(modal=>{let opener;new MutationObserver(()=>{if(modal.classList.contains('show')){opener=document.activeElement;modal.querySelector('button,input,select')?.focus();}else opener?.focus();}).observe(modal,{attributes:true,attributeFilter:['class']});});
   document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>A.$('#'+b.dataset.close).classList.remove('show'));
   A.$('#objectsBtn').onclick=()=>{renderObjectList();A.$('#objectsModal').classList.add('show');};A.$('#objectSearch').oninput=renderObjectList;
   A.$('#planCanvas').setAttribute('aria-label','Floor plan canvas. Use Objects to select and edit entities with the keyboard.');
 }
 Object.assign(A,{initAccessibility,renderObjectList});
})();
