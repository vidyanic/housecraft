# Atelier Plan — Codebase Index

> **Purpose**: Quick reference for AI agents and developers to navigate the modular codebase.
> Updated after the monolithic refactor (v1 → v2).

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     index.html (326 lines)               │
│   Pure HTML markup — SVG icons, layout, modals, toast    │
│   Loads: css/styles.css + 14 JS modules + renderer3d     │
└──────────────────────────────────────────────────────────┘
         │
   ┌─────┴────────────────────────────────────────┐
   │         css/styles.css (601 lines)           │
   │   All CSS: variables, layout, components,    │
   │   responsive breakpoints, animations         │
   └──────────────────────────────────────────────┘
         │
   ┌─────┴─────── JS Module Load Order ───────────┐
   │                                               │
   │  1. utilities.js           Pure helpers       │
   │  2. constants.js           Defaults & sizes   │
   │  3. furniture-catalog.js   Object catalog     │
   │  4. project-model.js       Data model & solar │
   │  5. app-state.js           Mutable state      │
   │  6. structural-analysis.js Civil audit & frame│
   │  7. canvas-drawing.js      2D plan & symbols  │
   │  8. pointer-interaction.js Input & handles    │
   │  9. inspector-panel.js     Properties & civil │
   │ 10. catalog-sidebar.js     Object library     │
   │ 11. object-operations.js   Ops & clipboard    │
   │ 12. persistence.js         Autosave & export  │
   │ 13. ui-wiring.js           Bindings & bridge  │
   │ 14. app.js                 Bootstrap          │
   │                                               │
   └───────────────────────────────────────────────┘
         │
   ┌─────┴────────────────────────────────────────┐
   │         renderer3d.js (1,807 lines)          │
   │   Three.js WebGL scene — PBR rooms, walls,   │
   │   3D pillars, beams, lighting & shadows      │
   └──────────────────────────────────────────────┘
```

---

## File Reference

### Root Files

| File | Lines | Role |
|------|-------|------|
| [`index.html`](file:///c:/Users/ranje/Documents/atelier-plan/index.html) | 318 | HTML shell — SVG sprites, toolbar, stage, catalog panel, inspector panel, modals, mobile nav |
| [`renderer3d.js`](file:///c:/Users/ranje/Documents/atelier-plan/renderer3d.js) | 1,652 | Three.js PBR 3D renderer — builds scene from `atelierBridge.project` |
| [`default-layout.js`](file:///c:/Users/ranje/Documents/atelier-plan/default-layout.js) | 1 | Optional reference layout override (`window.ATELIER_REFERENCE_LAYOUT`) |

### CSS

| File | Lines | Contents |
|------|-------|----------|
| [`css/styles.css`](file:///c:/Users/ranje/Documents/atelier-plan/css/styles.css) | 601 | CSS custom properties, layout grid, panel styles, tool buttons, object cards, inspector fields, modals, toast, responsive breakpoints |

### JavaScript Modules (`js/`)

All modules use the `window.Atelier` global namespace. Each file is an IIFE that reads from and writes to `window.Atelier`.

| # | File | Lines | Responsibility | Key Exports |
|---|------|-------|----------------|-------------|
| 1 | [`utilities.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/utilities.js) | ~100 | DOM selectors, uid, deep clone, escape, colour shade, unit conversion, length/area formatting | `$, $$, icon, uid, deep, escapeHtml, shade, snap, toCm, formatLength, formatArea` |
| 2 | [`constants.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/constants.js) | ~40 | Shape classification sets, wall & structural member defaults | `POWERED_TYPES, WALL_DEFAULT_*, COLUMN_DEFAULT_*, BEAM_DEFAULT_*` |
| 3 | [`furniture-catalog.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/furniture-catalog.js) | ~130 | All placeable object definitions (90+ items) with dimensions, materials, categories | `CATALOG, CATEGORY_META` |
| 4 | [`project-model.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/project-model.js) | ~220 | DEFAULT project template, plan scaling, layout repair, solar position calculator, project normalisation/migration | `DEFAULT, normalizeProject, syncSolarPosition, formatSolarTime, solarWeekDate` |
| 5 | [`app-state.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/app-state.js) | ~86 | Centralised mutable state object, coordinate transforms, floor/entity accessors (incl. columns & beams) | `state, floor(), allEntities(), findEntity(), worldToScreen(), screenToWorld(), checkpoint()` |
| 6 | [`structural-analysis.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/structural-analysis.js) | ~1270 | Civil engineering structural analysis (IS 456 / ACI 318), column axial load, beam span-to-depth deflection limits, auto-framing, grid straightening/alignment, auto-sizing by weight & span, concrete & steel BOQ, built-up envelope measurement & auto-fitting (`getHouseFootprintBounds`, `getProjectFootprintBounds`, `autoFitHouseToBuiltUp`, `setBuiltUpDimensions`), interactive HTML civil report & sizing guide modals | `analyzeStructure, autoGenerateFraming, clearStructure, recreateFraming, autoAlignWallsForGrid, autoSizeStructure, getHouseFootprintBounds, getProjectFootprintBounds, autoFitHouseToBuiltUp, setBuiltUpDimensions, generateStructuralReportHtml, showStructuralReportModal, showSizingGuideModal` |
| 7 | [`canvas-drawing.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/canvas-drawing.js) | ~685 | Grid, built-up boundary envelope (`drawBuiltUpBoundary`), rooms, walls, columns (RCC hatch, rebar dots, civil status color coding: green/amber/red), beams (centerline, span tags, civil color coding), 60+ furniture symbols, dimensions, selection handles, snap guides, drag measurements, isometric 3D preview, main `draw()` loop | `draw, drawRoom, drawWall, drawColumn, drawBeam, drawBuiltUpBoundary, furnitureSymbol, drawItem, planBounds` |
| 8 | [`pointer-interaction.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/pointer-interaction.js) | ~220 | Hit testing, column/beam placement & endpoint handles, item/wall handle detection, smart guides, wall alignment, resize/rotate, marquee, selection, tool/view switching | `hitTest, setSelection, select, setTool, setView, addObjectToPlan, applySmartGuides` |
| 9 | [`inspector-panel.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/inspector-panel.js) | ~600 | Right panel rendering: project settings, built-up footprint card (width/length inputs, presets, nudge buttons, symmetry mode, boundary toggle, auto-fit house button), civil engineering audit card (recreate/clear framing, align walls to grid with tolerance slider, auto-size structure, HTML report modal, sizing guide modal, actionable civil suggestions, color code legend), column/beam properties, single-object properties, multi-selection, layout checks, camera/sun controls | `renderInspector, updateCameraReadouts, planAuditHtml` |
| 10 | [`catalog-sidebar.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/catalog-sidebar.js) | ~80 | Left panel: thumbnail generation, category filtering, search, drag/drop handlers | `renderCatalog, makeThumb` |
| 11 | [`object-operations.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/object-operations.js) | ~150 | Delete, copy/paste, duplicate, rotate, scale, align-to-wall, z-ordering, nudge, context menu | `deleteSelected, duplicateSelected, copySelected, pasteClipboard, rotateSelected, alignSelectedToWall` |
| 12 | [`persistence.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/persistence.js) | ~60 | localStorage save/load, JSON export/import, autosave debounce, toast/hint notifications | `saveProject, queueSave, exportProject, importProject, showToast, showHint` |
| 13 | [`ui-wiring.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/ui-wiring.js) | ~320 | All DOM event bindings, canvas pointer events, keyboard shortcuts (P for Pillar, B for Beam), panel toggling, mobile tabs, zoom, resize observer, atelierBridge, master `initUI()` | `initUI, syncUI, fitPlan, updateZoom, undo, redo, setMobileTab` |
| 14 | [`app.js`](file:///c:/Users/ranje/Documents/atelier-plan/js/app.js) | ~25 | Bootstrap — auto-frames initial plan if unplaced, calls `renderCatalog()` and `initUI()` | — |

---

## Namespace Pattern

```javascript
// Every module follows this pattern:
(function () {
  'use strict';
  const A = window.Atelier;   // read shared namespace
  // ... module code ...
  Object.assign(A, { fn1, fn2 }); // expose to namespace
})();
```

- **State lives in** `Atelier.state` (project, selection, tool, zoom, canvas refs)
- **No build tools** — plain `<script>` tags in dependency order
- **renderer3d.js** communicates via `window.atelierBridge` (set up in ui-wiring.js)

---

## Data Flow

```
User Input (pointer/keyboard)
    │
    ▼
pointer-interaction.js  →  app-state.js (mutate state)
    │                           │
    ▼                           ▼
canvas-drawing.js (draw)    inspector-panel.js (render panel)
    │                           │
    ▼                           ▼
persistence.js (autosave)   renderer3d.js (3D rebuild)
```

---

## Project Data Model (`Atelier.state.project`)

```
project
├── version, name, unit, north, grid, snap
├── showStructure (boolean, toggle 2D/3D structural visibility)
├── framingMode   (boolean, isolate structure & hide furniture)
├── site        { width, depth, north, west, south, east }
├── builtUp     { width, depth, showBoundary, fitMode, applyToAllFloors }
├── climate     { preset, courtyard, crossVentilation, ... }
├── vastu       { enabled, entry, primaryBedroom, kitchen, ... }
├── camera      { yaw, pitch, zoom, wallMode, roofMode, planRoofMode }
├── sun         { time, week, location{}, azimuth, altitude, intensity }
└── floors[]
    └── floor
        ├── id, name, elevation
        ├── rooms[]      { id, type, name, x, y, w, d, color, ... }
        ├── walls[]      { id, type, x1, y1, x2, y2, thickness, height }
        ├── columns[]    { id, type:'column', x, y, w, d, height, tag, material, steelGrade, rebarSpec, footingWidth, footingDepth, footingThickness }
        ├── beams[]      { id, type:'beam', x1, y1, x2, y2, width, depth, beamType, tag, material, steelGrade, rebarSpec }
        ├── items[]      { id, type, shape, name, x, y, w, d, rotation, ... }
        └── dimensions[] { id, type, x1, y1, x2, y2, color }
```

---

## Adding New Features — Quick Guide

| Task | Files to Edit |
|------|--------------|
| New furniture type | `furniture-catalog.js` (add to CATALOG), `canvas-drawing.js` (add symbol in `furnitureSymbol`), optionally `canvas-drawing.js` draw3D section for 3D shape |
| New tool (e.g. "pillar") | `pointer-interaction.js` (setTool, pointer handlers), `canvas-drawing.js` (drawPreview), `ui-wiring.js` (keyboard shortcut) |
| New inspector section | `inspector-panel.js` (renderInspector) |
| New project property | `project-model.js` (DEFAULT + normalizeProject), `app-state.js` if needed |
| Style changes | `css/styles.css` |
| 3D rendering changes | `renderer3d.js` (separate, uses atelierBridge) |
