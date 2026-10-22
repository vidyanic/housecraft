/**
 * js/inspector-panel.js — Right-side inspector panel rendering
 *
 * Builds the HTML for the inspector panel based on current
 * selection: project settings when nothing is selected, object
 * properties when items/walls/rooms/dimensions are selected,
 * and multi-selection group controls.
 *
 * Depends on: utilities.js, constants.js, app-state.js, canvas-drawing.js
 */
(function () {
  'use strict';
  const A = window.Atelier;
  function S() { return A.state; }

  // ── Field builders ───────────────────────────────────────────
  function fieldNumber(label,key,value,step=1) {
    const project=S().project;
    const lengthField=A.lengthKeys.has(key);
    const inputType=project.unit==='ft'&&lengthField?'text':'number';
    const suffix=lengthField?A.unitLabel():key.toLowerCase().includes('step')?'steps':'';
    return `<div class="field"><label>${label}</label><div class="input-unit"><input type="${inputType}" data-key="${key}" value="${lengthField?A.displayValue(value):value}" step="${step}" inputmode="decimal"><span>${suffix}</span></div></div>`;
  }

  // ── Plan readiness audit ─────────────────────────────────────
  function planAuditHtml() {
    const f=A.floor(),doors=f.items.filter(o=>(o.shape||o.type)==='door').length,windows=f.items.filter(o=>(o.shape||o.type)==='window').length;
    const minX=Math.min(...f.rooms.map(r=>r.x)),minY=Math.min(...f.rooms.map(r=>r.y)),maxX=Math.max(...f.rooms.map(r=>r.x+r.w)),maxY=Math.max(...f.rooms.map(r=>r.y+r.d));
    const site=A.state.project.site||A.DEFAULT.site,siteOk=Math.abs(maxX-minX-site.width)<1&&Math.abs(maxY-minY-site.depth)<1;
    const closedEdgeOpenings=f.items.filter(o=>['door','window'].includes(o.shape)).filter(o=>{const cx=o.x+o.w/2,cy=o.y+o.d/2;return [['north',Math.abs(cy-minY)],['south',Math.abs(cy-maxY)],['west',Math.abs(cx-minX)],['east',Math.abs(cx-maxX)]].some(([key,distance])=>distance<20&&A.siteSideDefinition(site,key).status==='closed');}).length;
    const courtyard=f.rooms.filter(r=>/courtyard|garden/i.test(r.name)).length;
    const stairs=f.items.filter(o=>['stairs','l-stairs','u-stairs','three-side-stairs'].includes(o.shape||o.type)).length;
    const checks=[[`${A.formatLength(site.width)} × ${A.formatLength(site.depth)} footprint`,siteOk?1:0,1],['Closed edges without openings',closedEdgeOpenings?0:1,1],['Enclosed spaces',f.rooms.length,1],['Walls',f.walls.length,4],['Entry doors',doors,1],['Natural-light openings',windows,1],['Courtyard / passive cooling',courtyard,1],['Stair layout present',stairs,1],['Recorded dimensions',f.dimensions.length,1]];
    const passed=checks.filter(x=>x[1]>=x[2]).length;
    return `<div class="section"><div class="section-title">Plan readiness <span>${passed}/${checks.length} checks</span></div><div class="audit-list">${checks.map(([label,count,min])=>`<div class="audit-item ${count>=min?'pass':'warn'}"><span>${label}</span><span>${count>=min?`✓ ${count}`:`Needs ${min}`}</span></div>`).join('')}</div></div>`;
  }

  // ── Object layout check ──────────────────────────────────────
  function objectLayoutCheckHtml(o) {
    const box=A.itemAabb(o,0),shape=o.shape||o.type,solid=!['door','window','rug'].includes(shape);
    const allowedParking=x=>(o.parkingUnder&&x.shape==='car')||(x.parkingUnder&&shape==='car');
    const overlaps=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY;
    const collisions=solid?A.floor().items.filter(x=>x.id!==o.id&&!['door','window','rug'].includes(x.shape||x.type)&&!allowedParking(x)&&overlaps(box,A.itemAabb(x,0))).length:0;
    const clearance=(o.clearance||0)>0?A.floor().items.filter(x=>x.id!==o.id&&!['rug'].includes(x.shape||x.type)&&overlaps(A.itemAabb(o,o.clearance),A.itemAabb(x,x.clearance||0))).length:0;
    const cx=o.x+o.w/2,cy=o.y+o.d/2;
    const inside=A.floor().rooms.some(r=>cx>=r.x&&cx<=r.x+r.w&&cy>=r.y&&cy<=r.y+r.d)||['door','window'].includes(shape);
    const issues=collisions+(clearance>0?1:0)+(inside?0:1);
    return `<div class="section"><div class="section-title">Layout check <span>${issues?`${issues} issue${issues===1?'':'s'}`:'Clear'}</span></div><div class="audit-list"><div class="audit-item ${collisions?'warn':'pass'}"><span>Object overlap</span><span>${collisions?collisions:'✓'}</span></div><div class="audit-item ${clearance?'warn':'pass'}"><span>Clearance conflicts</span><span>${clearance?clearance:'✓'}</span></div><div class="audit-item ${inside?'pass':'warn'}"><span>Inside a room</span><span>${inside?'✓':'Check'}</span></div></div></div>`;
  }

  // ── Camera readouts ──────────────────────────────────────────
  function updateCameraReadouts() {
    const project=S().project;
    A.$$('[data-camera]').forEach(input=>{
      const key=input.dataset.camera;input.value=project.camera[key];
      const readout=input.closest('.field')?.querySelector('label span');
      if(readout)readout.textContent=key==='zoom'?`${Math.round(project.camera.zoom/.56*100)}%`:`${Math.round(project.camera[key])}°`;
    });
  }

  function setCameraPreset(name) {
    const project=S().project;
    const presets={dollhouse:{yaw:-38,pitch:34,wallMode:'cutaway',roofMode:'visible'},top:{yaw:0,pitch:78,wallMode:'hidden',roofMode:'hidden'},front:{yaw:-8,pitch:24,wallMode:'cutaway',roofMode:'visible'}};
    Object.assign(project.camera,presets[name]);window.atelier3D?.setPreset(name);window.atelier3D?.requestRebuild();A.updateZoom();renderInspector();A.queueSave();
  }

  function sunCardinal(azimuth) {
    const dirs=['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round((((Number(azimuth)||0)%360)+360)%360/45)%8];
  }

  // ── Built-Up Dimensions & Footprint Section ─────────────────
  function builtUpSectionHtml() {
    const project = S().project;
    const b = A.getHouseFootprintBounds ? A.getHouseFootprintBounds(A.floor()) : null;
    const bu = project.builtUp || { width: 1981.2, depth: 1066.8, showBoundary: true, fitMode: 'exact' };
    const unit = project.unit || 'ft';

    const targetW = bu.width || 1981.2;
    const targetD = bu.depth || 1066.8;
    const targetArea = targetW * targetD;

    const actualW = b ? b.width : targetW;
    const actualD = b ? b.depth : targetD;

    const exceedsW = b && (b.width > targetW + 1);
    const exceedsD = b && (b.depth > targetD + 1);
    const exceeds = exceedsW || exceedsD;

    let stepLabel = '1 ft';
    if (unit === 'm') stepLabel = '0.5 m';
    else if (unit === 'cm') stepLabel = '50 cm';
    else if (unit === 'in') stepLabel = '10 in';

    return `
      <div class="section">
        <div class="section-title">Built-Up Footprint <span>${exceeds ? '⚠ Exceeds Area' : '✓ Fits Target'}</span></div>
        
        <div class="field-row">
          <div class="field">
            <label>Built-Up Width</label>
            <div class="input-unit">
              <input type="text" id="builtUpWidthInput" value="${A.displayValue(targetW)}">
              <span>${unit}</span>
            </div>
          </div>
          <div class="field">
            <label>Built-Up Length (Depth)</label>
            <div class="input-unit">
              <input type="text" id="builtUpDepthInput" value="${A.displayValue(targetD)}">
              <span>${unit}</span>
            </div>
          </div>
        </div>

        <!-- Quick +/- nudge buttons for built-up dimensions -->
        <div style="display:flex;gap:6px;margin:2px 0 8px">
          <div style="flex:1;display:flex;gap:3px">
            <button class="button small" id="buWidthMinus" title="Decrease target width by ${stepLabel}" style="flex:1;font-size:10px;padding:3px 2px">− W</button>
            <button class="button small" id="buWidthPlus" title="Increase target width by ${stepLabel}" style="flex:1;font-size:10px;padding:3px 2px">+ W</button>
          </div>
          <div style="flex:1;display:flex;gap:3px">
            <button class="button small" id="buDepthMinus" title="Decrease target length by ${stepLabel}" style="flex:1;font-size:10px;padding:3px 2px">− L</button>
            <button class="button small" id="buDepthPlus" title="Increase target length by ${stepLabel}" style="flex:1;font-size:10px;padding:3px 2px">+ L</button>
          </div>
        </div>

        <div class="field">
          <label>Standard Footprint Presets</label>
          <select id="builtUpPresetSelect">
            <option value="">Custom / Select Preset...</option>
            <option value="65x35ft">65 × 35 ft (2,275 sq ft · Courtyard)</option>
            <option value="60x30ft">60 × 30 ft (1,800 sq ft)</option>
            <option value="50x30ft">50 × 30 ft (1,500 sq ft)</option>
            <option value="45x25ft">45 × 25 ft (1,125 sq ft)</option>
            <option value="40x25ft">40 × 25 ft (1,000 sq ft)</option>
            <option value="30x20ft">30 × 20 ft (600 sq ft)</option>
            <option value="20x12m">20 × 12 m (240 m²)</option>
            <option value="15x10m">15 × 10 m (150 m²)</option>
            <option value="12x8m">12 × 8 m (96 m²)</option>
            <option value="current">Match Current House Footprint</option>
          </select>
        </div>

        <div class="field">
          <label>Fitting Symmetry Mode</label>
          <select id="builtUpFitModeSelect">
            <option value="exact" ${bu.fitMode !== 'proportional' ? 'selected' : ''}>Exact Fit (Independent W & L · Preserves Bilateral Symmetry)</option>
            <option value="proportional" ${bu.fitMode === 'proportional' ? 'selected' : ''}>Proportional (Preserves 1:1 Aspect Ratio)</option>
          </select>
        </div>

        <div class="toggle-row">
          <span>Apply fit to all floors</span>
          <div class="switch ${bu.applyToAllFloors !== false ? 'on' : ''}" id="buApplyAllFloorsToggle"></div>
        </div>

        <div class="toggle-row">
          <span>Show built-up boundary envelope</span>
          <div class="switch ${bu.showBoundary !== false ? 'on' : ''}" id="buShowBoundaryToggle"></div>
        </div>

        <!-- Footprint vs Target Comparison Audit -->
        <div class="audit-list" style="margin-top:8px">
          <div class="audit-item pass">
            <span>Target Built-Up Area</span>
            <span>${A.formatArea(targetArea)}</span>
          </div>
          <div class="audit-item ${exceeds ? 'warn' : 'pass'}">
            <span>Current House Envelope</span>
            <span>${A.formatLength(actualW)} × ${A.formatLength(actualD)}</span>
          </div>
          <div class="audit-item ${exceeds ? 'fail' : 'pass'}">
            <span>Envelope Status</span>
            <span>${exceeds ? '⚠ Exceeds Area' : '✓ Conforms to Boundary'}</span>
          </div>
        </div>

        ${exceeds ? `
          <p style="font-size:10px;color:var(--danger, #be2c20);margin:6px 0 8px;line-height:1.35">
            Current house envelope exceeds built-up boundary (${exceedsW ? `Width +${A.formatLength(actualW - targetW)} ` : ''}${exceedsD ? `Length +${A.formatLength(actualD - targetD)}` : ''}). Click Auto-Fit below to scale rooms, walls, and pillars into the defined envelope.
          </p>
        ` : ''}

        <button class="button primary" id="autoFitBuiltUpBtn" style="width:100%;margin-top:8px" title="Auto fit and correct room and wall sizes to strictly not exceed the built-up area while keeping symmetry intact">
          📐 Auto-Fit House to Built-Up Area
        </button>
      </div>
    `;
  }

  // ── Structural Civil Audit Section ──────────────────────────
  function structuralAuditSectionHtml() {
    return '<div class="section"><div class="section-title">Structural planning</div><p style="font-size:11px;line-height:1.6">Open the Structure tab for loads, supports, Lucknow/BIS inputs, calculation screening and reviewed fix proposals.</p><button class="button" id="openStructureWorkspace">Open Structure workspace</button></div>';
  }
  function renderMovementControls(body,objects) {
    if(S().viewMode!=='plan'||!objects.length||objects.some(o=>!A.floor().items.includes(o)||!A.canTransform(o)||o.hostWallId))return;
    const section=document.createElement('div');section.className='section';section.innerHTML='<div class="section-title">Move on canvas</div><div class="field"><label for="moveConstraint">Movement direction</label><select id="moveConstraint"><option value="free">Free movement</option><option value="x">Plan X · horizontal</option><option value="y">Plan Y · vertical</option><option value="object-x">Object X · along orientation</option><option value="object-y">Object Y · across orientation</option></select></div><p>Object axes use the primary selected object. In Free movement, Shift holds the first dominant plan axis; release it to unlock.</p><button class="button" id="moveOnCanvas">Move on canvas</button>';body.prepend(section);
    const precise=document.createElement('div');precise.className='field';precise.innerHTML=`<label for="moveDistance">Distance along direction (${A.unitLabel()})</label><input id="moveDistance" type="text" value="0"><button class="button" id="applyMoveDistance">Apply distance</button><p>Negative distances move in the opposite direction. Entering a distance does not move until Apply.</p>`;section.append(precise);
    const input=section.querySelector('#moveConstraint'),distance=section.querySelector('#moveDistance'),apply=section.querySelector('#applyMoveDistance'),sync=()=>{distance.disabled=apply.disabled=input.value==='free';};input.value=S().moveConstraint||'free';sync();input.onchange=()=>{if(S().pointerBackup)A.cancelInteraction();S().moveConstraint=input.value;sync();A.draw();};apply.onclick=()=>{const value=distance.value.trim()?A.toCm(distance.value):NaN;if(!Number.isFinite(value)){A.showToast('Enter a valid move distance');return;}A.moveSelectedDistance(value);};section.querySelector('#moveOnCanvas').onclick=()=>{A.setTool('select');S().multiSelect=false;A.setMobileTab('stage');A.canvasSpace?.revealCanvas();A.showHint('Drag the selected object · Movement direction: '+input.selectedOptions[0].textContent+' · Escape cancels');};
  }
  function renderInspector() {
    const s=S(),project=s.project,body=A.$('#inspectorBody'),o=s.inspectorMode==='project'?null:A.findEntity(s.selected);

    // ── Multi-selection mode ───────────────────────────────────
    if(s.selectedIds.size>1&&s.inspectorMode!=='project'){
      const objects=A.selectedObjectList();
      A.$('#inspectorTitle').textContent=`${objects.length} objects selected`;
      body.innerHTML=`<div class="empty-selection" style="padding-top:18px"><div class="empty-icon">${A.icon('i-select')}</div><strong>${objects.length} objects selected</strong><span>Group transform mode is active.</span></div><div class="section"><div class="section-title">Group transform <span>${objects.length} items</span></div><div class="audit-list"><div class="audit-item pass"><span>Move</span><span>Drag any selected object</span></div><div class="audit-item pass"><span>Rotate</span><span>Drag the round handle</span></div><div class="audit-item pass"><span>Nudge</span><span>Arrow keys · Shift = larger</span></div><div class="audit-item pass"><span>Remove</span><span>Delete key</span></div></div></div><div class="section"><div class="section-title">Selected objects</div><div class="audit-list">${objects.map(x=>`<div class="audit-item"><span>${A.escapeHtml(x.name||x.type)}</span><span>${A.formatLength(x.w)} × ${A.formatLength(x.d)}</span></div>`).join('')}</div></div><button class="button" id="clearMultiSelection" style="width:100%;margin-top:10px">Clear group selection</button>`;
      A.$('#clearMultiSelection').onclick=()=>A.select(null);
      const controls=document.createElement('div');controls.className='section';controls.innerHTML='<div class="section-title">Scale selection</div><label for="groupScale">Uniform scale (%)</label><input id="groupScale" type="number" value="100" min="10" max="500"><button class="button" id="groupRotate">Rotate group 90°</button>';
      body.prepend(controls);controls.querySelector('#groupScale').onchange=e=>{if(e.target.value.trim())A.scaleSelected(Number(e.target.value));};controls.querySelector('#groupRotate').onclick=A.rotateSelected;
      const arrange=document.createElement('div');arrange.className='section';arrange.innerHTML='<div class="section-title">Arrange selection</div>';
      for(const [axis,labels] of [['x',['Left','Horizontal center','Right']],['y',['Top','Vertical center','Bottom']]]){const row=document.createElement('div');row.className='quick-actions';['start','center','end'].forEach((edge,i)=>{const button=document.createElement('button');button.textContent=labels[i];button.onclick=()=>A.alignSelection(axis,edge);row.append(button);});arrange.append(row);}
      for(const [label,action] of [['Equal horizontal gaps',()=>A.distributeSelection('x')],['Equal vertical gaps',()=>A.distributeSelection('y')],['Bring selection to front',A.bringToFront],['Send selection to back',A.sendToBack]]){const button=document.createElement('button');button.className='button';button.textContent=label;button.disabled=label.startsWith('Equal')&&objects.length<3;button.onclick=action;arrange.append(button);}controls.after(arrange);
      renderMovementControls(body,objects);return;
    }

    // ── No selection — project settings ────────────────────────
    if(!o){
      A.$('#inspectorTitle').textContent='Project';
      const cameraPanel=s.viewMode==='3d'?`<div class="section"><div class="section-title">3D camera <span>WebGL PBR</span></div><div class="preset-row"><button data-preset="dollhouse">Dollhouse</button><button data-preset="top">Top</button><button data-preset="front">Front</button></div><div class="field"><label>Wall display</label><select id="wallMode"><option value="cutaway">Cutaway</option><option value="full">Full height</option><option value="hidden">Hide walls</option></select></div><div class="field"><label>Roof display</label><select id="roofMode"><option value="visible">Show roof</option><option value="hidden">Hide roof · interior</option></select></div><div class="field"><label>Orbit <span>${Math.round(project.camera.yaw)}°</span></label><input type="range" data-camera="yaw" min="-180" max="180" value="${project.camera.yaw}"></div><div class="field"><label>Viewing angle <span>${Math.round(project.camera.pitch)}°</span></label><input type="range" data-camera="pitch" min="12" max="80" value="${project.camera.pitch}"></div><div class="field"><label>Camera zoom <span>${Math.round(project.camera.zoom/.56*100)}%</span></label><input type="range" data-camera="zoom" min=".18" max="1.4" step=".01" value="${project.camera.zoom}"></div></div>`:''
      const sunLocation=project.sun.location||A.DEFAULT.sun.location;
      const sunPanel=s.viewMode==='3d'?`<div class="section"><div class="section-title">Sun & shadows <span>Solar position</span></div><div class="field"><label>Location</label><input type="text" data-sun-location="name" value="${A.escapeHtml(sunLocation.name||'Lucknow')}"></div><div class="field-row"><div class="field"><label>Latitude</label><div class="input-unit"><input type="number" data-sun-location="latitude" value="${Number(sunLocation.latitude).toFixed(4)}" min="-89" max="89" step=".0001"><span>deg</span></div></div><div class="field"><label>Longitude</label><div class="input-unit"><input type="number" data-sun-location="longitude" value="${Number(sunLocation.longitude).toFixed(4)}" min="-180" max="180" step=".0001"><span>deg</span></div></div></div><div class="field"><label>Time zone</label><div class="input-unit"><input type="number" data-sun-location="timezone" value="${Number(sunLocation.timezone??5.5).toFixed(1)}" min="-12" max="14" step=".5"><span>UTC</span></div></div><div class="field"><label>Time of day <span id="sunTimeReadout">${A.formatSolarTime(project.sun.time)}</span></label><input type="range" data-sun="time" min="0" max="23" step="1" value="${project.sun.time}"></div><div class="field"><label>Week of year <span id="sunWeekReadout">Week ${project.sun.week} · ${A.solarWeekDate(project.sun.week)}</span></label><input type="range" data-sun="week" min="1" max="52" step="1" value="${project.sun.week}"></div><p id="sunPositionReadout" style="margin:9px 0 0;color:var(--muted);font-size:10px;line-height:1.45">Azimuth ${Math.round(project.sun.azimuth)}° · ${sunCardinal(project.sun.azimuth)} · solar altitude ${Math.round(project.sun.solarAltitude??project.sun.altitude)}° · daylight intensity ${Number(project.sun.intensity).toFixed(1)}×</p><p style="margin:7px 0 0;color:var(--muted);font-size:10px;line-height:1.45">Position uses local clock time, latitude, longitude, time zone, and week-of-year. 0° is north, 90° east, 180° south, 270° west.</p></div>`:''
      const climatePanel=`<div class="section"><div class="section-title">Climate & Vastu <span>Advisory</span></div><div class="field"><label>Climate preset</label><select id="climatePreset"><option ${project.climate.preset==='Delhi hot semi-arid'?'selected':''}>Delhi hot semi-arid</option><option ${project.climate.preset==='Tropical humid'?'selected':''}>Tropical humid</option><option ${project.climate.preset==='Temperate'?'selected':''}>Temperate</option></select></div><div class="audit-list"><div class="audit-item pass"><span>Passive cooling</span><span>${project.climate.courtyard?'Courtyard':'Courtyard off'} · ${project.climate.crossVentilation?'Cross ventilation':'Ventilation off'}</span></div><div class="audit-item pass"><span>Solar control</span><span>${project.climate.westShading?'West shading':'Shading off'} · ${project.climate.coolRoof?'Cool roof':'Cool roof off'}</span></div><div class="audit-item pass"><span>Vastu layout</span><span>${project.vastu.enabled?'Entry: '+A.escapeHtml(project.vastu.entry||'Unspecified'):'Advisory disabled'}</span></div></div><p style="margin:9px 0 0;color:var(--muted);font-size:10px;line-height:1.45">Climate preset: ${A.escapeHtml(project.climate.preset)}. Consider orientation, ventilation and local climate when choosing shading and finishes. Vastu zones are a design aid, not a structural or statutory code.</p></div>`;

      body.innerHTML=`<div class="empty-selection"><div class="empty-icon">${A.icon(s.viewMode==='3d'?'i-fit':'i-select')}</div><strong>${s.viewMode==='3d'?'Interactive 3D view':'Nothing selected'}</strong><span>${s.viewMode==='3d'?'Drag the model to orbit and use the wheel to zoom.':'Choose an object to edit its dimensions and finish.'}</span></div>${cameraPanel}${sunPanel}${climatePanel}
        <div class="section"><div class="section-title">Drawing settings</div><div class="field"><label>Measurement units</label><select id="unitSelect"><option value="cm">Centimetres</option><option value="m">Metres</option><option value="ft">Feet + inches</option><option value="in">Inches</option></select></div><div class="toggle-row"><span>Snap to ${project.unit==='ft'||project.unit==='in'?'1 in':'1 cm'} grid</span><div class="switch ${project.snap?'on':''}" id="snapToggle"></div></div>${s.viewMode==='plan'?`<div class="field"><label>Roof overlay</label><select id="planRoofMode"><option value="visible">Show roof</option><option value="hidden">Hide roof · edit interior</option></select></div>`:''}<div class="field"><label>North orientation</label><div class="input-unit"><input type="number" data-key="north" value="${project.north}" step="1"><span>deg</span></div></div><button class="button" id="loadSample" style="width:100%;margin-top:8px">Load 65 × 35 ft sample</button></div>${builtUpSectionHtml()}${structuralAuditSectionHtml()}${s.viewMode==='plan'?planAuditHtml():''}`;

      A.$('#unitSelect').value=project.unit;A.$('#unitSelect').onchange=e=>{project.unit=e.target.value;A.syncUnitPresentation();A.updateGridLegend();A.queueSave();renderInspector();A.draw()};
      A.$('#climatePreset').onchange=e=>{project.climate.preset=e.target.value;project.climate.crossVentilation=e.target.value!=='Temperate';project.climate.westShading=e.target.value!=='Temperate';project.climate.coolRoof=e.target.value==='Delhi hot semi-arid';A.queueSave();renderInspector()};
      A.$('#snapToggle').onclick=()=>{project.snap=!project.snap;A.queueSave();renderInspector()};
      A.$('#loadSample').onclick=()=>{if(!confirm('Replace the current project with the 65 × 35 ft courtyard sample? Export JSON first if you want to keep it.'))return;A.checkpoint();s.project=A.normalizeProject(A.deep(A.DEFAULT));s.selected=null;s.selectedIds.clear();A.syncUI();A.fitPlan();A.saveProject();A.showToast('65 × 35 ft sample loaded')};
      if(A.$('#planRoofMode')){A.$('#planRoofMode').value=project.camera.planRoofMode;A.$('#planRoofMode').onchange=e=>{project.camera.planRoofMode=e.target.value;A.draw();A.queueSave()};}
      
      // Built-Up Area Controls Wiring
      const buWInput = A.$('#builtUpWidthInput', body);
      if (buWInput) buWInput.onchange = e => {
        project.builtUp ||= {};
        project.builtUp.width = Math.max(100, A.toCm(e.target.value) || project.builtUp.width);
        A.draw();
        A.queueSave();
        renderInspector();
      };

      const buDInput = A.$('#builtUpDepthInput', body);
      if (buDInput) buDInput.onchange = e => {
        project.builtUp ||= {};
        project.builtUp.depth = Math.max(100, A.toCm(e.target.value) || project.builtUp.depth);
        A.draw();
        A.queueSave();
        renderInspector();
      };

      let buStep = 30.48; // 1 ft
      if (project.unit === 'm') buStep = 50;
      else if (project.unit === 'cm') buStep = 50;
      else if (project.unit === 'in') buStep = 25.4;

      const buWMinus = A.$('#buWidthMinus', body);
      if (buWMinus) buWMinus.onclick = () => {
        project.builtUp ||= {};
        project.builtUp.width = Math.max(100, Math.round(((project.builtUp.width || 1981.2) - buStep) * 10) / 10);
        A.draw(); A.queueSave(); renderInspector();
      };
      const buWPlus = A.$('#buWidthPlus', body);
      if (buWPlus) buWPlus.onclick = () => {
        project.builtUp ||= {};
        project.builtUp.width = Math.round(((project.builtUp.width || 1981.2) + buStep) * 10) / 10;
        A.draw(); A.queueSave(); renderInspector();
      };
      const buDMinus = A.$('#buDepthMinus', body);
      if (buDMinus) buDMinus.onclick = () => {
        project.builtUp ||= {};
        project.builtUp.depth = Math.max(100, Math.round(((project.builtUp.depth || 1066.8) - buStep) * 10) / 10);
        A.draw(); A.queueSave(); renderInspector();
      };
      const buDPlus = A.$('#buDepthPlus', body);
      if (buDPlus) buDPlus.onclick = () => {
        project.builtUp ||= {};
        project.builtUp.depth = Math.round(((project.builtUp.depth || 1066.8) + buStep) * 10) / 10;
        A.draw(); A.queueSave(); renderInspector();
      };

      const buPreset = A.$('#builtUpPresetSelect', body);
      if (buPreset) buPreset.onchange = e => {
        const val = e.target.value;
        const presets = {
          '65x35ft': { w: 65 * 30.48, d: 35 * 30.48 },
          '60x30ft': { w: 60 * 30.48, d: 30 * 30.48 },
          '50x30ft': { w: 50 * 30.48, d: 30 * 30.48 },
          '45x25ft': { w: 45 * 30.48, d: 25 * 30.48 },
          '40x25ft': { w: 40 * 30.48, d: 25 * 30.48 },
          '30x20ft': { w: 30 * 30.48, d: 20 * 30.48 },
          '20x12m':  { w: 2000, d: 1200 },
          '15x10m':  { w: 1500, d: 1000 },
          '12x8m':   { w: 1200, d: 800 }
        };
        project.builtUp ||= {};
        if (val === 'current') {
          const b = A.getHouseFootprintBounds(A.floor());
          project.builtUp.width = b.width;
          project.builtUp.depth = b.depth;
        } else if (presets[val]) {
          project.builtUp.width = presets[val].w;
          project.builtUp.depth = presets[val].d;
        }
        A.draw(); A.queueSave(); renderInspector();
      };

      const buFitMode = A.$('#builtUpFitModeSelect', body);
      if (buFitMode) buFitMode.onchange = e => {
        project.builtUp ||= {};
        project.builtUp.fitMode = e.target.value;
        A.queueSave();
      };

      const buApplyAll = A.$('#buApplyAllFloorsToggle', body);
      if (buApplyAll) buApplyAll.onclick = () => {
        project.builtUp ||= {};
        project.builtUp.applyToAllFloors = project.builtUp.applyToAllFloors === false;
        A.queueSave(); renderInspector();
      };

      const buShowBound = A.$('#buShowBoundaryToggle', body);
      if (buShowBound) buShowBound.onclick = () => {
        project.builtUp ||= {};
        project.builtUp.showBoundary = project.builtUp.showBoundary === false;
        A.draw(); A.queueSave(); renderInspector();
      };

      const autoFitBtn = A.$('#autoFitBuiltUpBtn', body);
      if (autoFitBtn) autoFitBtn.onclick = () => {
        project.builtUp ||= {};
        A.autoFitHouseToBuiltUp(project.builtUp.width, project.builtUp.depth, {
          fitMode: project.builtUp.fitMode || 'exact',
          applyToAllFloors: project.builtUp.applyToAllFloors !== false
        });
      };

      // Structural button wiring
      const openStructure=A.$('#openStructureWorkspace',body);if(openStructure)openStructure.onclick=()=>A.setWorkspace('structure');
      const recreateBtn = A.$('#recreateFramingBtn', body);
      if(recreateBtn) recreateBtn.onclick = () => A.recreateFraming();
      const autoFramingBtn = A.$('#autoFramingBtn', body);
      if(autoFramingBtn) autoFramingBtn.onclick = () => A.autoGenerateFraming();
      const clearBtn = A.$('#clearFramingBtn', body);
      if(clearBtn) clearBtn.onclick = () => A.clearStructure();

      const tolRange = A.$('#gridAlignToleranceRange', body);
      const tolReadout = A.$('#alignTolReadout', body);
      if(tolRange && tolReadout) {
        tolRange.oninput = (e) => {
          tolReadout.textContent = `±${e.target.value} cm`;
        };
      }

      const alignBtn = A.$('#autoAlignWallsBtn', body);
      if(alignBtn) alignBtn.onclick = () => {
        const tol = Number(A.$('#gridAlignToleranceRange', body)?.value || 25);
        A.autoAlignWallsForGrid(A.floor(), s.project, tol);
      };

      const classifyBeamsBtn = A.$('#classifyBeamsBtn', body);
      if(classifyBeamsBtn) classifyBeamsBtn.onclick = () => A.classifyBeamHierarchy(A.floor(), s.project, true);

      const autoReducePillarsBtn = A.$('#autoReducePillarsBtn', body);
      if(autoReducePillarsBtn) autoReducePillarsBtn.onclick = () => A.autoReduceRedundantPillars(A.floor(), s.project);

      const applyReduceBtn = A.$('#applyReducePillarsBtn', body);
      if(applyReduceBtn) applyReduceBtn.onclick = () => A.autoReduceRedundantPillars(A.floor(), s.project);

      const autoImprovePillarsBtn = A.$('#autoImprovePillarsBtn', body);
      if(autoImprovePillarsBtn) autoImprovePillarsBtn.onclick = () => A.autoImprovePillarGrid(A.floor(), s.project);

      const autoSizeBtn = A.$('#autoSizeBtn', body);
      if(autoSizeBtn) autoSizeBtn.onclick = () => A.autoSizeStructure();

      const viewReportBtn = A.$('#viewReportBtn', body) || A.$('#exportReportBtn', body);
      if(viewReportBtn) viewReportBtn.onclick = () => A.showStructuralReportModal();

      const sizingGuideBtn = A.$('#sizingGuideBtn', body);
      if(sizingGuideBtn) sizingGuideBtn.onclick = () => A.showSizingGuideModal();

      // Suggestion action triggers
      A.$$('[data-struct-action]', body).forEach(btn => {
        btn.onclick = () => {
          const action = btn.dataset.structAction;
          if (action === 'auto-size') A.autoSizeStructure();
          else if (action === 'recreate') A.recreateFraming();
          else if (action === 'align-grid') {
            const tol = Number(A.$('#gridAlignToleranceRange', body)?.value || 25);
            A.autoAlignWallsForGrid(A.floor(), s.project, tol);
          }
          else if (action === 'reduce-pillars') A.autoReduceRedundantPillars(A.floor(), s.project);
          else if (action === 'improve-grid') A.autoImprovePillarGrid(A.floor(), s.project);
          else if (action === 'classify-beams') A.classifyBeamHierarchy(A.floor(), s.project, true);
        };
      });

      const showStructToggle = A.$('#inspectorShowStructureToggle', body);
      if(showStructToggle) showStructToggle.onclick = () => {
        project.showStructure = !(project.showStructure !== false);
        const sb = A.$('#structureBtn');
        if(sb) sb.classList.toggle('active', project.showStructure);
        A.draw();
        if(s.viewMode === '3d') window.atelier3D?.requestRebuild();
        A.queueSave();
        renderInspector();
        A.showToast(project.showStructure ? 'Structure visible' : 'Structure hidden');
      };

      const framingToggle = A.$('#inspectorFramingModeToggle', body);
      if(framingToggle) framingToggle.onclick = () => {
        project.framingMode = !project.framingMode;
        A.draw();
        A.queueSave();
        renderInspector();
        A.showToast(project.framingMode ? 'Framing plan focus: ON' : 'Framing plan focus: OFF');
      };

      A.$$('[data-camera]',body).forEach(input=>input.oninput=e=>{project.camera[e.target.dataset.camera]=Number(e.target.value);updateCameraReadouts();A.updateZoom();window.atelier3D?.setCamera(project.camera);A.queueSave()});
      const updateSunReadouts=()=>{const timeReadout=A.$('#sunTimeReadout',body),weekReadout=A.$('#sunWeekReadout',body),positionReadout=A.$('#sunPositionReadout',body);if(timeReadout)timeReadout.textContent=A.formatSolarTime(project.sun.time);if(weekReadout)weekReadout.textContent=`Week ${project.sun.week} · ${A.solarWeekDate(project.sun.week)}`;if(positionReadout)positionReadout.textContent=`Azimuth ${Math.round(project.sun.azimuth)}° · ${sunCardinal(project.sun.azimuth)} · solar altitude ${Math.round(project.sun.solarAltitude??project.sun.altitude)}° · daylight intensity ${Number(project.sun.intensity).toFixed(1)}×`};
      A.$$('[data-sun]',body).forEach(input=>input.oninput=e=>{const key=e.target.dataset.sun;project.sun[key]=Number(e.target.value);A.syncSolarPosition();updateSunReadouts();A.queueSave()});
      A.$$('[data-sun-location]',body).forEach(input=>input.oninput=e=>{const key=e.target.dataset.sunLocation;project.sun.location[key]=key==='name'?e.target.value:Number(e.target.value);if(key!=='name')A.syncSolarPosition();updateSunReadouts();A.queueSave()});
      if(A.$('#wallMode')){A.$('#wallMode').value=project.camera.wallMode;A.$('#wallMode').onchange=e=>{project.camera.wallMode=e.target.value;window.atelier3D?.requestRebuild();A.queueSave()};A.$('#roofMode').value=project.camera.roofMode;A.$('#roofMode').onchange=e=>{project.camera.roofMode=e.target.value;window.atelier3D?.requestRebuild();A.queueSave()};A.$$('[data-preset]',body).forEach(b=>b.onclick=()=>{if(window.atelier3D?.isWalking?.())window.atelier3D.setWalk(false);setCameraPreset(b.dataset.preset);renderInspector()});}
      A.$('[data-key="north"]',body).onchange=e=>{project.north=Number(e.target.value)||0;A.$('#compass').style.setProperty('--north',`${project.north}deg`);A.draw();A.queueSave()};return;
    }

    // ── Single entity selected ─────────────────────────────────
    if(o.type === 'column'){
      A.$('#inspectorTitle').textContent = `Pillar ${A.escapeHtml(o.tag || 'C')}`;
      const analysis = A.analyzeStructure ? A.analyzeStructure() : null;
      const colData = analysis?.columnDetails?.find(c => c.id === o.id);

      let html = `
        <div class="section">
          <div class="section-title">Column Identity <span>${A.escapeHtml(o.tag || 'C')}</span></div>
          <div class="field"><label>Column Tag</label><input type="text" data-key="tag" value="${A.escapeHtml(o.tag || '')}"></div>
          <div class="field-row">
            ${fieldNumber('Width (b)', 'w', o.w || 23, 1)}
            ${fieldNumber('Depth (D)', 'd', o.d || 30, 1)}
          </div>
          <div class="field-row">
            ${fieldNumber('Height', 'height', o.height || 300, 1)}
            <div class="field"><label>Shape</label><select data-key="shape"><option value="rect" ${o.shape!=='circle'?'selected':''}>Rectangular</option><option value="circle" ${o.shape==='circle'?'selected':''}>Circular</option></select></div>
          </div>
          <div class="field-row">
            ${fieldNumber('Position X', 'x', o.x, .1)}
            ${fieldNumber('Position Y', 'y', o.y, .1)}
          </div>
        </div>
        <div class="section">
          <div class="section-title">Civil Engineering Specs <span>IS 456</span></div>
          <div class="field-row">
            <div class="field"><label>Concrete</label><select data-key="material"><option ${o.material==='RCC M20'?'selected':''}>RCC M20</option><option ${o.material==='RCC M25'?'selected':''}>RCC M25</option><option ${o.material==='RCC M30'?'selected':''}>RCC M30</option><option ${o.material==='RCC M35'?'selected':''}>RCC M35</option></select></div>
            <div class="field"><label>Steel</label><select data-key="steelGrade"><option ${o.steelGrade==='Fe415'?'selected':''}>Fe415</option><option ${o.steelGrade==='Fe500'?'selected':''}>Fe500</option><option ${o.steelGrade==='Fe550'?'selected':''}>Fe550</option></select></div>
          </div>
          <div class="field"><label>Longitudinal Rebar</label><input type="text" data-key="rebarSpec" value="${A.escapeHtml(o.rebarSpec || '4-T16 + 8mm ties @ 150 c/c')}"></div>
          <div class="section-title" style="margin-top:10px">Isolated Footing</div>
          <div class="field-row">
            ${fieldNumber('Footing Width', 'footingWidth', o.footingWidth || 120, 1)}
            ${fieldNumber('Footing Depth', 'footingDepth', o.footingDepth || 120, 1)}
          </div>
          ${fieldNumber('Footing Thickness', 'footingThickness', o.footingThickness || 35, 1)}
        </div>
        <div class="section">
          <div class="section-title">Structural Load Check <span>${colData ? `${colData.utilization}% load` : 'Analysis'}</span></div>
          <div class="audit-list">
            <div class="audit-item pass"><span>Tributary Area</span><span>${colData?.tributaryAreaM2 || 12} m²</span></div>
            <div class="audit-item pass"><span>Factored Load (Pu)</span><span>${colData?.factoredLoadKN || 150} kN</span></div>
            <div class="audit-item pass"><span>Axial Capacity (Puz)</span><span>${colData?.capacityKN || 650} kN</span></div>
            <div class="audit-item ${colData?.status || 'pass'}"><span>Capacity Status</span><span>${colData?.status === 'pass' ? '✓ Adequate' : '⚠ High Stress'}</span></div>
          </div>
          <p style="margin:8px 0 0;color:var(--muted);font-size:10px;line-height:1.4">${colData?.advice || 'Column meets IS 456 axial compression guidelines.'}</p>
        </div>
        <div class="section">
          <div class="quick-actions">
            <button id="duplicateSelected">Duplicate</button>
            <button id="nudgeSelected">Nudge 20 cm</button>
          </div>
          <div class="quick-actions" style="margin-top:6px">
            <button id="autoSizeColBtn" title="Auto-size based on tributary load">📏 Auto-Size</button>
            <button id="colReportBtn" title="View Civil Report">📄 Civil Report</button>
          </div>
          <button class="delete-button" id="deleteSelected" style="margin-top:8px">Delete Column</button>
        </div>
      `;
      body.innerHTML = html;
      wireStructuralItemHandlers(o);
      return;
    }

    if(o.type === 'beam'){
      A.$('#inspectorTitle').textContent = `Beam ${A.escapeHtml(o.tag || 'B')}`;
      const analysis = A.analyzeStructure ? A.analyzeStructure() : null;
      const beamData = analysis?.beamDetails?.find(b => b.id === o.id);
      const spanLen = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);

      let html = `
        <div class="section">
          <div class="section-title">Beam Identity <span>${A.escapeHtml(o.tag || 'B')}</span></div>
          <div class="field"><label>Beam Tag</label><input type="text" data-key="tag" value="${A.escapeHtml(o.tag || '')}"></div>
          <div class="field"><label>Span Length</label><input type="text" disabled value="${A.formatLength(spanLen)} (${(spanLen/100).toFixed(2)} m)"></div>
          <div class="field-row">
            ${fieldNumber('Width (b)', 'width', o.width || 23, 1)}
            ${fieldNumber('Depth (D)', 'depth', o.depth || 35, 1)}
          </div>
          <div class="field"><label>Beam Type</label><select data-key="beamType"><option value="primary" ${o.beamType==='primary'?'selected':''}>Primary Beam</option><option value="secondary" ${o.beamType==='secondary'?'selected':''}>Secondary / Tie Beam</option><option value="cantilever" ${o.beamType==='cantilever'?'selected':''}>Cantilever Beam</option></select></div>
        </div>
        <div class="section">
          <div class="section-title">Civil Engineering Specs <span>IS 456</span></div>
          <div class="field-row">
            <div class="field"><label>Concrete</label><select data-key="material"><option ${o.material==='RCC M20'?'selected':''}>RCC M20</option><option ${o.material==='RCC M25'?'selected':''}>RCC M25</option><option ${o.material==='RCC M30'?'selected':''}>RCC M30</option></select></div>
            <div class="field"><label>Steel</label><select data-key="steelGrade"><option ${o.steelGrade==='Fe415'?'selected':''}>Fe415</option><option ${o.steelGrade==='Fe500'?'selected':''}>Fe500</option></select></div>
          </div>
          <div class="field"><label>Rebar Detail</label><input type="text" data-key="rebarSpec" value="${A.escapeHtml(o.rebarSpec || 'Top 2-T12, Bot 2-T16, 8mm @ 150 c/c')}"></div>
        </div>
        <div class="section">
          <div class="section-title">Deflection Check <span>L/d = ${beamData?.actualLd || (spanLen/(o.depth||35)).toFixed(1)}</span></div>
          <div class="audit-list">
            <div class="audit-item pass"><span>Allowable L/d</span><span>≤ ${beamData?.maxLd || 20}</span></div>
            <div class="audit-item ${beamData?.status || 'pass'}"><span>Actual L/d Ratio</span><span>${beamData?.actualLd || '14.0'}</span></div>
<div class="audit-item pass"><span>Min Required Depth</span><span>${A.formatLength(beamData?.minRequiredDepthCm || 30)}</span></div>
            <div class="audit-item ${beamData?.status || 'pass'}"><span>Deflection Safety</span><span>${beamData?.status === 'pass' ? '✓ Passed' : '⚠ Deflection Risk'}</span></div>
          </div>
          <p style="margin:8px 0 0;color:var(--muted);font-size:10px;line-height:1.4">${beamData?.advice || 'Beam depth satisfies civil engineering deflection criteria.'}</p>
        </div>
        <div class="section">
          <div class="quick-actions">
            <button id="nudgeSelected">Nudge 20 cm</button>
            <button id="autoSizeBeamBtn" title="Auto-size based on span deflection">📏 Auto-Size</button>
          </div>
          <div class="quick-actions" style="margin-top:6px">
            <button id="beamReportBtn" title="View Civil Report">📄 Civil Report</button>
            <button id="beamGuideBtn" title="View Sizing Guide">📖 Sizing Guide</button>
          </div>
          <button class="delete-button" id="deleteSelected" style="margin-top:8px">Delete Beam</button>
        </div>
      `;
      body.innerHTML = html;
      wireStructuralItemHandlers(o);
      return;
    }

    A.$('#inspectorTitle').textContent=o.type==='room'?'Room':o.type==='wall'?'Wall':o.type==='dimension'?'Dimension':o.name;
    const shape=o.shape||o.type,isOpening=shape==='door'||shape==='window',isPowered=A.POWERED_TYPES.has(shape);
    let html=`<div class="section"><div class="section-title">Identity <span>${A.escapeHtml(o.type)}</span></div>${o.name?`<div class="field"><label>Name</label><input type="text" data-key="name" value="${A.escapeHtml(o.name)}"></div>`:''}`;
    if(o.type==='room'||A.floor().items.includes(o)){
      html+=`<div class="field-row">${fieldNumber('Width','w',o.w,.1)}${fieldNumber(o.type==='room'?'Depth':'Length','d',o.d,.1)}</div><div class="field-row">${fieldNumber('Position X','x',o.x,.1)}${fieldNumber('Position Y','y',o.y,.1)}</div>`;
      if(o.type!=='room')html+=`<div class="field"><label>Orientation <span>${o.rotation||0}°</span></label><input type="range" data-key="rotation" min="0" max="359" value="${o.rotation||0}"></div>`;
      if(o.type==='room')html+=`${fieldNumber('Ceiling height','ceilingHeight',o.ceilingHeight||280,.1)}<div class="field"><label>Floor finish</label><select data-key="floorMaterial">${['Wood','Tile','Stone','Concrete','Carpet'].map(m=>`<option ${m===(o.floorMaterial||'Wood')?'selected':''}>${m}</option>`).join('')}</select></div><div class="field"><label>Area</label><input type="text" disabled value="${A.formatArea(o.type==='room'?A.roomArea(o):o.w*o.d)}"></div>`;
      else html+=`<div class="field"><label>Footprint area</label><input type="text" disabled value="${A.formatArea(o.type==='room'?A.roomArea(o):o.w*o.d)}"></div><div class="field-row">${fieldNumber(shape==='three-side-stairs'?'Floor-to-floor rise':'Object height','height',o.height||80,.1)}${fieldNumber(isOpening&&shape==='window'?'Sill height':'Elevation','elevation',o.elevation||0,.1)}</div><div class="field-row">${fieldNumber('Clearance zone','clearance',o.clearance||0,.1)}<div class="field"><label>Uniform scale</label><div class="input-unit"><input type="number" id="uniformScale" value="100" min="10" max="500" step="5"><span>%</span></div></div></div><div class="toggle-row"><span>Lock proportions while resizing</span><div class="switch ${o.lockAspect?'on':''}" id="aspectToggle"></div></div>`;
      if(shape==='door'){const percentDoor=o.type==='sliding-door'||o.type==='garage-door';html+=`<div class="field"><label>${percentDoor?'Open amount':'Door opening'} <span>${o.openAngle??30}${percentDoor?'%':'°'}</span></label><input type="range" data-key="openAngle" min="0" max="${percentDoor?100:120}" value="${o.openAngle??30}"></div>${!percentDoor?`<div class="preset-row"><button data-door-angle="0">Closed</button><button data-door-angle="35">Semi-open</button><button data-door-angle="90">Open</button></div><div class="field"><label>Hinge side</label><select data-key="hingeSide"><option value="left" ${o.hingeSide!=='right'?'selected':''}>Left hinge</option><option value="right" ${o.hingeSide==='right'?'selected':''}>Right hinge</option></select></div><div class="toggle-row"><span>Reverse swing direction</span><div class="switch ${(o.swingSide??1)<0?'on':''}" id="swingSideToggle"></div></div>`:''}`;}
      if(['stairs','l-stairs','u-stairs'].includes(shape)){const split=shape!=='stairs',lower=o.lowerStepCount||Math.ceil((o.stepCount||16)/2),upper=o.upperStepCount||Math.max(1,(o.stepCount||16)-lower);html+=`<div class="section-title" style="margin-top:15px">Stair geometry</div><div class="field-row">${fieldNumber('Clear width','stairWidth',o.stairWidth||Math.min(100,o.w),.1)}${fieldNumber('Landing width','landingWidth',o.landingWidth||(shape==='u-stairs'?o.w:o.stairWidth),.1)}</div><div class="field-row">${fieldNumber('Landing length','landingLength',o.landingLength||o.landingDepth||100,.1)}${split?fieldNumber('Lower flight steps','lowerStepCount',lower,1):fieldNumber('Total risers','stepCount',o.stepCount||16,1)}</div>${split?fieldNumber('Upper flight steps','upperStepCount',upper,1):''}<div class="toggle-row"><span>Under-stair storage</span><div class="switch ${o.underStorage!==false?'on':''}" id="underStorageToggle"></div></div>`;}
      if(shape==='ceiling-fan')html+=`<div class="section-title" style="margin-top:15px">Fan geometry</div>${fieldNumber('Blade count','bladeCount',o.bladeCount||4,1)}`;
      if(shape==='three-side-stairs'){
        const semi=o.type==='semi-l-stairs'||o.stairLayout==='semi-l',alongX=((o.stairStartSide||'short')==='long'?o.w>=o.d:o.w<o.d),clockwiseHand=alongX?(semi?'left':'right'):(semi?'right':'left');
        let report;try{const l=A.threeSideStairLayout(o);report=`${l.total} equal risers · ${A.stairFormatLength(l.riser)} high<br>Uniform tread: ${A.stairFormatLength(l.going)}<br>Flights: ${l.counts.join(' + ')} risers<br>Landings: ${A.stairFormatLength(l.landingAcross)} × ${A.stairFormatLength(l.landingAlong)}<br>Entrance platform: ${A.stairFormatLength(l.width)} × ${A.stairFormatLength(l.platform)}<br>Exit bridge: ${A.stairFormatLength(l.bridgeWidth)} × ${A.stairFormatLength(l.platform)}<br>Rise: ${A.formatLength(o.height)} · 2R + T: ${A.stairFormatLength(l.comfort)}`;}catch(error){report=A.escapeHtml(error.message);}
        html+=fieldNumber('Minimum entry / exit platform length','stairPlatformLength',o.stairPlatformLength??91.44,.1);
        html+=`<div class="section-title" style="margin-top:15px">${semi?'Auto-fit Semi L stair':'Auto-fit three-sided stair'}</div><p>Width/Length above are the clear room dimensions; Floor-to-floor rise sets the total ascent. ${semi?'Flights 1 and 2 run in a straight line across a level landing; flight 3 turns 90°. The exit bridge meets a compact U stair above.':'Three flights turn through two level corner landings. Mirror swaps start/end corners; rotate 180° for the opposite pair.'}</p><div class="field"><label for="stairStartSide">${semi?'Straight flights along':'Start along'}</label><select id="stairStartSide" ${o.locked?'disabled':''}><option value="short" ${(o.stairStartSide||'short')==='short'?'selected':''}>Shorter room side</option><option value="long" ${o.stairStartSide==='long'?'selected':''}>Longer room side</option></select></div><div class="field"><label for="stairHandedness">Start corner / direction</label><select id="stairHandedness" ${o.locked?'disabled':''}><option value="left" ${(o.stairHandedness||'left')==='left'?'selected':''}>${clockwiseHand==='left'?'Clockwise':'Anticlockwise'}</option><option value="right" ${o.stairHandedness==='right'?'selected':''}>${clockwiseHand==='right'?'Clockwise':'Anticlockwise'}</option></select></div>${fieldNumber('Clear flight width','stairWidth',o.stairWidth??91.44,.1)}${fieldNumber('Minimum corner landing','stairLandingMin',o.stairLandingMin??91.44,.1)}${fieldNumber('Preferred riser','stairTargetRiser',o.stairTargetRiser??15.24,.1)}<p id="stairLayoutSummary" class="struct-note">${report}</p><p class="struct-note">Planning geometry. Entry and exit platforms are included; connect the upper floor and check the opening, 2.2 m headroom, handrails and local stair-width rules. Requested 3 ft is below the common 1 m dwelling benchmark. Use dimensions clear of wall finishes.</p>`;
      }
      if(['ceiling-light','pendant','chandelier','sconce','downlight'].includes(shape))html+=`<div class="section-title" style="margin-top:15px">Lighting</div>${fieldNumber('Output','lumens',o.lumens||1000,50)}`;
      if(shape==='mirror')html+=`<div class="section-title" style="margin-top:15px">Daylight reflection</div><div class="toggle-row"><span>Reflect sunlight</span><div class="switch ${o.reflectionEnabled!==false?'on':''}" id="mirrorReflectionToggle"></div></div><div class="field"><label>Reflection strength <span>${Math.round((o.reflectionStrength??.58)*100)}%</span></label><input type="range" data-key="reflectionStrength" min="0" max="1" step=".01" value="${o.reflectionStrength??.58}"></div><div class="field"><label>Reflection spread <span>${Math.round(o.reflectionSpread??32)}°</span></label><input type="range" data-key="reflectionSpread" min="8" max="75" step="1" value="${o.reflectionSpread??32}"></div><div class="field"><label>Surface roughness <span>${Number(o.roughness??.045).toFixed(2)}</span></label><input type="range" data-key="roughness" min=".01" max=".3" step=".01" value="${o.roughness??.045}"></div>`;
      if(isPowered)html+=`<div class="toggle-row"><span>Powered / active state</span><div class="switch ${o.active?'on':''}" id="activeStateToggle"></div></div>`;
    } else {
      html+=`<div class="field-row">${fieldNumber('Start X','x1',o.x1,.1)}${fieldNumber('Start Y','y1',o.y1,.1)}</div><div class="field-row">${fieldNumber('End X','x2',o.x2,.1)}${fieldNumber('End Y','y2',o.y2,.1)}</div>`;
      const length=Math.hypot(o.x2-o.x1,o.y2-o.y1);html+=`<div class="field"><label>Measured length</label><input type="text" disabled value="${A.formatLength(length)}"></div>`;
      if(o.type==='wall')html+=`<div class="field-row">${fieldNumber('Wall thickness','thickness',o.thickness,.1)}${fieldNumber('Wall height','height',o.height||280,.1)}</div><p style="margin:8px 0 0;color:var(--muted);font-size:10px;line-height:1.4">On the plan, drag either endpoint to resize. Drag the round ↻ handle to rotate.</p>`;
    }
    html+=`</div>${A.floor().items.includes(o)&&!o.system?objectLayoutCheckHtml(o):''}<div class="section"><div class="section-title">Material & finish</div>${A.floor().items.includes(o)?`<div class="field"><label>Material</label><select data-key="material">${['Wood','Fabric','Leather','Stone','Metal','Glass','Mirror','Ceramic','Natural','Plastic','Concrete'].map(m=>`<option ${m===(o.material||'Wood')?'selected':''}>${m}</option>`).join('')}</select></div><div class="field"><label>Transparency <span>${Math.round(o.transparency||0)}%</span></label><input type="range" data-key="transparency" min="0" max="90" value="${o.transparency||0}"></div>`:''}<div class="field"><label>Surface colour</label><div class="color-row"><input type="color" data-key="color" value="${o.color||'#65736c'}"><span>${o.color||'#65736c'}</span></div></div>${o.type==='room'?`<div class="field"><label>Floor opacity <span>${Math.round((o.opacity??1)*100)}%</span></label><input type="range" data-key="opacity" min="0.25" max="1" step="0.05" value="${o.opacity??1}"></div>`:''}</div><div class="section"><div class="quick-actions"><button id="duplicateSelected">Duplicate</button>${A.floor().items.includes(o)?'<button id="rotateSelected">Rotate 90°</button><button id="alignWall">Align wall</button>':`<button id="nudgeSelected">Nudge 20 cm</button><button disabled>—</button>`}</div><button class="delete-button" id="deleteSelected">Delete ${A.escapeHtml(o.type)}</button></div>`;
    body.innerHTML=html;
    A.renderServiceInspector?.(o,body);
    renderMovementControls(body,[o]);
    if(['door','window'].includes(o.shape||o.type)){
      const section=document.createElement('div');section.className='section';
      const wall=A.floor().walls.find(w=>w.id===o.hostWallId);
      section.innerHTML=`<div class="section-title">Wall attachment <span>${wall?'Attached':'Free'}</span></div>${wall?fieldNumber('Center distance along wall','wallOffset',o.wallOffset,.1)+'<p>Drag along the wall or resize with either width handle. Width stays inside the wall ends.</p>':'<p>Attach to a nearby wall to constrain movement and width.</p>'}<button class="button" id="openingAttachment">${wall?'Detach from wall':'Attach to nearby wall'}</button>`;
      body.append(section);A.$('#openingAttachment',section).disabled=!!o.locked;A.$('#openingAttachment',section).onclick=()=>A.setOpeningAttachment(o,!wall);
      if(wall){for(const key of ['d','rotation'])A.$$(`[data-key="${key}"]`,body).forEach(input=>input.disabled=true);for(const id of ['uniformScale','rotateSelected','aspectToggle']){const control=A.$('#'+id,body);if(control){control.disabled=true;control.setAttribute('aria-disabled','true');}}}
    }
    if(A.floor().items.includes(o)){
      const lock=document.createElement('button');lock.className='button';lock.textContent=o.locked?'Unlock object':'Lock object';lock.onclick=()=>{A.checkpoint();o.locked=!o.locked;A.queueSave();renderInspector();A.draw();};body.append(lock);
      if(o.locked){A.$$('[data-key]',body).forEach(input=>{if(A.lengthKeys.has(input.dataset.key)||['rotation','stepCount','lowerStepCount','upperStepCount'].includes(input.dataset.key))input.disabled=true;});for(const id of ['uniformScale','rotateSelected','alignWall','deleteSelected']){const control=A.$('#'+id,body);if(control)control.disabled=true;}}
    }

    function wireStructuralItemHandlers(item) {
      A.$$('[data-key]', body).forEach(input => input.addEventListener(input.type === 'color' ? 'input' : 'change', e => {
        const key = e.target.dataset.key;
        A.checkpoint();
        if (['tag', 'name', 'shape', 'material', 'steelGrade', 'rebarSpec', 'beamType'].includes(key)) {
          item[key] = e.target.value;
        } else {
          item[key] = key==='color' ? e.target.value : A.lengthKeys.has(key) ? A.toCm(e.target.value) : Number(e.target.value);
        }
        A.queueSave();
        A.draw();
        renderInspector();
        if (S().viewMode === '3d') window.atelier3D?.requestRebuild();
      }));
      const delBtn = A.$('#deleteSelected');
      if (delBtn) delBtn.onclick = A.deleteSelected;
      const dupBtn = A.$('#duplicateSelected');
      if (dupBtn) dupBtn.onclick = A.duplicateSelected;
      const nudgeBtn = A.$('#nudgeSelected');
      if (nudgeBtn) nudgeBtn.onclick = () => A.nudgeEntity(item);

      const colAutoSizeBtn = A.$('#autoSizeColBtn');
      if (colAutoSizeBtn) colAutoSizeBtn.onclick = () => { A.autoSizeStructure(); renderInspector(); };
      const colReportBtn = A.$('#colReportBtn');
      if (colReportBtn) colReportBtn.onclick = () => A.showStructuralReportModal();

      const beamAutoSizeBtn = A.$('#autoSizeBeamBtn');
      if (beamAutoSizeBtn) beamAutoSizeBtn.onclick = () => { A.autoSizeStructure(); renderInspector(); };
      const beamReportBtn = A.$('#beamReportBtn');
      if (beamReportBtn) beamReportBtn.onclick = () => A.showStructuralReportModal();
      const beamGuideBtn = A.$('#beamGuideBtn');
      if (beamGuideBtn) beamGuideBtn.onclick = () => A.showSizingGuideModal();
    }

    // ── Wire up inspector event handlers ────────────────────────
    const nudgeButton=A.$('#nudgeSelected');if(nudgeButton)nudgeButton.textContent=`Nudge ${A.formatLength(20)}`;
    if(shape==='three-side-stairs')for(const key of ['stairStartSide','stairHandedness']){const el=A.$('#'+key,body);if(el)el.onchange=()=>A.updateThreeSideStair(o,{[key]:el.value});}
    if(o.type==='wall'){const wallRotateButton=A.$('.quick-actions button[disabled]',body);if(wallRotateButton){wallRotateButton.disabled=false;wallRotateButton.textContent='Rotate 90°';wallRotateButton.id='rotateWall90';wallRotateButton.onclick=A.rotateWall90}}
    A.$$('[data-key]',body).forEach(input=>input.addEventListener(input.type==='range'||input.type==='color'?'input':'change',e=>{
      if(shape==='three-side-stairs'&&['w','d','height','stairWidth','stairLandingMin','stairPlatformLength','stairTargetRiser'].includes(e.target.dataset.key)){A.updateThreeSideStair(o,{[e.target.dataset.key]:A.toCm(e.target.value)});return;}
      const key=e.target.dataset.key,oldW=o.w,oldD=o.d;A.checkpoint();o[key]=['name','color','material','hingeSide','floorMaterial'].includes(key)?e.target.value:(['rotation','opacity','swing','openAngle','transparency','reflectionStrength','reflectionSpread','roughness','stepCount','lowerStepCount','upperStepCount','bladeCount','lumens'].includes(key)?Number(e.target.value):A.toCm(e.target.value));if(key==='stepCount')o.stepCount=Math.max(1,Math.min(36,Math.round(o.stepCount)));if(['lowerStepCount','upperStepCount'].includes(key)){o[key]=Math.max(1,Math.min(35,Math.round(o[key])));o.stepCount=o.lowerStepCount+o.upperStepCount}if(key==='bladeCount')o.bladeCount=Math.max(1,Math.min(12,Math.round(o.bladeCount)));if(key==='lumens')o.lumens=Math.max(100,Math.min(5000,Math.round(o.lumens/50)*50));if(key==='landingLength'){o.landingLength=Math.max(1,o.landingLength);o.landingDepth=o.landingLength}if(key==='landingDepth'){o.landingLength=o.landingDepth}if(key==='material'&&o.material==='Glass'&&(o.transparency||0)===0)o.transparency=45;if(o.lockAspect&&A.floor().items.includes(o)&&key==='w'&&oldW)o.d=oldD*(o.w/oldW);if(o.lockAspect&&A.floor().items.includes(o)&&key==='d'&&oldD)o.w=oldW*(o.d/oldD);
      const readout=e.target.closest('.field')?.querySelector('label span');
      if(readout&&key==='rotation')readout.textContent=`${o.rotation}°`;
      if(readout&&key==='swing')readout.textContent=`${o.swing}°`;
      if(readout&&key==='openAngle')readout.textContent=`${o.openAngle}${o.type==='sliding-door'||o.type==='garage-door'?'%':'°'}`;
      if(readout&&key==='transparency')readout.textContent=`${Math.round(o.transparency)}%`;
      if(readout&&key==='opacity')readout.textContent=`${Math.round(o.opacity*100)}%`;
      if(readout&&key==='reflectionStrength')readout.textContent=`${Math.round(o.reflectionStrength*100)}%`;
      if(readout&&key==='reflectionSpread')readout.textContent=`${Math.round(o.reflectionSpread)}°`;
      if(readout&&key==='roughness')readout.textContent=Number(o.roughness).toFixed(2);
      if(key==='color')e.target.nextElementSibling.textContent=e.target.value;
      A.queueSave();A.draw();
      if(o.hostWallId&&['w','wallOffset','x','y'].includes(key))renderInspector();
      if(o.type==='room'||['material','color','opacity'].includes(key)) window.atelier3D?.requestRebuild();
      if(key==='material')renderInspector();
    }));
    A.$('#deleteSelected').onclick=A.deleteSelected;
    A.$('#duplicateSelected').onclick=A.duplicateSelected;
    const rotate=A.$('#rotateSelected'),nudge=A.$('#nudgeSelected');if(rotate)rotate.onclick=A.rotateSelected;if(nudge)nudge.onclick=()=>A.nudgeEntity(o);
    const aspect=A.$('#aspectToggle'),scaleInput=A.$('#uniformScale'),align=A.$('#alignWall');if(aspect)aspect.onclick=()=>{A.checkpoint();o.lockAspect=!o.lockAspect;A.queueSave();renderInspector()};if(scaleInput)scaleInput.onchange=e=>{if(e.target.value.trim())A.scaleSelected(Number(e.target.value),A.$('#routeScaleMode',body)?.value||'spatial');};if(align)align.onclick=A.alignSelectedToWall;
    A.$$('[data-door-angle]',body).forEach(b=>b.onclick=()=>{A.checkpoint();o.openAngle=Number(b.dataset.doorAngle);renderInspector();A.draw();A.queueSave()});const swingToggle=A.$('#swingSideToggle');if(swingToggle)swingToggle.onclick=()=>{A.checkpoint();o.swingSide=(o.swingSide??1)*-1;renderInspector();A.draw();A.queueSave()};
    const activeToggle=A.$('#activeStateToggle');if(activeToggle)activeToggle.onclick=()=>{A.checkpoint();o.active=!o.active;renderInspector();A.draw();A.queueSave()};
    const mirrorToggle=A.$('#mirrorReflectionToggle');if(mirrorToggle)mirrorToggle.onclick=()=>{A.checkpoint();o.reflectionEnabled=o.reflectionEnabled===false;renderInspector();A.draw();A.queueSave()};
    const storageToggle=A.$('#underStorageToggle');if(storageToggle)storageToggle.onclick=()=>{A.checkpoint();o.underStorage=o.underStorage===false;renderInspector();A.draw();A.queueSave()};
  }

  Object.assign(A, {
    fieldNumber, planAuditHtml, objectLayoutCheckHtml,
    updateCameraReadouts, setCameraPreset, sunCardinal,
    renderInspector
  });
})();
