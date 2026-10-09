# Atelier Plan

Atelier Plan is an offline browser application for residential concept planning. It combines a 2D editor, a locally vendored Three.js renderer, a 117-item catalog, plumbing and electrical layouts, walkthroughs, solar studies, and preliminary structural estimates. No build step or external service is required.

## Run

Open `index.html` directly, or run `node server.cjs` from this directory and visit http://127.0.0.1:4173. The server binds only to the local computer.

## Editing

The studio has persistent Architecture, Structure, Services and 3D workspaces, a contextual tool row, direct floor switching, searchable Library/Objects panels and focused property sheets. Export opens the drawing/project export sheet. Use Ctrl/Cmd K for commands, Alt 1–4 for workspaces and Ctrl/Cmd S to save. Desktop docks adapt to a single side panel on tablets and full-width sheets on phones. See [UI_REDESIGN.md](UI_REDESIGN.md) for the critique and interaction decisions.

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

## Structural planning

**Architecture, Structure, Services and 3D** share one building model. Structure provides a separate drawing workspace with its own camera, faded architecture, grid axes, explicit rectangular/polygonal slab panels, RC wall objects, point loads, member schedules, adjacent-floor overlays, and X/Y elevation projections. Click a member or schedule row to edit its cm coordinates, sections, reinforcement, support condition and column connections. Beam endpoints follow column IDs. A cantilever has one connected column and a free endpoint. Floor copies remap member, panel and load IDs.

The default basis is **Lucknow, India, Zone III**. Soil class II and 150 kPa bearing capacity are **provisional editable inputs**, not site-test results. References are IS 456:2000, IS 875 Part 1:2026 / Part 2:1987, IS 1893 Part 1:2016 and IS 13920:2016. Reference editions and outstanding amendment/table verification are recorded in every report. RCC density 25 kN/m³, masonry density 19 kN/m³, residential live load 2 kN/m² and finish load 1 kN/m² are editable assumptions; they do not constitute a complete occupancy/material load library.

**Calculate screening** conserves slab tributary areas by clipping nearest-support regions to panel boundaries, accumulates gravity loads down aligned columns by elevation, sums all longitudinal bar groups, and checks basic axial capacity, steel ratio, bearing pressure and span/effective depth. Explicit panels replace architectural room proxies. These checks use a preliminary direct-to-column load distribution.

**Run modal / CQC** adds a linear elastic 3D Euler–Bernoulli frame calculation with explicit supports, optional rigid floor constraints, cracked stiffness factors, massless-DOF condensation, eigenmodes, X/Y participation, BIS 5% spectra, CQC response, base-shear scaling, drift and seismic member-force envelopes. Column/wall mass is apportioned to bounding floor levels; the roof flag excludes seismic live load, and panel live-load participation respects the 25/50% thresholds. A separate 97-case static screening envelope includes gravity factors, directional signs, 100/30 variants and ±5% plan eccentricity. Static results are labelled screening because Lucknow falls outside the 2016 equivalent-static eligibility.

**Propose fixes** creates a clone and displays changed geometry and failed-check counts before Apply. Generated framing adds members without replacing manual framing. Section proposals preserve IDs, reinforcement, column centres and locks and only increase sizes. Grid changes use explicit axes and connected end IDs. Apply rejects stale proposals and new failed checks and produces one undo action. Automatic column deletion is disabled because the available checks cannot establish a safe alternate load path.

Calculation JSON exports the input basis, node/member model, numerical results, named checks, issues and required reviews. The solver is limited to 80 nodes and 96 mass DOFs. Unstable/disconnected models stop calculation. RC wall shell stiffness, actual slab-to-beam distribution, full bending/shear reinforcement design, biaxial/slender-column design, confinement/joint detailing, amplified static eccentricity, vertical earthquake, P-delta, wind and complete foundation design remain **uncomputed**, and reports say so. Plan projections are drawings rather than cut-section or shell analyses. Application benchmarks are not independent structural validation or construction approval.

## Accessibility

The searchable Objects list supports keyboard selection of rooms, walls, furniture, columns, beams, and dimensions. Inspector labels are associated with fields. Catalog cards and switches are keyboard operable. Dialogs manage focus, trap Tab, close with Escape, and return focus to their opener. Save/toast status is announced.

## Validate

Run `node tests/regression.cjs` for model and geometry checks plus script parsing.
Run `node tests/engineering.cjs` for tributary/load conservation, frame elasticity, eigenmodes, rigid diaphragms, mass participation, spectra, combinations and proposal benchmarks.

With the server running, open `tests/browser.html` and select **Run browser checks**. It exercises the actual app in an iframe with separate test storage, including imports, undo, measurements, cancellation, hosted openings, rooms, floor copying, recovery, PDF/SVG output, keyboard access, and incremental 3D updates.

`tests/responsive.html` provides 1440 × 900 desktop, 820 × 900 tablet, and 390 × 844 mobile previews.
`tests/structural-demo.html` provides an isolated two-storey Lucknow frame with structural plan, elevation, 3D and modal previews at those sizes.

See [INDEX.md](INDEX.md) for the module map and [PROJECT_SPEC.md](PROJECT_SPEC.md) for the current design boundaries. Three.js is covered by [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt).
