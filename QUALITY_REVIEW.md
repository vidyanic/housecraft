# Atelier Plan — three-loop critic review

Review scope: readiness as a browser-based residential schematic planning and furniture-layout tool. This is not a rating for construction documents, BIM coordination, structural design, code compliance, or permit submission.

## Evaluation model

The 100-point rubric weights the tasks that most affect successful house-layout work:

| Area | Weight | Baseline | Loop 1 | Loop 2 | Loop 3 |
|---|---:|---:|---:|---:|---:|
| 3D clarity and rendering stability | 20 | 5 | 17 | 18 | 18 |
| Architectural essentials | 20 | 10 | 11 | 17 | 19 |
| Editing speed and precision | 15 | 9 | 9 | 13 | 14 |
| Discoverability and navigation | 15 | 7 | 12 | 13 | 14 |
| Dimensional accuracy and units | 10 | 8 | 8 | 9 | 9 |
| Persistence and interchange | 10 | 9 | 9 | 9 | 9 |
| Visual hierarchy | 10 | 4 | 6 | 7 | 8 |
| **Total** | **100** | **52** | **72** | **86** | **91** |

## Loop 1 — rendering legibility and stability

### Criticism

- All 3D faces were globally sorted by their average depth.
- Large ground and wall polygons competed with small furniture faces, so orbiting could reorder objects abruptly.
- Every object was rendered as a generic box, making the model difficult to understand.
- Tall foreground walls obscured the layout.
- A horizontal category strip overflowed the narrow library panel.

### Changes

- Separated ground, floor, wall, and object rendering into deterministic passes.
- Added stable per-object sorting with consistent tie-breaking.
- Kept furniture in a dedicated foreground pass to prevent unexplained disappearance.
- Added composite geometry for sofas, chairs, beds, tables, lamps, plants, stairs, windows, and doors.
- Added a smart dollhouse cutaway mode and constrained unsafe camera extremes.
- Replaced overflowing category chips with a contained category selector.

## Loop 2 — architectural correctness and editing flow

### Criticism

- Doors and windows sat on top of solid wall geometry.
- Camera recovery required manually manipulating sliders.
- Common editing actions took too many property-panel changes.

### Changes

- Walls are segmented around aligned doors and windows, producing real 3D openings.
- Added Dollhouse, Top, and Front camera presets.
- Added Smart cutaway, Full height, and Hidden wall-display modes.
- Added duplicate, 90-degree rotation, and 20 cm nudge actions.
- Added opening dimensions, sill/elevation, door swing, material, and wall-height controls.

## Loop 3 — schematic-design readiness

### Criticism

- The editor did not surface missing minimum plan elements.
- Keyboard precision was limited.
- Wall-snapped openings did not inherit wall depth.
- Imported older projects could retain unsafe camera settings.

### Changes

- Added a live Plan Readiness panel for rooms, walls, entry doors, windows, and dimensions.
- Added arrow-key precision movement, with Shift for larger moves.
- Wall-snapped doors and windows now match the host wall thickness.
- Added project migration for stable camera limits, wall modes, object heights, elevations, materials, and room heights.
- Kept local autosave and versioned JSON interchange intact.

## Industry conventions used

- Sweet Home 3D treats the plan and 3D view as synchronized representations, organizes furniture by category, supports aerial and virtual-visit viewpoints, and snaps doors/windows to walls: https://www.sweethome3d.com/users-guide/
- Floorplanner emphasizes accurate room drawing, movable walls, doors/windows, real-time 3D feedback, multiple floors, and a categorized object library: https://floorplanner.com/
- SketchUp exposes explicit orbit controls and model-centering behavior, which informed the camera presets and recovery controls: https://help.sketchup.com/en/sketchup/viewing-model

## Remaining limitations

- The 3D view is a procedural WebGL/PBR preview rather than an authored production asset pipeline.

## Loop 4 — placement, circulation, and regional guidance

- Updated critic score: **94/100** for schematic residential planning usability.
- Added deterministic room-envelope placement repair for saved/imported objects, including rotated furniture footprints and tree/stair collision recovery.
- Reworked stairs as open-tread L/U/straight assemblies with rails/stringers and optional under-stair storage; the former solid wedge no longer fills the void.
- Added a Delhi hot semi-arid climate preset and explicit Vastu advisory panel for courtyard cooling, cross-ventilation, west shading, cool roof, and recommended orientation zones.
- This score remains for concept design; it is not a permit, structural, accessibility, or Vastu certification.
- Latest stair-specific pass: **96/100** after aligning 2D/3D ascent direction and removing the upper support-block artifact.
- Rooms are rectangular objects; there is no polygonal room-topology solver.
- Wall joins are visually overlapped rather than mitered.
- There is no structural, MEP, accessibility, fire-egress, or building-code validation.
- JSON is the only interchange format; DXF, IFC, SVG/PDF, and print-scale output are not implemented.
- No collaborative editing, cloud library, photorealistic materials, or walkthrough navigation.

The 91/100 result therefore means “strong browser schematic planner prototype,” not “permit-ready architectural CAD.”
