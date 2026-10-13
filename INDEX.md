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
| js/services.js | 19 plumbing/electrical objects, route drawing and canvas vertex/segment editing |
| js/stairs.js | Auto-fit three-sided U stair layout, uniform rise/going, two corner landings, shared plan/SVG geometry; explicit clockwise/anticlockwise choices |
| js/stair-connections.js | Entrance/exit floor links, derived upper opening/arrival, bridge-linked storey continuation, floor reconciliation and convex opening subtraction |
| js/structural-model.js | Lucknow/BIS basis, panel clipping, reinforcement, gravity bookkeeping |
| js/frame-solver.js | 3D frame stiffness, support/diaphragm transformations and eigen helpers |
| js/seismic-analysis.js | Spectra, seismic mass, modal/CQC response, drift, force envelopes and reports |
| js/project-model.js | Defaults, version migration, layout repair, solar calculation |
| js/project-validation.js | Validate and clone portable projects before committing them |
| js/app-state.js | Project/view/selection state, indexed entity lookup, edit transactions, undo checkpoints and queued gesture drawing |
| js/structural-analysis.js | Cached legacy plan annotations and compatible proposal/report entry points |
| js/structural-proposals.js | Clone/compare/apply framing, sizing, grids and wall proposals |
| js/structural-workspace.js | Discipline tabs, structural forms, layers, schedules and projections |
| js/canvas-drawing.js | 2D canvas renderer, bounds, entity symbols and handles |
| js/pointer-interaction.js | Hit testing, selection, resize, rotation, snapping, placement |
| js/inspector-panel.js | Project/entity properties and advisory panels |
| js/plan-settings.js | Shared units, editable site/front/side labels, climate/Vastu/location fields and destination-floor copying controls |
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
| js/read-only.js | URL viewer policy and validated same-origin shared-layout loading; see PUBLISHING.md |
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
| tests/interaction-profile.html + interaction-profile.js | Live mouse/touch PointerEvent profiling and transform/history invariants |

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
- Structure plan offers Show/Hide interior in the workspace toolbar and an interior layer checkbox in Properties. Interior items are a faded, nonselectable reference below structural members, hidden initially; toggling retains the camera and creates no history or saved-project changes. The architecture layer independently controls rooms/walls.
- Structure toolbar members drag onto the plan with a transient preview, including touch release-to-place; canceled/outside drops create no history. Column/beam rail buttons also arm canvas placement. `js/structural-workspace.js` owns toolbar placement, geometric snapping and transient Layout guides (automatic, plan axes, wall parallel/perpendicular, free); `js/ui-wiring.js` applies them to creation, movement and endpoints. Alt bypasses guides. Column centers, grids and wall centerlines/endpoints are references; only an explicit beam endpoint snap to a column creates a joint. Connected beam body drags move its support columns and update attached beams, rejecting locked supports/connected beams. Endpoint drags can detach or reconnect, in one undo action. Selected columns offer nearest-wall parallel/90° orientation; plan hit testing, SVG and cached 3D respect column rotation. Layout guides opens the Model sheet directly from the rail. No new persisted settings are introduced.
- Architecture offers Square walls 90° for the current floor: `squareWallFloor` in `js/architecture.js` aligns unlocked walls to their nearest plot axis using shared-endpoint coordinate constraints, preserving locked endpoints and rejecting conflicts/collapsed walls. A validated clone updates hosted openings, dimensions and traced rooms before one undo checkpoint. Plot-axis guide is transient UI state; new wall gestures in `js/ui-wiring.js` use `wallGuidePoint` to constrain to width (plan X) or length/depth (plan Y), with a labelled canvas guide and Alt free-drawing override. Compass north does not rotate these plot axes.
- Alignment failures carry offending wall IDs and select/center the original wall without a model/history change; collapsed-wall warnings offer endpoint adjustment or normal deletion. Selected walls also have Parallel to width/length actions, preserving start and length and updating joined neighbors on a validated clone. Plot-axis guide applies to existing wall endpoint drags and rotation as well as drawing; Alt bypasses axis/grid constraints. Locked joined walls block an alignment that would move them.
- The permanent vertical tool rail stays on the left, including in Expand canvas mode. Desktop shows both Library and Properties; narrow layouts show one sheet at a time. Headers and sheets are visible initially.
- 3D exposes Show/Hide structure beside Fit in the canvas upper-right, independently of Structure only. Hide returns a structure-only view to architecture with structural members hidden; visibility changes create no undo history. Fit exits walkthrough and recentres the rendered active-floor/all-floor bounds, allowing enough distance for tall/large stacks.
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
- Floors & 3D stack opens from the workspace `+ Floors` control or command search. `js/ui-wiring.js` owns floor creation, name/elevation edits, deletion and level swaps; `css/canvas-space.css` owns the responsive manager layout. The manager shows highest floor first; Up/Down exchanges adjacent elevations while preserving floor/entity IDs and the active floor. Add uses a selected floor below plus a positive floor-to-floor height, with an editable absolute elevation for basements/split levels. Existing levels stay fixed; new or edited coincident levels are rejected. Delete confirms contents, retains at least one floor and leaves other elevations unchanged. Each mutation is one undo action; manager navigation and the all-floor 3D toggle create no history. No new persisted floor fields are required.
- Project library storage is separate from the existing active-project key.
- Project settings opens from the Project property tab or command search in every workspace, including Structure. `site.frontSide` is an optional plan-edge key (`north`, `west`, `south`, `east`, or empty); compass rotation remains `north`. Canonical perimeter annotations are `site.sides[edge]` with `direction`, `measurement` (cm or null), `status`, `note`, `visible` and `showMeasurement`. Validation migrates root/site `sideLabels`, direct edge text/objects and `label`/numeric `length` aliases on a clone; existing canonical values take precedence. Missing site settings receive defaults. Canvas and SVG share annotation bounds for room, wall-only and empty-site plans. Metadata Apply actions validate first and create one undo entry; drafts create none.
- Select objects, choose Copy to floor, then Copy at same position in Properties. `copySelectionToFloor` in `js/object-operations.js` preserves X/Y, dimensions, rotation and elevation relative to the destination floor; it includes required hosts/supports/anchors, remaps IDs, validates a cloned candidate and applies one undo action while retaining the source floor and selection. Clipboard paste/duplicate retain their existing offset behavior.
- Structure's Copy structure command opens the focus-managed complete-copy dialog in `js/studio-ui.js`. `copyStructureToFloors` in `js/object-operations.js` copies columns, beams, slabs, RC walls, loads, grids and the diaphragm assumption to several existing structurally empty floors and/or up to 20 new levels above the highest elevation. Each destination gets independent IDs and remapped joints/load references at the same X/Y, with member dimensions, heights, rotations and locks preserved. Existing architecture/elevations/roof flags remain; new levels start non-roof. Validate the whole clone before one undo checkpoint; reject occupied, stale, invalid or coincident destinations without partial copying. Copy & view building / Building stack opens all floors in 3D. `state.structureOnly3D` is a transient renderer filter; Show whole building restores architectural geometry without changing the model/history. Review copied sizes, loads, storey heights and roof/diaphragm assumptions for each floor; copying is geometry reuse, not a structural design approval.
- Complete-copy preflight uses `structuralReferenceIssues` (`js/object-operations.js`) to name each member, start/end joint or load assignment, missing ID and reason (missing/deleted column, non-column object or another floor's column). The dialog lists all source problems with Show on plan / Edit connection. `focusStructuralIssue` in `js/structural-workspace.js` selects/centres the original and draws red endpoint/load markers; mobile plan navigation dismisses Properties, while Edit focuses the flagged dropdown. Missing dropdown references remain visible and invalid until explicitly repaired or set Unconnected. Member Apply rejects unresolved references before checkpointing. Diagnostic navigation and previews create no model/history changes; explicit repairs use normal member undo.
- A `?test=1` URL uses an isolated storage prefix.
- `?readonly=1` opens the bundled reference in a viewer; `&layout=path.json` loads a validated same-origin layout. Native controls, custom switches/catalog cards, gestures and shortcuts cannot edit the layout or local saves. A canvas badge identifies the viewer at all screen sizes. `js/read-only.js` defaults new controls to disabled; mark navigation through its explicit allowlist.
- `?tab=3d|architecture|structure|services` chooses the opening workspace (`view=3d` is an alias). Bootstrap applies it after the studio/canvas shell. Entering 3D shows all floors stacked by default, with the active-floor toggle retained. Read-only collapses project/Library/Properties through the canvas-space API and hides editing/history actions, retaining the left viewing rail, workspace tabs and canvas controls; the ordinary editor visibility rules remain unchanged.
- Service items store `system`, `mountSurface`, elevation, diameter and route points where applicable. Route vertices use centimetres relative to the floor; vertical distances contribute to length. Route Properties offers spatial scaling or footprint-only scaling that preserves all vertex elevations; diameter is unchanged in both. Choosing the scale mode is transient UI state, without history or persistence. They describe layout, without automatic hydraulic/electrical sizing or network connectivity.
- `three-side-stairs` is a separate catalog type/shape, preserving existing straight/L/U stair behavior. Width/length are clear room dimensions and height is floor-to-floor rise. Optional `stairStartSide` (short/long), `stairHandedness` (left/right), `stairTargetRiser`, `stairLandingMin` and `stairWidth` receive defaults on normalization; validation checks their types/ranges. `threeSideStairLayout` derives equal risers/going, three flight counts, two level rectangular corner landings, plan parts and illustrative rails without mutating saved data. It searches 14–18 cm risers, 25–33 cm going, 60–65 cm for 2R+T and 3–12 risers/flight; these are comfort heuristics, not compliance. Inspector changes validate fit before one undo checkpoint; generic resize/scale can produce an infeasible layout, shown as an error while remaining saveable/recoverable. Start-side/mirror/size/rise changes recalculate plan, SVG and cached 3D. Upper-floor landing/opening, headroom, guards and local width review remain required; 3 ft is below the common 1 m dwelling benchmark. `tests/ui-preview.html` has an isolated stair fixture; importable examples and comparison drawing are in `deliverables/stair-11ft6-9ft6/`.
- Three-sided stairs now reserve entrance/exit platforms inside the footprint (`stairPlatformLength`, default at least the clear flight width), reducing available runs and recalculating risers/going. Optional `stairUpperFloorId` links the exit to an existing/new higher floor; imported references are validated, copied floors/objects clear the old link, and floor-manager changes reconcile a feasible rise or disconnect. Connect/add upper floor and Continue to next floor are validated, single-undo actions; viewing arrivals is navigation. Continuation retains the flight direction and uses a full-width, 3-foot-deep upper bridge landing to connect arrival to the next entrance, avoiding opposing-flight headroom collisions. Tread/landing plates and riser faces are illustrative 3D geometry, not solid blocks extending down through the storey. Upper-floor plans/SVGs show a derived arrival platform and opening; renderer room finishes subtract the rotated opening from triangulated room polygons and retain the platform. These are architectural finish openings: explicit structural slab geometry/load proxies remain subject to manual opening design/review. The default 11′6″ × 9′6″ example with 3′ platforms fits 18 risers (7+4+7) at 6⅔″ with 11″ going for a long-side start, or 17 (5+7+5) at about 7.06″ with 10½″ going for a short-side start.

## Update flow

Input → selection/preview → snapshot before mutation → relationship updates → 2D drawing or incremental 3D synchronization → commit → debounced save.

Continuous 2D/3D pointer edits use `armEdit` on pointer-down, then `beginEdit` before the first mutation beyond the movement threshold, followed by `commitEdit` or `cancelInteraction`. Arming does not serialize the project or copy history; clicks and jitter end without snapshots. Keyboard nudges begin immediately before mutation. Selection, jitter and cancellation preserve redo/history; persistence waits for previews to finish. Pointer motion queues drawing and relationship synchronization once per frame, including 3D move previews. Group targets and guide candidates are reused during gestures; entity lookup indexes collection membership. Wall tracing uses intersection bounds and defers traced-room reconstruction during previews. Rotated bounds use analytic half-extents to avoid temporary corner arrays; preserve corner-based geometry for actual resize/rotation anchors.

Resize uses a fixed opposite anchor and records the handle grab offset. Items expose corner and edge controls; manual rooms, columns and slabs use rectangle handles. Shift latches the first dominant movement axis until released; Alt temporarily bypasses item grid/guides, and Space temporarily pans. Unattached unlocked items/groups expose plan X/Y and primary-object X/Y movement directions plus signed numeric distance in Properties. Direction and unsubmitted distance are transient UI state; new selections reset the direction. Constrained drags show a direction/distance guide, snap the projected distance and skip competing smart guides. Move on canvas dismisses touch sheets. Pinch paints are frame-coalesced, including the final release state. Small touch objects keep their center as a move target. Beam endpoint dragging detaches that endpoint or explicitly reconnects to a snapped column; Structure beam body movement translates its unlocked support columns and follows all connected ends. Dimension body movement edits anchor offsets; endpoint dragging detaches that anchor. Locks and derived-room restrictions apply to shared transform commands. Services has a vertex editing mode with vertex/segment dragging and insertion/removal. Route drafts have a rubber-band preview and local undo/redo, committing once on Finish. 3D exposes Orbit, Move, Rotate and uniform Scale modes for mouse/touch; rotation and scaling apply to unattached items, and all-floor manipulation remains disabled.

Rendering reads model relationships and structural annotations without changing saved geometry. `updateModelRelationships` is the explicit dependency phase before UI/save snapshots and edit commits; preview updates defer room-face reconstruction. Structural drawing reads cached `structuralAnnotation` values. Hosted openings move along their current wall and resize only in width, within its endpoints. Properties offers center distance and explicit attach/detach; persisted `freePlacement` prevents detached openings from automatically reattaching. Item multi-selection supports rotated-bounds alignment, equal-gap distribution and order-preserving stacking. Select multiple and Next overlapping element provide touch access without changing the project.

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

Latest recorded result: 46 browser groups, 61 interaction checks at 1440/820/390 px and 9 application regression groups; the last engineering run passed 17 groups. `tests/change-tracking.cjs` covers no-op history/persistence; `tests/interaction-profile.html` provides isolated mouse/touch fixtures and repeatable event/paint/dependency measurements, click serialization counts and encoded undo payloads. See `CANVAS_INTERACTION_IMPLEMENTATION.md` for research, critique, measured limits and the remaining audit backlog. Counts are a baseline, not a substitute for rerunning checks after changes. Save relevant screenshots in `validation/`, update `validation/RESULTS.md`, and run `git diff --check` before committing. Documentation-only edits do not require a new browser run.
