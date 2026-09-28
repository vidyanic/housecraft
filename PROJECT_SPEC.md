# Atelier Plan — Project Specification

## 1. Product intent

Atelier Plan is an offline-friendly browser application for early-stage architectural and residential layout design. It combines a 2D floor plan, a synchronized interactive 3D/PBR preview, a categorized object library, editable dimensions/materials, solar studies, and JSON persistence.

The uploaded reference images established the visual direction: a dimensioned courtyard house plan above an isometric interior/3D view, with bedrooms, wet rooms, living/dining, kitchen, plants, garage/car, doors, windows, and circulation elements.

This is a schematic concept-design tool. It is not a BIM authoring system, structural calculator, permit drawing generator, accessibility certification tool, or production Blender/Unreal asset pipeline.

## 2. Files and runtime

- `index.html` — complete application shell, catalog, 2D canvas plan editor, state model, inspector, persistence, and UI.
- `renderer3d.js` — local Three.js WebGL renderer with procedural architectural/furniture geometry, PBR materials, shadows, camera controls, openings, and sun controls.
- `vendor/three.min.js` — vendored Three.js runtime.
- `vendor/OrbitControls.js` — vendored orbit controls.
- `vendor/THREE-LICENSE.txt` — bundled Three.js license notice.
- `README.md` — user-facing run instructions and feature overview.
- `QUALITY_REVIEW.md` — usability/readiness critic loops.
- `REALISM_REVIEW.md` — rendering critic loops and production-rendering boundary.
- `OBJECT_USABILITY_REVIEW.md` — object editing and layout critic loops.
- `DIMENSION_AND_LAYOUT_REVIEW.md` — measurement audit and layout critic loops.

Run locally with:

```bash
python3 -m http.server 4173 --directory outputs/atelier-plan
```

Then open `http://localhost:4173`.

## 3. Default project

- Name: `65 × 35 ft Courtyard House`.
- Default unit: feet + inches (`unit: 'ft'`).
- Internal storage unit: centimetres; UI converts values at display/edit time.
- Footprint: 65 ft × 35 ft (1981.2 cm × 1066.8 cm).
- North edge: open, 65 ft.
- West edge: open, 35 ft.
- South edge: closed.
- East edge: closed.
- North orientation: 0° by default.
- Snap: enabled; imperial snap interval is 4 in; major grid is 2 ft.
- New wall defaults: 4 in thickness × 10 ft height; values are stored internally in centimetres.
- Exterior wall target: about 6 in (15 cm).
- Interior planning wall target: about 4 in (10 cm).
- Ground floor elevation: 0.
- Default camera: dollhouse/cutaway, orbit -38°, pitch 34°.
- Sun and shadows use a solar-position model driven by local time (1-hour slider) and week of year (1-week slider), with editable latitude/longitude/time zone. Default location is Lucknow (26.8467° N, 80.9462° E, UTC+5:30); azimuth, altitude, and daylight intensity are calculated automatically.

The reference-inspired plan contains three bedrooms, two compact wet rooms, a planted central courtyard, living room, kitchen/dining, garage, garden court, car, wall openings, and an L-shaped stair.

Sun controls use architectural azimuth measured clockwise from plan north: 0° north, 90° east, 180° south, and 270° west. The 3D renderer maps plan north to its negative-Z direction so shadows agree with the 2D compass. Altitude is elevation above the horizon; it is independent of cardinal direction. The default/new-project solar study is set near south (180°) for a northern-hemisphere noon-oriented starting point.

## 4. Default spatial intent

The plan uses a compact courtyard-house arrangement with north/west access, a central planted court for daylight and passive cooling, enclosed south/east edges, shaded west-facing exposure, and a service/garage edge. The layout is intentionally adjustable and should be reviewed against actual setbacks, structure, drainage, services, fire egress, and local authority requirements before construction use.

The Vastu metadata is advisory rather than a claim of strict compliance:

- Entry: north/west.
- Primary retreat: south-west target zone.
- Kitchen: south-east target zone.
- Courtyard: centre/Brahmasthan target zone.
- Wet rooms: west/north-west target zone.
- Stairs: south/west target zone.

The Project inspector exposes these recommendations and a climate selector so the designer can intentionally adapt the concept rather than treating Vastu as an automatic code rule.

## 5. Climate preset

The default preset is `Delhi hot semi-arid` (Delhi is treated here as a hot, seasonally dry climate rather than a humid-tropical classification). The guidance surfaces:

- Planted courtyard for daylight, stack effect, and passive cooling.
- Cross-ventilation as a planning objective.
- Reduced/unprotected west glazing and deeper west shading.
- Cool/reflective roof guidance.
- Thermal-mass finishes and planted courts.

Other selectable presets are `Tropical humid` and `Temperate`. These change the advisory metadata; they do not pretend to be a full energy model.

## 6. Object library and editing contract

The catalog contains 50+ architectural, furniture, service, garden, electrical, lighting, and decor objects across doors/windows, living, bedroom, kitchen, bathroom, appliances, electrical & lighting, garage, outdoor, and decor categories. Openings include a temple double door with paired leaves, jali-style openings, carved-style accents, and a finial. Electrical & lighting objects include a wall switch board, electrical distribution panel, roof/ceiling fan, and LED ceiling panel.

Every placed object supports, where applicable. The library also includes a Roof slab object; the dedicated Roof drawing tool creates a rectangular slab from a click-drag footprint at the current floor's ceiling level.

- Position X/Y.
- Width/depth (length for non-room objects).
- All visible lengths and areas follow the active unit: cm/cm², m/m², ft/ft², or in/in². Room areas, object footprint areas, catalog dimensions, site annotations, elevations, and nudge labels are converted from the internal centimetre model.
- When feet are selected, editable length fields use feet–inches notation such as `5′ 4″`; the parser also accepts ASCII forms such as `5' 4"` and decimal feet for interoperability.
- Height/elevation or sill height.
- Rotation.
- Material and surface colour.
- Rooms expose Wood, Tile, Stone, Concrete, and Carpet finishes plus floor
  colour and opacity; changing these values triggers an immediate 3D floor
  rebuild. Room textures are cloned per room so texture scale/repeat cannot
  leak between rooms. The 3D floor applies a restrained tint lift so the
  selected colour remains legible under the procedural finish texture and
  tone-mapped lighting.
- Transparency (especially glass; default glass transparency is non-zero).
- Uniform percentage scale and aspect-ratio lock.
- Clearance zone.
- Duplicate, rotate 90°, wall alignment, keyboard nudge, and delete.
- Undo and Redo are available in the top bar.
- Powered/active state for TVs, cooktops, lamps, and appliances.

Doors additionally support swing angle, closed/semi-open/open presets, hinge side, reverse swing direction, and sliding/garage open amount. Windows support sill/elevation and transparency. Materials include wood, fabric, leather, stone, metal, glass, mirror, ceramic, natural, plastic, and concrete.

Wall switch boards and distribution panels are wall-mounted catalog objects. When dropped near a wall they align to the nearest wall face, retain editable X/Y, width/depth, elevation, and rotation, and expose switch/breaker counts. Roof fans and LED ceiling panels use ceiling-level elevation defaults, remain selectable in Plan and 3D View, and expose blade count, powered state, and LED output (lumens) where applicable. Active LED panels contribute a local soft point light in the WebGL view; inactive fixtures remain visible without emitting light.

Television bodies preserve the selected material/finish on the bezel and cabinet while keeping the display as a separate glass screen surface.

The Wall mirror object uses a low-roughness metallic PBR surface and exposes a daylight-reflection toggle, reflected-light strength, beam spread, and surface roughness controls. Its WebGL representation adds a controlled reflected-sun light aligned to the live solar position; disabling the toggle removes that contribution while preserving the mirror surface.

## 7. Stairs

The catalog supports straight, L-shaped, and U-shaped stairs. Legacy `spiral-stairs` objects migrate to L-shaped stairs when an older project is opened.

Stair parameters:

- Overall width/depth.
- Floor-to-floor height.
- Clear flight width.
- Landing width and landing length.
- Independent lower-flight and upper-flight riser counts (1–35 each; total is calculated).
- Under-stair storage toggle.

3D stairs use open tread slabs, landings, thin guard rails, and posts. Lower treads terminate at the middle platform edge; they do not continue underneath it. Continuous support blocks/stringers are intentionally omitted from the visible stair mass so the upper section cannot project as a hanging block. Under-stair storage is an optional separate cabinet volume and does not fill the entire stair void.

Clockwise L-stair convention: the lower flight ascends from the plan bottom/south toward the top/north landing, then turns right/east. The 3D tread heights, landing, rails, and the 2D symbol all use this same sequence.

## 8. 2D/3D behavior

The Plan and 3D View tabs share the same project data. The 2D canvas renders rooms, walls, roofs, dimensions, openings, furniture symbols, grid, compass, site-edge annotations, and selection handles. The 2D Drawing settings include a Roof overlay control for hiding the roof while editing the interior. The 3D renderer builds floors, segmented wall openings, opaque shadow-casting roof slabs, procedural furniture, plants, appliances, cars, doors, windows, and stairs.

Object orientation contract: both views use the same local basis and positive plan-angle convention. The 2D canvas rotates toward plan +Y; WebGL maps plan +Y to world +Z and applies the mathematically equivalent inverse Y-axis sign. L/U stair handedness and door swings therefore remain clockwise-identical between Plan and 3D View.

### Selection and transform contract

- Select mode supports single selection, Shift/Cmd/Ctrl-click additive selection, and empty-canvas marquee selection.
- Rooms remain draggable in normal Select mode. Because rooms occupy the visible floor surface, Alt/Option-drag (or Shift/Cmd/Ctrl-drag) over a room explicitly starts a marquee selection instead of moving the room.
- A group selection is shown with a dashed aggregate bounding box and a round rotation handle.
- Dragging any selected object moves the entire group while preserving each object's relative position, rotation, size, material, and elevation.
- Dragging the round group handle rotates the group around the aggregate bounds centre. Rotation follows the same plan-angle convention as individual objects and respects the active 15° snap increment.
- Arrow keys nudge the group; Shift increases the nudge step. Delete removes all selected objects. Escape clears the selection.
- Group transforms checkpoint the project so undo/redo restores the complete prior arrangement. The selection is transient and is not stored in exported project data.
- The browser-style shortcuts Cmd/Ctrl+C, Cmd/Ctrl+V, and Cmd/Ctrl+D copy, paste, and duplicate the selected object or group using an in-session project clipboard. Paste offsets copies by one snap step (or 20 cm when snapping is off).
- Single-object corner handles resize from the opposite corner, preserving the opposite anchor; Shift or the aspect-lock toggle preserves proportions. The round handle rotates the object with the active snap increment.

3D camera presets are Dollhouse, Top, and Front. Wall display modes are Cutaway, Full height, and Hidden. Roof display can be Show roof or Hide roof · interior; the Top preset hides the roof for inspection while Dollhouse and Front show it. Hiding the roof changes only its visual pass: an invisible shadow-casting roof occluder remains in the WebGL scene, so direct sunlight and shadows still behave as if the roof exists. Orbit, viewing angle, and zoom are editable. Sun time-of-day and week-of-year sliders recalculate azimuth, solar altitude, and intensity live; mirror reflections follow the same solar position.

## 9. Placement safety

On first normalization of a legacy/default/imported file, a one-time repair pass:

1. Keeps freestanding objects within their containing room envelope.
2. Accounts for rotated furniture footprints.
3. Leaves a small furniture inset from room edges.
4. Exempts doors/windows so wall alignment is preserved.
5. Detects tree/stair collisions and relocates a tree into a planted courtyard/garden room.

The selected-object Layout check still reports overlap, clearance conflicts, and whether the object is inside a room. This is design assistance, not collision-resolving physics.

After that migration the project is marked `layoutValidated`. Subsequent
refreshes do not relocate user-authored objects; this preserves copied and
manually positioned items such as a Kitchen run.

## 10. Persistence and interchange

- Autosave to browser `localStorage`.
- The debounced autosave is synchronously flushed on page unload, so a quick
  refresh after dragging or duplicating an object keeps its latest position.
- Explicit Save action.
- Export project as formatted JSON.
- Import JSON with version normalization.
- Existing saved projects are preserved; the `Load 65 × 35 ft sample` action deliberately replaces the current project after confirmation.
- Default layout source: `default-layout.js`, generated from the supplied `65-35-ft-courtyard-house.json` reference. The garage bay uses a dedicated open U stair (`garage-u-stairs`) with a centred vehicle aisle, 10 ft stair height, 42 in clear stair width, and intentional vehicle-under-stair overlap.

Important project fields include `version`, `name`, `unit`, `north`, `site`, `climate`, `vastu`, `camera`, `sun`, and `floors`. Each floor contains `rooms`, `walls`, `items`, and `dimensions`.

## 11. Critic-loop history

- Baseline layout/readiness: 56/100.
- Exact footprint, open/closed edges, wall thickness, standard modules: 79/100.
- Collision checks, feet/inches default, 4 in snap, dimension audit: 91/100.
- Placement repair, rotated insets, tree/stair recovery, open-tread stairs, under-stair storage, climate/Vastu guidance: 94/100.
- Orientation correction pass: WebGL object rotation and door swing signs now account for the plan-to-world handedness, removing mirrored stairs/doors between Plan and 3D View.

Rendering critic history progressed from a flat canvas prototype to a local WebGL/PBR preview with procedural materials, environment lighting, ACES tone mapping, soft shadows, camera presets, segmented openings, and stable object passes. It remains below authored production Blender/Unreal quality because it lacks artist-authored high-poly meshes, UVs, calibrated texture sets, HDRI/global illumination, reflection probes, and a glTF/GLB asset pipeline.

## 12. Professional limitations and next steps

Before using the output for real construction, add or verify:

- Local setbacks, FAR/coverage, site survey, and authority rules.
- Structural grid, column/beam sizing, wall assemblies, and foundation assumptions.
- Fire egress, stair/guard details, accessibility, and door clearances.
- Plumbing stacks, electrical/HVAC coordination, rainwater drainage, and waterproofing.
- Window performance, solar heat-gain calculations, daylight, energy, and ventilation analysis.
- Professionally authored GLB assets and a production rendering/asset pipeline.
- Vastu decisions with the client/design team; this application labels them as advisory cultural planning guidance, not law.
