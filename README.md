# Atelier Plan

The 3D workspace now uses a locally vendored WebGL renderer with physically based materials, environment reflections, soft shadows, ACES tone mapping, operable openings, detailed procedural furniture, and orbit/pan/zoom controls. It works without a CDN; Three.js remains under its bundled MIT license in `vendor/THREE-LICENSE.txt`.

The project inspector includes live solar controls for azimuth, altitude, and intensity, plus morning/noon/evening presets. Light direction and shadow length update immediately in the 3D view.

The circulation library now includes parametric straight, L-shaped, and U-shaped stairs. L/U stairs expose overall dimensions, clear flight width, landing depth, floor-to-floor height, and riser count. Legacy spiral-stair objects migrate to an L-shaped stair when an older JSON project is opened.

Fresh projects open with an exact 65 × 35 ft reference-inspired courtyard house using feet and inches. The 65 ft north edge and 35 ft west edge are open frontages; south and east are closed. Three bedrooms, paired wet rooms, a planted court, living room, kitchen/dining, garage, garden, car, operable openings, and an L stair are included. Existing locally saved work is preserved; use **Load 65 × 35 ft sample** in Project settings when you want to replace it deliberately.

The Project inspector now includes a **Climate & Vastu** advisory. The Delhi hot semi-arid preset calls out planted-courtyard cooling, cross-ventilation, west solar shading, and a cool roof. Vastu guidance highlights north/west entry, a south-east kitchen, a south-west retreat, a central court, and west/north-west wet rooms; it is intentionally labeled as design guidance rather than statutory compliance.

Sun direction uses the architectural convention `0° = north`, `90° = east`, `180° = south`, `270° = west`. Solar altitude is the sun’s height above the horizon, not a north/south direction. For a northern-hemisphere noon study, use an azimuth near `180°` (due south), then adjust for time of day and date.

See `DIMENSION_AND_LAYOUT_REVIEW.md` for the complete 49-object measurement audit and three-pass layout critic score.

See `REALISM_REVIEW.md` for the three-pass critic score and the remaining boundary between this procedural browser preview and an authored Blender/Unreal visualization pipeline.

Atelier Plan is a dependency-free, offline-friendly floor-planning web app. It runs entirely in the browser and stores project data locally.

## Run

Open `index.html` directly in a modern browser, or serve the folder locally:

```bash
python3 -m http.server 4173 --directory .
```

Then visit `http://localhost:4173`.

## What's new in this build

- **Richer 3D realism** — procedural textures now carry generated normal maps (wood grain, stone, weave, concrete relief), floor-standing objects get soft contact shadows for better grounding, and the sky, exposure, and light colour shift through a full day/night cycle driven by the solar model (warm golden-hour sun, dim blue nights where lamps and fixtures take over).
- **First-person walk-through** — a Walk-through button in the 3D camera panel drops you inside the home at eye height. Drag to look, W/A/S/D or arrow keys to move, Shift to run, Esc to exit.
- **~25 new objects** — curtains, roller blinds, accent armchair, ottoman, console table, bookshelf, framed wall art, fireplace, upright piano, chest of drawers, king bed, wall cabinet, range hood, pendant light, chandelier, wall sconce, recessed downlight, table lamp, outdoor sofa, patio umbrella, pergola, swimming pool, fence, gate and BBQ grill — each with a 2D symbol and detailed 3D geometry. Lights actually illuminate the scene.
- **Smart editing** — drag an object and magenta guides snap it to nearby edges, centres and wall faces; live green dimension lines show clearances to the surrounding room walls; right-click any object for duplicate, rotate ±90°, align-to-wall, bring-to-front / send-to-back, copy and delete.
- **Real catalog thumbnails** — every library card previews the object's actual plan symbol instead of a generic icon.

## Included

- Room, wall, dimension, select, move, and pan tools
- Multi-select with Shift/Cmd/Ctrl-click or drag an empty canvas to marquee-select objects; drag the group to move it, use the round group handle to rotate it, and use arrow keys to nudge the whole selection
- 48-item architectural library spanning openings, living, bedroom, kitchen, bathroom, appliances, garage, garden, and decor
- Wall-snapping doors and windows with editable swing, sill, elevation, and opening size
- Continuous door opening, semi-open presets, hinge reversal, sliding/garage opening states, and per-object transparency
- Editable position, size, height, rotation, thickness, elevation, material, colour, and opacity
- Interactive generated 3D model with orbit, viewing-angle, zoom, walls, floors, openings, furniture, open-tread L/U stairs, thin guard rails, and optional under-stair storage
- Shared 2D/3D rotation basis so object facing and clockwise L/U stair handedness stay consistent between views
- Centimetres, metres, feet/inches, and inches, with object dimensions, footprint areas, room areas, catalog cards, elevations, and nudge labels converted to the active unit; feet fields use architectural feet–inches notation (for example `5′ 4″`) rather than decimal feet
- Snap grid, zoom, fit-to-plan, north orientation, undo, and redo
- Multiple floor levels
- Automatic browser-local saving and restore
- Portable JSON import and export
- Placement repair keeps freestanding objects inside room envelopes and moves tree/stair collisions into the planted court

Keyboard shortcuts: `V` select, `R` room, `W` wall, `D` dimension, `H` pan, `Cmd/Ctrl+C` copy, `Cmd/Ctrl+V` paste, `Cmd/Ctrl+D` duplicate, `Delete` remove, arrow keys nudge (Shift = larger step), and `Cmd/Ctrl+Z` undo. In Select mode, drag rooms/objects to move them; Shift/Cmd/Ctrl-click adds or removes objects; drag empty canvas to draw a selection rectangle; use Alt/Option-drag over a room to marquee-select through floor space. Selected objects expose corner resize handles and a round rotation handle. The canvas grid legend shows the current unit plus minor/major spacing.

The [three-loop quality review](QUALITY_REVIEW.md) records the usability rubric, changes, final score, and professional limitations.

The [object usability review](OBJECT_USABILITY_REVIEW.md) covers direct scaling, object detail, clearance checks, and layout-assistance improvements.
