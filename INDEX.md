# Atelier Plan — codebase index

Updated 10 October 2026. Start here when continuing development, adding objects, or changing existing features. This is developer context; `index.html` remains the runnable application entry point.

The app uses plain script tags and the `window.Atelier` namespace. There is no build step. Script order in `index.html` is the dependency source of truth; bootstrap runs after all scripts load.

| File | Responsibility |
|---|---|
| index.html | Application shell, toolbars, panels, dialogs, script order |
| css/styles.css | Responsive layout, components, focus styles, drawing/report print styles |
| css/studio.css | Adaptive studio shell, workspace/task navigation, docked panels and touch sheets |
| js/studio-ui.js | Command search, object browser, contextual tools, property sheets and adaptive navigation |
| css/canvas-space.css | Final shell overrides, permanent left rail, canvas corner controls, sheet overlays and responsive spacing |
| js/canvas-space.js | Moves existing controls into the final shell; explicit hide/reveal, hover sheets and Expand/Restore state |
| js/utilities.js | DOM helpers, IDs, unit conversion, signed formatting, storage namespace |
| js/constants.js | Structural and geometry defaults |
| js/furniture-catalog.js | Base furniture/opening/equipment definitions |
| js/services.js | 19 plumbing/electrical objects, route drawing and vertex editing |
| js/structural-model.js | Lucknow/BIS basis, panel clipping, reinforcement, gravity bookkeeping |
| js/frame-solver.js | 3D frame stiffness, support/diaphragm transformations and eigen helpers |
| js/seismic-analysis.js | Spectra, seismic mass, modal/CQC response, drift, force envelopes and reports |
| js/project-model.js | Defaults, version migration, layout repair, solar calculation |
| js/project-validation.js | Validate and clone portable projects before committing them |
| js/app-state.js | Project/view/selection state, restored-project detection, undo checkpoints |
| js/structural-analysis.js | Cached legacy plan annotations and compatible proposal/report entry points |
| js/structural-proposals.js | Clone/compare/apply framing, sizing, grids and wall proposals |
| js/structural-workspace.js | Discipline tabs, structural forms, layers, schedules and projections |
| js/canvas-drawing.js | 2D canvas renderer, bounds, entity symbols and handles |
| js/pointer-interaction.js | Hit testing, selection, resize, rotation, snapping, placement |
| js/inspector-panel.js | Project/entity properties and advisory panels |
| js/catalog-sidebar.js | Catalog thumbnails, filtering, keyboard and drag placement |
| js/object-operations.js | Clipboard, duplicate, delete, z-order, object transforms |
| js/persistence.js | Autosave, validated JSON import, JSON export |
| js/ui-wiring.js | Event bindings, floor copying, view switching, renderer bridge |
| js/editing-support.js | Measurement validation, grouped edits, canceled-pointer rollback |
| js/architecture.js | Joined wall endpoints, hosted openings, associative dimensions, closed wall faces |
| js/project-library.js | Named projects, archive/restore, five recovery snapshots |
| js/drawing-export.js | Physical-scale SVG/PDF drawing export and printing |
| js/accessibility.js | Field labels, keyboard switches, focus-managed dialogs, entity search |
| js/app.js | Bootstrap; framing changes require a reviewed proposal |
| renderer3d.js | Three.js scene cache, transform updates, elevated floor stacks, walkthrough |
| default-layout.js | Reference courtyard layout |
| server.cjs | Read-only localhost development server |
| tests/regression.cjs | Pure model/geometry regression groups and script parsing |
| tests/engineering.cjs | Numerical frame, mass, spectrum, constraint and proposal benchmarks |
| tests/browser.html + browser-tests.js | Isolated browser integration suite |
| tests/responsive.html | Desktop/tablet/mobile iframe preview |
| tests/structural-demo.html | Isolated two-storey structural / modal / 3D sample |
| tests/ui-preview.html | Isolated studio preview with desktop/tablet/mobile sizes and direct workspace/panel controls |
| tests/services-demo.html | Plumbing/electrical demonstration workspace |

## Current development context

The application is offline, browser-local and framework-free. Do not introduce a build step or remote asset dependency for routine changes. CSS loads in order: `styles.css`, `studio.css`, `canvas-space.css`; the last file owns the current editor layout. Bootstrap calls `initUI`, `initStructuralWorkspace`, `initStudioUI`, then `initCanvasSpace`. Several later modules wrap existing `Atelier` methods, so inspect wrappers before changing a base method.

The latest application revision is `eb18d58` (canvas history controls and Architecture visibility), following `b22f288` (canvas corners/top reveal arrows). Use Git history for subsequent revisions rather than treating these hashes as permanent branch heads.

Read these companion documents as needed:

- `PROJECT_SPEC.md`: product and model specification.
- `UI_REDESIGN.md` and `CANVAS_SPACE.md`: navigation decisions, critique and layout behavior.
- `STRUCTURAL_IMPLEMENTATION.md` and `STRUCTURAL_REVIEW.md`: calculation scope, reference review and unresolved engineering checks.
- `REFERENCE_INVENTORY.md`: reference material inventory.
- `validation/RESULTS.md`: recorded verification and screenshot evidence.

### Editor layout to preserve

- Architecture, Structure, Services and 3D share one project. Architecture does not draw or hit-test beams/columns. Structure has its own drawing, camera, member creation, layers and analysis. Keep structural geometry in the model when changing workspaces.
- The permanent vertical tool rail stays on the left, including in Expand canvas mode. Desktop shows both Library and Properties; narrow layouts show one sheet at a time. Headers and sheets are visible initially.
- The floor dropdown has an accessible name and no visible label, in the canvas upper-left. Grid/Fit occupy the upper-right. Add floor belongs to the workspace bar.
- Undo/Redo occupy the canvas bottom-left. Zoom/Expand occupy the bottom-right. The grid legend is bottom-centred; touch sheets leave clearance above bottom controls. Help sits beside command search. Avoid repeated floor names and duplicate actions.
- Project/workspace bars collapse through upward arrows and reveal through downward arrows at the app top, outside the canvas. Bar arrows require explicit activation; hovering must not immediately reopen a just-hidden bar.
- Explicit sheet hiding changes available canvas space. Hover reveals an unpinned sheet as an overlay without changing canvas bounds, bitmap, camera or model. Do not auto-hide pinned sheets. Expand hides headers/sheets and Restore reinstates their previous visibility.
- `Atelier.canvasSpace` exposes `showPanel`, `hidePanel` and `focus`; use the existing navigation/visibility entry points rather than adding a second panel-state system. Hidden surfaces are inert; preserve keyboard focus return, Escape behavior and touch access.

## Data and relationships

Internal lengths are centimetres. Project fields include `name`, `projectId`, `unit`, `north`, `camera`, `sun`, `builtUp`, `climate`, `vastu`, and `floors`. Each floor has an ID, name, elevation, and arrays for rooms, walls, items, dimensions, columns, and beams.
`structuralBasis` records site, code references and assumed loads/materials. Floors also store `slabs`, `loads`, `structuralWalls`, `grids`, `diaphragm` and `isRoof`; beams store start/end column IDs. Frame analysis uses kN, metres and radians; the plan model remains in centimetres.

- Hosted doors/windows store `hostWallId` and `wallOffset` (centimetres along the wall).
- Associative dimensions store `anchor1`/`anchor2` with an entity ID, endpoint or corner, and drawing offsets.
- Traced rooms store world-coordinate `polygon` points and sorted `boundaryWallIds`.
- `camera.allFloors` selects stacked 3D rendering.
- Project library storage is separate from the existing active-project key.
- A `?test=1` URL uses an isolated storage prefix.
- Service items store `system`, `mountSurface`, elevation, diameter and route points where applicable. Route vertices use centimetres relative to the floor; vertical distances contribute to length. They describe layout, without automatic hydraulic/electrical sizing or network connectivity.

## Update flow

Input → checkpoint → model mutation → architecture synchronization → 2D drawing or incremental 3D synchronization → debounced save.

Architecture synchronization propagates shared wall endpoint edits, updates hosted openings and dimension anchors, and refreshes existing traced rooms. The renderer caches scene records by floor/entity ID and geometry signature. Item position/elevation/rotation can update without rebuilding its geometry.

Structural outputs are derived annotations. The analysis cache ignores those outputs and ordinary furniture changes; relevant geometry, materials, reinforcement, and supporting-floor columns invalidate it.

## Extending

Canvas overlay navigation lives in `js/canvas-space.js` and `css/canvas-space.css`, initialized after the studio shell. `CANVAS_SPACE.md` describes the reveal/hide invariants and expand mode.

### Adding or modifying an object

1. Find the existing `type` and `shape` in `js/furniture-catalog.js` or `js/services.js`. `type` is the persisted identity; `shape` selects drawing/geometry behavior. Preserve existing type names so saved projects keep working. Supply centimetre dimensions, height/elevation, name, category, material, color and appropriate defaults.
2. Reuse an existing shape when its geometry fits. For a new shape, update 2D `furnitureSymbol`/drawing in `js/canvas-drawing.js`, thumbnail handling in `js/catalog-sidebar.js`, and item geometry in `renderer3d.js`. Inspect renderer geometry signatures when adding properties so edits invalidate the cache correctly.
3. Add editable fields in `js/inspector-panel.js`; service route/fixture behavior belongs in `js/services.js`. Keep measurement parsing and grouped-edit handling consistent with `js/editing-support.js`. A route requires correct drawing, hit testing, vertices, transforms and total length, including vertical runs.
4. Check placement and transformations in `js/pointer-interaction.js` and `js/object-operations.js`. Keep IDs unique, floor-copy relationships remapped, hosted openings attached, and cancellation reversible.
5. Add migration/default handling in `js/project-model.js` and validation in `js/project-validation.js` for persisted fields. Check JSON round trips and `js/drawing-export.js` output; exports have their own drawing path and do not automatically inherit every canvas visibility change.
6. Validate the object in catalog placement, plan selection/editing, duplicate/delete, Undo/Redo, floor copying, save/import/export and 3D. Add meaningful regression/browser coverage where behavior or relationships change.

### Adding or modifying a feature

Follow the existing update flow. Checkpoint before model mutation; group a continuous gesture into one history action and preserve pointer cancellation. View/panel navigation must not create geometry changes or undo entries. Use existing DOM controls and event handlers when relocating UI instead of duplicating buttons. Use `js/studio-ui.js` for workspace commands/property sheets and `js/canvas-space.js` for final placement/visibility. Keep `index.html` IDs stable when they are used by event bindings or tests.

For structural features, work through `structural-model`, solver/analysis and proposal modules rather than inserting calculations into UI handlers. Defaults are Lucknow, Zone III, provisional soil II and 150 kPa bearing; these are editable assumptions, not soil-test results. Preserve report limitations and required reviews. Fix proposals must preview on a clone, reject stale/invalid results, preserve manual geometry and apply as one undo action. Do not present preliminary screening as complete BIS compliance or enable automatic column deletion without a validated alternate load-path method.

## Verification workflow

Run from the project root:

```text
node tests/regression.cjs
node tests/engineering.cjs
node server.cjs
```

Use engineering benchmarks when changing calculations, structural modeling or proposals. Open `http://127.0.0.1:4173/tests/browser.html` and run the isolated browser checks. Use `tests/ui-preview.html` for visual checks at 1440, 820 and 390 px; inspect affected Architecture/Structure/Services/3D views, panel overlays, Expand/Restore and keyboard/touch targets. Keep testing in isolated storage so the user's working project is preserved.

Latest recorded result: 43 browser groups, 8 application regression groups; 17 engineering groups passed in the preceding structural validation. The latest canvas changes did not modify engineering calculations. Counts are a baseline, not a substitute for rerunning checks after changes. Save relevant screenshots in `validation/`, update `validation/RESULTS.md`, and run `git diff --check` before committing. Documentation-only edits do not require a new browser run.
