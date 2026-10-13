/**
 * js/structural-analysis.js — Civil Engineering Structural Analysis & Framing Engine
 *
 * Legacy plan annotations and compatibility APIs for preliminary structural screening.
 * - Pillar/Column spacing and layout rules (optimal 3-5m, max 6m)
 * - Beam span-to-effective-depth ratio (L/d deflection control)
 * - Column tributary area & factored axial load estimation (Pu <= 0.4 fck Ac + 0.67 fy Asc)
 * - Unsupported masonry wall stiffener checks (max 4.5m)
 * - Multi-floor vertical load path continuity (floating column warnings)
 * - Auto-generation of framing (columns & beams) from architectural walls/rooms
 * - Material estimation: Concrete volume (m³), reinforcement steel (kg), and BOQ
 *
 * Depends on: utilities.js, constants.js, app-state.js
 */
(function () {
  'use strict';
  const A = window.Atelier;

  // ── Civil Engineering Constants ──────────────────────────────
  const DENSITY_CONCRETE = 25.0; // kN/m³
  const DENSITY_MASONRY  = 19.0; // kN/m³
  const DENSITY_STEEL    = 7850; // kg/m³
  const LIVE_LOAD_RES    = 2.0;  // kN/m² (IS 875 Part 2 / Residential)
  const FINISH_LOAD      = 1.0;  // kN/m² (screed, tile, plaster)
  const SLAB_THICKNESS   = 0.15; // 150mm standard RCC slab (m)

  // ── Distance & Geometry Helpers ──────────────────────────────
  function dist(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  function beamLength(b) {
    return Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
  }

  function colCenter(c) {
    return { x: c.x + (c.w || 23) / 2, y: c.y + (c.d || 30) / 2 };
  }

  // ── Column Tributary Area Calculation ────────────────────────
  function calculateColumnTributaryArea(col, allCols, floor) {
    return A.tributaryAssignment({...floor,columns:allCols},A.state.project).alloc.get(col.id)||0;
  }

  // ── Structural Analysis Engine ───────────────────────────────
  const analysisCache = new WeakMap();
  const derivedKeys = new Set(['status','utilization','colorCode','redundant','redundancyReason','isRedundant','hierarchy','recommendation']);
  const analysisSignature=(floor,project)=>floor.id+'|'+A.structuralSignature(project);
  function analyzeStructure(floor = A.floor(), project = A.state.project) {
    const signature=analysisSignature(floor,project);
    const cached=analysisCache.get(floor);
    if(cached?.signature===signature)return cached.report;
    const report=computeStructure(floor,project);
    const finalSignature=analysisSignature(floor,project);
    analysisCache.set(floor,{signature:finalSignature,report,annotations:new Map([...report.columnDetails,...report.beamDetails].map(o=>[o.id,o]))});
    return report;
  }
  function computeStructure(floor = A.floor(), project = A.state.project) {
    const columns = floor.columns || [];
    const beams = floor.beams || [];
    const walls = floor.walls || [];
    const allFloors = [...project.floors||[]].sort((a,b)=>a.elevation-b.elevation);
    const currentFloorIdx = allFloors.findIndex(f=>f.id===floor.id);
    const gravity=A.gravityModel(project),floorGravity=gravity.floors.get(floor.id);

    const report = {
      summary: {
        columnCount: columns.length,
        beamCount: beams.length,
        totalConcreteM3: 0,
        totalSteelKg: 0,
        estimatedTotalLoadKN: 0,
        status: 'pass', // 'pass' | 'warn' | 'fail'
        score: 100
      },
      checks: [],
      columnDetails: [],
      beamDetails: []
    };

    const beamHierarchy = classifyBeamHierarchy(floor, project, false);
    const pillarOptimization = analyzePillarOptimization(floor, project);
    report.beamHierarchy = beamHierarchy;
    report.pillarOptimization = pillarOptimization;

    let totalConcreteM3 = 0;
    let totalSteelKg = 0;
    let totalLoadKN = 0;

    // ── 1. Column Sizing, Axial Loads & Spacing Check ───────────
    const colCenters = columns.map(c => ({ id: c.id, ...colCenter(c), raw: c }));

    columns.forEach(col => {
      const wM = (col.w || 23) / 100;
      const dM = (col.d || 30) / 100;
      const hM = (col.height || 300) / 100;
      const fck = Number(col.material?.match(/M(\d+)/)?.[1]) || 25;
      const fy = Number(col.steelGrade?.match(/Fe(\d+)/)?.[1]) || 500;

      // Gross area Ag in mm²
      const Ag = wM * 1000 * (dM * 1000) * (col.shape==='circle'?Math.PI/4:1);
      const groups=A.reinforcementGroups(col.rebarSpec);
      const Asc = A.steelArea(groups);
      const steelPercent = Asc/Ag;
      const Ac = Ag - Asc;

      // Axial capacity Pu_capacity = 0.4*fck*Ac + 0.67*fy*Asc (IS 456 cl. 39.3)
      const Pu_cap_N = 0.4 * fck * Ac + 0.67 * fy * Asc;
      const Pu_capacity_kN = Pu_cap_N / 1000;

      // Load estimation
      const tribAreaM2 = calculateColumnTributaryArea(col, columns, floor);
      const slabDL = tribAreaM2 * (SLAB_THICKNESS * DENSITY_CONCRETE + FINISH_LOAD);
      const slabLL = tribAreaM2 * LIVE_LOAD_RES;
      const approxWallLoad = 12.5 * Math.sqrt(tribAreaM2);
      const colSelfWeight = wM * dM * hM * DENSITY_CONCRETE*(col.shape==='circle'?Math.PI/4:1);

      const demand=floorGravity?.loads.get(col.id);
      const serviceLoad = demand ? demand.dead+demand.live : slabDL+slabLL+colSelfWeight;
      const factoredAxialLoad = serviceLoad * 1.5;

      totalLoadKN += factoredAxialLoad;
      const colConcreteVol = wM * dM * hM*(col.shape==='circle'?Math.PI/4:1);
      const ftW = (col.footingWidth || 120) / 100;
      const ftD = (col.footingDepth || 120) / 100;
      const ftTh = (col.footingThickness || 35) / 100;
      const footingVol = ftW * ftD * ftTh;

      totalConcreteM3 += (colConcreteVol + footingVol);
      totalSteelKg += Asc*hM/1e6*DENSITY_STEEL;

      const utilization = Math.round((factoredAxialLoad / Pu_capacity_kN) * 100);

      let colStatus = 'pass';
      let advice = 'Sufficient cross-section for axial load.';
      if (utilization > 85) {
        colStatus = 'warn';
        advice = 'High axial stress (>85%). Consider increasing section to 300x380mm.';
      }
      if (utilization > 100) { colStatus='fail'; advice='Estimated axial demand exceeds capacity. Review loads and reinforcement before sizing.'; }
      if (steelPercent < .008 || steelPercent > .06) { colStatus='fail'; advice='Longitudinal reinforcement ratio is outside the modeled range (0.8–6%).'; }
      if (wM < 0.20 || dM < 0.20) {
        colStatus = 'fail';
        advice = 'Below minimum structural size (200mm / 8") for framed construction.';
      }


      const neighbors = colCenters
        .filter(o => o.id !== col.id)
        .map(o => dist(colCenter(col), o))
        .sort((a, b) => a - b);
      const nearestDistM = neighbors.length ? (neighbors[0] / 100) : 0;

      report.columnDetails.push({
        id: col.id,
        tag: col.tag || col.name || 'Column',
        wCm: col.w || 23,
        dCm: col.d || 30,
        heightCm: col.height || 300,
        tributaryAreaM2: Math.round(tribAreaM2 * 10) / 10,
        factoredLoadKN: Math.round(factoredAxialLoad),
        capacityKN: Math.round(Pu_capacity_kN),
        utilization,
        nearestSpanM: Math.round(nearestDistM * 100) / 100,
        status: colStatus,
        optimizationStatus: col.optimizationStatus || 'optimal',
        redundancyReason: col.redundancyReason || '',
        advice,
        rebar: col.rebarSpec || (utilization > 60 ? '6-T16 + 8mm ties @ 150 c/c' : '4-T16 + 8mm ties @ 150 c/c')
      });
    });

    // ── 2. Beam Span-to-Effective-Depth Ratio Check (IS 456 cl. 23.2.1) ──
    beams.forEach(beam => {
      const lenCm = beamLength(beam);
      const spanM = lenCm / 100;
      const bM = (beam.width || 23) / 100;
      const dCm = beam.depth || 35;
      const dM = dCm / 100;

      const isCantilever = beam.beamType === 'cantilever';
      const maxLd = beam.supportCondition==='cantilever'||isCantilever ? 7 : (beam.supportCondition==='continuous' ? 26 : 20);
      const actualLd = spanM > 0 ? spanM/(A.effectiveDepth(beam)/100) : 0;
      const minRequiredDepthCm = Math.ceil((spanM/maxLd)*100+(beam.cover??2.5)+(beam.tieDiameter??.8)+(beam.barDiameter??1.6)/2);

      const beamVol = bM * dM * spanM;
      totalConcreteM3 += beamVol;
      totalSteelKg += (beamVol * 110);

      let beamStatus = 'pass';
      let advice = `L/d ratio (${actualLd.toFixed(1)}) conforms to IS 456 deflection limit (≤${maxLd}).`;

      if (actualLd > maxLd) {
        beamStatus = 'warn';
        advice = `Deflection warning: Span ${spanM.toFixed(1)}m requires min depth ${minRequiredDepthCm}cm (current: ${dCm}cm).`;
      }
      if (spanM > 6.0) {
        beamStatus = actualLd > maxLd ? 'fail' : 'warn';
        advice = `Span (${spanM.toFixed(1)}m) > 6.0m: Consider deeper beam (≥45cm) or intermediate column.`;
      }


      report.beamDetails.push({
        id: beam.id,
        tag: beam.tag || beam.name || 'Beam',
        beamType: beam.beamType || 'primary',
        typeLabel: beam.beamType === 'cantilever' ? 'Cantilever' : beam.beamType === 'secondary' ? 'Secondary' : 'Primary',
        spanM: Math.round(spanM * 100) / 100,
        widthCm: beam.width || 23,
        depthCm: dCm,
        actualLd: Math.round(actualLd * 10) / 10,
        maxLd,
        minRequiredDepthCm,
        status: beamStatus,
        advice,
        rebar: beam.rebarSpec || (spanM > 4.5 ? 'Top: 2-T12, Bot: 3-T16, 8mm stirrups @ 150 c/c' : 'Top: 2-T12, Bot: 2-T16, 8mm stirrups @ 150 c/c')
      });
    });

    // ── 3. Civil Guidelines Audit List ─────────────────────────
    if (columns.length === 0) {
      report.checks.push({
        name: 'Structural Framing',
        status: 'fail',
        message: 'No pillars/columns defined. Auto-generate or place pillars at wall junctions.'
      });
      report.summary.status = 'fail';
      report.summary.score -= 40;
    } else {
      report.checks.push({
        name: 'Column Grid Count',
        status: 'pass',
        message: `${columns.length} pillars/columns defined on this floor.`
      });
    }

    const longSpans = report.beamDetails.filter(b => b.spanM > 5.5);
    const failedColumns=report.columnDetails.filter(c=>c.status==='fail');
    if(failedColumns.length){report.checks.push({name:'Column capacity / reinforcement',status:'fail',message:`${failedColumns.length} column(s) exceed the modeled demand or reinforcement limits.`});report.summary.status='fail';report.summary.score-=25;}
    if (longSpans.length > 0) {
      report.checks.push({
        name: 'Column Spacing (Max 5.5m)',
        status: 'warn',
        message: `${longSpans.length} beam span(s) exceed 5.5m. Intermediate column or heavier beam recommended.`
      });
      report.summary.score -= 15;
      if (report.summary.status !== 'fail') report.summary.status = 'warn';
    } else if (columns.length > 0) {
      report.checks.push({
        name: 'Column Spacing (Max 5.5m)',
        status: 'pass',
        message: 'All column spans are within standard residential limits (≤5.5m).'
      });
    }

    const deflectionIssues = report.beamDetails.filter(b => b.status !== 'pass');
    if (deflectionIssues.length > 0) {
      report.checks.push({
        name: 'Beam Deflection (L/d Limits)',
        status: 'warn',
        message: `${deflectionIssues.length} beam(s) have inadequate depth for span deflection (IS 456 cl. 23.2.1).`
      });
      report.summary.score -= 15;
      if (report.summary.status !== 'fail') report.summary.status = 'warn';
    } else if (beams.length > 0) {
      report.checks.push({
        name: 'Beam Deflection (L/d Limits)',
        status: 'pass',
        message: 'Basic span/effective-depth screening passed. Modification factors and full deflection analysis are not computed.'
      });
    }

    const unreinforcedWalls = walls.filter(w => {
      const lenM = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / 100;
      if (lenM <= 4.5) return false;
      const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
      return !columns.some(c => {
        const cc = colCenter(c);
        return Math.hypot(cc.x - mx, cc.y - my) < 80;
      });
    });

    if (unreinforcedWalls.length > 0) {
      report.checks.push({
        name: 'Wall Stiffener Limit (4.5m)',
        status: 'warn',
        message: `${unreinforcedWalls.length} wall(s) exceed 4.5m without intermediate stiffener pillar (IS 1905).`
      });
      report.summary.score -= 10;
      if (report.summary.status !== 'fail') report.summary.status = 'warn';
    } else {
      report.checks.push({
        name: 'Wall Stiffener Limit (4.5m)',
        status: 'pass',
        message: 'All wall lengths are adequately braced or under 4.5m.'
      });
    }

    if (currentFloorIdx > 0 && allFloors.length > 1) {
      const lowerFloor = allFloors[currentFloorIdx - 1];
      const lowerCols = lowerFloor.columns || [];
      const floatingCols = columns.filter(col => {
        const cc = colCenter(col);
        return !lowerCols.some(lc => {
          const lcc = colCenter(lc);
          return Math.hypot(cc.x - lcc.x, cc.y - lcc.y) < 45;
        });
      });

      if (floatingCols.length > 0) {
        report.checks.push({
          name: 'Load Path Continuity',
          status: 'fail',
          message: `CRITICAL: ${floatingCols.length} floating column(s) on this floor have no supporting pillar below (IS 1893 seismic risk).`
        });
        report.summary.status = 'fail';
        report.summary.score -= 30;
      } else {
        report.checks.push({
          name: 'Load Path Continuity',
          status: 'pass',
          message: 'All upper columns align vertically with columns below.'
        });
      }
    }

    // Beam Hierarchy Check
    if (beams.length > 0) {
      report.checks.push({
        name: 'Beam Hierarchy (PB / SB / CB)',
        status: beamHierarchy.unsupported.length?'fail':'pass',
        message: `${beamHierarchy.primary.length} column-to-column beams, ${beamHierarchy.cantilever.length} cantilevers, ${beamHierarchy.unsupported.length} unsupported or inconsistent connections.`
      });
    }

    if(columns.length)report.checks.push({name:'Column removal review',status:'warn',message:'No removal candidates are certified. A verified alternate load path and full member/foundation checks are required.'});

    report.summary.totalConcreteM3 = Math.round(totalConcreteM3 * 10) / 10;
    report.summary.totalSteelKg = Math.round(totalSteelKg);
    report.summary.estimatedTotalLoadKN = Math.round(totalLoadKN);
    report.summary.score = Math.max(10, Math.min(100, report.summary.score));

    // Structural Civil Recommendations / Suggestions
    report.suggestions = [];


    if (longSpans.length > 0) {
      report.suggestions.push({
        title: 'Long Beam Spans (>5.5m)',
        desc: `${longSpans.length} beam(s) exceed 5.5m. Place an intermediate pillar or auto-size depth to ≥45cm.`,
        action: 'auto-size',
        actionLabel: 'Auto-Size Members'
      });
    }
    if (deflectionIssues.length > 0) {
      report.suggestions.push({
        title: 'Deflection Check (L/d Warning)',
        desc: `${deflectionIssues.length} beam(s) have inadequate depth for span deflection (IS 456).`,
        action: 'auto-size',
        actionLabel: 'Auto-Size Members'
      });
    }
    if (unreinforcedWalls.length > 0) {
      report.suggestions.push({
        title: 'Masonry Wall Bracing Limit',
        desc: `${unreinforcedWalls.length} wall(s) exceed 4.5m without intermediate stiffener pillar.`,
        action: 'recreate',
        actionLabel: 'Recreate Framing'
      });
    }
    if (columns.length > 0) {
      report.suggestions.push({
        title: 'Grid Alignment Optimization',
        desc: 'Straighten near-collinear wall & roof lines to eliminate eccentric beam moments and kinking.',
        action: 'align-grid',
        actionLabel: 'Align Walls to Grid'
      });
      report.suggestions.push({
        title: 'Orthogonal Pillar Grid',
        desc: 'Snap pillars onto unified orthogonal gridlines to eliminate eccentric twisting moments.',
        action: 'improve-grid',
        actionLabel: '✨ Auto-Improve Pillar Grid'
      });
    }
    if (beams.length > 0) {
      report.suggestions.push({
        title: 'Detect Primary & Secondary Beams',
        desc: 'Classify PB girders vs SB floor joists and auto-adjust IS 456 section depths.',
        action: 'classify-beams',
        actionLabel: '🔍 Auto-Detect Beam Hierarchy'
      });
    }

    return report;
  }

  // ── Clear & Recreate Structural Framing ───────────────────────
  function clearStructure(floor = A.floor(), project = A.state.project) {
    if ((!floor.columns || floor.columns.length === 0) && (!floor.beams || floor.beams.length === 0)) {
      A.showToast('No columns or beams to clear');
      return;
    }
    A.checkpoint();
    const count = (floor.columns?.length || 0) + (floor.beams?.length || 0);
    floor.columns = [];
    floor.beams = [];
    A.queueSave();
    A.draw();
    if (A.state.viewMode === '3d') window.atelier3D?.requestRebuild();
    A.renderInspector();
    A.updateCounts();
    A.showToast(`Cleared ${count} structural member(s)`);
  }

  function recreateFraming(floor = A.floor()){return A.proposeStructuralFixes?.('generate',floor);}
  function autoAlignWallsForGrid(floor = A.floor()){return A.proposeStructuralFixes?.('align',floor);}
  function autoSizeStructure(floor = A.floor()){return A.proposeStructuralFixes?.('size',floor);}
  function autoGenerateFraming(floor = A.floor()){return A.proposeStructuralFixes?.('generate',floor);}
  function classifyBeamHierarchy(floor = A.floor(), project = A.state.project, autoResize = false){
    if(autoResize)return A.proposeStructuralFixes?.('size',floor);
    const result={primary:[],secondary:[],cantilever:[],unsupported:[]},columns=floor.columns||[];
    for(const b of floor.beams||[]){const support=(key,x,y)=>columns.some(c=>b[key]?c.id===b[key]:b[key]==null&&Math.hypot(colCenter(c).x-b[x],colCenter(c).y-b[y])<1),start=support('startColumnId','x1','y1'),end=support('endColumnId','x2','y2');if(b.supportCondition==='cantilever'&&start!==end)result.cantilever.push(b);else if(start&&end&&b.supportCondition!=='cantilever')result.primary.push(b);else result.unsupported.push(b);}return result;
  }
  function analyzePillarOptimization(floor = A.floor()) {
    const columns=floor.columns||[];
    return {columns,redundantCandidates:[],redundantCount:0,coreCount:0,highStressCount:0,optimalCount:0,potentialSavings:{concreteM3:0,steelKg:0,footings:0,estCostInr:0},scope:'Column removal requires verified alternate load paths and member/foundation design.'};
  }
  function autoReduceRedundantPillars(){return A.proposeStructuralFixes?.('reduce');}
  function autoImprovePillarGrid(floor = A.floor()){return A.proposeStructuralFixes?.('grid',floor);}
  function generateStructuralReportHtml(floor = A.floor(), project = A.state.project){
    if(!A.engineeringReport)return '<p>Use the Structure workspace for current calculation reports.</p>';
    const r=A.engineeringReport(project),e=A.escapeHtml;return '<h1>Structural planning calculations</h1><p>'+e(r.scope)+'</p><p>'+e(r.basis.location)+' · '+e(r.basis.seismicCode)+'</p><p>Gravity balance error: '+r.gravity.balanceError.toFixed(3)+' kN</p><table><thead><tr><th>Member</th><th>Computed check</th><th>Status</th></tr></thead><tbody>'+r.checks.map(c=>'<tr><td>'+e(c.id)+'</td><td>'+e(c.check)+'</td><td>'+e(c.status)+'</td></tr>').join('')+'</tbody></table><h2>Issues / required review</h2><ul>'+r.issues.map(i=>'<li>'+e(i.message)+'</li>').join('')+r.requiredReviews.map(i=>'<li>'+e(i)+' — not computed</li>').join('')+'</ul>';
  }
  function showStructuralReportModal(floor = A.floor(), project = A.state.project) {
    const modal = A.$('#structuralReportModal');
    const content = A.$('#structuralReportContent');
    if (!modal || !content) return;

    content.innerHTML = generateStructuralReportHtml(floor, project);
    modal.classList.add('show');

    // Wire action buttons
    const closeBtn = A.$('#closeReportModalBtn');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('show');
    const footerCloseBtn = A.$('#closeReportFooterBtn');
    if (footerCloseBtn) footerCloseBtn.onclick = () => modal.classList.remove('show');

    const printBtn = A.$('#printReportBtn');
    if (printBtn) printBtn.onclick = () => window.print();

    const copyBtn = A.$('#copyReportBtn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        try {
          navigator.clipboard.writeText(content.innerText || content.textContent);
          A.showToast('Report copied to clipboard');
        } catch (_) {
          A.showToast('Please select and copy text manually');
        }
      };
    }
  }

  // ── Show Sizing Guide Modal ──────────────────────────────────
  function showSizingGuideModal() {
    const modal = A.$('#structuralGuideModal');
    if (!modal) return;
    modal.classList.add('show');

    const closeBtn = A.$('#closeGuideModalBtn');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('show');
    const footerCloseBtn = A.$('#closeGuideFooterBtn');
    if (footerCloseBtn) footerCloseBtn.onclick = () => modal.classList.remove('show');
  }

  // ── Measure House Footprint Bounds (Rooms, Walls, Pillars, Beams) ──
  function getHouseFootprintBounds(floor = A.floor()) {
    const f = floor || A.floor();
    if (!f) return { minX: 100, minY: 100, maxX: 1550, maxY: 900, width: 1450, depth: 800, roomArea: 0 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let count = 0;
    let roomArea = 0;

    // 1. Rooms
    (f.rooms || []).forEach(r => {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.d);
      roomArea += (r.w * r.d);
      count++;
    });

    // 2. Walls (incorporate thickness / 2 to outer face)
    (f.walls || []).forEach(w => {
      const halfTh = (w.thickness || 15) / 2;
      minX = Math.min(minX, Math.min(w.x1, w.x2) - halfTh);
      minY = Math.min(minY, Math.min(w.y1, w.y2) - halfTh);
      maxX = Math.max(maxX, Math.max(w.x1, w.x2) + halfTh);
      maxY = Math.max(maxY, Math.max(w.y1, w.y2) + halfTh);
      count++;
    });

    // 3. Columns (Pillars)
    (f.columns || []).forEach(c => {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + (c.w || 23));
      maxY = Math.max(maxY, c.y + (c.d || 30));
      count++;
    });

    // 4. Beams
    (f.beams || []).forEach(b => {
      const halfW = (b.width || 23) / 2;
      minX = Math.min(minX, Math.min(b.x1, b.x2) - halfW);
      minY = Math.min(minY, Math.min(b.y1, b.y2) - halfW);
      maxX = Math.max(maxX, Math.max(b.x1, b.x2) + halfW);
      maxY = Math.max(maxY, Math.max(b.y1, b.y2) + halfW);
      count++;
    });

    if (count === 0 || !Number.isFinite(minX)) {
      return { minX: 100, minY: 100, maxX: 1550, maxY: 900, width: 1450, depth: 800, roomArea: 0 };
    }

    return {
      minX: Math.round(minX * 10) / 10,
      minY: Math.round(minY * 10) / 10,
      maxX: Math.round(maxX * 10) / 10,
      maxY: Math.round(maxY * 10) / 10,
      width: Math.round((maxX - minX) * 10) / 10,
      depth: Math.round((maxY - minY) * 10) / 10,
      roomArea
    };
  }

  // ── Measure Project-Wide Footprint Bounds (Across all floors) ──
  function getProjectFootprintBounds(project = A.state.project) {
    const p = project || A.state.project;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let count = 0;

    (p.floors || []).forEach(fl => {
      const b = getHouseFootprintBounds(fl);
      if (b.width > 0 && b.depth > 0) {
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
        count++;
      }
    });

    if (count === 0 || !Number.isFinite(minX)) {
      return getHouseFootprintBounds(A.floor());
    }

    return {
      minX: Math.round(minX * 10) / 10,
      minY: Math.round(minY * 10) / 10,
      maxX: Math.round(maxX * 10) / 10,
      maxY: Math.round(maxY * 10) / 10,
      width: Math.round((maxX - minX) * 10) / 10,
      depth: Math.round((maxY - minY) * 10) / 10
    };
  }

  // ── Auto-Fit House to Built-Up Envelope (Preserving Symmetry & Constraints) ──
  function autoFitHouseToBuiltUp(targetW, targetD, options = {}) {
    const s = A.state;
    const project = s.project;

    const tw = Number(targetW) || project.builtUp?.width || 1981.2;
    const td = Number(targetD) || project.builtUp?.depth || 1066.8;
    const fitMode = options.fitMode || project.builtUp?.fitMode || 'exact';
    const applyAll = options.applyToAllFloors ?? project.builtUp?.applyToAllFloors ?? true;

    if (tw <= 100 || td <= 100) {
      A.showToast('Built-up dimensions must be at least 1m (3.3 ft)');
      return;
    }

    project.builtUp ||= {};
    project.builtUp.width = Math.round(tw * 10) / 10;
    project.builtUp.depth = Math.round(td * 10) / 10;
    if (options.fitMode) project.builtUp.fitMode = options.fitMode;

    const activeFl = A.floor();
    const currentBounds = applyAll ? getProjectFootprintBounds(project) : getHouseFootprintBounds(activeFl);

    if (currentBounds.width <= 10 || currentBounds.depth <= 10) {
      A.showToast('No walls or rooms available to fit');
      return;
    }

    const srcW = currentBounds.width;
    const srcD = currentBounds.depth;
    const origMinX = currentBounds.minX;
    const origMinY = currentBounds.minY;

    // Anchor built-up boundary to wrap the house smoothly from its top-left
    project.builtUp.originX = origMinX;
    project.builtUp.originY = origMinY;

    // Strict Envelope Check: Only reduce dimensions that exceed the target built-up boundary
    const exceedsW = srcW > (tw + 0.5);
    const exceedsD = srcD > (td + 0.5);

    if (!exceedsW && !exceedsD) {
      A.draw();
      A.renderInspector();
      A.showToast(`House already fits within built-up envelope (${A.formatLength(srcW)} × ${A.formatLength(srcD)} ≤ ${A.formatLength(tw)} × ${A.formatLength(td)}). No reduction needed.`);
      return;
    }

    A.checkpoint();

    // Scale factors: ONLY reduce the axis that exceeds the boundary
    let sx = exceedsW ? (tw / srcW) : 1.0;
    let sy = exceedsD ? (td / srcD) : 1.0;

    if (fitMode === 'proportional' && exceedsW && exceedsD) {
      const uniform = Math.min(sx, sy);
      sx = uniform;
      sy = uniform;
    }

    // Top-left anchor for smooth in-place scaling
    const anchorX = origMinX;
    const anchorY = origMinY;

    // Linear mapping functions that guarantee preservation of collinearity & symmetry
    const tx = x => anchorX + (x - origMinX) * sx;
    const ty = y => anchorY + (y - origMinY) * sy;

    const targetFloors = applyAll ? project.floors : [activeFl];

    targetFloors.forEach(f => {
      // 1. Scale Rooms (preserving contiguous shared edges)
      (f.rooms || []).forEach(r => {
        r.x = tx(r.x);
        r.y = ty(r.y);
        r.w = r.w * sx;
        r.d = r.d * sy;
      });

      // 2. Scale Walls (keeping standard wall thickness, endpoints scale synchronously)
      (f.walls || []).forEach(w => {
        w.x1 = tx(w.x1);
        w.y1 = ty(w.y1);
        w.x2 = tx(w.x2);
        w.y2 = ty(w.y2);
      });

      // 3. Scale Pillars / Columns (maintains pillar symmetry & junction seating)
      (f.columns || []).forEach(col => {
        const oldCx = col.x + (col.w || 23) / 2;
        const oldCy = col.y + (col.d || 30) / 2;
        const newCx = tx(oldCx);
        const newCy = ty(oldCy);
        col.x = newCx - (col.w || 23) / 2;
        col.y = newCy - (col.d || 30) / 2;
      });

      // 4. Scale Beams (endpoints align with pillar and wall nodes)
      (f.beams || []).forEach(b => {
        b.x1 = tx(b.x1);
        b.y1 = ty(b.y1);
        b.x2 = tx(b.x2);
        b.y2 = ty(b.y2);
      });

      // 5. Scale Furniture, Openings, Stairs, Roofs
      (f.items || []).forEach(o => {
        const isRf = (o.shape || o.type) === 'roof';
        if (isRf) {
          o.x = tx(o.x);
          o.y = ty(o.y);
          o.w = o.w * sx;
          o.d = o.d * sy;
          return;
        }

        const oldCx = o.x + o.w / 2;
        const oldCy = o.y + o.d / 2;
        const newCx = tx(oldCx);
        const newCy = ty(oldCy);

        // For doors/windows, scale length along the wall if appropriate
        if (o.shape === 'door' || o.shape === 'window') {
          const isVert = Math.abs((Number(o.rotation) || 0) % 180 === 90);
          const wallFactor = isVert ? sy : sx;
          o.w = Math.max(60, Math.min(300, o.w * wallFactor));
        }

        o.x = newCx - o.w / 2;
        o.y = newCy - o.d / 2;

        // Ensure interior furniture stays safely inside scaled rooms
        const room = (f.rooms || []).find(r => newCx >= r.x && newCx <= r.x + r.w && newCy >= r.y && newCy <= r.y + r.d);
        if (room && !['door', 'window'].includes(o.shape)) {
          const inset = 10;
          if (room.w > o.w + inset * 2) {
            o.x = Math.max(room.x + inset, Math.min(room.x + room.w - inset - o.w, o.x));
          }
          if (room.d > o.d + inset * 2) {
            o.y = Math.max(room.y + inset, Math.min(room.y + room.d - inset - o.d, o.y));
          }
        }
      });

      // 6. Scale Dimensions
      (f.dimensions || []).forEach(d => {
        d.x1 = tx(d.x1);
        d.y1 = ty(d.y1);
        d.x2 = tx(d.x2);
        d.y2 = ty(d.y2);
      });
    });

    // 7. Microscopic clamp from anchor if wall thickness slightly exceeds tw/td
    const checkBounds = applyAll ? getProjectFootprintBounds(project) : getHouseFootprintBounds(activeFl);
    const overW = checkBounds.width - tw;
    const overD = checkBounds.depth - td;

    if (overW > 0.5 || overD > 0.5) {
      const corrX = overW > 0.5 ? (tw / checkBounds.width) : 1.0;
      const corrY = overD > 0.5 ? (td / checkBounds.depth) : 1.0;
      const mtx = x => anchorX + (x - anchorX) * corrX;
      const mty = y => anchorY + (y - anchorY) * corrY;

      targetFloors.forEach(f => {
        (f.rooms || []).forEach(r => {
          r.x = mtx(r.x); r.y = mty(r.y); r.w *= corrX; r.d *= corrY;
        });
        (f.walls || []).forEach(w => {
          w.x1 = mtx(w.x1); w.y1 = mty(w.y1); w.x2 = mtx(w.x2); w.y2 = mty(w.y2);
        });
        (f.columns || []).forEach(c => {
          const ocx = c.x + (c.w || 23) / 2, ocy = c.y + (c.d || 30) / 2;
          c.x = mtx(ocx) - (c.w || 23) / 2; c.y = mty(ocy) - (c.d || 30) / 2;
        });
        (f.beams || []).forEach(b => {
          b.x1 = mtx(b.x1); b.y1 = mty(b.y1); b.x2 = mtx(b.x2); b.y2 = mty(b.y2);
        });
        (f.items || []).forEach(o => {
          if ((o.shape || o.type) === 'roof') {
            o.x = mtx(o.x); o.y = mty(o.y); o.w *= corrX; o.d *= corrY;
          } else {
            const ocx = o.x + o.w / 2, ocy = o.y + o.d / 2;
            o.x = mtx(ocx) - o.w / 2; o.y = mty(ocy) - o.d / 2;
          }
        });
        (f.dimensions || []).forEach(d => {
          d.x1 = mtx(d.x1); d.y1 = mty(d.y1); d.x2 = mtx(d.x2); d.y2 = mty(d.y2);
        });
      });
    }

    // Refresh structural analysis with newly sized spans
    if (A.analyzeStructure) {
      A.analyzeStructure(activeFl, project);
    }

    A.queueSave();
    A.draw();
    A.renderInspector();
    if (s.viewMode === '3d') window.atelier3D?.requestRebuild();

    const finalBounds = getHouseFootprintBounds(activeFl);
    const reducedMsg = [];
    if (exceedsW) reducedMsg.push(`width ${A.formatLength(finalBounds.width)}`);
    if (exceedsD) reducedMsg.push(`length ${A.formatLength(finalBounds.depth)}`);
    A.showToast(`Auto-fitted: ${reducedMsg.join(' & ')} (fits envelope ${A.formatLength(tw)} × ${A.formatLength(td)})`);
  }

  // ── Set Built-Up Dimensions ──────────────────────────────────
  function setBuiltUpDimensions(width, depth, autoFit = false) {
    const project = A.state.project;
    project.builtUp ||= {};
    if (width !== undefined) project.builtUp.width = Number(width);
    if (depth !== undefined) project.builtUp.depth = Number(depth);
    if (autoFit) {
      autoFitHouseToBuiltUp(project.builtUp.width, project.builtUp.depth);
    } else {
      A.draw();
      A.renderInspector();
      A.queueSave();
    }
  }

  // ── Expose on global namespace ───────────────────────────────
  Object.assign(A, {
    structuralAnnotation:(id,f=A.floor())=>analysisCache.get(f)?.annotations.get(id),
    analyzeStructure,
    classifyBeamHierarchy,
    analyzePillarOptimization,
    autoReduceRedundantPillars,
    autoImprovePillarGrid,
    autoGenerateFraming,
    clearStructure,
    recreateFraming,
    autoAlignWallsForGrid,
    autoSizeStructure,
    getHouseFootprintBounds,
    getProjectFootprintBounds,
    autoFitHouseToBuiltUp,
    setBuiltUpDimensions,
    generateStructuralReportHtml,
    showStructuralReportModal,
    downloadStructuralReport: showStructuralReportModal,
    showSizingGuideModal
  });
})();
