# Rendering critic loop

Evaluation target: a convincing, stable real-time architectural preview in a browser. This is not represented as equivalent to an authored Unreal Engine or Blender production scene.

## Loop 1 — baseline: 36/100

- 3D was a hand-drawn canvas projection with flat polygon shading.
- Furniture read as boxes; glass, metal, fabric, wood, and stone did not respond differently to light.
- No real perspective camera, shadow map, environment light, tone mapping, or object picking.
- 2D rooms merged into the grid and lacked floor-finish notation.

## Loop 2 — renderer and assets: 72/100

- Replaced the display layer with local Three.js WebGL rendering.
- Added physically based material classes, generated wood/fabric/stone/tile textures, environment reflections, physically correct lights, soft shadows, fog, and ACES filmic tone mapping.
- Rebuilt key catalog families as multi-part procedural assets: sofas, chairs, beds, tables, storage, kitchens, appliances, sinks, bathroom fixtures, stairs, plants, lamps, openings, and the car.
- Added true perspective orbit/pan/zoom, camera presets, clickable 3D selection, and continuous operable-door geometry.
- Added architectural floor patterns, clearer wall poche, and restrained furniture shadows to the plan view.

## Loop 3 — stability and usability: 84/100

- Removed wall self-shadow acne found during browser capture.
- Refined cutaway walls so camera-facing construction opens while rear walls retain enclosure and window context.
- Kept transparent objects depth-safe and deterministic; the previous show/hide flicker path is no longer used.
- Verified local loading, WebGL 2 creation, scene construction, Plan/3D switching, and zero browser console errors in headless Chrome.

## Scored critic loop — geometry & material realism (target 90+)

Rubric (100 pts): **Edge/form quality** 20 (rounded, chamfered edges vs. hard cubes) · **Object detail** 20 (part count, cushions, legs, handles) · **Materials** 20 (textures, normal maps, PBR roughness/metalness) · **Lighting & shadows** 20 (sun, contact AO, artificial lights, day/night, tone mapping) · **Structure** 20 (walls, floors, skirting, openings, proportions).

Scores below are a structured self-assessment of the geometry and material pipeline (live in-browser rendering could not be captured in this session because the browser bridge was unavailable).

### Loop 4 — baseline before this pass: 62/100
- Edge/form 8: almost every object was flat `BoxGeometry` — hard CGI-cube read.
- Object detail 13: multi-part but blocky (seat + back + arms as plain slabs).
- Materials 17: procedural wood/fabric/stone/tile, no relief.
- Lighting 16: sun + soft shadows + ACES, no contact AO, no day/night.
- Structure 8: flat wall boxes, no skirting, floors read as coloured slabs.

### Loop 5 — normal maps, contact shadows, day/night: 76/100
- Materials 19: generated tangent-space **normal maps** derived from each diffuse texture add grain/weave/grout relief.
- Lighting 19: soft **contact-shadow** blobs ground every floor object; full **day→night** cycle drives sky, exposure, sun colour and hands the room over to lamps/fixtures after dark.
- Edge/form still 9 and structure still 9 — objects were still boxy; this is what Loop 6 targets.

### Loop 6 — rounded geometry, richer parts, skirting: 91/100
- **Edge/form 18** — new `roundedBox` (extruded rounded-rect profile + bevelled caps) replaces flat boxes on sofas, chairs, beds, tables, cabinets, kitchen runs, dressers, ottomans, consoles, TVs and benches. Bevelled edges catch light and kill the cube look.
- **Object detail 18** — sofas gained separate seat + back cushions, upholstered arms, a back panel and turned wooden feet; beds gained a headboard, folded throw and pillows; kitchens gained a worktop lip, splashback and plinth feet; cabinets gained recessed door panels and handles; tables gained aprons and tapered legs.
- **Materials 19** — normal-mapped wood/stone/fabric/concrete, glass transmission, metal, mirror; emissive lit fixtures.
- **Lighting 19** — sun + contact AO + artificial point/spot lights + day/night + ACES tone mapping.
- **Structure 17** — rooms now carry **skirting boards** around their perimeter, grounding walls to floors; segmented wall openings and opaque roof occluders retained.

Loops 4–6 scored the geometry/material *pipeline*, not a real render.

### Loop 7 — first look at an actual browser screenshot: 58/100 (photoreal bar)
Reviewing a live 3D capture reset expectations. The pipeline is good but the render read as a clean schematic dollhouse, not photoreal:
- **Lighting 10** — flat, even illumination; almost no directional shading gradient (the biggest "not real" cue).
- **Materials 11** — matte objects looked plasticky; fabric/paint had no light response.
- **Structure 12** — walls flat bright white, wall/floor junctions invisible.
- **Objects 13** — rounding present but washed out; the tree was a cluster of smooth balloons.
- **Edge/form 12**.

### Loop 8 — lighting contrast, foliage, wall/skirting definition (in progress)
- Stronger, crisper key sun (×1.25, min 2.4) with **lower ambient/hemisphere and fill** and a slightly darker exposure → real directional shading instead of flat light.
- Trees/plants rebuilt as **layered low-poly canopy masses** (flat-shaded, varied greens) on a tapered branched trunk — reads as foliage, not balloons.
- Walls given a painted-plaster material; **skirting darkened** so wall/floor junctions read.
- Beds gained a duvet layer + turned-down sheet + plumper pillows so they stop reading as a slab.

Re-score pending the next screenshot; iterate from there.

## Remaining gap to production visualization

The app now has a credible real-time PBR preview, but “Unreal quality” also requires artist-authored high-poly meshes, UVs, calibrated 2K/4K texture sets, HDRI or designed lighting, global illumination, reflection probes, post-processing, and asset-level optimization. Those inputs cannot be fabricated faithfully from the plan’s width/depth/height metadata alone. The next technically sound step is glTF/GLB import with per-object model replacement and a production asset pipeline.

The stair family is now represented with open procedural treads, stringers, rails, and an optional storage volume, improving depth cues while retaining the renderer’s lightweight procedural constraint.
