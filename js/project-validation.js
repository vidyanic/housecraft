/** Validate portable data before migration or replacement of the working project. */
(function () {
  'use strict';
  const A = window.Atelier;
  function validateProject(value) {
    const p = A.deep(value);
    const object = v => v && typeof v === 'object' && !Array.isArray(v);
    if (!object(p) || !Array.isArray(p.floors) || !p.floors.length || p.floors.length > 100) throw new Error('A project must contain 1–100 floors.');
    A.migrateSiteSettings(p);
    if(p.name!=null&&typeof p.name!=='string')throw new Error('Project name must be text.');
    if(p.projectId!=null&&(typeof p.projectId!=='string'||!/^[\w.-]{1,100}$/.test(p.projectId)))throw new Error('Invalid project identifier.');
    if (p.version > 9) throw new Error('This project requires a newer Atelier Plan version.');
    if (p.unit != null && !['cm','m','ft','in'].includes(p.unit)) throw new Error('Unsupported measurement unit.');
    const ids = new Set(); let count = 0;
    function id(o) { o.id ||= A.uid(); if (typeof o.id !== 'string' || !/^[\w.-]{1,100}$/.test(o.id) || ids.has(o.id)) throw new Error('Project IDs must be unique identifiers.'); ids.add(o.id); }
    for (const f of p.floors) {
      if (!object(f)) throw new Error('Invalid floor.');
      id(f); f.name ||= 'Floor'; f.elevation ??= 0;
      if(typeof f.name!=='string')throw new Error('Floor name must be text.');
      if (!Number.isFinite(f.elevation)) throw new Error('Invalid floor elevation.');
      if(f.diaphragm!=null&&!['none','rigid'].includes(f.diaphragm))throw Error('Invalid diaphragm assumption.');
      if(f.isRoof!=null&&typeof f.isRoof!=='boolean')throw Error('Invalid roof level flag.');
      for (const key of ['rooms','walls','items','dimensions','columns','beams','slabs','loads','structuralWalls','grids']) {
        f[key] ??= [];
        if (!Array.isArray(f[key])) throw new Error(`${key} must be an array.`);
        count += f[key].length;
        if (count > 20000) throw new Error('Project exceeds 20,000 objects.');
        for (const o of f[key]) {
          if (!object(o)) throw new Error(`Invalid ${key} object.`);
          id(o);
          if(['loads','grids'].includes(key)){
            if(o.name!=null&&typeof o.name!=='string')throw Error('Invalid structural object name.');
            if(key==='loads'&&(!['dead','live'].includes(o.case)||!Number.isFinite(o.value)||o.value<0||!Number.isFinite(o.x)||!Number.isFinite(o.y)))throw Error('Invalid structural point load.');
            if(key==='grids'&&(!['x','y'].includes(o.axis)||!Number.isFinite(o.position)))throw Error('Invalid structural grid.');
            if(o.columnId!=null&&typeof o.columnId!=='string')throw Error('Invalid load support reference.');
            continue;
          }
          for(const ref of ['startColumnId','endColumnId'])if(o[ref]!=null&&typeof o[ref]!=='string')throw Error('Invalid beam joint reference.');
          for(const k of ['cover','tieDiameter','barDiameter','deadLoad','liveLoad'])if(o[k]!=null&&(!Number.isFinite(o[k])||o[k]<0))throw Error('Invalid structural property: '+k);
          if(o.system!=null&&!['cold-water','hot-water','waste','soil','rainwater','electrical'].includes(o.system))throw new Error('Invalid service system.');
          if(o.mountSurface!=null&&!['floor','wall','roof'].includes(o.mountSurface))throw new Error('Invalid installation surface.');
          if(o.circuit!=null&&typeof o.circuit!=='string')throw new Error('Invalid service label.');
          if(o.diameter!=null&&(!Number.isFinite(o.diameter)||o.diameter<=0||o.diameter>100))throw new Error('Invalid service diameter.');
          if(o.routePoints!=null&&(!Array.isArray(o.routePoints)||o.routePoints.length<2||o.routePoints.length>200||o.routePoints.some(p=>!object(p)||['x','y','z'].some(k=>!Number.isFinite(p[k])||Math.abs(p[k])>1000000))))throw new Error('Invalid service route.');
          if(o.boundaryWallIds!=null&&(!Array.isArray(o.boundaryWallIds)||o.boundaryWallIds.some(v=>typeof v!=='string')))throw new Error('Invalid room boundary references.');
          for(const anchor of [o.anchor1,o.anchor2])if(anchor!=null&&(!object(anchor)||typeof anchor.entityId!=='string'||(anchor.dx!=null&&!Number.isFinite(anchor.dx))||(anchor.dy!=null&&!Number.isFinite(anchor.dy))))throw new Error('Invalid dimension anchor.');
          for(const prop of ['name','type','shape','tag','material','steelGrade','rebarSpec'])if(o[prop]!=null&&typeof o[prop]!=='string')throw new Error(`Invalid ${prop} text.`);
          if(o.freePlacement!=null&&typeof o.freePlacement!=='boolean')throw new Error('Invalid opening attachment mode.');
          if((o.shape||o.type)==='three-side-stairs'){for(const [key,values] of [['stairStartSide',['long','short']],['stairHandedness',['left','right']]])if(o[key]!=null&&!values.includes(o[key]))throw Error('Invalid '+key+'.');for(const key of ['stairWidth','stairTargetRiser','stairLandingMin','stairPlatformLength'])if(o[key]!=null&&(!Number.isFinite(o[key])||o[key]<=0||o[key]>1000000))throw Error('Invalid '+key+'.');}
          if(o.color!=null&&!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(o.color))throw new Error('Object colors must be hex colors.');
          if(o.polygon!=null&&(!Array.isArray(o.polygon)||o.polygon.length<3||o.polygon.length>2000||o.polygon.some(p=>!object(p)||!Number.isFinite(p.x)||!Number.isFinite(p.y))))throw new Error('Invalid room polygon.');
          const rect = ['rooms','items','columns','slabs'].includes(key);
          for (const prop of rect ? ['x','y','w','d'] : ['x1','y1','x2','y2']) {
            if (!Number.isFinite(o[prop]) || Math.abs(o[prop]) > 1000000 || (['w','d'].includes(prop) && o[prop] <= 0)) throw new Error(`Invalid ${prop} in ${o.name || key}.`);
          }
          for (const prop of ['height','thickness','width','depth','rotation','elevation','opacity','transparency','ceilingHeight','stairWidth','stepCount','lowerStepCount','upperStepCount','wallOffset','footingWidth','footingDepth','footingThickness']) {
            if (o[prop] != null && (!Number.isFinite(o[prop]) || (['height','thickness','width','depth'].includes(prop) && o[prop] <= 0))) throw new Error(`Invalid ${prop}.`);
          }
        }
      }
    }
    if (p.activeFloor == null) p.activeFloor = 0;
    for(const f of p.floors)for(const o of f.items||[])if(o.stairUpperFloorId!=null&&(typeof o.stairUpperFloorId!=='string'||o.stairUpperFloorId===f.id||!p.floors.some(upper=>upper.id===o.stairUpperFloorId&&upper.elevation>f.elevation)))throw Error('Invalid stair arrival floor reference.');
    if (!Number.isInteger(p.activeFloor) || p.activeFloor < 0 || p.activeFloor >= p.floors.length) throw new Error('Invalid active floor.');
    for (const key of ['camera','sun','builtUp','climate','vastu','site']) if(p[key] != null && !object(p[key])) throw new Error(`Invalid ${key} settings.`);
    const numeric=(obj,keys)=>{for(const key of keys)if(obj?.[key]!=null&&!Number.isFinite(obj[key]))throw new Error(`Invalid ${key} setting.`);};
    numeric(p.camera,['yaw','pitch','zoom']);numeric(p.sun,['time','week','azimuth','altitude','intensity']);numeric(p.builtUp,['width','depth','originX','originY']);numeric(p.site,['width','depth']);numeric(p,['north']);
    if(p.site.frontSide!=null&&!['','north','west','south','east'].includes(p.site.frontSide))throw Error('Invalid front side.');
    for(const key of ['width','depth'])if(p.site[key]!=null&&(p.site[key]<=0||p.site[key]>1000000))throw Error('Invalid site '+key+'.');
    if(p.site?.sides!=null){if(!object(p.site.sides))throw Error('Invalid site side labels.');for(const [key,side] of Object.entries(p.site.sides)){if(!['north','west','south','east'].includes(key)||!object(side))throw Error('Invalid site edge.');for(const text of ['direction','note'])if(side[text]!=null&&(typeof side[text]!=='string'||side[text].length>(text==='note'?160:80)))throw Error('Invalid site label text.');if(side.status!=null&&!['open','closed','road','none'].includes(side.status))throw Error('Invalid site boundary status.');if(side.measurement!=null&&(!Number.isFinite(side.measurement)||side.measurement<=0||side.measurement>1000000))throw Error('Invalid site edge measurement.');for(const flag of ['visible','showMeasurement'])if(side[flag]!=null&&typeof side[flag]!=='boolean')throw Error('Invalid site label visibility.');}}
    if(p.sun?.location!=null&&!object(p.sun.location))throw new Error('Invalid solar location.');
    if(p.structuralBasis?.soilVerified!=null&&typeof p.structuralBasis.soilVerified!=='boolean')throw Error('Invalid site investigation flag.');
    numeric(p.sun?.location,['latitude','longitude','timezone']);
    if(p.sun?.location){const l=p.sun.location;if(l.name!=null&&(typeof l.name!=='string'||l.name.length>160))throw Error('Invalid solar location name.');if(l.latitude!=null&&Math.abs(l.latitude)>89||l.longitude!=null&&Math.abs(l.longitude)>180||l.timezone!=null&&(l.timezone< -12||l.timezone>14))throw Error('Invalid solar location coordinates or time zone.');}
    for(const key of ['courtyard','crossVentilation','westShading','coolRoof'])if(p.climate?.[key]!=null&&typeof p.climate[key]!=='boolean')throw Error('Invalid climate setting: '+key);
    for(const key of ['enabled','advisory'])if(p.vastu?.[key]!=null&&typeof p.vastu[key]!=='boolean')throw Error('Invalid Vastu setting: '+key);
    for(const key of ['entry','primaryBedroom','kitchen','courtyard','toilets','stairs'])if(p.vastu?.[key]!=null&&(typeof p.vastu[key]!=='string'||p.vastu[key].length>160))throw Error('Invalid Vastu text: '+key);
    if(p.structuralBasis!=null){if(!object(p.structuralBasis))throw Error('Invalid structural basis.');const b=p.structuralBasis;numeric(b,['bearingKpa','importance','responseReduction','slabThickness','finishLoad','liveLoad','liveParticipation','concreteDensity','masonryDensity','storeyHeight','columnStiffness','beamStiffness','zoneFactor','damping','driftLimit','footingClearance']);if(b.footingClearance!=null&&(b.footingClearance<0||b.footingClearance>300))throw Error('Invalid footing clearance.');for(const k of ['bearingKpa','importance','responseReduction','slabThickness','storeyHeight','concreteDensity','masonryDensity','columnStiffness','beamStiffness','zoneFactor','damping','driftLimit'])if(b[k]!=null&&b[k]<=0)throw Error('Invalid structural basis: '+k);for(const k of ['finishLoad','liveLoad'])if(b[k]!=null&&b[k]<0)throw Error('Invalid structural load.');for(const k of ['liveParticipation','columnStiffness','beamStiffness'])if(b[k]!=null&&(b[k]<0||b[k]>1))throw Error('Invalid structural fraction.');if(b.zone!=null&&!['II','III','IV','V'].includes(b.zone))throw Error('Invalid seismic zone.');if(b.soilClass!=null&&!['I','II','III'].includes(b.soilClass))throw Error('Invalid soil class.');}
    if(p.builtUp&&(p.builtUp.width<=0||p.builtUp.depth<=0))throw new Error('Built-up dimensions must be positive.');
    return p;
  }
  A.validateProject = validateProject;
})();
