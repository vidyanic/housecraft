(function(){
  'use strict';const A=window.Atelier;
  const key=()=>A.storagePrefix+'library';
  function readLibrary(){try{return JSON.parse(localStorage.getItem(key()))||{projects:[],archived:[]};}catch{return {projects:[],archived:[]};}}
  function storeLibrary(library){localStorage.setItem(key(),JSON.stringify(library));}
  function recordProject(){
    const p=A.state.project;p.projectId ||= A.uid();const library=readLibrary();let row=library.projects.find(r=>r.id===p.projectId);
    if(!row){row={id:p.projectId,name:p.name,snapshots:[]};library.projects.unshift(row);}
    const serialized=JSON.stringify(p);
    if(row.project&&JSON.stringify(row.project)!==serialized){row.snapshots.unshift({date:row.updated,project:row.project});row.snapshots=row.snapshots.slice(0,5);}
    row.project=JSON.parse(serialized);row.name=p.name;row.updated=new Date().toISOString();
    library.projects.sort((a,b)=>b.updated.localeCompare(a.updated));storeLibrary(library);
  }
  function replaceProject(p){
    const normalized=A.normalizeProject(A.validateProject(p));
    clearTimeout(A.state.saveTimer);A.state.editSession=null;A.checkpoint();
    A.state.project=normalized;A.state.selected=null;A.state.selectedIds.clear();A.syncUI();A.fitPlan();A.saveProject();
  }
  function openLibrary(){A.saveProject();renderLibrary();A.$('#projectLibraryModal').classList.add('show');}
  function renderLibrary(){
    const library=readLibrary(),body=A.$('#projectLibraryBody');
    body.innerHTML='<h3>Recent projects</h3>'+library.projects.map(row=>`<article class="project-card"><strong>${A.escapeHtml(row.name)}</strong><small>${new Date(row.updated).toLocaleString()}</small><div class="quick-actions"><button data-open="${row.id}">Open</button><button data-copy="${row.id}">Duplicate</button><button data-archive="${row.id}">Archive</button></div><details><summary>Recovery snapshots (${row.snapshots.length})</summary>${row.snapshots.map((snapshot,i)=>`<button class="button" data-recover="${row.id}" data-index="${i}">Restore ${new Date(snapshot.date).toLocaleString()}</button>`).join('')}</details></article>`).join('')+
      (library.archived.length?'<h3>Archived projects</h3>'+library.archived.map(row=>`<article class="project-card"><strong>${A.escapeHtml(row.name)}</strong><button class="button" data-restore="${row.id}">Restore project</button></article>`).join(''):'');
    body.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{replaceProject(library.projects.find(r=>r.id===b.dataset.open).project);A.$('#projectLibraryModal').classList.remove('show');});
    body.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{const p=A.deep(library.projects.find(r=>r.id===b.dataset.copy).project);p.projectId=A.uid();p.name+=' copy';replaceProject(p);renderLibrary();});
    body.querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>{const row=library.projects.find(r=>r.id===b.dataset.archive);if(row.id===A.state.project.projectId){A.showToast('Open another project before archiving the current one');return;}library.projects=library.projects.filter(r=>r!==row);library.archived.unshift(row);storeLibrary(library);renderLibrary();});
    body.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{const row=library.archived.find(r=>r.id===b.dataset.restore);library.archived=library.archived.filter(r=>r!==row);library.projects.unshift(row);storeLibrary(library);renderLibrary();});
    body.querySelectorAll('[data-recover]').forEach(b=>b.onclick=()=>{const row=library.projects.find(r=>r.id===b.dataset.recover);replaceProject(row.snapshots[Number(b.dataset.index)].project);A.$('#projectLibraryModal').classList.remove('show');A.showToast('Recovery snapshot restored; previous work retained');});
  }
  function newProject(){const p=A.deep(A.DEFAULT);p.projectId=A.uid();p.name='Untitled project';p.floors=[{id:A.uid(),name:'Ground floor',elevation:0,rooms:[],walls:[],items:[],dimensions:[],columns:[],beams:[]}];p.activeFloor=0;p.camera.allFloors=false;p.layoutValidated=true;replaceProject(p);A.$('#projectLibraryModal').classList.remove('show');}
  Object.assign(A,{readLibrary,recordProject,replaceProject,openLibrary,newProject});
})();
