# Atelier Plan — codebase index

The app uses plain script tags and the `window.Atelier` namespace. There is no build step. Script order in `index.html` is the dependency source of truth; bootstrap runs after all scripts load.

| File | Responsibility |
|---|---|
| index.html | Application shell, toolbars, panels, dialogs, script order |
| css/styles.css | Responsive layout, components, focus styles, drawing/report print styles |
| css/studio.css | Adaptive studio shell, workspace/task navigation, docked panels and touch sheets |
| js/studio-ui.js | Command search, object browser, contextual tools, property sheets and adaptive navigation |
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

## Data and relationships

Internal lengths are centimetres. Project fields include `name`, `projectId`, `unit`, `north`, `camera`, `sun`, `builtUp`, `climate`, `vastu`, and `floors`. Each floor has an ID, name, elevation, and arrays for rooms, walls, items, dimensions, columns, and beams.
`structuralBasis` records site, code references and assumed loads/materials. Floors also store `slabs`, `loads`, `structuralWalls`, `grids`, `diaphragm` and `isRoof`; beams store start/end column IDs. Frame analysis uses kN, metres and radians; the plan model remains in centimetres.

- Hosted doors/windows store `hostWallId` and `wallOffset` (centimetres along the wall).
- Associative dimensions store `anchor1`/`anchor2` with an entity ID, endpoint or corner, and drawing offsets.
- Traced rooms store world-coordinate `polygon` points and sorted `boundaryWallIds`.
- `camera.allFloors` selects stacked 3D rendering.
- Project library storage is separate from the existing active-project key.
- A `?test=1` URL uses an isolated storage prefix.

## Update flow

Input → checkpoint → model mutation → architecture synchronization → 2D drawing or incremental 3D synchronization → debounced save.

Architecture synchronization propagates shared wall endpoint edits, updates hosted openings and dimension anchors, and refreshes existing traced rooms. The renderer caches scene records by floor/entity ID and geometry signature. Item position/elevation/rotation can update without rebuilding its geometry.

Structural outputs are derived annotations. The analysis cache ignores those outputs and ordinary furniture changes; relevant geometry, materials, reinforcement, and supporting-floor columns invalidate it.

## Extending

Canvas overlay navigation lives in `js/canvas-space.js` and `css/canvas-space.css`, initialized after the studio shell. `CANVAS_SPACE.md` describes the reveal/hide invariants and expand mode.

Add catalog types to furniture-catalog.js, 2D symbols to canvas-drawing.js, and geometry to renderer3d.js. New project properties should have migration defaults and import validation. New interactions should checkpoint before mutation and preserve cancellation. Add regression coverage for relationships and browser behavior.
