# Atelier Plan — current project specification

## Intent

An offline browser workspace for early residential concept planning: editable 2D plans, procedural 3D previews, furniture/openings, solar studies, and preliminary structural estimates. The reference project is a 65 × 35 ft courtyard house.

## Runtime

Plain HTML/CSS/JavaScript, a shared Atelier namespace, and locally vendored Three.js/OrbitControls. Open index.html or use node server.cjs at http://127.0.0.1:4173. No network assets, account, build service, or backend database is required.

## Model

All lengths are centimetres internally. Units display as cm, m, inches, or signed feet/inches. A project contains multiple floors with independent IDs, names, elevations, rooms, walls, items, dimensions, columns, and beams.

JSON validation precedes normalization and replacement. Entity rectangles require finite coordinates and positive sizes; settings, IDs, collections, and polygons are checked. Missing legacy collections are supplied. Unsupported future versions and malformed projects leave the current project intact.

## Architectural editing

Wall endpoints that coincide within the connection tolerance stay joined during edits. Openings retain wall IDs and offsets. Dimensions near corners/endpoints store references and offsets. Closed wall faces can be traced into polygonal rooms; intersections split the tracing graph. Traced rooms update from their boundaries, and their area uses the polygon rather than the bounding rectangle.

Room tracing currently supports up to 1,000 walls. Rooms use wall-centerline polygons. This is a schematic editing system rather than a BIM topology engine: curved walls, robust nested courtyards/holes, automatic wall-layer junction detailing, and construction-ready opening schedules are outside its current scope.

Undo is captured before edits. Slider gestures group history. Pointer cancellation and Escape roll back active 2D edits. Inspector inputs reject invalid/negative sizes while permitting signed positions and elevations.

## Persistence

The active project retains the atelier-plan-project localStorage key. Named projects, duplicate projects, reversible archives, and five prior recovery snapshots are stored in a separate library key. JSON remains the portable backup format. Browser quota failures show a storage warning and direct the user to JSON export.

Tests use a separate prefix under ?test=1. They must not replace working project data.

## Rendering and floors

3D rendering caches records by floor and entity. Unchanged geometry is reused. Item transforms update independently; camera and selection updates reuse geometry. Removed records dispose owned resources while shared cached materials remain available.

Active-floor and stacked-floor views apply each floor's elevation. Copied floors receive independent IDs and remapped relationships. Walkthrough eye height includes the active floor elevation. Stacked view supports orbit/selection; shift-drag edits require active-floor mode.

2D structural analysis is cached by relevant inputs. Stored projects with cleared structural framing remain clear when reopened.

## Solar and orientation

Solar controls use hour/week, latitude, longitude, and time-zone offset. Zero-valued coordinates and UTC are valid. Architectural azimuth is measured clockwise from north; north orientation also rotates solar direction in 3D. This is a visual solar study rather than an annual energy/daylight simulation.

## Structural estimates

The model estimates single-floor gravity loads with a 150 mm slab, 1 kN/m² finish load, 2 kN/m² live load, approximate wall load, and 1.5 load factor. Column steel uses the first bar-count/T-diameter pattern, falling back to a disclosed 1.5% area. Material grades are parsed from their fields. Circular columns use circular section area and corresponding 3D geometry.

Utilization can exceed 100% and overload produces a failed modeled check. Reports distinguish these planning estimates from verified structural design. Cumulative multi-floor loading, bending/frame analysis, wind/seismic actions, and foundation design are not solved.

## Deliverables

Portable JSON; vector SVG drawings; rendered PDF drawings with physical page dimensions; browser printing. Scales: 1:50, 1:100, 1:200. Drawings contain room labels/areas, footprints, structural members, dimension annotations, north arrow, and project/floor title block. Print at actual size on sufficiently large paper.

Furniture is exported as labeled footprints rather than the entire detailed canvas-symbol catalog. PDF uses a high-resolution raster drawing; SVG remains vector.

## Accessibility and layout

Desktop panels, tablet controls, and mobile Canvas/Library/Properties/Levels/Help navigation. Projects and entity search are also accessible through More options. Inspector inputs have associated labels. Catalog objects/switches support keyboard activation. Dialogs trap focus, support Escape, and restore focus. Status announcements use live regions.

## Validation

Run node tests/regression.cjs, then run tests/browser.html in a browser. Validate the responsive preview at desktop/tablet/mobile sizes. Browser checks cover measurement parsing/editing, invalid imports, undo/redo grouping, cancellation, wall and dimension relationships, room geometry, copied floors, recovery, SVG/PDF structure, keyboard selection/dialogs, 3D cache reuse, and stacked floors.
