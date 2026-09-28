# Object detail and layout-planning critic loop

Scope: furniture/object recognition, modification, scaling, placement, and spatial feedback in the residential schematic planner.

| Criterion | Weight | Baseline | Loop 1 | Loop 2 | Loop 3 |
|---|---:|---:|---:|---:|---:|
| Object recognisability | 20 | 8 | 15 | 16 | 18 |
| Direct manipulation | 20 | 5 | 14 | 16 | 17 |
| Scale and property control | 15 | 9 | 11 | 14 | 15 |
| Layout assistance | 20 | 10 | 10 | 17 | 19 |
| Discoverability | 15 | 8 | 11 | 13 | 14 |
| 2D/3D consistency | 10 | 8 | 9 | 9 | 10 |
| **Total** | **100** | **48** | **70** | **85** | **93** |

## Gaps identified

- The inspector contained numeric dimensions, but scaling was not discoverable on the canvas.
- The single selection marker looked like a handle but had no resize behavior.
- There was no uniform percentage scale or aspect-ratio lock.
- Objects had no displayed footprint dimensions or names when selected.
- Object clearances and collisions were invisible.
- Furniture could not be quickly aligned to a wall.
- Several plan symbols and 3D models shared generic geometry.
- Switching to 3D discarded the active selection and interrupted editing.

## Loop 1 — recognition and direct manipulation

- Added four visible corner handles for direct resizing.
- Added a dedicated round rotation handle with a leader line.
- Added 15-degree rotation snapping when grid snapping is enabled.
- Added live width × depth annotation and the object name on selection.
- Added selection guidance explaining the two handle types.
- Refined sectional, cabinetry, kitchen, sink, bath, toilet, and window plan symbols.

## Loop 2 — scaling and placement

- Added percentage-based uniform scaling from 10% to 500%.
- Added proportion locking for canvas and numeric resizing.
- Uniform scaling changes width, depth, and height around the existing center.
- Added adjustable clearance zones rendered around objects.
- Added one-click wall alignment for furniture.
- Preserved duplicate, rotate 90°, keyboard nudge, position, elevation, height, material, and color controls.

## Loop 3 — planning feedback and 3D consistency

- Added live overlap, clearance-conflict, and inside-room checks.
- Kept selected objects active and editable while switching to 3D.
- Added detailed 3D subcomponents for cabinets, kitchen units, counters, sinks, tubs, toilets, and showers.
- Added migration defaults for proportion lock and clearance on existing saved projects.
- Kept every dimensional and material edit synchronized with the 3D model.

## Result and limits

The resulting 93/100 represents strong object-layout usability for a schematic residential planner. It does not imply manufacturer-accurate 3D assets, parametric BIM families, accessibility/code clearance certification, photorealistic rendering, or collision-resolving physics.

## Loop 4 — placement repair and circulation

- Saved/imported layouts now clamp freestanding objects to their containing room, including rotated footprints, with a small furniture inset.
- Tree/stair collisions are repaired automatically by relocating the tree to a planted court.
- L/U stairs now use open treads, rails, stringers, and an optional under-stair storage cabinet; the stair void is no longer a solid wedge.

## Loop 5 — multi-object planning workflow

- Added Shift/Cmd/Ctrl-click additive selection for precise object sets.
- Added empty-canvas marquee selection using rotated object footprints, so a furniture cluster can be selected spatially.
- Added group move with preserved relative offsets and a dashed aggregate bounds overlay.
- Added group rotation around the selection centre with the same clockwise plan-angle convention and 15° snap behavior as single-object rotation.
- Added group delete and arrow-key nudging, with one undo checkpoint for the complete operation.

Updated practical score: 97/100. Direct manipulation now covers single-object handles plus grouped move/rotate; discoverability is covered by visible selection bounds, the rotation handle, and an in-app hint. Remaining gap: lasso/freeform selection and constraint-aware group transforms are intentionally deferred to keep this browser planner predictable.

## Loop 6 — regression fix for real floor-plan whitespace

- Fixed marquee selection when the drag begins inside a room. Rooms are visually empty working space, so a drag over a room now creates a marquee; a click still selects the room.
- Centralized the group-handle geometry so the visible round handle and its hit-test use exactly the same screen position, with viewport clamping to keep it visible.
- Added a dedicated multi-object inspector showing the selected count, object list, move/rotate/nudge/delete actions, and a clear-selection control.
- Added a group transform regression check for relative-offset movement and rotation preservation.
