/**
 * js/project-model.js — Default project, normalization, solar position
 *
 * Contains the DEFAULT project template (65 × 35 ft courtyard house),
 * plan preparation helpers, project normalization/migration logic,
 * solar position calculations, and layout repair routines.
 *
 * Depends on: utilities.js, constants.js, furniture-catalog.js
 */
(function () {
  'use strict';
  const A = window.Atelier;
  const { uid, deep, CATALOG, POWERED_TYPES, WALL_DEFAULT_THICKNESS, WALL_DEFAULT_HEIGHT } = A;

  // ── Default Project Template ─────────────────────────────────
  const DEFAULT = {
    version: 7,
    name: '65 × 35 ft Courtyard House', unit: 'ft', north: 0, grid: true, snap: true,
    site: { width:1981.2, depth:1066.8, north:'open', west:'open', south:'closed', east:'closed' },
    builtUp: { width:1981.2, depth:1066.8, showBoundary:true, fitMode:'exact', applyToAllFloors:true },
    climate: { preset:'Delhi hot semi-arid', courtyard:true, crossVentilation:true, westShading:true, coolRoof:true },
    vastu: { enabled:true, entry:'North / west', primaryBedroom:'South-west', kitchen:'South-east', courtyard:'Centre (Brahmasthan)', toilets:'West / north-west', stairs:'South / west', advisory:true },
    camera: { yaw: -38, pitch: 34, zoom: .5, wallMode:'cutaway', roofMode:'visible', planRoofMode:'visible' },
    sun: { time:12, week:26, location:{name:'Lucknow',latitude:26.8467,longitude:80.9462,timezone:5.5}, azimuth:180, altitude:38, solarAltitude:38, intensity:3.6 },
    floors: [{
      id: uid(), name: 'Ground floor', elevation: 0,
      rooms: [
        {id:uid(),type:'room',name:'Primary bedroom',x:100,y:100,w:400,d:420,color:'#eee5d7',floorMaterial:'Wood',opacity:1,ceilingHeight:280},
        {id:uid(),type:'room',name:'Bathroom',x:500,y:100,w:200,d:120,color:'#dce5e2',floorMaterial:'Tile',opacity:1,ceilingHeight:280},
        {id:uid(),type:'room',name:'Utility bath',x:700,y:100,w:200,d:120,color:'#dce5e2',floorMaterial:'Tile',opacity:1,ceilingHeight:280},
        {id:uid(),type:'room',name:'Planted courtyard',x:500,y:220,w:400,d:300,color:'#d8e6d5',floorMaterial:'Stone',opacity:1,ceilingHeight:280},
        {id:uid(),type:'room',name:'Bedroom two',x:900,y:100,w:350,d:420,color:'#e9e1d7',floorMaterial:'Wood',opacity:1,ceilingHeight:280},
        {id:uid(),type:'room',name:'Garage',x:1250,y:100,w:300,d:420,color:'#deded9',floorMaterial:'Concrete',opacity:1,ceilingHeight:300},
        {id:uid(),type:'room',name:'Living room',x:100,y:520,w:550,d:380,color:'#eee4cf',floorMaterial:'Wood',opacity:1,ceilingHeight:300},
        {id:uid(),type:'room',name:'Kitchen + dining',x:650,y:520,w:250,d:380,color:'#e3e6df',floorMaterial:'Tile',opacity:1,ceilingHeight:300},
        {id:uid(),type:'room',name:'Bedroom three',x:900,y:520,w:350,d:380,color:'#e9e1d7',floorMaterial:'Wood',opacity:1,ceilingHeight:280},
        {id:uid(),type:'room',name:'Garden court',x:1250,y:520,w:300,d:380,color:'#d8e7d6',floorMaterial:'Stone',opacity:.92,ceilingHeight:280}
      ],
      walls: [
        {id:uid(),type:'wall',x1:100,y1:100,x2:1550,y2:100,thickness:15,height:300,color:'#39443f'},
        {id:uid(),type:'wall',x1:1550,y1:100,x2:1550,y2:900,thickness:15,height:300,color:'#39443f'},
        {id:uid(),type:'wall',x1:1550,y1:900,x2:100,y2:900,thickness:15,height:300,color:'#39443f'},
        {id:uid(),type:'wall',x1:100,y1:900,x2:100,y2:100,thickness:15,height:300,color:'#39443f'},
        {id:uid(),type:'wall',x1:100,y1:520,x2:1550,y2:520,thickness:10,height:280,color:'#46514c'},
        {id:uid(),type:'wall',x1:500,y1:100,x2:500,y2:520,thickness:10,height:280,color:'#46514c'},
        {id:uid(),type:'wall',x1:900,y1:100,x2:900,y2:900,thickness:10,height:280,color:'#46514c'},
        {id:uid(),type:'wall',x1:1250,y1:100,x2:1250,y2:900,thickness:10,height:300,color:'#46514c'},
        {id:uid(),type:'wall',x1:650,y1:520,x2:650,y2:900,thickness:10,height:300,color:'#4c5752'},
        {id:uid(),type:'wall',x1:500,y1:220,x2:900,y2:220,thickness:10,height:280,color:'#4c5752'},
        {id:uid(),type:'wall',x1:700,y1:100,x2:700,y2:220,thickness:10,height:280,color:'#4c5752'}
      ],
      items: [
        {id:uid(),type:'queen-bed',name:'Primary bed',x:195,y:140,w:160,d:205,height:62,rotation:0,color:'#b9b6ae',material:'Fabric'},
        {id:uid(),type:'wardrobe',name:'Primary wardrobe',x:110,y:330,w:180,d:62,height:225,rotation:0,color:'#9a826a',material:'Wood'},
        {id:uid(),type:'writing-desk',name:'Bedroom desk',x:345,y:325,w:140,d:65,height:76,rotation:0,color:'#987b61',material:'Wood'},
        {id:uid(),type:'toilet',name:'Bathroom toilet',x:515,y:118,w:42,d:70,height:78,rotation:0,color:'#e4e7e4',material:'Ceramic'},
        {id:uid(),type:'bathroom-basin',name:'Bathroom basin',x:620,y:110,w:58,d:48,height:18,elevation:82,rotation:0,color:'#d8ddda',material:'Ceramic'},
        {id:uid(),type:'washing-machine',name:'Washing machine',x:720,y:115,w:62,d:65,height:88,rotation:0,color:'#c4c9c7',material:'Metal'},
        {id:uid(),type:'toilet',name:'Guest toilet',x:825,y:118,w:42,d:70,height:78,rotation:0,color:'#e4e7e4',material:'Ceramic'},
        {id:uid(),type:'queen-bed',name:'Bedroom two bed',x:995,y:140,w:160,d:205,height:62,rotation:0,color:'#b7b4ae',material:'Fabric'},
        {id:uid(),type:'writing-desk',name:'Bedroom two desk',x:1080,y:325,w:140,d:65,height:76,rotation:0,color:'#91765d',material:'Wood'},
        {id:uid(),type:'car',shape:'car',name:'Family car',x:1305,y:92,w:185,d:330,height:150,rotation:0,color:'#405978',material:'Metal'},
        {id:uid(),type:'garage-door',shape:'door',name:'Garage door',x:1260,y:92,w:280,d:16,height:220,rotation:0,openAngle:0,color:'#9d927e',material:'Metal'},
        {id:uid(),type:'sofa',name:'Living sofa',x:180,y:485,w:220,d:90,height:82,rotation:0,color:'#a7aa93',material:'Fabric'},
        {id:uid(),type:'sectional',shape:'sofa',name:'Sectional sofa',x:360,y:510,w:260,d:145,height:84,rotation:90,color:'#9fa58f',material:'Fabric'},
        {id:uid(),type:'coffee-table',shape:'table',name:'Coffee table',x:300,y:670,w:120,d:65,height:42,rotation:0,color:'#aa815b',material:'Wood'},
        {id:uid(),type:'television',shape:'tv',name:'Television',x:115,y:640,w:145,d:18,height:85,elevation:55,rotation:90,color:'#30383b',material:'Glass',transparency:8},
        {id:uid(),type:'round-table',shape:'round-table',name:'Dining table',x:690,y:680,w:125,d:125,height:76,rotation:0,color:'#98704b',material:'Wood'},
        {id:uid(),type:'dining-chair',shape:'chair',name:'Dining chair',x:725,y:610,w:48,d:52,height:92,rotation:0,color:'#8f765f',material:'Wood'},
        {id:uid(),type:'dining-chair',shape:'chair',name:'Dining chair',x:725,y:820,w:48,d:52,height:92,rotation:180,color:'#8f765f',material:'Wood'},
        {id:uid(),type:'dining-chair',shape:'chair',name:'Dining chair',x:640,y:720,w:48,d:52,height:92,rotation:90,color:'#8f765f',material:'Wood'},
        {id:uid(),type:'dining-chair',shape:'chair',name:'Dining chair',x:815,y:720,w:48,d:52,height:92,rotation:270,color:'#8f765f',material:'Wood'},
        {id:uid(),type:'kitchen-run',shape:'kitchen',name:'Kitchen run',x:665,y:545,w:220,d:62,height:92,rotation:0,color:'#b6b8ae',material:'Stone'},
        {id:uid(),type:'queen-bed',name:'Bedroom three bed',x:995,y:590,w:160,d:205,height:62,rotation:0,color:'#b9b6ae',material:'Fabric'},
        {id:uid(),type:'wardrobe',shape:'cabinet',name:'Bedroom three wardrobe',x:1050,y:825,w:180,d:62,height:225,rotation:0,color:'#9a826a',material:'Wood'},
        {id:uid(),type:'l-stairs',shape:'l-stairs',name:'Garden L stair',x:1275,y:545,w:245,d:260,height:280,stairWidth:95,landingDepth:100,stepCount:16,underStorage:false,rotation:0,color:'#c39a66',material:'Wood'},
        {id:uid(),type:'garden-tree',shape:'plant',name:'Courtyard tree',x:660,y:280,w:240,d:240,height:360,rotation:0,color:'#477149',material:'Natural'},
        {id:uid(),type:'planter-box',shape:'planter',name:'Courtyard planter',x:520,y:240,w:160,d:55,height:48,rotation:0,color:'#8b6c4e',material:'Wood'},
        {id:uid(),type:'plant',shape:'plant',name:'Courtyard plant',x:690,y:270,w:55,d:55,height:115,rotation:0,color:'#5f8069',material:'Natural'},
        {id:uid(),type:'window',shape:'window',name:'Primary window',x:215,y:95,w:170,d:10,height:125,elevation:90,rotation:0,transparency:55,color:'#86aeb5',material:'Glass'},
        {id:uid(),type:'window',shape:'window',name:'Bedroom two window',x:990,y:95,w:170,d:10,height:125,elevation:90,rotation:0,transparency:55,color:'#86aeb5',material:'Glass'},
        {id:uid(),type:'window',shape:'window',name:'Living window',x:10,y:560,w:180,d:10,height:135,elevation:75,rotation:90,transparency:55,color:'#86aeb5',material:'Glass'},
        {id:uid(),type:'window',shape:'window',name:'Bedroom three courtyard window',x:815,y:675,w:170,d:10,height:125,elevation:90,rotation:90,transparency:55,color:'#86aeb5',material:'Glass'},
        {id:uid(),type:'door',shape:'door',name:'Main entry',x:50,y:710,w:100,d:12,height:220,rotation:90,openAngle:32,hingeSide:'left',swingSide:1,color:'#9a7959',material:'Wood'},
        {id:uid(),type:'door',shape:'door',name:'Primary door',x:455,y:330,w:90,d:12,height:210,rotation:90,openAngle:30,hingeSide:'right',swingSide:1,color:'#9a7959',material:'Wood'},
        {id:uid(),type:'door',shape:'door',name:'Bedroom two door',x:855,y:320,w:90,d:12,height:210,rotation:90,openAngle:30,hingeSide:'left',swingSide:1,color:'#9a7959',material:'Wood'},
        {id:uid(),type:'door',shape:'door',name:'Bedroom three door',x:855,y:500,w:90,d:12,height:210,rotation:90,openAngle:30,hingeSide:'right',swingSide:-1,color:'#9a7959',material:'Wood'},
        {id:uid(),type:'door',shape:'door',name:'Bathroom door',x:545,y:214,w:80,d:12,height:210,rotation:0,openAngle:30,hingeSide:'left',swingSide:1,color:'#9a7959',material:'Wood'},
        {id:uid(),type:'door',shape:'door',name:'Utility door',x:745,y:214,w:80,d:12,height:210,rotation:0,openAngle:30,hingeSide:'right',swingSide:-1,color:'#9a7959',material:'Wood'},
        {id:uid(),type:'sliding-door',shape:'door',name:'Courtyard slider',x:625,y:514,w:180,d:10,height:220,rotation:0,openAngle:45,color:'#81918c',material:'Glass',transparency:45}
      ],
      dimensions: [
        {id:uid(),type:'dimension',x1:100,y1:65,x2:1550,y2:65,color:'#5f6f68'},
        {id:uid(),type:'dimension',x1:1585,y1:100,x2:1585,y2:900,color:'#5f6f68'}
      ],
      columns: [],
      beams: []
    }], activeFloor: 0
  };

  // ── Scale default plan to true 65 × 35 ft ────────────────────
  function prepareDefaultPlan(p) {
    const f=p.floors[0],ox=100,oy=100,sourceW=1450,sourceD=800,targetW=65*30.48,targetD=35*30.48,sx=targetW/sourceW,sy=targetD/sourceD,tx=x=>ox+(x-ox)*sx,ty=y=>oy+(y-oy)*sy;
    f.rooms.forEach(r=>{r.x=tx(r.x);r.y=ty(r.y);r.w*=sx;r.d*=sy});
    f.walls.forEach(w=>{w.x1=tx(w.x1);w.x2=tx(w.x2);w.y1=ty(w.y1);w.y2=ty(w.y2)});
    f.items.forEach(o=>{const oldCx=o.x+o.w/2,oldCy=o.y+o.d/2,spec=CATALOG.find(x=>x.type===o.type);if(spec){o.w=spec.w;o.d=spec.d;o.height=spec.height||o.height;o.elevation=spec.elevation??o.elevation;o.stairWidth=spec.stairWidth??o.stairWidth;o.landingDepth=spec.landingDepth??o.landingDepth;o.stepCount=spec.stepCount??o.stepCount}o.x=tx(oldCx)-o.w/2;o.y=ty(oldCy)-o.d/2});
    f.dimensions.forEach(d=>{d.x1=tx(d.x1);d.x2=tx(d.x2);d.y1=ty(d.y1);d.y2=ty(d.y2)});
    if(f.columns) f.columns.forEach(c=>{c.x=tx(c.x);c.y=ty(c.y);});
    if(f.beams) f.beams.forEach(b=>{b.x1=tx(b.x1);b.x2=tx(b.x2);b.y1=ty(b.y1);b.y2=ty(b.y2);});
  }
  prepareDefaultPlan(DEFAULT);

  // ── Reference layout override ────────────────────────────────
  function prepareReferenceDefault(p) {
    const f=p.floors[0],room=(name,x,y,w,d,color,floorMaterial='Wood',opacity=1)=>({id:uid(),type:'room',name,x,y,w,d,color,opacity,floorMaterial,ceilingHeight:304.8});
    f.rooms=[
      room('Planted entry court',100,100,457.2,540,'#d8e6d5','Stone'),
      room('Garage + parking stair',563.88,100,457.2,540,'#deded9','Concrete'),
      room('Kitchen + dining',1021.08,100,563.88,540,'#e3e6df','Tile'),
      room('Living room',1584.96,100,496.24,540,'#eee4cf','Wood'),
      room('Bedroom three',563.88,640.08,457.2,526.72,'#e9e1d7','Wood'),
      room('Bedroom two',1021.08,640.08,563.88,526.72,'#e9e1d7','Wood'),
      room('Garden court',1584.96,640.08,496.24,526.72,'#d8e7d6','Stone',.92)
    ];
    f.dimensions=[{id:uid(),type:'dimension',x1:100,y1:65,x2:2081.2,y2:65,color:'#5f6f68'},{id:uid(),type:'dimension',x1:2112,y1:100,x2:2112,y2:1166.8,color:'#5f6f68'}];
    const stairs=f.items.find(o=>o.shape==='l-stairs'||o.type==='l-stairs');
    if(stairs){stairs.type='garage-u-stairs';stairs.shape='u-stairs';stairs.name='Garage parking U stair';stairs.x=563.88;stairs.y=180;stairs.w=457.2;stairs.d=365.76;stairs.height=304.8;stairs.stairWidth=106.68;stairs.landingWidth=457.2;stairs.landingLength=106.68;stairs.landingDepth=106.68;stairs.lowerStepCount=9;stairs.upperStepCount=8;stairs.stepCount=17;stairs.underStorage=false;stairs.parkingUnder=true;stairs.rotation=180;stairs.color='#b88b5c';stairs.material='Wood'}
    const car=f.items.find(o=>o.shape==='car'||o.type==='car');
    if(car){car.x=700;car.y=150;car.w=182.88;car.d=442;car.height=147.32;car.rotation=0;car.parkingClearance=35}
    const garageDoor=f.items.find(o=>o.type==='garage-door');
    if(garageDoor){garageDoor.x=655;garageDoor.y=90;garageDoor.w=274.32;garageDoor.d=19;garageDoor.rotation=0;garageDoor.openAngle=0}
    f.name='Ground floor';p.activeFloor=0;p.name='65 × 35 ft Courtyard House';p.unit='ft';p.version=7;p.camera={yaw:-38,pitch:34,zoom:.5,wallMode:'cutaway',roofMode:'visible',planRoofMode:'visible'};
    return p;
  }
  if(window.ATELIER_REFERENCE_LAYOUT) Object.assign(DEFAULT, deep(window.ATELIER_REFERENCE_LAYOUT));

  // ── Layout repair (one-time migration) ───────────────────────
  function repairFloorLayout(f) {
    const openings=new Set(['door','window']);
    const aabb=o=>({minX:o.x,maxX:o.x+o.w,minY:o.y,maxY:o.y+o.d});
    const hit=(a,b)=>{const x=aabb(a),y=aabb(b);return x.minX<y.maxX&&x.maxX>y.minX&&x.minY<y.maxY&&x.maxY>y.minY};
    f.items.forEach(o=>{
      if(openings.has(o.shape||o.type)) return;
      const cx=o.x+o.w/2, cy=o.y+o.d/2;
      const room=f.rooms.find(r=>cx>=r.x&&cx<=r.x+r.w&&cy>=r.y&&cy<=r.y+r.d);
      if(!room) return;
      const inset=12,rad=(Number(o.rotation)||0)*Math.PI/180,rw=Math.abs(Math.cos(rad))*o.w+Math.abs(Math.sin(rad))*o.d,rd=Math.abs(Math.sin(rad))*o.w+Math.abs(Math.cos(rad))*o.d;
      const safeCx=Math.max(room.x+inset+rw/2,Math.min(cx,room.x+room.w-inset-rw/2));
      const safeCy=Math.max(room.y+inset+rd/2,Math.min(cy,room.y+room.d-inset-rd/2));
      o.x=safeCx-o.w/2; o.y=safeCy-o.d/2;
    });
    const stairs=f.items.filter(o=>['stairs','l-stairs','u-stairs'].includes(o.shape||o.type));
    f.items.filter(o=>o.type==='garden-tree'||o.name?.toLowerCase().includes('tree')).forEach(tree=>{
      if(!stairs.some(s=>hit(tree,s))) return;
      const court=f.rooms.find(r=>/courtyard|garden/i.test(r.name));
      if(court){ tree.x=court.x+Math.max(12,(court.w-tree.w)/2); tree.y=court.y+Math.max(12,(court.d-tree.d)/2); }
    });
  }

  // ── Solar position calculator ────────────────────────────────
  function calculateSolarPosition(sun) {
    const location=sun.location||{},latitude=Math.max(-89,Math.min(89,Number(location.latitude??26.8467))),longitude=Number(location.longitude??80.9462),timezone=Number(location.timezone??5.5),time=Math.max(0,Math.min(23,Number(sun.time??12))),week=Math.max(1,Math.min(52,Math.round(Number(sun.week??26)))),dayOfYear=(week-.5)*7;
    const gamma=2*Math.PI/365*(dayOfYear-1+(time-12)/24),decl=0.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma),eqTime=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma)),solarMinutes=time*60+eqTime+4*longitude-60*timezone,hourAngle=solarMinutes/4-180,latRad=latitude*Math.PI/180,declRad=decl,haRad=hourAngle*Math.PI/180,cosZenith=Math.max(-1,Math.min(1,Math.sin(latRad)*Math.sin(declRad)+Math.cos(latRad)*Math.cos(declRad)*Math.cos(haRad))),solarAltitude=90-Math.acos(cosZenith)*180/Math.PI;
    let azimuth=(Math.atan2(Math.sin(haRad),Math.cos(haRad)*Math.sin(latRad)-Math.tan(declRad)*Math.cos(latRad))*180/Math.PI+180)%360;if(azimuth<0)azimuth+=360;
    const above=Math.max(0,Math.sin(Math.max(0,solarAltitude)*Math.PI/180));
    return {azimuth,altitude:Math.max(2,Math.min(88,solarAltitude)),solarAltitude,intensity:Math.max(.2,Math.min(6,.35+5.2*above))};
  }

  function syncSolarPosition() {
    const project = A.state.project;
    Object.assign(project.sun, calculateSolarPosition(project.sun));
    window.atelier3D?.updateSun(project.sun);
  }

  function formatSolarTime(hour) {
    const h=Math.max(0,Math.min(23,Math.round(Number(hour)||0))),suffix=h<12?'AM':'PM',display=h%12||12;
    return `${display}:00 ${suffix}`;
  }

  function solarWeekDate(week) {
    const day=Math.max(1,Math.min(364,Math.round((Number(week)||1)*7-3)));
    const date=new Date(Date.UTC(2025,0,day));
    return date.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
  }

  // ── Project normalisation / migration ────────────────────────
  function normalizeProject(p) {
    A.migrateSiteSettings(p);p.site={...deep(DEFAULT.site),...p.site};
    const previousVersion=p.version||1,needsLayoutRepair=p.layoutValidated!==true;p.version=8;if(previousVersion<4)p.unit='ft';else p.unit||='ft';p.camera ||= {yaw:-38,pitch:34,zoom:.56};p.camera.wallMode||='cutaway';p.camera.roofMode||='visible';p.camera.planRoofMode||='visible';p.camera.pitch=Math.max(12,Math.min(80,p.camera.pitch||34));p.sun ||= deep(DEFAULT.sun);p.sun.time??=12;p.sun.week??=26;p.sun.location ||= deep(DEFAULT.sun.location);p.sun.location.name ||= 'Lucknow';p.sun.location.latitude=Number.isFinite(Number(p.sun.location.latitude))?Number(p.sun.location.latitude):26.8467;p.sun.location.longitude=Number.isFinite(Number(p.sun.location.longitude))?Number(p.sun.location.longitude):80.9462;p.sun.location.timezone=Number.isFinite(Number(p.sun.location.timezone))?Number(p.sun.location.timezone):5.5;Object.assign(p.sun,calculateSolarPosition(p.sun));p.north ||= 0;
    p.climate ||= deep(DEFAULT.climate); p.vastu ||= deep(DEFAULT.vastu);
    const legacyShapes={chair:'chair',table:'table',bed:'bed',desk:'desk',kitchen:'kitchen',tub:'tub',sofa:'sofa',plant:'plant'};
    const heights={chair:88,table:76,bed:62,desk:76,kitchen:92,tub:58,sofa:82,plant:115};
    p.showStructure ??= true;
    p.framingMode ??= false;
    p.builtUp ||= { width: 1981.2, depth: 1066.8, showBoundary: true, fitMode: 'exact', applyToAllFloors: true };
    p.builtUp.width = Number(p.builtUp.width) || 1981.2;
    p.builtUp.depth = Number(p.builtUp.depth) || 1066.8;
    p.builtUp.showBoundary ??= true;
    p.builtUp.fitMode ||= 'exact';
    p.builtUp.applyToAllFloors ??= true;
    p.floors.forEach(f=>{
      f.rooms ||= []; f.walls ||= []; f.items ||= []; f.dimensions ||= []; f.columns ||= []; f.beams ||= [];
      f.rooms.forEach(r=>{r.ceilingHeight ||= 280;r.floorMaterial||=(/kitchen|bath/i.test(r.name)?'Tile':/terrace|garage/i.test(r.name)?'Stone':'Wood')});
      f.walls.forEach(w=>{w.thickness ??= WALL_DEFAULT_THICKNESS;w.height ??= WALL_DEFAULT_HEIGHT});
      f.columns.forEach((c, idx)=>{c.type='column';c.tag||=`C${idx+1}`;c.w??=A.COLUMN_DEFAULT_WIDTH||23;c.d??=A.COLUMN_DEFAULT_DEPTH||30;c.height??=A.COLUMN_DEFAULT_HEIGHT||300;c.shape||='rect';c.material||='RCC M25';c.steelGrade||='Fe500';c.rebarSpec||='4-T16 + 8mm stirrups @ 150 c/c';c.footingWidth??=120;c.footingDepth??=120;c.footingThickness??=35;c.color||='#24332d'});
      f.beams.forEach((b, idx)=>{b.type='beam';b.tag||=`B${idx+1}`;b.width??=A.BEAM_DEFAULT_WIDTH||23;b.depth??=A.BEAM_DEFAULT_DEPTH||35;b.beamType||='primary';b.material||='RCC M25';b.steelGrade||='Fe500';b.rebarSpec||='Top 2-T12, Bot 2-T16, 8mm @ 150 c/c';b.color||='#2e493e'});
      f.items.forEach(o=>{const source=CATALOG.find(x=>x.type===o.type);if(o.shape==='spiral-stairs'||o.type==='spiral-stairs'){o.type='l-stairs';o.shape='l-stairs';o.w=Math.max(o.w||0,220);o.d=Math.max(o.d||0,240)}o.shape ||= source?.shape||legacyShapes[o.type]||'cabinet';o.height ??= source?.height||heights[o.shape]||80;o.elevation ??= source?.elevation||0;o.clearance??=0;o.lockAspect??=!['door','window'].includes(o.shape);o.material ||= source?.material||'Wood';o.transparency??=source?.transparency??(o.material==='Glass'?45:0);if(source){o.switches??=source.switches;o.breakers??=source.breakers;o.bladeCount??=source.bladeCount;o.lumens??=source.lumens}if(['stairs','l-stairs','u-stairs'].includes(o.shape)){o.stairWidth??=source?.stairWidth||Math.min(100,o.w);o.landingDepth??=source?.landingDepth||100;o.stepCount??=source?.stepCount||16;o.underStorage??=false}if(o.shape==='mirror'){o.reflectionEnabled??=source?.reflectionEnabled??true;o.reflectionStrength??=source?.reflectionStrength??.58;o.reflectionSpread??=source?.reflectionSpread??32;o.roughness??=source?.roughness??.045;o.frameColor??=source?.frameColor??'#4d5552'}if(o.type==='temple-double-door'){o.doorStyle??=source?.doorStyle||'Hindu temple';o.openingStyle??=source?.openingStyle||'Jali openings';o.templeFinial??=source?.templeFinial??true}if(POWERED_TYPES.has(o.shape))o.active??=source?.active??false;if(o.shape==='door'){o.swing ??=90;o.openAngle??=source?.openAngle??30;o.hingeSide||='left';o.swingSide??=1;}});
      f.items.filter(o=>['l-stairs','u-stairs'].includes(o.shape)).forEach(o=>{const total=Math.max(2,Math.min(36,Math.round(o.stepCount||16)));o.lowerStepCount=Math.max(1,Math.min(35,Math.round(o.lowerStepCount??Math.ceil(total/2))));o.upperStepCount=Math.max(1,Math.min(35,Math.round(o.upperStepCount??Math.max(1,total-o.lowerStepCount))));o.stepCount=o.lowerStepCount+o.upperStepCount;o.landingLength??=o.landingDepth||100;o.landingDepth=o.landingLength;o.landingWidth??=(o.shape==='u-stairs'?o.w:o.stairWidth)});
      f.items.filter(o=>o.shape==='three-side-stairs').forEach(o=>{o.stairWidth??=91.44;o.stairStartSide??='short';o.stairHandedness??='left';o.stairTargetRiser??=15.24;o.stairLandingMin??=91.44;o.stairPlatformLength??=91.44;o.lockAspect=false;});
      if(previousVersion<5) f.items.filter(o=>['stairs','l-stairs','u-stairs'].includes(o.shape||o.type)).forEach(o=>o.underStorage=false);
      if(previousVersion<7) f.items.filter(o=>['door','window'].includes(o.shape||o.type)).forEach(o=>o.lockAspect=false);
      if(needsLayoutRepair) repairFloorLayout(f);
    });
    p.layoutValidated=true;
    A.normalizeStructure?.(p);
    return p;
  }

  Object.assign(A, {
    DEFAULT,
    prepareDefaultPlan,
    prepareReferenceDefault,
    repairFloorLayout,
    calculateSolarPosition,
    syncSolarPosition,
    formatSolarTime,
    solarWeekDate,
    normalizeProject
  });
})();
