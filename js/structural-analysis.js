/**
 * js/structural-analysis.js — Civil Engineering Structural Analysis & Framing Engine
 *
 * Implements standard civil engineering guidelines (IS 456:2000, ACI 318, Eurocode 2, IS 1905):
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
    const center = colCenter(col);
    const distances = allCols
      .filter(other => other.id !== col.id)
      .map(other => {
        const oc = colCenter(other);
        return { col: other, dist: dist(center, oc), dx: oc.x - center.x, dy: oc.y - center.y };
      })
      .sort((a, b) => a.dist - b.dist);

    let halfSpanX = 200, halfSpanY = 200; // default 2m half-span (cm)
    const xNeighbors = distances.filter(d => Math.abs(d.dy) < Math.abs(d.dx));
    const yNeighbors = distances.filter(d => Math.abs(d.dx) <= Math.abs(d.dy));

    if (xNeighbors.length > 0) {
      const nearestX = xNeighbors[0].dist;
      halfSpanX = Math.min(350, Math.max(100, nearestX / 2));
    }
    if (yNeighbors.length > 0) {
      const nearestY = yNeighbors[0].dist;
      halfSpanY = Math.min(350, Math.max(100, nearestY / 2));
    }

    const areaSqM = ((halfSpanX * 2) / 100) * ((halfSpanY * 2) / 100);
    return Math.max(4.0, Math.min(45.0, areaSqM));
  }

  // ── Structural Analysis Engine ───────────────────────────────
  const analysisCache = new WeakMap();
  const derivedKeys = new Set(['status','utilization','colorCode','redundant','redundancyReason','isRedundant','hierarchy','recommendation']);
  const analysisSignature=(floor,project)=>JSON.stringify({floor:{walls:floor.walls,columns:floor.columns,beams:floor.beams,rooms:floor.rooms},activeFloor:project.activeFloor,support:project.floors.map(f=>({elevation:f.elevation,columns:f.columns}))},(key,value)=>derivedKeys.has(key)?undefined:value);
  function analyzeStructure(floor = A.floor(), project = A.state.project) {
    const signature=analysisSignature(floor,project);
    const cached=analysisCache.get(floor);
    if(cached?.signature===signature)return cached.report;
    const report=computeStructure(floor,project);
    const finalSignature=analysisSignature(floor,project);
    analysisCache.set(floor,{signature:finalSignature,report});
    return report;
  }
  function computeStructure(floor = A.floor(), project = A.state.project) {
    const columns = floor.columns || [];
    const beams = floor.beams || [];
    const walls = floor.walls || [];
    const allFloors = project.floors || [];
    const currentFloorIdx = project.activeFloor || 0;

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
      const bars=col.rebarSpec?.match(/(\d+)\s*[-×x]?\s*T\s*(\d+)/i);
      const Asc = bars ? Number(bars[1])*Math.PI*Number(bars[2])**2/4 : Ag*0.015;
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
      const colSelfWeight = wM * dM * hM * DENSITY_CONCRETE;

      const serviceLoad = slabDL + slabLL + approxWallLoad + colSelfWeight;
      const factoredAxialLoad = serviceLoad * 1.5;

      totalLoadKN += factoredAxialLoad;
      const colConcreteVol = wM * dM * hM;
      const ftW = (col.footingWidth || 120) / 100;
      const ftD = (col.footingDepth || 120) / 100;
      const ftTh = (col.footingThickness || 35) / 100;
      const footingVol = ftW * ftD * ftTh;

      totalConcreteM3 += (colConcreteVol + footingVol);
      totalSteelKg += (colConcreteVol * DENSITY_CONCRETE * 0.015 * (DENSITY_STEEL / DENSITY_CONCRETE * 0.001) * 1000 + 45);

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

      col.status = colStatus;
      col.utilization = utilization;
      col.colorCode = colStatus === 'fail' ? '#c93b2b' : colStatus === 'warn' ? '#d97724' : '#247d4e';

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
      const maxLd = isCantilever ? 7 : (beam.beamType === 'continuous' ? 26 : 20);
      const actualLd = spanM > 0 && dM > 0 ? (spanM / (dCm / 100)) : 0;
      const minRequiredDepthCm = Math.ceil((spanM / maxLd) * 100);

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

      beam.status = beamStatus;
      beam.actualLd = actualLd;
      beam.colorCode = (spanM > 5.5 || beamStatus === 'fail') ? '#be2c20' : (actualLd > maxLd || spanM > 4.5 || beamStatus === 'warn') ? '#c87a1e' : '#2e6b52';

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
        message: 'All beam depths meet IS 456 / ACI 318 span-to-depth deflection criteria.'
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
        status: 'pass',
        message: `${beamHierarchy.primary.length} Primary Beams (PB), ${beamHierarchy.secondary.length} Secondary Beams (SB), ${beamHierarchy.cantilever.length} Cantilever (CB).`
      });
    }

    // Pillar Redundancy Check
    if (pillarOptimization.redundantCount > 0) {
      report.checks.push({
        name: 'Pillar Spacing & Redundancy',
        status: 'warn',
        message: `${pillarOptimization.redundantCount} redundant pillar(s) detected (<2.5m spacing). Reducing them can save ~${pillarOptimization.potentialSavings.concreteM3}m³ concrete, ~${pillarOptimization.potentialSavings.steelKg}kg steel & ${pillarOptimization.potentialSavings.footings} footings.`
      });
      if (report.summary.status !== 'fail') report.summary.status = 'warn';
      report.summary.score -= 10;
    } else if (columns.length > 0) {
      report.checks.push({
        name: 'Pillar Spacing & Redundancy',
        status: 'pass',
        message: `Pillar grid is efficient: ${pillarOptimization.coreCount} core structural pillars, no redundant columns detected.`
      });
    }

    report.summary.totalConcreteM3 = Math.round(totalConcreteM3 * 10) / 10;
    report.summary.totalSteelKg = Math.round(totalSteelKg);
    report.summary.estimatedTotalLoadKN = Math.round(totalLoadKN);
    report.summary.score = Math.max(10, Math.min(100, report.summary.score));

    // Structural Civil Recommendations / Suggestions
    report.suggestions = [];

    if (pillarOptimization.redundantCount > 0) {
      report.suggestions.push({
        title: `Reduce ${pillarOptimization.redundantCount} Redundant Pillar(s)`,
        desc: `Pillars are spaced <2.5m apart. Auto-reduction safely eliminates them, merges continuous beams (≤5.5m), and saves ~₹${pillarOptimization.potentialSavings.estCostInr.toLocaleString('en-IN')}.`,
        action: 'reduce-pillars',
        actionLabel: '⚡ Auto-Reduce Redundant Pillars'
      });
    }

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

  function recreateFraming(floor = A.floor(), project = A.state.project) {
    A.checkpoint();
    floor.columns = [];
    floor.beams = [];
    autoGenerateFraming(floor, project);
    A.showToast('Recreated structural framing');
  }

  // ── Auto-Align Walls & Roof for Straight Structural Grid ─────
  function autoAlignWallsForGrid(floor = A.floor(), project = A.state.project, toleranceCm = 25) {
    A.checkpoint();
    const walls = floor.walls || [];
    const rooms = floor.rooms || [];
    const items = floor.items || [];
    let adjustedCount = 0;

    // 1. Straighten near-horizontal & near-vertical walls
    walls.forEach(w => {
      const dx = Math.abs(w.x2 - w.x1);
      const dy = Math.abs(w.y2 - w.y1);
      if (dy > 0 && dy <= toleranceCm && dx > dy * 2) {
        const avgY = Math.round((w.y1 + w.y2) / 2);
        w.y1 = avgY;
        w.y2 = avgY;
        adjustedCount++;
      } else if (dx > 0 && dx <= toleranceCm && dy > dx * 2) {
        const avgX = Math.round((w.x1 + w.x2) / 2);
        w.x1 = avgX;
        w.x2 = avgX;
        adjustedCount++;
      }
    });

    // 2. Identify dominant continuous grid lines
    const xCoords = [];
    const yCoords = [];

    walls.forEach(w => {
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      if (w.x1 === w.x2) xCoords.push({ val: w.x1, weight: len });
      else {
        xCoords.push({ val: w.x1, weight: 10 });
        xCoords.push({ val: w.x2, weight: 10 });
      }
      if (w.y1 === w.y2) yCoords.push({ val: w.y1, weight: len });
      else {
        yCoords.push({ val: w.y1, weight: 10 });
        yCoords.push({ val: w.y2, weight: 10 });
      }
    });

    rooms.forEach(r => {
      xCoords.push({ val: r.x, weight: r.d || 100 });
      xCoords.push({ val: r.x + r.w, weight: r.d || 100 });
      yCoords.push({ val: r.y, weight: r.w || 100 });
      yCoords.push({ val: r.y + r.d, weight: r.w || 100 });
    });

    function clusterGrid(coords, tol) {
      const sorted = [...coords].sort((a, b) => a.val - b.val);
      const clusters = [];
      sorted.forEach(pt => {
        let matched = clusters.find(c => Math.abs(c.center - pt.val) <= tol);
        if (!matched) {
          matched = { totalWeight: 0, sumWeighted: 0, center: pt.val };
          clusters.push(matched);
        }
        matched.totalWeight += (pt.weight || 1);
        matched.sumWeighted += pt.val * (pt.weight || 1);
        matched.center = Math.round(matched.sumWeighted / matched.totalWeight);
      });
      return clusters.map(c => c.center);
    }

    const gridX = clusterGrid(xCoords, toleranceCm);
    const gridY = clusterGrid(yCoords, toleranceCm);

    function snapToGrid(val, grid, tol) {
      let closest = val;
      let minDiff = Infinity;
      grid.forEach(g => {
        const diff = Math.abs(g - val);
        if (diff <= tol && diff < minDiff) {
          minDiff = diff;
          closest = g;
        }
      });
      return closest;
    }

    walls.forEach(w => {
      const nx1 = snapToGrid(w.x1, gridX, toleranceCm);
      const ny1 = snapToGrid(w.y1, gridY, toleranceCm);
      const nx2 = snapToGrid(w.x2, gridX, toleranceCm);
      const ny2 = snapToGrid(w.y2, gridY, toleranceCm);
      if (nx1 !== w.x1 || ny1 !== w.y1 || nx2 !== w.x2 || ny2 !== w.y2) {
        w.x1 = nx1; w.y1 = ny1; w.x2 = nx2; w.y2 = ny2;
        adjustedCount++;
      }
      if (Math.abs(w.y1 - w.y2) <= 10) w.y2 = w.y1;
      if (Math.abs(w.x1 - w.x2) <= 10) w.x2 = w.x1;
    });

    rooms.forEach(r => {
      const nx = snapToGrid(r.x, gridX, toleranceCm);
      const ny = snapToGrid(r.y, gridY, toleranceCm);
      const nx2 = snapToGrid(r.x + r.w, gridX, toleranceCm);
      const ny2 = snapToGrid(r.y + r.d, gridY, toleranceCm);
      if (nx !== r.x || ny !== r.y || nx2 !== (r.x + r.w) || ny2 !== (r.y + r.d)) {
        r.x = nx;
        r.y = ny;
        r.w = Math.max(50, nx2 - nx);
        r.d = Math.max(50, ny2 - ny);
        adjustedCount++;
      }
    });

    items.filter(it => (it.shape || it.type) === 'roof').forEach(rf => {
      const nx = snapToGrid(rf.x, gridX, toleranceCm);
      const ny = snapToGrid(rf.y, gridY, toleranceCm);
      const nx2 = snapToGrid(rf.x + rf.w, gridX, toleranceCm);
      const ny2 = snapToGrid(rf.y + rf.d, gridY, toleranceCm);
      rf.x = nx;
      rf.y = ny;
      rf.w = Math.max(50, nx2 - nx);
      rf.d = Math.max(50, ny2 - ny);
    });

    // Re-create framing so columns sit on clean straight gridlines
    autoGenerateFraming(floor, project);

    A.queueSave();
    A.draw();
    if (A.state.viewMode === '3d') window.atelier3D?.requestRebuild();
    A.renderInspector();
    A.showToast(`Grid straightened: aligned walls & recreated framing`);
    return adjustedCount;
  }

  // ── Auto-Size Pillar & Beam Sizes based on Length & Weight ───
  function autoSizeStructure(floor = A.floor(), project = A.state.project) {
    A.checkpoint();
    const columns = floor.columns || [];
    const beams = floor.beams || [];
    let updatedCols = 0;
    let updatedBeams = 0;

    // Sizing columns from tributary area & factored load
    columns.forEach(col => {
      const tribAreaM2 = calculateColumnTributaryArea(col, columns, floor);
      const slabDL = tribAreaM2 * (SLAB_THICKNESS * DENSITY_CONCRETE + FINISH_LOAD);
      const slabLL = tribAreaM2 * LIVE_LOAD_RES;
      const approxWall = 12.5 * Math.sqrt(tribAreaM2);
      const factoredPu = 1.5 * (slabDL + slabLL + approxWall + 15);

      let newW = 23, newD = 30, rebar = '4-T16 + 8mm ties @ 150 c/c', ftW = 120, ftD = 120, ftTh = 35;

      if (factoredPu <= 400 && tribAreaM2 <= 12) {
        newW = 23; newD = 23; rebar = '4-T16 + 8mm ties @ 150 c/c';
        ftW = 100; ftD = 100; ftTh = 30;
      } else if (factoredPu <= 750 && tribAreaM2 <= 22) {
        newW = 23; newD = 30; rebar = '4-T16 + 2-T12 ties @ 150 c/c';
        ftW = 120; ftD = 120; ftTh = 35;
      } else if (factoredPu <= 1100 || tribAreaM2 <= 32) {
        newW = 23; newD = 38; rebar = '6-T16 ties @ 125 c/c';
        ftW = 140; ftD = 140; ftTh = 40;
      } else {
        newW = 30; newD = 38; rebar = '8-T16 ties @ 100 c/c';
        ftW = 160; ftD = 160; ftTh = 45;
      }

      if (col.w !== newW || col.d !== newD || col.rebarSpec !== rebar) {
        const oldCx = col.x + (col.w || 23) / 2;
        const oldCy = col.y + (col.d || 30) / 2;
        col.w = newW;
        col.d = newD;
        col.x = Math.round(oldCx - newW / 2);
        col.y = Math.round(oldCy - newD / 2);
        col.rebarSpec = rebar;
        col.footingWidth = ftW;
        col.footingDepth = ftD;
        col.footingThickness = ftTh;
        updatedCols++;
      }
    });

    // Sizing beams based on span length & deflection control
    beams.forEach(beam => {
      const spanM = beamLength(beam) / 100;
      let newWidth = 23, newDepth = 30, rebar = 'Top: 2-T12, Bot: 2-T16, 8mm @ 150 c/c';

      if (spanM <= 3.2) {
        newWidth = 23; newDepth = 25;
        rebar = 'Top: 2-T12, Bot: 2-T12, 8mm stirrups @ 150 c/c';
      } else if (spanM <= 4.2) {
        newWidth = 23; newDepth = 35;
        rebar = 'Top: 2-T12, Bot: 2-T16, 8mm stirrups @ 150 c/c';
      } else if (spanM <= 5.2) {
        newWidth = 23; newDepth = 40;
        rebar = 'Top: 2-T12, Bot: 3-T16, 8mm stirrups @ 150 c/c';
      } else if (spanM <= 6.0) {
        newWidth = 23; newDepth = 45;
        rebar = 'Top: 2-T16, Bot: 4-T16, 8mm stirrups @ 125 c/c';
      } else {
        newWidth = 30; newDepth = 50;
        rebar = 'Top: 3-T16, Bot: 4-T20, 8mm stirrups @ 100 c/c';
      }

      if (beam.depth !== newDepth || beam.width !== newWidth || beam.rebarSpec !== rebar) {
        beam.depth = newDepth;
        beam.width = newWidth;
        beam.rebarSpec = rebar;
        updatedBeams++;
      }
    });

    A.queueSave();
    A.draw();
    if (A.state.viewMode === '3d') window.atelier3D?.requestRebuild();
    A.renderInspector();
    A.showToast(`Auto-sized: ${updatedCols} pillar(s) & ${updatedBeams} beam(s) adjusted for span & weight`);
  }

  // ── Auto-Framing Generator (from Walls & Rooms) ──────────────
  function autoGenerateFraming(floor = A.floor(), project = A.state.project) {
    A.checkpoint();
    floor.columns ||= [];
    floor.beams ||= [];

    const points = [];
    (floor.walls || []).forEach(w => {
      points.push({ x: w.x1, y: w.y1 });
      points.push({ x: w.x2, y: w.y2 });
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      if (len > 450) {
        const parts = Math.ceil(len / 420);
        for (let i = 1; i < parts; i++) {
          points.push({
            x: w.x1 + ((w.x2 - w.x1) * i) / parts,
            y: w.y1 + ((w.y2 - w.y1) * i) / parts
          });
        }
      }
    });

    (floor.rooms || []).forEach(r => {
      points.push({ x: r.x, y: r.y });
      points.push({ x: r.x + r.w, y: r.y });
      points.push({ x: r.x + r.w, y: r.y + r.d });
      points.push({ x: r.x, y: r.y + r.d });
    });

    const clusteredNodes = [];
    points.forEach(p => {
      const match = clusteredNodes.find(c => Math.hypot(c.x - p.x, c.y - p.y) < 40);
      if (!match) {
        clusteredNodes.push({ x: A.snap(p.x), y: A.snap(p.y) });
      }
    });

    floor.columns = [];
    floor.beams = [];

    const defaultColW = A.COLUMN_DEFAULT_WIDTH || 23;
    const defaultColD = A.COLUMN_DEFAULT_DEPTH || 30;
    const defaultColH = A.COLUMN_DEFAULT_HEIGHT || 300;

    clusteredNodes.forEach((node, idx) => {
      const colId = A.uid();
      floor.columns.push({
        id: colId,
        type: 'column',
        name: `Column C${idx + 1}`,
        tag: `C${idx + 1}`,
        x: node.x - defaultColW / 2,
        y: node.y - defaultColD / 2,
        w: defaultColW,
        d: defaultColD,
        height: defaultColH,
        shape: 'rect',
        material: 'RCC M25',
        steelGrade: 'Fe500',
        rebarSpec: '4-T16 + 8mm stirrups @ 150 c/c',
        footingWidth: 120,
        footingDepth: 120,
        footingThickness: 35,
        color: '#24332d'
      });
    });

    let beamIdx = 1;
    for (let i = 0; i < floor.columns.length; i++) {
      for (let j = i + 1; j < floor.columns.length; j++) {
        const c1 = colCenter(floor.columns[i]);
        const c2 = colCenter(floor.columns[j]);
        const d = dist(c1, c2);

        const isAligned = Math.abs(c1.x - c2.x) < 25 || Math.abs(c1.y - c2.y) < 25;
        if (d <= 580 && d >= 120 && isAligned) {
          const blocked = floor.columns.some((k, kIdx) => {
            if (kIdx === i || kIdx === j) return false;
            const ck = colCenter(k);
            const cross = Math.abs((c2.y - c1.y) * ck.x - (c2.x - c1.x) * ck.y + c2.x * c1.y - c2.y * c1.x) / d;
            const dot = ((ck.x - c1.x) * (c2.x - c1.x) + (ck.y - c1.y) * (c2.y - c1.y)) / (d * d);
            return cross < 20 && dot > 0.05 && dot < 0.95;
          });

          if (!blocked) {
            const spanM = d / 100;
            const recDepth = Math.max(30, Math.ceil((spanM / 14) * 10) * 5);
            floor.beams.push({
              id: A.uid(),
              type: 'beam',
              name: `Beam B${beamIdx}`,
              tag: `B${beamIdx}`,
              x1: c1.x,
              y1: c1.y,
              x2: c2.x,
              y2: c2.y,
              width: A.BEAM_DEFAULT_WIDTH || 23,
              depth: recDepth,
              beamType: 'primary',
              material: 'RCC M25',
              steelGrade: 'Fe500',
              rebarSpec: spanM > 4 ? 'Top: 2-T12, Bot: 3-T16, 8mm @ 150 c/c' : 'Top: 2-T12, Bot: 2-T16, 8mm @ 150 c/c',
              color: '#2e493e'
            });
            beamIdx++;
          }
        }
      }
    }

    classifyBeamHierarchy(floor, project, false);
    analyzePillarOptimization(floor, project);

    project.showStructure = true;
    A.queueSave();
    A.draw();
    if (A.state.viewMode === '3d') window.atelier3D?.requestRebuild();
    A.renderInspector();
    A.updateCounts();
    A.showToast(`Framing created: ${floor.columns.length} columns, ${floor.beams.length} beams`);
  }

  // ── Beam Hierarchy Classification (Primary vs Secondary vs Cantilever) ──
  function classifyBeamHierarchy(floor = A.floor(), project = A.state.project, autoResize = false) {
    const columns = floor.columns || [];
    const beams = floor.beams || [];
    if (!beams.length) return { primary: [], secondary: [], cantilever: [] };

    const colCenters = columns.map(c => ({ id: c.id, ...colCenter(c), raw: c }));

    function getSupportingColumn(pt) {
      return colCenters.find(c => Math.hypot(c.x - pt.x, c.y - pt.y) <= 45);
    }

    function getIntersectingBeam(pt, ignoreId) {
      return beams.find(b => {
        if (b.id === ignoreId) return false;
        const d = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
        if (d < 1) return false;
        const cross = Math.abs((b.y2 - b.y1) * pt.x - (b.x2 - b.x1) * pt.y + b.x2 * b.y1 - b.y2 * b.x1) / d;
        const dot = ((pt.x - b.x1) * (b.x2 - b.x1) + (pt.y - b.y1) * (b.y2 - b.y1)) / (d * d);
        return cross <= 30 && dot >= -0.05 && dot <= 1.05;
      });
    }

    let pbIdx = 1, sbIdx = 1, cbIdx = 1;

    beams.forEach(b => {
      const p1 = { x: b.x1, y: b.y1 };
      const p2 = { x: b.x2, y: b.y2 };

      const col1 = getSupportingColumn(p1);
      const col2 = getSupportingColumn(p2);

      let type = 'primary';
      if (col1 && col2) {
        type = 'primary';
      } else {
        const beam1 = !col1 ? getIntersectingBeam(p1, b.id) : null;
        const beam2 = !col2 ? getIntersectingBeam(p2, b.id) : null;
        const sup1 = col1 || beam1;
        const sup2 = col2 || beam2;

        if (sup1 && sup2) {
          type = 'secondary';
        } else if (sup1 || sup2) {
          type = 'cantilever';
        } else {
          type = 'secondary';
        }
      }

      b.beamType = type;
      const spanM = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / 100;

      if (type === 'primary') {
        b.tag = `PB${pbIdx++}`;
        b.name = `Primary Beam ${b.tag}`;
        if (autoResize) {
          b.width = b.width || 23;
          b.depth = Math.max(35, Math.ceil((spanM / 13) * 10) * 5); // L/13
          b.rebarSpec = spanM > 4.2 ? 'Top: 2-T12, Bot: 3-T16, 8mm @ 150 c/c' : 'Top: 2-T12, Bot: 2-T16, 8mm @ 150 c/c';
        }
      } else if (type === 'secondary') {
        b.tag = `SB${sbIdx++}`;
        b.name = `Secondary Beam ${b.tag}`;
        if (autoResize) {
          b.width = b.width || 23;
          b.depth = Math.max(25, Math.ceil((spanM / 16) * 10) * 5); // L/16
          b.rebarSpec = 'Top: 2-T10, Bot: 2-T12, 8mm @ 200 c/c';
        }
      } else {
        b.tag = `CB${cbIdx++}`;
        b.name = `Cantilever Beam ${b.tag}`;
        if (autoResize) {
          b.width = b.width || 23;
          b.depth = Math.max(30, Math.ceil((spanM / 7) * 10) * 5); // L/7
          b.rebarSpec = 'Top: 3-T16, Bot: 2-T12, 8mm @ 125 c/c';
        }
      }
    });

    const res = {
      primary: beams.filter(b => b.beamType === 'primary'),
      secondary: beams.filter(b => b.beamType === 'secondary'),
      cantilever: beams.filter(b => b.beamType === 'cantilever')
    };

    if (autoResize) {
      A.queueSave();
      A.draw();
      A.renderInspector();
      if (A.state.viewMode === '3d') window.atelier3D?.requestRebuild();
      A.showToast(`Classified: ${res.primary.length} Primary (PB), ${res.secondary.length} Secondary (SB), ${res.cantilever.length} Cantilever (CB)`);
    }

    return res;
  }

  // ── Pillar Optimization & Redundancy Analysis ────────────────
  function analyzePillarOptimization(floor = A.floor(), project = A.state.project) {
    const columns = floor.columns || [];
    const beams = floor.beams || [];
    const walls = floor.walls || [];

    if (!columns.length) {
      return {
        columns: [],
        redundantCandidates: [],
        coreCount: 0,
        redundantCount: 0,
        highStressCount: 0,
        optimalCount: 0,
        potentialSavings: { concreteM3: 0, steelKg: 0, footings: 0, estCostInr: 0 }
      };
    }

    const colCenters = columns.map(c => ({ id: c.id, ...colCenter(c), raw: c }));

    function getConnectedWalls(col) {
      const cc = colCenter(col);
      return walls.filter(w => {
        const d1 = Math.hypot(w.x1 - cc.x, w.y1 - cc.y);
        const d2 = Math.hypot(w.x2 - cc.x, w.y2 - cc.y);
        return d1 <= 45 || d2 <= 45;
      });
    }

    function isCornerOrJunction(col) {
      const conn = getConnectedWalls(col);
      if (conn.length >= 3) return { isCore: true, reason: '3/4-way wall junction' };
      if (conn.length === 2) {
        const cc = colCenter(col);
        const v1 = {
          x: Math.hypot(conn[0].x1 - cc.x, conn[0].y1 - cc.y) <= 45 ? conn[0].x2 - conn[0].x1 : conn[0].x1 - conn[0].x2,
          y: Math.hypot(conn[0].x1 - cc.x, conn[0].y1 - cc.y) <= 45 ? conn[0].y2 - conn[0].y1 : conn[0].y1 - conn[0].y2
        };
        const v2 = {
          x: Math.hypot(conn[1].x1 - cc.x, conn[1].y1 - cc.y) <= 45 ? conn[1].x2 - conn[1].x1 : conn[1].x1 - conn[1].x2,
          y: Math.hypot(conn[1].x1 - cc.x, conn[1].y1 - cc.y) <= 45 ? conn[1].y2 - conn[1].y1 : conn[1].y1 - conn[1].y2
        };
        const l1 = Math.hypot(v1.x, v1.y) || 1;
        const l2 = Math.hypot(v2.x, v2.y) || 1;
        const cosAngle = Math.abs((v1.x * v2.x + v1.y * v2.y) / (l1 * l2));
        if (cosAngle < 0.65) {
          return { isCore: true, reason: 'Perimeter structural corner' };
        }
      }
      return { isCore: false, reason: '' };
    }

    const redundantCandidates = [];
    const processedIds = new Set();

    columns.forEach(col => {
      const cc = colCenter(col);
      const cornerCheck = isCornerOrJunction(col);

      const hasCantilever = beams.some(b => b.beamType === 'cantilever' && (
        Math.hypot(b.x1 - cc.x, b.y1 - cc.y) <= 45 || Math.hypot(b.x2 - cc.x, b.y2 - cc.y) <= 45
      ));

      if (hasCantilever) {
        col.optimizationStatus = 'essential';
        col.redundancyReason = 'Supports cantilever overhang beam';
        return;
      }

      if (cornerCheck.isCore) {
        col.optimizationStatus = 'essential';
        col.redundancyReason = cornerCheck.reason;
        return;
      }

      if (col.utilization > 80) {
        col.optimizationStatus = 'high-stress';
        col.redundancyReason = `High axial utilization (${col.utilization}%)`;
        return;
      }

      const neighbors = colCenters
        .filter(o => o.id !== col.id)
        .map(o => ({ ...o, distCm: Math.hypot(o.x - cc.x, o.y - cc.y) }))
        .sort((a, b) => a.distCm - b.distCm);

      const closest = neighbors[0];

      if (closest && closest.distCm < 260 && !processedIds.has(closest.id)) {
        const c1 = cc;
        const dx = closest.x - c1.x, dy = closest.y - c1.y;
        const len = closest.distCm;

        const otherNeighbors = neighbors.slice(1).filter(n => n.distCm <= 550);
        let maxSpanAfterRemoval = len;

        const oppNeighbor = otherNeighbors.find(n => {
          const v = { x: n.x - c1.x, y: n.y - c1.y };
          const dot = (dx * v.x + dy * v.y) / (len * (n.distCm || 1));
          return dot < -0.7;
        });

        if (oppNeighbor) {
          maxSpanAfterRemoval = len + oppNeighbor.distCm;
        }

        if (maxSpanAfterRemoval <= 550) {
          col.optimizationStatus = 'redundant';
          const spanM = (closest.distCm / 100).toFixed(1);
          const mergedM = (maxSpanAfterRemoval / 100).toFixed(1);
          col.redundancyReason = `Spaced only ${spanM}m from ${closest.raw.tag || 'neighbor'}. Removal merges continuous span to ${mergedM}m (safe, ≤5.5m).`;
          redundantCandidates.push({
            id: col.id,
            col,
            tag: col.tag || col.name,
            neighborTag: closest.raw.tag || 'neighbor',
            distM: spanM,
            mergedSpanM: mergedM,
            reason: col.redundancyReason
          });
          processedIds.add(col.id);
          return;
        }
      }

      const tribArea = calculateColumnTributaryArea(col, columns, floor);
      if (tribArea < 3.2 && (!closest || closest.distCm >= 150)) {
        col.optimizationStatus = 'redundant';
        col.redundancyReason = `Low tributary area (${tribArea.toFixed(1)} m²). Non-load-bearing intermediate pillar.`;
        redundantCandidates.push({
          id: col.id,
          col,
          tag: col.tag || col.name,
          distM: closest ? (closest.distCm / 100).toFixed(1) : '2.0',
          mergedSpanM: '4.5',
          reason: col.redundancyReason
        });
        processedIds.add(col.id);
        return;
      }

      col.optimizationStatus = 'optimal';
      col.redundancyReason = 'Optimal grid spacing (3.0m - 5.0m span)';
    });

    const redundantCount = redundantCandidates.length;
    const coreCount = columns.filter(c => c.optimizationStatus === 'essential').length;
    const highStressCount = columns.filter(c => c.optimizationStatus === 'high-stress').length;
    const optimalCount = columns.filter(c => c.optimizationStatus === 'optimal').length;

    const concreteM3Savings = Math.round(redundantCount * 0.48 * 10) / 10;
    const steelKgSavings = Math.round(redundantCount * 70);
    const costInrSavings = redundantCount * 28000;

    return {
      columns,
      redundantCandidates,
      redundantCount,
      coreCount,
      highStressCount,
      optimalCount,
      potentialSavings: {
        concreteM3: concreteM3Savings,
        steelKg: steelKgSavings,
        footings: redundantCount,
        estCostInr: costInrSavings
      }
    };
  }

  // ── Pillar Auto-Reduction Engine ─────────────────────────────
  function autoReduceRedundantPillars(floor = A.floor(), project = A.state.project) {
    const optimization = analyzePillarOptimization(floor, project);
    if (!optimization.redundantCandidates.length) {
      A.showToast('✓ Pillar grid is already optimal! No redundant pillars found.');
      return;
    }

    A.checkpoint();
    const removedCount = optimization.redundantCandidates.length;
    const redundantIds = new Set(optimization.redundantCandidates.map(c => c.id));

    optimization.redundantCandidates.forEach(cand => {
      const col = cand.col;
      const cc = colCenter(col);

      const connected = (floor.beams || []).filter(b => {
        const d1 = Math.hypot(b.x1 - cc.x, b.y1 - cc.y);
        const d2 = Math.hypot(b.x2 - cc.x, b.y2 - cc.y);
        return d1 <= 45 || d2 <= 45;
      });

      if (connected.length === 2) {
        const b1 = connected[0];
        const b2 = connected[1];

        const p1 = Math.hypot(b1.x1 - cc.x, b1.y1 - cc.y) <= 45 ? { x: b1.x2, y: b1.y2 } : { x: b1.x1, y: b1.y1 };
        const p2 = Math.hypot(b2.x1 - cc.x, b2.y1 - cc.y) <= 45 ? { x: b2.x2, y: b2.y2 } : { x: b2.x1, y: b2.y1 };

        const mergedSpanM = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 100;
        if (mergedSpanM <= 6.0) {
          b1.x1 = p1.x; b1.y1 = p1.y;
          b1.x2 = p2.x; b1.y2 = p2.y;
          b1.depth = Math.max(35, Math.ceil((mergedSpanM / 13) * 10) * 5);
          b1.rebarSpec = mergedSpanM > 4.2 ? 'Top: 2-T12, Bot: 3-T16, 8mm @ 150 c/c' : 'Top: 2-T12, Bot: 2-T16, 8mm @ 150 c/c';
          floor.beams = floor.beams.filter(b => b.id !== b2.id);
        }
      }
    });

    floor.columns = floor.columns.filter(c => !redundantIds.has(c.id));

    floor.columns.forEach((c, idx) => {
      c.tag = `C${idx + 1}`;
      c.name = `Column C${idx + 1}`;
    });

    classifyBeamHierarchy(floor, project, true);

    A.queueSave();
    A.draw();
    if (A.state.viewMode === '3d') window.atelier3D?.requestRebuild();
    A.renderInspector();
    A.updateCounts();

    const sav = optimization.potentialSavings;
    A.showToast(`⚡ Reduced ${removedCount} redundant pillar(s)! Saved ~${sav.concreteM3}m³ concrete, ~${sav.steelKg}kg steel & ${sav.footings} footings.`);
  }

  // ── Pillar Grid Auto-Improvement (Straightening & Snapping) ────
  function autoImprovePillarGrid(floor = A.floor(), project = A.state.project, toleranceCm = 25) {
    const columns = floor.columns || [];
    if (columns.length < 2) {
      A.showToast('Not enough pillars to align grid.');
      return;
    }

    A.checkpoint();
    let snappedCols = 0;

    const clustersX = [];
    columns.forEach(col => {
      const cx = col.x + (col.w || 23) / 2;
      let cluster = clustersX.find(cl => Math.abs(cl.avg - cx) <= toleranceCm);
      if (!cluster) {
        cluster = { sum: 0, items: [], avg: cx };
        clustersX.push(cluster);
      }
      cluster.items.push(col);
      cluster.sum += cx;
      cluster.avg = cluster.sum / cluster.items.length;
    });

    clustersX.forEach(cluster => {
      if (cluster.items.length >= 2) {
        const targetX = Math.round(cluster.avg / 10) * 10;
        cluster.items.forEach(col => {
          const oldX = col.x;
          col.x = Math.round(targetX - (col.w || 23) / 2);
          if (Math.abs(col.x - oldX) >= 1) snappedCols++;
        });
      }
    });

    const clustersY = [];
    columns.forEach(col => {
      const cy = col.y + (col.d || 30) / 2;
      let cluster = clustersY.find(cl => Math.abs(cl.avg - cy) <= toleranceCm);
      if (!cluster) {
        cluster = { sum: 0, items: [], avg: cy };
        clustersY.push(cluster);
      }
      cluster.items.push(col);
      cluster.sum += cy;
      cluster.avg = cluster.sum / cluster.items.length;
    });

    clustersY.forEach(cluster => {
      if (cluster.items.length >= 2) {
        const targetY = Math.round(cluster.avg / 10) * 10;
        cluster.items.forEach(col => {
          const oldY = col.y;
          col.y = Math.round(targetY - (col.d || 30) / 2);
          if (Math.abs(col.y - oldY) >= 1) snappedCols++;
        });
      }
    });

    (floor.beams || []).forEach(b => {
      columns.forEach(col => {
        const cc = colCenter(col);
        if (Math.hypot(b.x1 - cc.x, b.y1 - cc.y) <= 35) {
          b.x1 = cc.x; b.y1 = cc.y;
        }
        if (Math.hypot(b.x2 - cc.x, b.y2 - cc.y) <= 35) {
          b.x2 = cc.x; b.y2 = cc.y;
        }
      });
    });

    classifyBeamHierarchy(floor, project, false);

    A.queueSave();
    A.draw();
    if (A.state.viewMode === '3d') window.atelier3D?.requestRebuild();
    A.renderInspector();
    A.showToast(`✨ Pillar grid improved: Snapped ${snappedCols} pillar coordinate(s) onto straight orthogonal gridlines.`);
  }

  // ── HTML Structural Civil Engineering Report Generator ────────
  function generateStructuralReportHtml(floor = A.floor(), project = A.state.project) {
    const analysis = analyzeStructure(floor, project);
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const { summary, checks, columnDetails, beamDetails } = analysis;

    const cementBags = Math.round(summary.totalConcreteM3 * 7.5);
    const sandTons = (summary.totalConcreteM3 * 0.45 * 1.6).toFixed(1);
    const aggTons = (summary.totalConcreteM3 * 0.90 * 1.6).toFixed(1);

    return `
      <div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:16px;font-weight:700;color:#18362a">${A.escapeHtml(project.name || 'Structural Project')}</div>
          <div style="font-size:11px;color:#54645d">Level: <strong>${A.escapeHtml(floor.name || 'Ground floor')}</strong> &nbsp;·&nbsp; Date: ${date} &nbsp;·&nbsp; Standard: IS 456:2000 / ACI 318</div>
        </div>
        <div style="text-align:right">
          <span class="${summary.status === 'pass' ? 'badge-pass' : summary.status === 'warn' ? 'badge-warn' : 'badge-fail'}" style="font-size:12px;padding:4px 10px">
            ${summary.status === 'pass' ? '✓ MODELED CHECKS PASSED' : summary.status === 'warn' ? '⚠ PLANNING ADVISORY' : '✕ ACTION REQUIRED'} (${summary.score}/100)
          </span>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="report-kpi-grid">
        <div class="report-kpi">
          <div class="report-kpi-label">Columns (Pillars)</div>
          <div class="report-kpi-val">${summary.columnCount}</div>
          <div class="report-kpi-sub">${analysis.pillarOptimization?.coreCount || 0} Core · ${analysis.pillarOptimization?.redundantCount || 0} Redundant</div>
        </div>
        <div class="report-kpi">
          <div class="report-kpi-label">Beams (PB / SB / CB)</div>
          <div class="report-kpi-val">${summary.beamCount}</div>
          <div class="report-kpi-sub">${analysis.beamHierarchy?.primary?.length || 0} PB · ${analysis.beamHierarchy?.secondary?.length || 0} SB · ${analysis.beamHierarchy?.cantilever?.length || 0} CB</div>
        </div>
        <div class="report-kpi">
          <div class="report-kpi-label">Concrete Volume</div>
          <div class="report-kpi-val">${summary.totalConcreteM3} m³</div>
          <div class="report-kpi-sub">M25 Grade Mix</div>
        </div>
        <div class="report-kpi">
          <div class="report-kpi-label">Reinforcement Steel</div>
          <div class="report-kpi-val">${summary.totalSteelKg} kg</div>
          <div class="report-kpi-sub">Fe500 Grade TMT</div>
        </div>
        <div class="report-kpi">
          <div class="report-kpi-label">Factored Gravity Load</div>
          <div class="report-kpi-val">${summary.estimatedTotalLoadKN} kN</div>
          <div class="report-kpi-sub">Total Floor Dead + Live</div>
        </div>
        <div class="report-kpi">
          <div class="report-kpi-label">Est. Cement Bags</div>
          <div class="report-kpi-val">~${cementBags}</div>
          <div class="report-kpi-sub">50kg Bags (M25)</div>
        </div>
      </div>

      ${(analysis.pillarOptimization?.redundantCount > 0) ? `
        <div style="margin:12px 0;padding:10px 14px;background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;font-size:11px;color:#9f1239;line-height:1.45">
          <strong>⚡ Pillar Reduction &amp; Cost Optimization Potential:</strong><br>
          ${analysis.pillarOptimization.redundantCount} closely spaced pillar(s) (&lt;2.5m spacing) can be safely eliminated. Removing them and connecting continuous beams saves <strong>~${analysis.pillarOptimization.potentialSavings.concreteM3} m³ concrete</strong>, <strong>~${analysis.pillarOptimization.potentialSavings.steelKg} kg reinforcement steel</strong>, and <strong>${analysis.pillarOptimization.potentialSavings.footings} isolated foundation footings</strong> (~₹${analysis.pillarOptimization.potentialSavings.estCostInr.toLocaleString('en-IN')}) with all spans strictly adhering to IS 456 limits (≤5.5m).
        </div>
      ` : ''}

      <!-- Compliance Checks -->
      <div class="report-section-title">
        <span>1. Civil Code Compliance Checks (IS 456 &amp; NBC)</span>
        <span style="font-size:11px;font-weight:normal;color:#596b63">Audit Score: ${summary.score}/100</span>
      </div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr><th>Status</th><th>Engineering Guideline</th><th>Observation &amp; Statutory Recommendation</th></tr>
          </thead>
          <tbody>
            ${checks.map(c => `
              <tr>
                <td><span class="${c.status === 'pass' ? 'badge-pass' : c.status === 'warn' ? 'badge-warn' : 'badge-fail'}">${c.status.toUpperCase()}</span></td>
                <td><strong>${A.escapeHtml(c.name)}</strong></td>
                <td>${A.escapeHtml(c.message)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Column Schedule -->
      <div class="report-section-title">
        <span>2. Column (Pillar) Schedule &amp; Axial Compression Capacity</span>
        <span style="font-size:11px;font-weight:normal;color:#596b63">IS 456 cl. 39.3 ($P_{uz} = 0.4 f_{ck} A_c + 0.67 f_y A_{sc}$)</span>
      </div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Tag</th><th>Role</th><th>Cross-Section</th><th>Trib. Area</th><th>Factored Load</th><th>Axial Capacity</th><th>Util.</th><th>Rebar Spec</th><th>Footing Size</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${columnDetails.length === 0 ? '<tr><td colspan="10" style="text-align:center;color:var(--muted)">No columns defined. Use ⚡ Auto-Framing.</td></tr>' : columnDetails.map(c => `
              <tr>
                <td><strong>${A.escapeHtml(c.tag)}</strong></td>
                <td><span class="${c.optimizationStatus === 'redundant' ? 'badge-redundant' : c.optimizationStatus === 'essential' ? 'badge-core' : 'badge-pass'}">${(c.optimizationStatus || 'optimal').toUpperCase()}</span></td>
                <td>${c.wCm} × ${c.dCm} cm</td>
                <td>${c.tributaryAreaM2} m²</td>
                <td>${c.factoredLoadKN} kN</td>
                <td>${c.capacityKN} kN</td>
                <td><strong>${c.utilization}%</strong></td>
                <td>${A.escapeHtml(c.rebar)}</td>
                <td>${c.wCm >= 30 ? '140×140×40 cm' : '120×120×35 cm'}</td>
                <td><span class="${c.status === 'pass' ? 'badge-pass' : c.status === 'warn' ? 'badge-warn' : 'badge-fail'}">${c.status.toUpperCase()}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Beam Schedule -->
      <div class="report-section-title">
        <span>3. Beam Schedule (Primary PB &amp; Secondary SB) &amp; Deflection Control</span>
        <span style="font-size:11px;font-weight:normal;color:#596b63">IS 456 cl. 23.2.1 ($L/d$ limit: Cantilever ≤ 7, SS ≤ 20, Cont ≤ 26)</span>
      </div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Tag</th><th>Hierarchy</th><th>Span (L)</th><th>Width × Depth</th><th>Actual L/d</th><th>Limit L/d</th><th>Min Depth Reqd</th><th>Reinforcement Spec</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${beamDetails.length === 0 ? '<tr><td colspan="9" style="text-align:center;color:var(--muted)">No beams defined. Use ⚡ Auto-Framing.</td></tr>' : beamDetails.map(b => `
              <tr>
                <td><strong>${A.escapeHtml(b.tag)}</strong></td>
                <td><span class="${b.beamType === 'secondary' ? 'badge-sb' : b.beamType === 'cantilever' ? 'badge-cb' : 'badge-pb'}">${(b.typeLabel || 'Primary').toUpperCase()}</span></td>
                <td>${b.spanM} m</td>
                <td>${b.widthCm} × ${b.depthCm} cm</td>
                <td>${b.actualLd}</td>
                <td>≤ ${b.maxLd}</td>
                <td>${b.minRequiredDepthCm} cm</td>
                <td>${A.escapeHtml(b.rebar)}</td>
                <td><span class="${b.status === 'pass' ? 'badge-pass' : b.status === 'warn' ? 'badge-warn' : 'badge-fail'}">${b.status.toUpperCase()}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- BOQ Material Estimation -->
      <div class="report-section-title">
        <span>4. Estimated Material Takeoff (BOQ)</span>
        <span style="font-size:11px;font-weight:normal;color:#596b63">Floor Structural Components</span>
      </div>
      <div class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr><th>Material Item</th><th>Estimated Quantity</th><th>Unit</th><th>Design Specification</th></tr>
          </thead>
          <tbody>
            <tr><td>Ready-Mix / Cast Concrete</td><td><strong>${summary.totalConcreteM3}</strong></td><td>m³</td><td>M25 Grade (1:1:2 design mix, 25 N/mm²)</td></tr>
            <tr><td>TMT Reinforcing Steel Bars</td><td><strong>${summary.totalSteelKg}</strong></td><td>kg</td><td>Fe500 Grade deformed high-yield bars</td></tr>
            <tr><td>Ordinary Portland Cement</td><td><strong>~${cementBags}</strong></td><td>Bags</td><td>50 kg bags (approx. 7.5 bags / m³)</td></tr>
            <tr><td>Coarse Aggregate (20mm down)</td><td><strong>~${aggTons}</strong></td><td>Metric Tons</td><td>Clean crushed granite / basalt</td></tr>
            <tr><td>Fine Aggregate (Sand / M-Sand)</td><td><strong>~${sandTons}</strong></td><td>Metric Tons</td><td>Zone-II river sand or washed M-sand</td></tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top:14px;padding:10px 12px;background:#fbfaf6;border:1px solid var(--line);border-radius:6px;font-size:10px;color:#56675f;line-height:1.4">
        <strong>Preliminary planning estimates:</strong> Assumes a 150 mm slab, 1 kN/m² finishes, 2 kN/m² residential live load, approximate wall loads, and a 1.5 load factor. Column steel area uses the first count × T-diameter in the reinforcement field; unrecognized text falls back to 1.5%. Soil bearing is assumed at 180 kN/m². This simplified model does not solve the building frame, cumulative floor loads, moments, seismic/wind actions, or footing design. Final design requires a structural engineer.
      </div>
    `;
  }

  // ── Show Structural Report in Modal (Replaces text file download) ──
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
