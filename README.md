# Atelier Plan

Atelier Plan is an offline browser application for residential concept planning. It combines a 2D editor, a locally vendored Three.js renderer, a 117-item catalog, plumbing and electrical layouts, walkthroughs, solar studies, and preliminary structural estimates. No build step or external service is required.

## Run

Open `index.html` directly, or run `node server.cjs` from this directory and visit http://127.0.0.1:4173. The server binds only to the local computer.

## Editing

Select and drag objects; use corner handles to resize and the round handle to rotate. Shift/Ctrl/Cmd-click adds furniture to a group. The inspector accepts feet/inches (including `6″` and `5′ 4″`), decimal units, and negative coordinates. Invalid measurements are rejected.

Wall endpoints that already meet stay joined when edited. Doors and windows keep a host-wall relationship and follow wall moves and rotations. Openings wider than a wall do not attach to it. Dimensions placed within 30 cm of an entity corner retain a reference and follow geometry edits.

In **Properties → Plan tools & drawing export**, choose **Trace closed rooms from walls** to create polygonal floors from closed wall faces. Generated room boundaries follow their walls; edit those walls to reshape the room. Existing free-standing room rectangles remain editable. Room areas are measured to wall centerlines.

Undo/redo supports geometry and project settings. A continuous slider gesture uses one undo action. Escape or a canceled pointer gesture restores the previous plan.

Shortcuts: V select, R room, W wall, T roof, D dimension, H pan, P column, B beam. Ctrl/Cmd+C copies, V pastes, D duplicates, Z undoes, Shift+Z redoes. Delete removes the selected entity. Arrow keys nudge.

## Plumbing and electrical layouts

The Plumbing category includes cold/hot water, waste, soil/vent and roof rainwater pipes, taps, isolation valves, floor/roof drains, cleanouts and a drain sink. Electrical includes conduit, wiring runs, power sockets, switch points, junction boxes, ceiling light points and data points.

Add a pipe or wiring run, then choose **Draw route on plan** in its inspector. Click route corners, change the drawing elevation for wall risers, then choose Finish or press Enter. Escape or Cancel discards the draft. A dotted preview shows the vertices as you draw. Installation surface presets set the base elevation for floor, wall or roof; adjust Elevation to match your building.

The vertex editor accepts one `X, Y, elevation` row per point, explicitly in centimetres relative to the active floor. It supports bends, vertical runs and sloping drains. Diameter uses the active measurement unit; route length includes vertical distances. Routes can be moved, resized, rotated, duplicated, undone and saved in JSON. They appear as colored paths in plan/SVG/PDF and tubes in 3D. Connection fixtures have editable elevations and orientation. Circuit/line labels identify runs and points.

These objects document layout geometry. They do not calculate hydraulic flow, cable capacity, electrical protection or automatic network connectivity.

## Projects and recovery

**Projects** lists named browser-local projects, recent saves, duplication, blank-project creation, and five prior recovery snapshots per project. Archive/restore is reversible. On smaller screens, Projects and the searchable **Objects** list are in **More options**.

Autosave retains the existing `atelier-plan-project` storage key. JSON import validates the entire project before replacing the working plan. Imports are limited to 20 MB, 100 floors, and 20,000 entities. Unknown future versions, malformed arrays, invalid geometry, and duplicate identifiers are rejected.

Browser storage has a quota and remains local to the browser and origin. Export JSON for portable backups. The project library and recovery history also use browser storage.

## Floors and 3D

Add a floor from Levels or the + floor button. Enter its elevation and optionally copy the current floor. Copies get independent IDs and retain internal wall/opening/dimension references.

The 3D floor display control switches between the active floor and a stacked view of all floors at their elevations. Walkthrough eye height follows the active floor. Shift-drag editing is available in the active-floor view.

The renderer reuses unchanged scene groups. Moving furniture updates its transform; camera and selection changes do not recreate furniture geometry. Structural analysis is cached until its inputs change. Previously saved projects with intentionally cleared framing remain clear after reopening.

## Drawing export

Choose a scale of 1:50, 1:100, or 1:200, then export SVG or PDF. Drawings include room labels/areas, furniture footprints, structural members, dimensions, a north arrow, and a title block. SVG is vector artwork. PDF embeds a high-resolution rendered drawing with a physical page size that preserves the selected scale. Print at **100% / actual size**, using paper large enough for the drawing.

Print drawing also uses the browser's native print workflow. Exports are concept drawings rather than construction documents.

## Structural estimates

The column check reports uncapped utilization and marks modeled overload as a failure. Material grades are read from their fields. Longitudinal steel area uses the first bar count/diameter in the reinforcement text; unrecognized text uses a disclosed 1.5% assumption.

The model uses assumed residential slab, finish, live, and approximate wall loads. It does not solve building-frame moments, cumulative floor loads, wind/seismic actions, or foundation design. Assumptions are visible in the inspector and report. Results describe modeled checks, not structural certification.

## Accessibility

The searchable Objects list supports keyboard selection of rooms, walls, furniture, columns, beams, and dimensions. Inspector labels are associated with fields. Catalog cards and switches are keyboard operable. Dialogs manage focus, trap Tab, close with Escape, and return focus to their opener. Save/toast status is announced.

## Validate

Run `node tests/regression.cjs` for model and geometry checks plus script parsing.

With the server running, open `tests/browser.html` and select **Run browser checks**. It exercises the actual app in an iframe with separate test storage, including imports, undo, measurements, cancellation, hosted openings, rooms, floor copying, recovery, PDF/SVG output, keyboard access, and incremental 3D updates.

`tests/responsive.html` provides 1440 × 900 desktop, 820 × 900 tablet, and 390 × 844 mobile previews.

See [INDEX.md](INDEX.md) for the module map and [PROJECT_SPEC.md](PROJECT_SPEC.md) for the current design boundaries. Three.js is covered by [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt).
