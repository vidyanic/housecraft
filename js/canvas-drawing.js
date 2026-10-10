/**
 * js/canvas-drawing.js — 2D canvas rendering engine
 *
 * All plan-view drawing: grid, rooms, walls, furniture symbols,
 * dimensions, selection handles, snap guides, drag measurements,
 * multi-selection overlay, isometric 3D preview, and the main
 * draw() orchestrator.
 *
 * Depends on: utilities.js, constants.js, app-state.js
 */
(function () {
  'use strict';
  const A = window.Atelier;

  // ── Local aliases (resolved at call time via A / A.state) ────
  function S()  { return A.state; }
  function ctx(){ return S().ctx; }

  // ── Geometry helpers ─────────────────────────────────────────
  function roundedRect(c,x,y,w,h,r) {
    const rr=Math.min(r,Math.abs(w)/2,Math.abs(h)/2); c.beginPath(); c.roundRect(x,y,w,h,rr);
  }

  function rotatedRect(o) {
    const cx=o.x+o.w/2,cy=o.y+o.d/2,a=(o.rotation||0)*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
    return [[-o.w/2,-o.d/2],[o.w/2,-o.d/2],[o.w/2,o.d/2],[-o.w/2,o.d/2]].map(([x,y])=>({x:cx+x*co-y*si,y:cy+x*si+y*co}));
  }

  function itemAabb(o,pad=o.clearance||0) {
    const pts=rotatedRect(o),xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
    return {minX:Math.min(...xs)-pad,maxX:Math.max(...xs)+pad,minY:Math.min(...ys)-pad,maxY:Math.max(...ys)+pad};
  }

  function planBounds(floorOverride=null) {
    const all=floorOverride?A.allEntities(floorOverride):S().viewMode==='3d'&&S().project.camera.allFloors?S().project.floors.flatMap(f=>A.allEntities(f)):A.allEntities();
    const entities=all.length?all:[{x:0,y:0,w:1000,d:700}];
    return entities.reduce((b,o)=>{const box=o.x!==undefined?itemAabb({...o,w:o.w||0,d:o.d||0},0):{minX:Math.min(o.x1,o.x2),maxX:Math.max(o.x1,o.x2),minY:Math.min(o.y1,o.y2),maxY:Math.max(o.y1,o.y2)};return {minX:Math.min(b.minX,box.minX),minY:Math.min(b.minY,box.minY),maxX:Math.max(b.maxX,box.maxX),maxY:Math.max(b.maxY,box.maxY)}},{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
  }

  function movingBox(objs) {
    return objs.reduce((b,o)=>{const r=itemAabb(o,0);return{minX:Math.min(b.minX,r.minX),maxX:Math.max(b.maxX,r.maxX),minY:Math.min(b.minY,r.minY),maxY:Math.max(b.maxY,r.maxY)}},{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
  }

  // ── Grid drawing ─────────────────────────────────────────────
  function drawGrid(w,h) {
    const c=ctx(),s=S(),project=s.project;
    c.fillStyle = '#f8f9f6'; c.fillRect(0,0,w,h);
    if (!project.grid) return;
    const isImperial = project.unit==='ft'||project.unit==='in';
    // Visual grid spacings (independent of snap step)
    const fine  = (isImperial ? 2.54  : 1)   * s.scale;  // 1″ / 1 cm
    const minor = (isImperial ? 15.24 : 10)  * s.scale;  // 6″ / 10 cm
    const major = (isImperial ? 60.96 : 100) * s.scale;  // 2′ / 1 m
    // Fine grid (1-inch / 1-cm) — only when zoomed in enough
    if (fine > 7) {
      c.strokeStyle='#eaece8'; c.lineWidth=.5; c.beginPath();
      let sx=((s.offset.x%fine)+fine)%fine, sy=((s.offset.y%fine)+fine)%fine;
      for(let x=sx;x<w;x+=fine){c.moveTo(x,0);c.lineTo(x,h)}
      for(let y=sy;y<h;y+=fine){c.moveTo(0,y);c.lineTo(w,y)} c.stroke();
    }
    // Minor grid (6″ / 10 cm)
    if (minor > 7) {
      c.strokeStyle='#dfe3de'; c.lineWidth=.7; c.beginPath();
      let sx=((s.offset.x%minor)+minor)%minor, sy=((s.offset.y%minor)+minor)%minor;
      for(let x=sx;x<w;x+=minor){c.moveTo(x,0);c.lineTo(x,h)}
      for(let y=sy;y<h;y+=minor){c.moveTo(0,y);c.lineTo(w,y)} c.stroke();
    }
    // Major grid (2′ / 1 m)
    c.strokeStyle='#c3cbc4'; c.lineWidth=1; c.beginPath();
    let sx=((s.offset.x%major)+major)%major, sy=((s.offset.y%major)+major)%major;
    for(let x=sx;x<w;x+=major){c.moveTo(x,0);c.lineTo(x,h)}
    for(let y=sy;y<h;y+=major){c.moveTo(0,y);c.lineTo(w,y)} c.stroke();
  }

  function updateGridLegend() {
    const el=A.$('#gridLegend'),project=S().project;if(!el)return;
    if(!project.grid){el.textContent='Grid hidden · use the grid button to show';return;}
    const snap=project.unit==='ft'||project.unit==='in'?'1″':'1 cm';
    const minor=project.unit==='ft'||project.unit==='in'?'6″':project.unit==='m'?'0.10 m':'10 cm';
    const major=project.unit==='ft'?'2′':project.unit==='in'?'24″':project.unit==='m'?'1 m':'1 m';
    const units=project.unit==='ft'?'feet + inches':project.unit==='in'?'inches':project.unit==='m'?'metres':'centimetres';
    el.textContent=`Grid · snap ${snap} · minor ${minor} · major ${major} · ${units}`;
  }

  // ── Site annotation labels ───────────────────────────────────
  function drawSiteAnnotations() {
    const c=ctx(),s=S(),project=s.project,fl=A.floor();
    if(!project.site||!fl.rooms.length)return;
    const minX=Math.min(...fl.rooms.map(r=>r.x)),minY=Math.min(...fl.rooms.map(r=>r.y)),maxX=Math.max(...fl.rooms.map(r=>r.x+r.w)),maxY=Math.max(...fl.rooms.map(r=>r.y+r.d)),a=A.worldToScreen({x:minX,y:minY}),b=A.worldToScreen({x:maxX,y:maxY});
    const tag=(text,x,y,angle=0,open=false)=>{c.save();c.translate(x,y);c.rotate(angle);c.font='700 9px Inter, sans-serif';c.textAlign='center';const tw=c.measureText(text).width;c.fillStyle='rgba(255,254,250,.9)';c.fillRect(-tw/2-6,-8,tw+12,16);c.fillStyle=open?'#28715a':'#8a5b4c';c.fillText(text,0,3);c.restore()};
    tag(`NORTH · ${A.formatLength(project.site.width)} · OPEN`,(a.x+b.x)/2,a.y-28,0,true);tag(`WEST · ${A.formatLength(project.site.depth)} · OPEN`,a.x-30,(a.y+b.y)/2,-Math.PI/2,true);tag('SOUTH · CLOSED',(a.x+b.x)/2,b.y+28);tag('EAST · CLOSED',b.x+30,(a.y+b.y)/2,Math.PI/2);
  }

  // ── Built-Up Area Boundary Envelope ────────────────────────
  function drawBuiltUpBoundary() {
    const c = ctx(), s = S(), project = s.project;
    if (!project.builtUp || project.builtUp.showBoundary === false) return;

    const b = A.getHouseFootprintBounds ? A.getHouseFootprintBounds(A.floor()) : null;
    const targetW = project.builtUp.width || 1981.2;
    const targetD = project.builtUp.depth || 1066.8;

    const originX = project.builtUp.originX ?? (b ? b.minX : 100);
    const originY = project.builtUp.originY ?? (b ? b.minY : 100);

    const screenOrigin = A.worldToScreen({ x: originX, y: originY });
    const screenW = targetW * s.scale;
    const screenD = targetD * s.scale;

    const exceedsW = b && (b.width > targetW + 1);
    const exceedsD = b && (b.depth > targetD + 1);
    const exceeds = exceedsW || exceedsD;

    c.save();
    // Dashed built-up envelope outline
    c.strokeStyle = exceeds ? '#c93b2b' : '#b87333';
    c.lineWidth = Math.max(1.2, 1.8 * s.scale);
    c.setLineDash([8, 6]);
    c.strokeRect(screenOrigin.x, screenOrigin.y, screenW, screenD);
    c.setLineDash([]);

    // Corner bracket accents
    const cornerSize = Math.max(8, 14 * s.scale);
    c.strokeStyle = exceeds ? '#c93b2b' : '#b87333';
    c.lineWidth = 2.4;
    // Top-left
    c.beginPath(); c.moveTo(screenOrigin.x, screenOrigin.y + cornerSize); c.lineTo(screenOrigin.x, screenOrigin.y); c.lineTo(screenOrigin.x + cornerSize, screenOrigin.y); c.stroke();
    // Top-right
    c.beginPath(); c.moveTo(screenOrigin.x + screenW - cornerSize, screenOrigin.y); c.lineTo(screenOrigin.x + screenW, screenOrigin.y); c.lineTo(screenOrigin.x + screenW, screenOrigin.y + cornerSize); c.stroke();
    // Bottom-right
    c.beginPath(); c.moveTo(screenOrigin.x + screenW, screenOrigin.y + screenD - cornerSize); c.lineTo(screenOrigin.x + screenW, screenOrigin.y + screenD); c.lineTo(screenOrigin.x + screenW - cornerSize, screenOrigin.y + screenD); c.stroke();
    // Bottom-left
    c.beginPath(); c.moveTo(screenOrigin.x + cornerSize, screenOrigin.y + screenD); c.lineTo(screenOrigin.x, screenOrigin.y + screenD); c.lineTo(screenOrigin.x, screenOrigin.y + screenD - cornerSize); c.stroke();

    // Top Label: Built-Up Width & Area
    const topText = `BUILT-UP ENVELOPE · WIDTH ${A.formatLength(targetW)} · AREA ${A.formatArea(targetW * targetD)}`;
    c.font = '700 9px Inter, sans-serif';
    c.textAlign = 'center';
    const topTw = c.measureText(topText).width;
    c.fillStyle = exceeds ? 'rgba(255, 240, 238, 0.95)' : 'rgba(255, 252, 244, 0.95)';
    c.fillRect(screenOrigin.x + screenW / 2 - topTw / 2 - 6, screenOrigin.y - 18, topTw + 12, 16);
    c.strokeStyle = exceeds ? '#c93b2b' : '#b87333';
    c.lineWidth = 1;
    c.strokeRect(screenOrigin.x + screenW / 2 - topTw / 2 - 6, screenOrigin.y - 18, topTw + 12, 16);
    c.fillStyle = exceeds ? '#c93b2b' : '#8a521e';
    c.fillText(topText, screenOrigin.x + screenW / 2, screenOrigin.y - 7);

    // Left Label: Built-Up Length / Depth
    const sideText = `LENGTH ${A.formatLength(targetD)}`;
    c.save();
    c.translate(screenOrigin.x - 14, screenOrigin.y + screenD / 2);
    c.rotate(-Math.PI / 2);
    const sideTw = c.measureText(sideText).width;
    c.fillStyle = exceeds ? 'rgba(255, 240, 238, 0.95)' : 'rgba(255, 252, 244, 0.95)';
    c.fillRect(-sideTw / 2 - 6, -8, sideTw + 12, 16);
    c.strokeStyle = exceeds ? '#c93b2b' : '#b87333';
    c.lineWidth = 1;
    c.strokeRect(-sideTw / 2 - 6, -8, sideTw + 12, 16);
    c.fillStyle = exceeds ? '#c93b2b' : '#8a521e';
    c.fillText(sideText, 0, 3);
    c.restore();

    // If actual plan exceeds target, draw bottom alert tag
    if (exceeds && b) {
      const diffW = b.width - targetW;
      const diffD = b.depth - targetD;
      let warnMsg = '⚠ House footprint exceeds built-up boundary: ';
      if (diffW > 1 && diffD > 1) warnMsg += `+${A.formatLength(diffW)} width, +${A.formatLength(diffD)} length`;
      else if (diffW > 1) warnMsg += `+${A.formatLength(diffW)} width`;
      else warnMsg += `+${A.formatLength(diffD)} length`;

      c.font = '600 10px Inter, sans-serif';
      const warnTw = c.measureText(warnMsg).width;
      const warnX = screenOrigin.x + screenW / 2;
      const warnY = screenOrigin.y + screenD + 18;
      c.fillStyle = 'rgba(201, 59, 43, 0.92)';
      c.fillRect(warnX - warnTw / 2 - 8, warnY - 10, warnTw + 16, 20);
      c.fillStyle = '#ffffff';
      c.textAlign = 'center';
      c.fillText(warnMsg, warnX, warnY + 3);
    }

    c.restore();
  }

  // ── Room drawing ─────────────────────────────────────────────
  function drawRoom(r) {
    const c=ctx(),s=S(),p=A.worldToScreen(r), w=r.w*s.scale, h=r.d*s.scale;
    const path=()=>{c.beginPath();if(r.polygon){r.polygon.forEach((point,i)=>{const q=A.worldToScreen(point);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.closePath();}else c.rect(p.x,p.y,w,h);};
    c.save(); c.globalAlpha=r.opacity ?? 1; c.fillStyle=r.color;path();c.fill();
    c.save();path();c.clip();c.globalAlpha=.18;c.strokeStyle='#65716b';c.lineWidth=.55;
    const finish=(r.floorMaterial||'Wood').toLowerCase(),step=Math.max(9,finish==='wood'?42*s.scale:80*s.scale);
    if(finish==='wood'){for(let y=p.y;y<p.y+h;y+=step){c.beginPath();c.moveTo(p.x,y);c.lineTo(p.x+w,y);c.stroke();for(let x=p.x+(Math.round((y-p.y)/step)%2)*step;x<p.x+w;x+=step*2){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+step);c.stroke()}}}
    else if(finish==='tile'||finish==='stone'){for(let x=p.x;x<p.x+w;x+=step){c.beginPath();c.moveTo(x,p.y);c.lineTo(x,p.y+h);c.stroke()}for(let y=p.y;y<p.y+h;y+=step){c.beginPath();c.moveTo(p.x,y);c.lineTo(p.x+w,y);c.stroke()}}
    else {for(let x=p.x-h;x<p.x+w+h;x+=step){c.beginPath();c.moveTo(x,p.y);c.lineTo(x+h,p.y+h);c.stroke()}}
    c.restore();c.globalAlpha=1;
    c.strokeStyle='#aeb5ae';c.lineWidth=1.2;path();c.stroke();
    if (w>80&&h>55) {
      c.fillStyle='#4f5c56';c.textAlign='center';c.font='600 11px Inter, sans-serif';
      c.fillText(r.name,p.x+w/2,p.y+h/2-10);
      c.font='10px Inter, sans-serif';c.fillStyle='#617069';
      c.fillText(`${A.formatLength(r.w)} × ${A.formatLength(r.d)}`,p.x+w/2,p.y+h/2+4);
      c.fillStyle='#78837e';
      c.fillText(A.formatArea(A.roomArea(r)),p.x+w/2,p.y+h/2+18);
    } else if (w>55&&h>35) {
      c.fillStyle='#4f5c56';c.textAlign='center';c.font='600 10px Inter, sans-serif';
      c.fillText(r.name,p.x+w/2,p.y+h/2-2);
      c.font='9px Inter, sans-serif';c.fillStyle='#727d77';
      c.fillText(A.formatArea(A.roomArea(r)),p.x+w/2,p.y+h/2+10);
    }
    if(s.selected===r.id){
      c.strokeStyle='#2f765f';c.lineWidth=2;c.setLineDash([6,4]);c.strokeRect(p.x-2,p.y-2,w+4,h+4);c.setLineDash([]);
      // Corner resize handles
      const sz=8;
      [[p.x,p.y],[p.x+w,p.y],[p.x+w,p.y+h],[p.x,p.y+h]].forEach(([cx,cy])=>{
        c.fillStyle='#fff';c.strokeStyle='#2e725b';c.lineWidth=2;
        c.fillRect(cx-sz/2,cy-sz/2,sz,sz);c.strokeRect(cx-sz/2,cy-sz/2,sz,sz);
      });
    } c.restore();
  }

  // ── Wall drawing and handles ─────────────────────────────────
  function wallHandlePoints(o) {
    const a=A.worldToScreen({x:o.x1,y:o.y1}),b=A.worldToScreen({x:o.x2,y:o.y2});
    const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    return {a,b,mid,rotate:{x:mid.x-dy/len*30,y:mid.y+dx/len*30}};
  }

  function wallHandleHit(p,o) {
    const h=wallHandlePoints(o);
    if(Math.hypot(p.x-h.a.x,p.y-h.a.y)<16)return 'resize-wall-start';
    if(Math.hypot(p.x-h.b.x,p.y-h.b.y)<16)return 'resize-wall-end';
    if(Math.hypot(p.x-h.rotate.x,p.y-h.rotate.y)<17)return 'rotate-wall';
    return null;
  }

  function beamHandleHit(p, o) {
    const a = A.worldToScreen({x:o.x1, y:o.y1}), b = A.worldToScreen({x:o.x2, y:o.y2});
    if (Math.hypot(p.x - a.x, p.y - a.y) < 16) return 'resize-beam-start';
    if (Math.hypot(p.x - b.x, p.y - b.y) < 16) return 'resize-beam-end';
    return null;
  }

  function drawWall(o) {
    const c=ctx(),s=S(),a=A.worldToScreen({x:o.x1,y:o.y1}), b=A.worldToScreen({x:o.x2,y:o.y2});
    c.save();c.strokeStyle=o.color||'#303a35';c.lineWidth=Math.max(4,o.thickness*s.scale);c.lineCap='square';c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.strokeStyle='rgba(255,255,255,.76)';c.lineWidth=Math.max(1,o.thickness*s.scale-3);c.stroke();c.strokeStyle=o.color||'#303a35';c.lineWidth=.8;c.stroke();
    // Selection highlight + endpoint resize circles + rotate handle
    if(s.selected===o.id){
      // Highlight stroke
      c.strokeStyle='#2f765f';c.lineWidth=2.5;c.setLineDash([6,4]);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);
      // Endpoint resize circles
      [a,b].forEach(pt=>{
        c.fillStyle='#fff';c.strokeStyle='#2e725b';c.lineWidth=2;
        c.beginPath();c.arc(pt.x,pt.y,7,0,Math.PI*2);c.fill();c.stroke();
        // Inner dot
        c.fillStyle='#2e725b';c.beginPath();c.arc(pt.x,pt.y,2.5,0,Math.PI*2);c.fill();
      });
      // Rotate handle
      const h=wallHandlePoints(o);
      c.strokeStyle='#2e725b';c.lineWidth=1.5;c.beginPath();c.moveTo(h.mid.x,h.mid.y);c.lineTo(h.rotate.x,h.rotate.y);c.stroke();
      c.fillStyle='#fff';c.beginPath();c.arc(h.rotate.x,h.rotate.y,7,0,Math.PI*2);c.fill();c.strokeStyle='#2e725b';c.stroke();
      c.fillStyle='#28735a';c.font='bold 11px Inter';c.textAlign='center';c.fillText('↻',h.rotate.x,h.rotate.y+4);
      // Dimension label
      const len=Math.hypot(o.x2-o.x1,o.y2-o.y1),angle=Math.atan2(b.y-a.y,b.x-a.x);
      c.save();c.translate((a.x+b.x)/2,(a.y+b.y)/2);c.rotate(angle);
      const text=A.formatLength(len);c.font='600 10px Inter';const tw=c.measureText(text).width;
      c.fillStyle='rgba(255,254,250,.94)';c.fillRect(-tw/2-5,-22,tw+10,16);
      c.fillStyle='#286a55';c.textAlign='center';c.fillText(text,0,-10);
      c.restore();
    }
    c.restore();
  }

  // ── Structural Column / Pillar Renderer ──────────────────────
  function drawColumn(o) {
    const c=ctx(),s=S(),p=A.worldToScreen({x:o.x,y:o.y}),w=(o.w||23)*s.scale,d=(o.d||30)*s.scale;
    c.save();

    const isRedundant = o.optimizationStatus === 'redundant';
    const isEssential = o.optimizationStatus === 'essential';
    const isHighStress = o.optimizationStatus === 'high-stress' || o.status === 'fail' || o.utilization > 85;

    // Civil engineering guideline color coding
    let fillColor = o.color || '#24332d';
    let borderColor = '#111b16';
    let haloColor = null;

    if (s.project.colorCodeStructure !== false) {
      if (isRedundant) {
        fillColor = '#831843'; // Deep Rose / Magenta
        borderColor = '#f43f5e'; // Bright Rose / Magenta
        haloColor = '#fb7185';
      } else if (isHighStress) {
        fillColor = '#80261e'; // Crimson
        borderColor = '#ef4444';
        haloColor = '#f87171';
      } else if (isEssential) {
        fillColor = '#14532d'; // Deep Emerald Green
        borderColor = '#22c55e'; // Bright Emerald Green
      } else if (o.status === 'warn' || o.utilization > 65) {
        fillColor = '#874e18';
        borderColor = '#d97724';
      } else {
        fillColor = '#1e293b'; // Slate
        borderColor = '#475569';
      }
    }

    // Outer Halo for Redundant (Removable) or High-Stress Pillars
    if (haloColor && isRedundant) {
      c.strokeStyle = haloColor;
      c.lineWidth = Math.max(1.6, 2.2 * s.scale);
      c.setLineDash([4, 3]);
      c.strokeRect(p.x - 4, p.y - 4, w + 8, d + 8);
      c.setLineDash([]);
    }

    c.fillStyle = fillColor;
    c.fillRect(p.x, p.y, w, d);
    c.strokeStyle = borderColor;
    c.lineWidth = Math.max(1.2, 1.8 * s.scale);
    c.strokeRect(p.x, p.y, w, d);

    // Cross / Hatching pattern for RCC
    c.strokeStyle = isRedundant ? 'rgba(255, 228, 230, 0.45)' : 'rgba(255,255,255,0.32)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(p.x, p.y); c.lineTo(p.x + w, p.y + d);
    c.moveTo(p.x + w, p.y); c.lineTo(p.x, p.y + d);
    c.stroke();

    // 4 Corner rebar dots
    const pad = Math.max(2, Math.min(6, 4 * s.scale));
    c.fillStyle = isRedundant ? '#fda4af' : '#f0c05a';
    [[p.x + pad, p.y + pad], [p.x + w - pad, p.y + pad], [p.x + pad, p.y + d - pad], [p.x + w - pad, p.y + d - pad]].forEach(([rx, ry]) => {
      c.beginPath(); c.arc(rx, ry, Math.max(1.2, 1.8 * s.scale), 0, Math.PI * 2); c.fill();
    });

    // Tag badge: C1, C2...
    const tag = o.tag || o.name || 'C';
    c.font = 'bold 9px Inter, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.fillText(tag, p.x + w / 2, p.y + d / 2);

    // Visual identifier badge above pillar: REDUNDANT or CORE
    if (isRedundant && s.scale >= 0.45) {
      c.font = 'bold 8px Inter, sans-serif';
      const rLabel = 'REDUNDANT';
      const rtw = c.measureText(rLabel).width;
      c.fillStyle = '#be123c';
      c.fillRect(p.x + w / 2 - rtw / 2 - 3, p.y - 13, rtw + 6, 11);
      c.strokeStyle = '#fff';
      c.lineWidth = 0.8;
      c.strokeRect(p.x + w / 2 - rtw / 2 - 3, p.y - 13, rtw + 6, 11);
      c.fillStyle = '#ffffff';
      c.fillText(rLabel, p.x + w / 2, p.y - 7.5);
    } else if (isEssential && s.scale >= 0.6) {
      c.font = 'bold 7px Inter, sans-serif';
      const eLabel = 'CORE';
      const etw = c.measureText(eLabel).width;
      c.fillStyle = '#15803d';
      c.fillRect(p.x + w / 2 - etw / 2 - 3, p.y - 12, etw + 6, 10);
      c.fillStyle = '#ffffff';
      c.fillText(eLabel, p.x + w / 2, p.y - 7);
    }

    // Selection highlight
    if (s.selected === o.id || s.selectedIds.has(o.id)) {
      c.strokeStyle = '#38b284';
      c.lineWidth = 2.5;
      c.setLineDash([4, 3]);
      c.strokeRect(p.x - 3, p.y - 3, w + 6, d + 6);
      c.setLineDash([]);
    }
    c.restore();
  }

  // ── Structural Beam Renderer ─────────────────────────────────
  function drawBeam(o) {
    const c=ctx(),s=S(),a=A.worldToScreen({x:o.x1,y:o.y1}), b=A.worldToScreen({x:o.x2,y:o.y2});
    const bw = Math.max(3, (o.width || 23) * s.scale);
    c.save();
    
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 1) { c.restore(); return; }
    const nx = -dy / len * (bw / 2), ny = dx / len * (bw / 2);
    const spanM = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) / 100;

    const bType = o.beamType || 'primary';
    const isPrimary = bType === 'primary';
    const isSecondary = bType === 'secondary';
    const isCantilever = bType === 'cantilever';

    // Color coding & visual styling by Beam Hierarchy & Civil Code
    let beamBody = 'rgba(2, 132, 199, 0.16)';
    let beamEdge = '#0284c7';
    let badgeBg = '#f0f9ff';
    let badgeBorder = '#0284c7';
    let badgeText = '#0369a1';
    let dashPattern = [];

    if (isSecondary) {
      beamBody = 'rgba(124, 58, 237, 0.15)';
      beamEdge = '#7c3aed';
      badgeBg = '#faf5ff';
      badgeBorder = '#7c3aed';
      badgeText = '#6d28d9';
      dashPattern = [4, 4];
    } else if (isCantilever) {
      beamBody = 'rgba(217, 119, 6, 0.18)';
      beamEdge = '#d97706';
      badgeBg = '#fffbeb';
      badgeBorder = '#d97706';
      badgeText = '#b45309';
      dashPattern = [8, 3, 2, 3];
    }

    if (s.project.colorCodeStructure !== false) {
      if (spanM > 5.5 || o.status === 'fail') {
        beamBody = 'rgba(220, 38, 38, 0.22)';
        beamEdge = '#dc2626';
        badgeBorder = '#dc2626';
        badgeText = '#991b1b';
        badgeBg = '#fef2f2';
      } else if (spanM > 4.5 || o.status === 'warn') {
        beamBody = 'rgba(217, 119, 6, 0.20)';
        beamEdge = '#d97706';
        badgeBorder = '#d97706';
        badgeText = '#b45309';
        badgeBg = '#fffbeb';
      }
    }

    // Beam body (semi-transparent concrete framing)
    c.fillStyle = beamBody;
    c.beginPath();
    c.moveTo(a.x + nx, a.y + ny);
    c.lineTo(b.x + nx, b.y + ny);
    c.lineTo(b.x - nx, b.y - ny);
    c.lineTo(a.x - nx, a.y - ny);
    c.closePath();
    c.fill();

    // Beam parallel outline
    c.strokeStyle = beamEdge;
    c.lineWidth = isPrimary ? 1.6 : 1.3;
    c.beginPath();
    c.moveTo(a.x + nx, a.y + ny); c.lineTo(b.x + nx, b.y + ny);
    c.moveTo(a.x - nx, a.y - ny); c.lineTo(b.x - nx, b.y - ny);
    c.stroke();

    // Centerline
    c.strokeStyle = beamEdge;
    c.lineWidth = 0.9;
    if (dashPattern.length) c.setLineDash(dashPattern);
    else c.setLineDash([6, 3]);
    c.beginPath();
    c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
    c.stroke();
    c.setLineDash([]);

    // Beam Tag & Size Label along beam center
    if (len > 35) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const angle = Math.atan2(dy, dx);
      const spanStr = spanM.toFixed(1);
      const typeLabel = isCantilever ? 'CB · Cantilever' : isSecondary ? 'SB · Secondary' : 'PB · Primary';
      const label = `${o.tag || (isCantilever?'CB':isSecondary?'SB':'PB')} (${typeLabel}) · ${o.width || 23}×${o.depth || 35} · ${spanStr}m`;
      c.save();
      c.translate(mx, my);
      const flip = angle > Math.PI / 2 || angle < -Math.PI / 2;
      c.rotate(flip ? angle + Math.PI : angle);
      c.font = '600 9px Inter, sans-serif';
      const tw = c.measureText(label).width;
      c.fillStyle = badgeBg;
      c.fillRect(-tw / 2 - 5, -8, tw + 10, 16);
      c.strokeStyle = badgeBorder;
      c.lineWidth = 1;
      c.strokeRect(-tw / 2 - 5, -8, tw + 10, 16);
      c.fillStyle = badgeText;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, 0, 0);
      c.restore();
    }

    // Selection highlight & endpoint handles
    if (s.selected === o.id || s.selectedIds.has(o.id)) {
      c.strokeStyle = '#38b284';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(a.x + nx, a.y + ny); c.lineTo(b.x + nx, b.y + ny);
      c.lineTo(b.x - nx, b.y - ny); c.lineTo(a.x - nx, a.y - ny);
      c.closePath();
      c.stroke();
      [a, b].forEach(pt => {
        c.fillStyle = '#fff';
        c.strokeStyle = '#2e725b';
        c.lineWidth = 1.5;
        c.beginPath(); c.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        c.fill(); c.stroke();
      });
    }

    c.restore();
  }

  // ── Furniture symbol renderer (2D plan icons) ────────────────
  function furnitureSymbol(o, c) {
    const s=S();
    c.strokeStyle = '#48564f'; c.lineWidth = 1.25/s.scale; c.fillStyle = o.color;
    const w=o.w,d=o.d,t=o.shape||o.type;
    if(o.system&&t!=='sink'){A.drawServiceSymbol(o,c);return;}
    if(t==='sofa') { roundedRect(c,-w/2,-d/2,w,d,10);c.fill();c.stroke();if(o.type==='sectional'){roundedRect(c,w*.18,-d*.05,w*.31,d*.53,8);c.fill();c.stroke()}c.beginPath();c.moveTo(-w/2+12,-d/2+d*.34);c.lineTo(w/2-12,-d/2+d*.34);c.moveTo(-w*.18,-d/2+d*.34);c.lineTo(-w*.18,d/2);c.moveTo(w*.18,-d/2+d*.34);c.lineTo(w*.18,d/2);c.stroke(); }
    else if(t==='chair'){roundedRect(c,-w/2,-d/2,w,d,12);c.fill();c.stroke();c.beginPath();c.arc(0,-d*.08,Math.min(w,d)*.27,0,Math.PI*2);c.stroke()}
    else if(t==='bed'){roundedRect(c,-w/2,-d/2,w,d,5);c.fill();c.stroke();c.fillStyle='rgba(255,255,255,.72)';roundedRect(c,-w*.42,-d*.40,w*.37,d*.24,5);c.fill();roundedRect(c,w*.05,-d*.40,w*.37,d*.24,5);c.fill();c.strokeStyle='rgba(82,96,88,.65)';c.stroke();}
    else if(t==='table'){roundedRect(c,-w/2,-d/2,w,d,10);c.fill();c.stroke();for(let i=-1;i<=1;i+=2)for(let j=-1;j<=1;j+=2){c.beginPath();c.arc(i*w*.35,j*d*.34,5/s.scale,0,Math.PI*2);c.stroke()}}
    else if(t==='desk'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeRect(w*.08,-d*.32,w*.32,d*.64);c.beginPath();c.arc(-w*.32,0,3/s.scale,0,Math.PI*2);c.stroke()}
    else if(t==='cabinet'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.moveTo(0,-d/2);c.lineTo(0,d/2);c.moveTo(-w/2,d*.15);c.lineTo(w/2,d*.15);c.stroke();c.beginPath();c.arc(-w*.05,0,2.5/s.scale,0,Math.PI*2);c.arc(w*.05,0,2.5/s.scale,0,Math.PI*2);c.stroke()}
    else if(t==='kitchen'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);for(let x=-w/2+w/4;x<w/2;x+=w/4){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}c.beginPath();c.arc(w*.28,0,d*.24,0,Math.PI*2);c.stroke();c.strokeRect(-w*.37,-d*.26,w*.2,d*.52)}
    else if(t==='sink'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.ellipse(0,0,w*.35,d*.32,0,0,Math.PI*2);c.stroke();c.beginPath();c.arc(0,0,3/s.scale,0,Math.PI*2);c.stroke()}
    else if(t==='tub'){roundedRect(c,-w/2,-d/2,w,d,d*.43);c.fill();c.stroke();c.strokeStyle='rgba(255,255,255,.8)';roundedRect(c,-w*.42,-d*.35,w*.84,d*.7,d*.32);c.stroke();c.beginPath();c.arc(w*.32,0,4/s.scale,0,Math.PI*2);c.stroke()}
    else if(t==='toilet'){c.fillRect(-w*.35,-d/2,w*.7,d*.28);c.strokeRect(-w*.35,-d/2,w*.7,d*.28);c.beginPath();c.ellipse(0,d*.12,w*.38,d*.34,0,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.ellipse(0,d*.12,w*.24,d*.22,0,0,Math.PI*2);c.stroke()}
    else if(t==='plant'){c.beginPath();c.arc(0,0,w*.48,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='rgba(255,255,255,.75)';for(let i=0;i<6;i++){c.rotate(Math.PI/3);c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(w*.16,-w*.14,w*.34,0);c.stroke()}}
    else if(t==='round-table'){c.beginPath();c.arc(0,0,Math.min(w,d)*.48,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.arc(0,0,Math.min(w,d)*.12,0,Math.PI*2);c.stroke()}
    else if(t==='roof'){c.fillStyle='#9a9f9a';c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeStyle='rgba(255,255,255,.72)';for(let x=-w*.45;x<w*.5;x+=Math.max(24,w*.12)){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x+w*.12,d/2);c.stroke()}c.strokeStyle='#48564f'}
    else if(t==='mirror'){c.fillStyle='#53686b';roundedRect(c,-w/2,-d/2,w,d,5);c.fill();c.stroke();c.fillStyle='#b9d4d7';roundedRect(c,-w*.42,-d*.38,w*.84,d*.76,3);c.fill();c.strokeStyle='rgba(255,255,255,.9)';c.beginPath();c.moveTo(-w*.28,d*.3);c.lineTo(w*.2,-d*.3);c.stroke();c.strokeStyle='#48564f'}
    else if(t==='tv'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.moveTo(-w*.12,d/2);c.lineTo(-w*.2,d*1.2);c.moveTo(w*.12,d/2);c.lineTo(w*.2,d*1.2);c.stroke()}
    else if(t==='cooktop'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);for(const x of [-.24,.24])for(const y of [-.25,.25]){c.beginPath();c.arc(x*w,y*d,Math.min(w,d)*.14,0,Math.PI*2);c.stroke()}}
    else if(t==='appliance'||t==='washer'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.arc(0,0,Math.min(w,d)*.3,0,Math.PI*2);c.stroke();c.beginPath();c.arc(w*.31,-d*.31,2.5/s.scale,0,Math.PI*2);c.stroke()}
    else if(t==='double-sink'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);for(const x of [-.24,.24]){c.beginPath();c.ellipse(x*w,0,w*.2,d*.31,0,0,Math.PI*2);c.stroke()}}
    else if(t==='radiator'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);for(let x=-w*.42;x<w*.45;x+=w*.12){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}}
    else if(t==='switchboard'){c.fillStyle=o.color||'#f1efe8';roundedRect(c,-w/2,-d/2,w,d,3);c.fill();c.stroke();const count=Math.max(1,Math.min(8,o.switches||4));for(let i=0;i<count;i++){const x=-w*.32+(i%4)*w*.21,y=i<4?-d*.08:d*.14;c.strokeRect(x-w*.055,y-d*.14,w*.11,d*.28);c.beginPath();c.arc(x,y,Math.max(2,Math.min(w,d)*.08),0,Math.PI*2);c.stroke()}}
    else if(t==='electrical-panel'){c.fillStyle=o.color||'#d9ddd8';roundedRect(c,-w/2,-d/2,w,d,3);c.fill();c.stroke();c.beginPath();c.moveTo(-w*.35,-d*.34);c.lineTo(w*.35,-d*.34);c.lineTo(w*.35,d*.34);c.lineTo(-w*.35,d*.34);c.closePath();c.stroke();for(let i=0;i<Math.max(1,Math.min(12,o.breakers||8));i++){const x=-w*.27+(i%4)*w*.18,y=-d*.17+Math.floor(i/4)*d*.17;c.fillStyle=i%4===0?'#c97d4e':'#6f8178';c.fillRect(x-w*.035,y-d*.07,w*.07,d*.14)}}
    else if(t==='ceiling-fan'){c.fillStyle='rgba(220,222,214,.78)';c.beginPath();c.arc(0,0,Math.min(w,d)*.44,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=o.color||'#d1cec4';c.beginPath();c.arc(0,0,Math.min(w,d)*.11,0,Math.PI*2);c.fill();c.stroke();const blades=Math.max(2,Math.min(12,o.bladeCount||4));for(let i=0;i<blades;i++){c.save();c.rotate(i*Math.PI*2/blades);c.beginPath();c.ellipse(Math.min(w,d)*.27,0,Math.min(w,d)*.25,Math.min(w,d)*.07,0,0,Math.PI*2);c.fill();c.stroke();c.restore()}}
    else if(t==='ceiling-light'){c.fillStyle=o.active===false?'#d8dbd6':'#fff0a8';c.beginPath();c.arc(0,0,Math.min(w,d)*.43,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='#fffdf0';c.lineWidth=2/s.scale;c.beginPath();c.arc(0,0,Math.min(w,d)*.24,0,Math.PI*2);c.stroke();c.strokeStyle='#48564f'}
    else if(t==='car'){roundedRect(c,-w/2,-d/2,w,d,Math.min(w,d)*.22);c.fill();c.stroke();c.fillStyle='rgba(35,48,58,.62)';roundedRect(c,-w*.37,-d*.2,w*.74,d*.42,12);c.fill();c.stroke();c.fillStyle='#303632';for(const x of [-w*.51,w*.51])for(const y of [-d*.3,d*.3])c.fillRect(x-4/s.scale,y-d*.1,8/s.scale,d*.2)}
    else if(t==='l-stairs'||t==='u-stairs'){const sw=Math.min(o.stairWidth||w*.4,w*.46,d*.46),lower=Math.max(1,Math.min(35,o.lowerStepCount||Math.ceil((o.stepCount||16)/2))),upper=Math.max(1,Math.min(35,o.upperStepCount||Math.max(1,(o.stepCount||16)-lower))),landingLength=Math.max(sw,Math.min(o.landingLength||o.landingDepth||100,d*.42)),landingWidth=Math.max(t==='u-stairs'?sw*2:sw,Math.min(o.landingWidth||(t==='u-stairs'?w:sw),w)),run=Math.max(1,d-landingLength),lowerStart=-d/2+landingLength; c.strokeRect(-w/2,-d/2,w,d);c.fillStyle='rgba(255,255,255,.12)';c.fillRect(-w/2,lowerStart,sw,run);if(t==='u-stairs')c.fillRect(w/2-sw,lowerStart,sw,run);else c.fillRect(-w/2,-d/2,sw,landingLength);c.fillRect(-landingWidth/2,-d/2,landingWidth,landingLength);for(let i=0;i<=lower;i++){const y=lowerStart+i*run/lower;c.beginPath();c.moveTo(-w/2,y);c.lineTo(-w/2+sw,y);c.stroke()}if(t==='u-stairs')for(let i=0;i<=upper;i++){const y=lowerStart+i*run/upper;c.beginPath();c.moveTo(w/2-sw,y);c.lineTo(w/2,y);c.stroke()}else for(let i=0;i<=upper;i++){const x=-w/2+sw+i*(w-sw)/upper;c.beginPath();c.moveTo(x,-d/2+sw/2);c.lineTo(x,-d/2+sw/2+sw);c.stroke()}c.beginPath();c.moveTo(-w*.28,d*.2);c.lineTo(-w*.28,-d*.2);c.lineTo(-w*.34,-d*.12);c.moveTo(-w*.28,-d*.2);c.lineTo(-w*.22,-d*.12);c.stroke()}
    else if(t==='planter'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.fillStyle='rgba(70,112,70,.75)';for(let x=-w*.38;x<w*.4;x+=w*.18){c.beginPath();c.arc(x,0,d*.22,0,Math.PI*2);c.fill();c.stroke()}}
    else if(t==='bench'){c.fillRect(-w/2,-d*.22,w,d*.44);c.strokeRect(-w/2,-d*.22,w,d*.44);c.beginPath();c.moveTo(-w*.42,-d*.22);c.lineTo(-w*.42,d*.5);c.moveTo(w*.42,-d*.22);c.lineTo(w*.42,d*.5);c.stroke()}
    else if(t==='door'){
      c.fillStyle='rgba(255,254,250,.92)';c.fillRect(-w/2,-d,w,d*2);c.strokeStyle='#48564f';
      if(o.type==='garage-door'){c.fillStyle=o.color;c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);for(let x=-w*.4;x<w*.45;x+=w*.2){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}}
      else if(o.type==='sliding-door'){const open=Math.max(0,Math.min(1,(o.openAngle||0)/100));c.fillStyle=o.color;c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeRect(-w/2+open*w*.48,-d,w*.5,d*2)}
      else {const opening=Math.max(0,Math.min(120,o.openAngle??30))*Math.PI/180,side=o.swingSide??1,drawLeaf=(hingeX,dir,leafW)=>{const base=dir>0?0:Math.PI,angle=base+dir*side*opening,endX=hingeX+Math.cos(angle)*leafW,endY=Math.sin(angle)*leafW;c.beginPath();c.moveTo(hingeX,0);c.lineTo(endX,endY);c.stroke();c.setLineDash([4/s.scale,4/s.scale]);c.beginPath();c.arc(hingeX,0,leafW,base,angle,dir*side<0);c.stroke();c.setLineDash([])};if(o.type==='double-door'||o.type==='temple-double-door'){drawLeaf(-w/2,1,w/2);drawLeaf(w/2,-1,w/2);if(o.type==='temple-double-door'){c.strokeStyle='#b68a43';for(const x of [-w*.25,0,w*.25]){c.beginPath();c.moveTo(x,-d*.45);c.lineTo(x,d*.45);c.stroke()}c.strokeStyle='#48564f'}}else if(o.hingeSide==='right')drawLeaf(w/2,-1,w);else drawLeaf(-w/2,1,w)}
    }
    else if(t==='window'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.moveTo(-w/2,-d);c.lineTo(w/2,-d);c.moveTo(-w/2,d);c.lineTo(w/2,d);c.moveTo(0,-d);c.lineTo(0,d);c.stroke()}
    else if(t==='rug'){c.globalAlpha=.72;c.fillRect(-w/2,-d/2,w,d);c.globalAlpha=1;c.strokeRect(-w/2,-d/2,w,d);for(let x=-w*.35;x<w*.4;x+=w*.18){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}}
    else if(t==='lamp'){c.beginPath();c.arc(0,0,w*.45,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.arc(0,0,w*.12,0,Math.PI*2);c.stroke()}
    else if(t==='stairs'){c.strokeRect(-w/2,-d/2,w,d);c.fillStyle='rgba(255,255,255,.12)';c.fillRect(-w/2,-d/2,w,d);for(let y=-d/2;y<d/2;y+=d/12){c.beginPath();c.moveTo(-w/2,y);c.lineTo(w/2,y);c.stroke()}}
    else if(t==='shower'){c.globalAlpha=.45;c.fillRect(-w/2,-d/2,w,d);c.globalAlpha=1;c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.moveTo(-w/2,-d/2);c.lineTo(w/2,d/2);c.moveTo(w/2,-d/2);c.lineTo(-w/2,d/2);c.stroke()}
    else if(t==='curtains'){c.fillRect(-w/2,-d/2,w,d*.4);c.strokeRect(-w/2,-d/2,w,d*.4);c.strokeStyle='rgba(90,80,60,.55)';for(let x=-w/2+4;x<w/2;x+=Math.max(6,w*.06)){c.beginPath();c.arc(x,-d*.1,Math.max(3,w*.03),Math.PI,0);c.stroke()}c.strokeStyle='#48564f'}
    else if(t==='blind'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeStyle='rgba(90,90,90,.4)';for(let y=-d/2+3;y<d/2;y+=Math.max(4,d*.18)){c.beginPath();c.moveTo(-w/2,y);c.lineTo(w/2,y);c.stroke()}c.strokeStyle='#48564f'}
    else if(t==='ottoman'){roundedRect(c,-w/2,-d/2,w,d,Math.min(w,d)*.28);c.fill();c.stroke();c.beginPath();c.moveTo(-w*.3,-d*.3);c.lineTo(w*.3,d*.3);c.moveTo(w*.3,-d*.3);c.lineTo(-w*.3,d*.3);c.stroke()}
    else if(t==='console'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.moveTo(0,-d/2);c.lineTo(0,d/2);c.stroke();for(const x of [-w*.42,w*.42])for(const y of [-d*.32,d*.32]){c.beginPath();c.arc(x,y,3/s.scale,0,Math.PI*2);c.stroke()}}
    else if(t==='bookshelf'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeStyle='rgba(90,70,50,.6)';for(let x=-w*.4;x<w/2;x+=w*.13){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}c.strokeStyle='#48564f'}
    else if(t==='art'){c.fillStyle=o.color;c.fillRect(-w/2,-d/2,w,d);c.lineWidth=3/s.scale;c.strokeRect(-w/2,-d/2,w,d);c.lineWidth=1.25/s.scale;c.strokeStyle='rgba(255,255,255,.6)';c.strokeRect(-w*.4,-d*.35,w*.8,d*.7);c.strokeStyle='#48564f'}
    else if(t==='fireplace'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.fillStyle='#3a3330';c.fillRect(-w*.3,-d*.28,w*.6,d*.56);c.fillStyle='#d98a3d';for(const x of [-w*.12,0,w*.12]){c.beginPath();c.moveTo(x,d*.22);c.quadraticCurveTo(x+w*.03,-d*.05,x,-d*.15);c.quadraticCurveTo(x-w*.03,-d*.05,x,d*.22);c.fill()}}
    else if(t==='piano'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.fillStyle='#f4f1e8';c.fillRect(-w*.46,d*.18,w*.92,d*.24);c.strokeRect(-w*.46,d*.18,w*.92,d*.24);c.strokeStyle='rgba(40,40,40,.6)';for(let x=-w*.44;x<w*.46;x+=w*.05){c.beginPath();c.moveTo(x,d*.18);c.lineTo(x,d*.42);c.stroke()}c.strokeStyle='#48564f'}
    else if(t==='dresser'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);for(let x=-w*.25;x<=w*.25;x+=w*.5){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}for(const x of [-w*.25,w*.25])for(const y of [-d*.25,d*.25]){c.beginPath();c.arc(x,y,3/s.scale,0,Math.PI*2);c.stroke()}}
    else if(t==='wall-cabinet'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.setLineDash([5/s.scale,4/s.scale]);for(let x=-w*.375;x<w/2;x+=w*.25){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}c.setLineDash([])}
    else if(t==='range-hood'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.ellipse(0,0,w*.3,d*.28,0,0,Math.PI*2);c.stroke()}
    else if(t==='pendant'||t==='downlight'){c.fillStyle=o.active===false?'#d8dbd6':'#ffe9a8';c.beginPath();c.arc(0,0,Math.min(w,d)*.45,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.arc(0,0,Math.min(w,d)*.2,0,Math.PI*2);c.stroke()}
    else if(t==='chandelier'){c.fillStyle=o.active===false?'#d8dbd6':'#ffe9a8';c.beginPath();c.arc(0,0,Math.min(w,d)*.16,0,Math.PI*2);c.fill();c.stroke();for(let i=0;i<6;i++){const a=i*Math.PI/3,rx=Math.cos(a)*w*.42,ry=Math.sin(a)*d*.42;c.beginPath();c.moveTo(0,0);c.lineTo(rx,ry);c.stroke();c.beginPath();c.arc(rx,ry,Math.min(w,d)*.09,0,Math.PI*2);c.fill();c.stroke()}}
    else if(t==='sconce'){c.fillStyle=o.active===false?'#d8dbd6':'#ffe9a8';c.beginPath();c.moveTo(-w/2,-d/2);c.lineTo(w/2,0);c.lineTo(-w/2,d/2);c.closePath();c.fill();c.stroke()}
    else if(t==='umbrella'){c.beginPath();c.arc(0,0,Math.min(w,d)*.49,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='rgba(255,255,255,.6)';for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*w*.49,Math.sin(a)*d*.49);c.stroke()}c.strokeStyle='#48564f';c.beginPath();c.arc(0,0,4/s.scale,0,Math.PI*2);c.fill()}
    else if(t==='pergola'){c.globalAlpha=.5;c.fillRect(-w/2,-d/2,w,d);c.globalAlpha=1;c.strokeRect(-w/2,-d/2,w,d);c.strokeStyle='rgba(90,70,50,.55)';for(let x=-w*.4;x<w/2;x+=w*.12){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}c.strokeStyle='#48564f';for(const x of [-w*.47,w*.47])for(const y of [-d*.47,d*.47]){c.fillRect(x-4/s.scale,y-4/s.scale,8/s.scale,8/s.scale)}}
    else if(t==='pool'){c.globalAlpha=.7;c.fillStyle=o.color;roundedRect(c,-w/2,-d/2,w,d,Math.min(w,d)*.12);c.fill();c.globalAlpha=1;c.stroke();c.strokeStyle='rgba(255,255,255,.55)';for(let y=-d*.3;y<d*.4;y+=d*.2){c.beginPath();for(let x=-w*.4;x<w*.4;x+=6/s.scale)c.lineTo(x,y+Math.sin(x*.08)*4/s.scale);c.stroke()}c.strokeStyle='#48564f'}
    else if(t==='fence'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);for(let x=-w*.44;x<w/2;x+=w*.09){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}}
    else if(t==='gate'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.moveTo(-w/2,-d/2);c.lineTo(w/2,d/2);c.moveTo(-w/2,d/2);c.lineTo(w/2,-d/2);c.stroke()}
    else if(t==='grill'){c.beginPath();c.ellipse(0,0,w*.48,d*.48,0,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='rgba(255,255,255,.5)';for(let x=-w*.35;x<w*.4;x+=w*.12){c.beginPath();c.moveTo(x,-d*.4);c.lineTo(x,d*.4);c.stroke()}c.strokeStyle='#48564f'}
    else if(t==='mandir'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.fillStyle='#d9a441';c.beginPath();c.moveTo(-w*.4,-d*.2);c.lineTo(0,-d*.5);c.lineTo(w*.4,-d*.2);c.closePath();c.fill();c.stroke();c.fillStyle='rgba(217,164,65,.4)';c.beginPath();c.arc(0,d*.12,Math.min(w,d)*.22,0,Math.PI*2);c.fill();c.stroke()}
    else if(t==='tulsi'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeRect(-w*.32,-d*.32,w*.64,d*.64);c.fillStyle='#4f8a54';c.beginPath();c.arc(0,0,Math.min(w,d)*.22,0,Math.PI*2);c.fill();c.stroke()}
    else if(t==='diwan'){roundedRect(c,-w/2,-d/2,w,d,8);c.fill();c.stroke();c.fillStyle='rgba(255,255,255,.5)';for(const x of [-w*.3,0,w*.3]){roundedRect(c,x-w*.11,-d*.4,w*.22,d*.28,5);c.fill()}c.strokeRect(-w/2,d*.28,w,d*.22)}
    else if(t==='jhula'){c.strokeRect(-w/2,-d/2,w,d);roundedRect(c,-w*.34,-d*.3,w*.68,d*.6,8);c.fill();c.stroke();for(const x of [-w*.34,w*.34]){c.beginPath();c.moveTo(x,-d*.3);c.lineTo(x,-d/2);c.moveTo(x,d*.3);c.lineTo(x,d/2);c.stroke()}}
    else if(t==='floor-seating'){c.globalAlpha=.85;roundedRect(c,-w/2,-d/2,w,d,10);c.fill();c.globalAlpha=1;c.stroke();c.strokeStyle='rgba(90,70,60,.5)';for(let x=-w*.3;x<w*.35;x+=w*.2){c.beginPath();c.moveTo(x,-d/2);c.lineTo(x,d/2);c.stroke()}c.fillStyle='rgba(255,255,255,.35)';for(const y of [-d*.4,d*.4]){roundedRect(c,-w*.44,y-d*.06,w*.88,d*.12,6);c.fill()}c.strokeStyle='#48564f'}
    else if(t==='charpai'){roundedRect(c,-w/2,-d/2,w,d,6);c.fill();c.stroke();c.strokeStyle='rgba(120,95,60,.55)';for(let x=-w*.4;x<w*.4;x+=w*.1){c.beginPath();c.moveTo(x,-d*.42);c.lineTo(x,d*.42);c.stroke()}for(let y=-d*.36;y<d*.4;y+=d*.16){c.beginPath();c.moveTo(-w*.42,y);c.lineTo(w*.42,y);c.stroke()}c.strokeStyle='#48564f'}
    else if(t==='almirah'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.moveTo(w*.05,-d/2);c.lineTo(w*.05,d/2);c.stroke();c.strokeRect(-w*.4,-d*.34,w*.34,d*.68);for(const y of [-d*.1,d*.1]){c.beginPath();c.arc(w*.15,y,3/s.scale,0,Math.PI*2);c.stroke()}}
    else if(t==='gas-stove'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);for(const x of [-w*.24,w*.24]){c.beginPath();c.arc(x,0,Math.min(w,d)*.26,0,Math.PI*2);c.stroke();c.beginPath();c.arc(x,0,Math.min(w,d)*.1,0,Math.PI*2);c.stroke()}for(const x of [-w*.4,w*.4]){c.beginPath();c.arc(x,d*.34,3/s.scale,0,Math.PI*2);c.fill();c.stroke()}}
    else if(t==='gas-cylinder'){c.beginPath();c.arc(0,0,Math.min(w,d)*.46,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.arc(0,0,Math.min(w,d)*.16,0,Math.PI*2);c.stroke()}
    else if(t==='ro-purifier'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeRect(-w*.3,-d*.34,w*.6,d*.4);c.fillStyle='#7fb8d6';c.fillRect(-w*.25,-d*.28,w*.5,d*.28);c.strokeStyle='#48564f'}
    else if(t==='geyser'){c.beginPath();c.arc(0,0,Math.min(w,d)*.46,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.arc(0,-d*.05,Math.min(w,d)*.14,0,Math.PI*2);c.stroke();c.fillStyle='#c95a3a';c.beginPath();c.arc(w*.24,d*.24,3/s.scale,0,Math.PI*2);c.fill()}
    else if(t==='squat-toilet'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.beginPath();c.ellipse(0,0,w*.28,d*.4,0,0,Math.PI*2);c.stroke();c.beginPath();c.ellipse(0,-d*.28,w*.12,d*.08,0,0,Math.PI*2);c.fill();c.stroke()}
    else if(t==='cooler'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeStyle='rgba(80,90,90,.6)';for(let x=-w*.36;x<w*.4;x+=w*.14){c.beginPath();c.moveTo(x,-d*.4);c.lineTo(x,d*.4);c.stroke()}c.strokeStyle='#48564f';c.beginPath();c.arc(0,0,Math.min(w,d)*.2,0,Math.PI*2);c.stroke()}
    else if(t==='inverter'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeRect(-w*.36,-d*.34,w*.72,d*.3);c.fillStyle=o.active===false?'#7d867f':'#5ebf86';c.beginPath();c.arc(-w*.2,d*.24,3/s.scale,0,Math.PI*2);c.fill()}
    else if(t==='water-tank'){c.beginPath();c.arc(0,0,Math.min(w,d)*.48,0,Math.PI*2);c.fill();c.stroke();c.beginPath();c.arc(0,0,Math.min(w,d)*.34,0,Math.PI*2);c.stroke();c.beginPath();c.arc(0,0,Math.min(w,d)*.12,0,Math.PI*2);c.fill();c.stroke()}
    else if(t==='jaali'){c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d);c.strokeStyle='rgba(120,95,60,.6)';for(let x=-w*.4;x<w*.4;x+=w*.13)for(let y=-d*.3;y<d*.3;y+=d*.4){c.beginPath();c.arc(x,y,Math.min(w*.05,4/s.scale),0,Math.PI*2);c.stroke()}c.strokeStyle='#48564f'}
    else {c.fillRect(-w/2,-d/2,w,d);c.strokeRect(-w/2,-d/2,w,d)}
    if(o.active){c.fillStyle='#5ebf86';c.beginPath();c.arc(w*.38,-d*.35,4/s.scale,0,Math.PI*2);c.fill();c.strokeStyle='#256047';c.stroke()}
  }

  // ── Item (furniture) drawing with selection handles ───────────
  function drawItem(o) {
    const c=ctx(),s=S();
    const center=A.worldToScreen({x:o.x+o.w/2,y:o.y+o.d/2});
    c.save();c.translate(center.x,center.y);c.rotate((o.rotation||0)*Math.PI/180);c.scale(s.scale,s.scale);
    if((o.clearance||0)>0){c.strokeStyle='rgba(190,112,45,.75)';c.lineWidth=1.2/s.scale;c.setLineDash([6/s.scale,5/s.scale]);c.strokeRect(-o.w/2-o.clearance,-o.d/2-o.clearance,o.w+o.clearance*2,o.d+o.clearance*2);c.setLineDash([])}
    c.save();c.shadowColor='rgba(29,38,34,.22)';c.shadowBlur=9/s.scale;c.shadowOffsetX=3/s.scale;c.shadowOffsetY=4/s.scale;c.globalAlpha=Math.max(.1,1-(o.transparency||0)/100);furnitureSymbol(o,c);c.restore();
    if(s.selectedIds.has(o.id)){
      const pad=7/s.scale,size=10/s.scale,rotY=-o.d/2-34/s.scale;c.strokeStyle='#28735a';c.lineWidth=2/s.scale;c.setLineDash([7/s.scale,5/s.scale]);c.strokeRect(-o.w/2-pad,-o.d/2-pad,o.w+pad*2,o.d+pad*2);c.setLineDash([]);
      c.fillStyle='#fff';c.lineWidth=1.5/s.scale;[[-o.w/2-pad,-o.d/2-pad],[o.w/2+pad,-o.d/2-pad],[o.w/2+pad,o.d/2+pad],[-o.w/2-pad,o.d/2+pad]].forEach(([x,y],i)=>{c.fillRect(x-size/2,y-size/2,size,size);c.strokeRect(x-size/2,y-size/2,size,size);c.strokeStyle='#28735a';c.lineWidth=1/s.scale;c.beginPath();const sx=i===0||i===3?-1:1,sy=i===0||i===1?-1:1;c.moveTo(x+sx*size*.25,y+sy*size*.25);c.lineTo(x-sx*size*.25,y-sy*size*.25);c.stroke();c.strokeStyle='#28735a';});
      c.beginPath();c.moveTo(0,-o.d/2-pad);c.lineTo(0,rotY);c.stroke();c.beginPath();c.arc(0,rotY,7/s.scale,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#28735a';c.font=`bold ${12/s.scale}px Inter`;c.textAlign='center';c.fillText('↻',0,rotY+4/s.scale);
      const text=`${A.formatLength(o.w)} × ${A.formatLength(o.d)}`;c.font=`${10/s.scale}px Inter`;const tw=c.measureText(text).width;c.fillStyle='rgba(255,254,250,.94)';c.fillRect(-tw/2-5/s.scale,o.d/2+14/s.scale,tw+10/s.scale,16/s.scale);c.fillStyle='#286a55';c.textAlign='center';c.fillText(text,0,o.d/2+26/s.scale);
      c.font=`600 ${10/s.scale}px Inter`;c.fillStyle='#294f42';c.fillText(o.name||o.type,0,-o.d/2-44/s.scale);
    }
    c.restore();
  }

  // ── Dimension lines ──────────────────────────────────────────
  function drawDimension(o) {
    const c=ctx(),s=S();
    const a=A.worldToScreen({x:o.x1,y:o.y1}),b=A.worldToScreen({x:o.x2,y:o.y2}),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(o.x2-o.x1,o.y2-o.y1),angle=Math.atan2(dy,dx);
    c.save();c.strokeStyle=s.selected===o.id?'#267259':(o.color||'#63716b');c.fillStyle=c.strokeStyle;c.lineWidth=1;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
    [a,b].forEach(p=>{c.beginPath();c.moveTo(p.x+Math.sin(angle)*5,p.y-Math.cos(angle)*5);c.lineTo(p.x-Math.sin(angle)*5,p.y+Math.cos(angle)*5);c.stroke()});
    c.translate((a.x+b.x)/2,(a.y+b.y)/2);c.rotate(angle);c.fillStyle='#f7f6f1';const text=A.formatLength(len);c.font='10px Inter';const tw=c.measureText(text).width;c.fillRect(-tw/2-4,-14,tw+8,14);c.fillStyle=s.selected===o.id?'#267259':'#57645e';c.textAlign='center';c.fillText(text,0,-4);c.restore();
  }

  // ── Selection bounds & multi-selection overlay ───────────────
  function selectionBounds() {
    const s=S(),objects=A.floor().items.filter(o=>s.selectedIds.has(o.id));
    if(!objects.length)return null;
    const points=objects.flatMap(rotatedRect),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    return {objects,minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),cx:(Math.min(...xs)+Math.max(...xs))/2,cy:(Math.min(...ys)+Math.max(...ys))/2};
  }

  function groupSelectionScreen() {
    const b=selectionBounds();if(!b)return null;
    const a=A.worldToScreen({x:b.minX,y:b.minY}),z=A.worldToScreen({x:b.maxX,y:b.maxY}),pad=10;
    return {b,a,z,pad,handle:{x:(a.x+z.x)/2,y:Math.max(24,a.y-pad-32)}};
  }

  function drawMultiSelection() {
    const s=S(),c=ctx();
    if(s.selectedIds.size<2)return;
    const g=groupSelectionScreen();if(!g)return;
    const {a,z,pad,handle}=g;
    c.save();c.strokeStyle='#1e7b5d';c.fillStyle='#fff';c.lineWidth=2.5;c.setLineDash([9,5]);c.strokeRect(a.x-pad,a.y-pad,z.x-a.x+pad*2,z.y-a.y+pad*2);c.setLineDash([]);
    c.beginPath();c.moveTo((a.x+z.x)/2,a.y-pad);c.lineTo(handle.x,handle.y);c.stroke();c.beginPath();c.arc(handle.x,handle.y,9,0,Math.PI*2);c.fill();c.stroke();
    c.fillStyle='#1e7b5d';c.beginPath();c.arc(handle.x,handle.y,3,0,Math.PI*2);c.fill();
    c.fillStyle='rgba(255,254,250,.96)';c.font='600 11px Inter';c.textAlign='center';const label=`${s.selectedIds.size} objects  ·  drag to move  ·  rotate handle`;const tw=c.measureText(label).width;const canvas=s.canvas;const viewHeight=canvas.clientHeight||canvas.height/(devicePixelRatio||1);const labelY=Math.min(viewHeight-22,z.y+pad+20);c.fillRect((a.x+z.x)/2-tw/2-8,labelY-13,tw+16,20);c.fillStyle='#286a55';c.fillText(label,(a.x+z.x)/2,labelY+1);c.restore();
  }

  // ── Preview shapes (drawing in progress) ─────────────────────
  function drawPreview() {
    const s=S(),c=ctx(),interaction=s.interaction;
    if(!interaction || !['room','wall','roof','dimension','marquee','beam','column'].includes(interaction.type)) return;
    const a=interaction.start,b=interaction.current;
    c.save();c.strokeStyle='#2f8064';c.fillStyle='rgba(58,135,103,.12)';c.setLineDash([6,4]);c.lineWidth=2;
    if(interaction.type==='room'||interaction.type==='roof'||interaction.type==='marquee'){const p=A.worldToScreen({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y)}),w=Math.abs(b.x-a.x)*s.scale,h=Math.abs(b.y-a.y)*s.scale;if(interaction.type==='roof'){c.fillStyle='rgba(93,101,96,.22)';c.strokeStyle='#66736c'}c.fillRect(p.x,p.y,w,h);c.strokeRect(p.x,p.y,w,h)}
    else if(interaction.type==='column'){
      const colW=(A.COLUMN_DEFAULT_WIDTH||23)*s.scale, colD=(A.COLUMN_DEFAULT_DEPTH||30)*s.scale;
      const cp=A.worldToScreen(a);
      c.fillStyle='rgba(36,51,45,0.45)'; c.fillRect(cp.x-colW/2,cp.y-colD/2,colW,colD);
      c.strokeRect(cp.x-colW/2,cp.y-colD/2,colW,colD);
    }
    else {const aa=A.worldToScreen(a),bb=A.worldToScreen(b);c.beginPath();c.moveTo(aa.x,aa.y);c.lineTo(bb.x,bb.y);c.stroke()}
    c.restore();
  }

  // ── Snap guide lines ─────────────────────────────────────────
  function drawSnapGuides() {
    const s=S(),c=ctx();
    if(!s.snapGuides.length)return;
    const canvas=s.canvas,w=canvas.clientWidth,h=canvas.clientHeight;
    c.save();c.strokeStyle='#e0559b';c.lineWidth=1;c.setLineDash([6,4]);
    s.snapGuides.forEach(g=>{c.beginPath();if(g.x!==undefined){const sc=A.worldToScreen({x:g.x,y:0});c.moveTo(sc.x,0);c.lineTo(sc.x,h)}else{const sc=A.worldToScreen({x:0,y:g.y});c.moveTo(0,sc.y);c.lineTo(w,sc.y)}c.stroke()});
    c.restore();
  }

  // ── Drag measurement lines ───────────────────────────────────
  function drawDragMeasure() {
    const s=S(),c=ctx(),interaction=s.interaction;
    if(!interaction||!['move','move-group','resize-item','resize-item-corner'].includes(interaction.type))return;
    const ids=interaction.ids||(interaction.id?[interaction.id]:[]),objs=A.floor().items.filter(o=>ids.includes(o.id));
    if(!objs.length)return;
    const box=movingBox(objs),cx=(box.minX+box.maxX)/2,cy=(box.minY+box.maxY)/2;
    const room=A.floor().rooms.find(r=>cx>=r.x&&cx<=r.x+r.w&&cy>=r.y&&cy<=r.y+r.d);if(!room)return;
    const seg=(x1,y1,x2,y2,val)=>{const a=A.worldToScreen({x:x1,y:y1}),b=A.worldToScreen({x:x2,y:y2});if(Math.hypot(b.x-a.x,b.y-a.y)<14)return;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,txt=A.formatLength(val);c.save();c.font='10px Inter';const tw=c.measureText(txt).width;c.fillStyle='rgba(41,95,79,.94)';c.fillRect(mx-tw/2-4,my-8,tw+8,15);c.fillStyle='#fff';c.textAlign='center';c.fillText(txt,mx,my+3);c.restore()};
    c.save();c.strokeStyle='#3f7b66';c.lineWidth=1;c.setLineDash([3,3]);
    seg(room.x,cy,box.minX,cy,box.minX-room.x);
    seg(box.maxX,cy,room.x+room.w,cy,room.x+room.w-box.maxX);
    seg(cx,room.y,cx,box.minY,box.minY-room.y);
    seg(cx,box.maxY,cx,room.y+room.d,room.y+room.d-box.maxY);
    c.restore();
  }

  // ── Isometric 3D preview (canvas-based fallback) ─────────────
  function project3D(p,w,h,bounds) {
    const cam=S().project.camera, cx=(bounds.minX+bounds.maxX)/2,cy=(bounds.minY+bounds.maxY)/2,a=cam.yaw*Math.PI/180,pitch=cam.pitch*Math.PI/180;
    const dx=p.x-cx,dy=p.y-cy,xr=dx*Math.cos(a)-dy*Math.sin(a),yr=dx*Math.sin(a)+dy*Math.cos(a),z=p.z||0;
    return {x:w/2+xr*cam.zoom,y:h*.67+yr*cam.zoom*Math.sin(pitch)-z*cam.zoom*Math.cos(pitch),depth:yr+z*.08};
  }

  function draw3D(w,h) {
    const c=ctx(),s=S(),project=s.project;
    const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#e7ece8');bg.addColorStop(.62,'#f5f3ec');bg.addColorStop(1,'#d4d6d0');c.fillStyle=bg;c.fillRect(0,0,w,h);
    const bounds=planBounds(),wallGroups=[],itemGroups=[];
    const drawFace=sf=>{c.save();c.globalAlpha=sf.alpha;c.beginPath();sf.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=sf.color;c.fill();c.strokeStyle=sf.stroke;c.lineWidth=.75;c.stroke();c.restore()};
    const flat=(poly,z,color,stroke,alpha=1)=>drawFace({points:poly.map(p=>project3D({...p,z},w,h,bounds)),color,stroke,alpha});
    const group=(id,cx,cy)=>({id,depth:project3D({x:cx,y:cy,z:0},w,h,bounds).depth,faces:[]});
    const addFace=(g,points,color,stroke='#68716c',alpha=1)=>{const projected=points.map(p=>project3D(p,w,h,bounds));g.faces.push({points:projected,color,stroke,alpha,depth:projected.reduce((sum,p)=>sum+p.depth,0)/projected.length,order:g.faces.length})};
    const prism=(g,poly,z,height,color,alpha=1)=>{const top=poly.map(p=>({...p,z:z+height}));for(let i=0;i<poly.length;i++){const n=(i+1)%poly.length;addFace(g,[{...poly[i],z},{...poly[n],z},top[n],top[i]],A.shade(color,i%2?-20:-9),'#6f7772',alpha)}addFace(g,top,A.shade(color,17),'#68716c',alpha)};
    const localRect=(o,ox,oy,pw,pd)=>{const cx=o.x+o.w/2,cy=o.y+o.d/2,a=(o.rotation||0)*Math.PI/180,pcx=cx+ox*Math.cos(a)-oy*Math.sin(a),pcy=cy+ox*Math.sin(a)+oy*Math.cos(a);return rotatedRect({x:pcx-pw/2,y:pcy-pd/2,w:pw,d:pd,rotation:o.rotation||0})};
    const doorLeafRect=(o,right=false,leafW=o.w)=>{const cx=o.x+o.w/2,cy=o.y+o.d/2,base=(o.rotation||0)*Math.PI/180,hx=right?o.w/2:-o.w/2,hingeX=cx+hx*Math.cos(base),hingeY=cy+hx*Math.sin(base),direction=right?-1:1,angle=base+(right?Math.PI:0)+direction*(o.swingSide??1)*Math.max(0,Math.min(120,o.openAngle??30))*Math.PI/180,leafCx=hingeX+Math.cos(angle)*leafW/2,leafCy=hingeY+Math.sin(angle)*leafW/2;return rotatedRect({x:leafCx-leafW/2,y:leafCy-o.d/2,w:leafW,d:o.d,rotation:angle*180/Math.PI})};

    const pad=85,ground=[{x:bounds.minX-pad,y:bounds.minY-pad},{x:bounds.maxX+pad,y:bounds.minY-pad},{x:bounds.maxX+pad,y:bounds.maxY+pad},{x:bounds.minX-pad,y:bounds.maxY+pad}];
    flat(ground,-5,'#d7dcd6','#a9b1ab',1);
    A.floor().rooms.forEach(r=>{const poly=[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.d},{x:r.x,y:r.y+r.d}];flat(poly,1,r.color,'#a2aba5',Math.max(.88,r.opacity??1))});

    A.floor().walls.forEach(o=>{
      const dx=o.x2-o.x1,dy=o.y2-o.y1,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,nx=-uy*o.thickness/2,ny=ux*o.thickness/2,g=group(o.id,(o.x1+o.x2)/2,(o.y1+o.y2)/2),near=g.depth>0,mode=project.camera.wallMode||'cutaway',wallHeight=mode==='hidden'?8:(mode==='cutaway'&&near?Math.min(105,o.height||280):(o.height||280));
      const segmentPoly=(a,b)=>[{x:o.x1+ux*a+nx,y:o.y1+uy*a+ny},{x:o.x1+ux*b+nx,y:o.y1+uy*b+ny},{x:o.x1+ux*b-nx,y:o.y1+uy*b-ny},{x:o.x1+ux*a-nx,y:o.y1+uy*a-ny}];
      const openings=A.floor().items.filter(it=>['door','window'].includes(it.shape)).map(it=>{const cx=it.x+it.w/2,cy=it.y+it.d/2,t=((cx-o.x1)*dx+(cy-o.y1)*dy)/(len*len),px=o.x1+t*dx,py=o.y1+t*dy,dist=Math.hypot(cx-px,cy-py),angle=Math.abs((((it.rotation||0)-Math.atan2(dy,dx)*180/Math.PI+90)%180+180)%180-90);return{it,center:t*len,dist,angle}}).filter(x=>x.dist<Math.max(35,o.thickness*2)&&x.angle<8&&x.center>0&&x.center<len).map(x=>({...x,start:Math.max(0,x.center-x.it.w/2),end:Math.min(len,x.center+x.it.w/2)}));
      const cuts=[0,len,...openings.flatMap(x=>[x.start,x.end])].sort((a,b)=>a-b).filter((v,i,a)=>!i||Math.abs(v-a[i-1])>.1);
      for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1],mid=(a+b)/2,opening=openings.find(x=>mid>x.start+.1&&mid<x.end-.1),poly=segmentPoly(a,b);if(!opening)prism(g,poly,3,wallHeight,'#e7e8e4',1);else{const sill=opening.it.shape==='window'?(opening.it.elevation||90):0,top=Math.min(wallHeight,sill+(opening.it.height||120));if(sill>0)prism(g,poly,3,Math.min(sill,wallHeight),'#e7e8e4',1);if(top<wallHeight)prism(g,poly,3+top,wallHeight-top,'#e7e8e4',1)}}
      wallGroups.push(g)
    });

    A.floor().items.forEach(o=>{
      const t=o.shape||o.type;if(t==='roof'&&project.camera.roofMode==='hidden')return;const z=o.elevation||5,H=Math.max(2,o.height||80),g=group(o.id,o.x+o.w/2,o.y+o.d/2);g.alpha=Math.max(.08,1-(o.transparency||0)/100);
      addFace(g,rotatedRect(o).map(p=>({...p,z:3})), 'rgba(49,61,55,.10)','rgba(0,0,0,0)',.65);
      if(t==='sofa'){prism(g,localRect(o,0,o.d*.08,o.w,o.d*.72),z,H*.5,o.color);prism(g,localRect(o,0,-o.d*.38,o.w,o.d*.2),z,H,o.color);prism(g,localRect(o,-o.w*.45,0,o.w*.1,o.d),z,H*.7,o.color);prism(g,localRect(o,o.w*.45,0,o.w*.1,o.d),z,H*.7,o.color)}
      else if(t==='chair'){prism(g,localRect(o,0,o.d*.08,o.w*.82,o.d*.65),z,H*.48,o.color);prism(g,localRect(o,0,-o.d*.38,o.w*.82,o.d*.16),z,H,o.color)}
      else if(t==='bed'){prism(g,localRect(o,0,0,o.w,o.d),z,H*.5,A.shade(o.color,-12));prism(g,localRect(o,0,o.d*.04,o.w*.94,o.d*.86),z+H*.46,H*.38,A.shade(o.color,22));prism(g,localRect(o,-o.w*.25,-o.d*.33,o.w*.4,o.d*.22),z+H*.78,H*.14,'#eeeae2');prism(g,localRect(o,o.w*.25,-o.d*.33,o.w*.4,o.d*.22),z+H*.78,H*.14,'#eeeae2')}
      else if(t==='table'||t==='desk'){prism(g,localRect(o,0,0,o.w,o.d),z+H*.82,H*.18,o.color);for(const sx of [-.4,.4])for(const sy of [-.35,.35])prism(g,localRect(o,o.w*sx,o.d*sy,Math.min(10,o.w*.1),Math.min(10,o.d*.14)),z,H*.84,A.shade(o.color,-25))}
      else if(t==='round-table'){const cx=o.x+o.w/2,cy=o.y+o.d/2,top=Array.from({length:16},(_,i)=>({x:cx+Math.cos(i*Math.PI/8)*o.w*.49,y:cy+Math.sin(i*Math.PI/8)*o.d*.49}));prism(g,localRect(o,0,0,o.w*.13,o.d*.13),z,H*.86,A.shade(o.color,-25));prism(g,top,z+H*.84,H*.16,o.color)}
      else if(t==='cabinet'){prism(g,rotatedRect(o),z,H,o.color);prism(g,localRect(o,-o.w*.255,o.d*.51,o.w*.47,3),z+8,H-16,A.shade(o.color,8));prism(g,localRect(o,o.w*.255,o.d*.51,o.w*.47,3),z+8,H-16,A.shade(o.color,5))}
      else if(t==='kitchen'){prism(g,rotatedRect(o),z,H*.92,o.color);prism(g,localRect(o,0,0,o.w+4,o.d+4),z+H*.9,H*.1,A.shade(o.color,28));for(let x=-o.w*.375;x<o.w*.5;x+=o.w*.25)prism(g,localRect(o,x,o.d*.51,2,o.d*.04),z+8,H*.78,A.shade(o.color,-18))}
      else if(t==='sink'){prism(g,rotatedRect(o),z,H*.9,o.color);prism(g,localRect(o,0,0,o.w+3,o.d+3),z+H*.88,H*.12,A.shade(o.color,18));prism(g,localRect(o,0,0,o.w*.62,o.d*.56),z+H*.96,3,'#667a7a')}
      else if(t==='plant'){prism(g,localRect(o,0,0,o.w*.28,o.d*.28),z,H*.38,'#765b40');const cx=o.x+o.w/2,cy=o.y+o.d/2,canopy=Array.from({length:8},(_,i)=>({x:cx+Math.cos(i*Math.PI/4)*o.w*.54,y:cy+Math.sin(i*Math.PI/4)*o.d*.54}));prism(g,canopy,z+H*.28,H*.64,o.color,.96)}
      else if(t==='lamp'){prism(g,localRect(o,0,0,o.w*.18,o.d*.18),z,H*.84,'#646963');prism(g,localRect(o,0,0,o.w,o.d),z+H*.79,H*.21,o.color,.9)}
      else if(t==='door'){if(o.type==='garage-door'){const open=Math.max(0,Math.min(1,(o.openAngle||0)/100)),visible=H*(1-open);if(visible>2)prism(g,localRect(o,0,0,o.w,o.d),z+H-visible,visible,o.color,1)}else if(o.type==='sliding-door'){const open=Math.max(0,Math.min(1,(o.openAngle||0)/100));prism(g,localRect(o,open*o.w*.45,0,o.w*.55,o.d),z,H,o.color,1)}else if(o.type==='double-door'||o.type==='temple-double-door'){prism(g,doorLeafRect(o,false,o.w/2),z,H,o.color,1);prism(g,doorLeafRect(o,true,o.w/2),z,H,o.color,1);if(o.type==='temple-double-door'){for(const sx of [-.25,0,.25])prism(g,localRect(o,o.w*sx,0,2,o.d*.72),z+H*.52,H*.35,'#b68a43');prism(g,localRect(o,0,0,o.w*1.08,o.d*.9),z+H,H*.06,'#b68a43')}}else prism(g,doorLeafRect(o,o.hingeSide==='right'),z,H,o.color,1);prism(g,localRect(o,-o.w*.49,0,5,o.d+4),z,H+5,'#76624f');prism(g,localRect(o,o.w*.49,0,5,o.d+4),z,H+5,'#76624f')}
      else if(t==='window'){prism(g,localRect(o,0,0,o.w,o.d),z,H,o.color,.42);prism(g,localRect(o,0,0,o.w,5),z,6,'#e5e7e3');prism(g,localRect(o,0,0,o.w,5),z+H-6,6,'#e5e7e3');prism(g,localRect(o,0,0,6,o.d+3),z,H,'#e5e7e3')}
      else if(t==='roof'){prism(g,rotatedRect(o),z,H,o.color||'#a8aaa5');prism(g,localRect(o,0,0,o.w*.94,o.d*.94),z+H,H*.08,A.shade(o.color||'#a8aaa5',18))}
      else if(t==='mirror'){prism(g,localRect(o,0,0,o.w,o.d),z,H,o.frameColor||'#4d5552');prism(g,localRect(o,0,0,o.w*.9,o.d*.7),z+4,H-8,o.color||'#b7c7c7',.96);prism(g,localRect(o,-o.w*.2,0,o.w*.06,o.d*.75),z+H*.2,H*.58,'#e7f5f4',.55)}
      else if(t==='tv'){prism(g,localRect(o,0,0,o.w,o.d),z,H,o.active?'#2f7892':o.color);prism(g,localRect(o,0,0,o.w*.18,o.d*1.5),Math.max(0,z-18),18,'#4f5553')}
      else if(t==='cooktop'){prism(g,rotatedRect(o),z,H,o.color);for(const sx of [-.24,.24])for(const sy of [-.24,.24])prism(g,localRect(o,o.w*sx,o.d*sy,o.w*.25,o.d*.25),z+H,2,o.active?'#c85d35':'#202525')}
      else if(t==='appliance'||t==='washer'){prism(g,rotatedRect(o),z,H,o.color);prism(g,localRect(o,0,o.d*.51,o.w*.72,3),z+H*.18,H*.58,t==='washer'?'#657477':'#343a3b')}
      else if(t==='double-sink'){prism(g,rotatedRect(o),z,H,o.color);prism(g,localRect(o,-o.w*.24,0,o.w*.38,o.d*.6),z+H,2,'#667a7a');prism(g,localRect(o,o.w*.24,0,o.w*.38,o.d*.6),z+H,2,'#667a7a')}
      else if(t==='radiator'){prism(g,rotatedRect(o),z,H,o.color);for(let x=-o.w*.4;x<o.w*.45;x+=o.w*.13)prism(g,localRect(o,x,o.d*.52,o.w*.06,3),z+5,H-10,A.shade(o.color,-10))}
      else if(t==='car'){prism(g,localRect(o,0,0,o.w,o.d),z,H*.38,o.color);prism(g,localRect(o,0,-o.d*.04,o.w*.78,o.d*.48),z+H*.35,H*.48,A.shade(o.color,5));prism(g,localRect(o,0,-o.d*.02,o.w*.66,o.d*.22),z+H*.58,H*.27,'#35434c',.8)}
      else if(t==='l-stairs'||t==='u-stairs'){const steps=Math.max(6,Math.min(36,o.stepCount||16)),half=Math.ceil(steps/2),sw=Math.min(o.stairWidth||95,o.w*.46,o.d*.46),landing=Math.min(o.landingDepth||100,o.d*.42),run=o.d-landing;for(let i=0;i<half;i++){const sy=o.d/2-landing-(i+.5)*run/half;prism(g,localRect(o,-o.w/2+sw/2,sy,sw,run/half+1),z,(i+1)*H*.5/half,o.color)}prism(g,localRect(o,0,-o.d/2+landing/2,t==='u-stairs'?o.w:sw,landing),z,H*.5,o.color);const remain=steps-half;for(let i=0;i<remain;i++){if(t==='u-stairs'){const sy=-o.d/2+landing+(i+.5)*run/remain;prism(g,localRect(o,o.w/2-sw/2,sy,sw,run/remain+1),z,H*.5+(i+1)*H*.5/remain,o.color)}else{const sx=-o.w/2+sw+(i+.5)*(o.w-sw)/remain;prism(g,localRect(o,sx,-o.d/2+sw/2,(o.w-sw)/remain+1,sw),z,H*.5+(i+1)*H*.5/remain,o.color)}}}
      else if(t==='planter'){prism(g,rotatedRect(o),z,H,o.color);for(let x=-o.w*.36;x<o.w*.4;x+=o.w*.18)prism(g,localRect(o,x,0,o.d*.3,o.d*.3),z+H,H*.8,'#4f7b51',.95)}
      else if(t==='bench'){prism(g,localRect(o,0,0,o.w,o.d*.45),z+H*.45,H*.14,o.color);prism(g,localRect(o,0,-o.d*.42,o.w,o.d*.12),z+H*.48,H*.52,o.color);for(const x of [-o.w*.4,o.w*.4])prism(g,localRect(o,x,0,8,8),z,H*.48,A.shade(o.color,-25))}
      else if(t==='stairs'){const steps=11;for(let i=0;i<steps;i++){const sy=o.d/2-(i+.5)*o.d/steps;prism(g,localRect(o,0,sy,o.w,o.d/steps+1),z,(i+1)*H/steps,o.color)}}
      else if(t==='rug')prism(g,rotatedRect(o),z,2,o.color,.9);
      else if(t==='shower'){prism(g,localRect(o,0,0,o.w,o.d),z,7,'#dfe6e4');prism(g,localRect(o,-o.w*.49,0,3,o.d),z,H,o.color,.3);prism(g,localRect(o,0,-o.d*.49,o.w,3),z,H,o.color,.3)}
      else if(t==='tub'){const poly=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5,c=o.x+o.w/2,d=o.y+o.d/2;return{x:c+Math.cos(a)*o.w/2,y:d+Math.sin(a)*o.d/2}});prism(g,poly,z,H,o.color);prism(g,localRect(o,0,0,o.w*.72,o.d*.5),z+H,3,'#9eb8ba')}
      else if(t==='toilet'){const bowl={...o,y:o.y+o.d*.2,d:o.d*.68},poly=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5,c=bowl.x+bowl.w/2,d=bowl.y+bowl.d/2;return{x:c+Math.cos(a)*bowl.w/2,y:d+Math.sin(a)*bowl.d/2}});prism(g,poly,z,H*.58,o.color);prism(g,localRect(o,0,-o.d*.38,o.w*.78,o.d*.24),z,H,o.color)}
      else prism(g,rotatedRect(o),z,H,o.color,1);
      itemGroups.push(g);
    });
    const drawGroups=groups=>groups.sort((a,b)=>a.depth-b.depth||String(a.id).localeCompare(String(b.id))).forEach(g=>g.faces.sort((a,b)=>a.depth-b.depth||a.order-b.order).forEach(sf=>drawFace({...sf,alpha:sf.alpha*(g.alpha??1)})));
    drawGroups(wallGroups);drawGroups(itemGroups);
    c.fillStyle='rgba(30,44,38,.72)';c.font='600 11px Inter, sans-serif';c.textAlign='left';c.fillText('DRAG TO ORBIT  ·  WHEEL TO ZOOM',18,h-18);
  }

  // ── Main draw orchestrator ───────────────────────────────────
  function draw() {
    const s=S(),c=ctx();
    A.syncArchitecture?.();
    if(s.viewMode==='3d'){window.atelier3D?.requestRebuild();return;}
    if(!s.canvas || !c) return;
    const dpr=Math.min(devicePixelRatio||1,2),w=s.canvas.width/dpr,h=s.canvas.height/dpr;
    if(w <= 0 || h <= 0) return;
    c.clearRect(0,0,w,h);
    drawGrid(w,h);
    drawSiteAnnotations();
    drawBuiltUpBoundary();
    A.floor().rooms.forEach(drawRoom);
    A.floor().walls.forEach(drawWall);
    if(s.workspace !== 'architecture' && s.project.showStructure !== false){
      if(A.analyzeStructure && ((A.floor().beams && A.floor().beams.length) || (A.floor().columns && A.floor().columns.length))){
        A.analyzeStructure(A.floor(), s.project);
      }
      (A.floor().beams || []).forEach(drawBeam);
      (A.floor().columns || []).forEach(drawColumn);
    }
    if(!s.project.framingMode){
      A.floor().items.filter(A.isRoofVisibleInPlan).forEach(drawItem);
    }
    A.floor().dimensions.forEach(drawDimension);
    drawMultiSelection();
    drawPreview();
    drawSnapGuides();
    drawDragMeasure();
    A.drawServiceDraft?.(c);
  }

  // ── Expose on global namespace ───────────────────────────────
  Object.assign(A, {
    roundedRect, rotatedRect, itemAabb, planBounds, movingBox,
    drawGrid, updateGridLegend, drawSiteAnnotations, drawBuiltUpBoundary,
    drawRoom, wallHandlePoints, wallHandleHit, beamHandleHit, drawWall,
    drawColumn, drawBeam,
    furnitureSymbol, drawItem, drawDimension,
    selectionBounds, groupSelectionScreen, drawMultiSelection,
    drawPreview, drawSnapGuides, drawDragMeasure,
    project3D, draw3D, draw
  });
})();
