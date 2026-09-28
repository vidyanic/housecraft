# Dimension and layout critic review

The library was checked as a residential concept-planning catalog. Dimensions are nominal planning envelopes, not manufacturer shop drawings. Code, accessibility, structure, fire separation, and setbacks still require local professional review.

Reference checks used in the audit:

- US Access Board: 36 in continuous accessible route and 32 in minimum clear door opening: https://www.access-board.gov/ada/chapter/ch04/
- 2021 IRC: residential stairs at least 36 in clear width: https://codes.iccsafe.org/content/IRC2021P1/chapter-3-building-planning
- Standard mattress modules: queen 60 × 80 in and twin 38 × 75 in: https://www.sleepfoundation.org/mattress-sizes/queen-size-bed-dimensions

## Catalog audit — all 49 objects

| Object | Nominal W × D × H | Review result |
|---|---:|---|
| Single door | 36 × 3.5 × 80 in | Updated to a common residential leaf module |
| Double door | 72 × 3.5 × 80 in | Updated; two 36 in leaves |
| Sliding door | 72 × 3 × 80 in | Updated; practical two-panel module |
| Picture window | 60 × 3 × 48 in | Updated; slimmer wall insert |
| Casement window | 36 × 3 × 48 in | Updated |
| Bay window | 72 × 18 × 54 in | Updated |
| Linen sofa | 84 × 35 × 32 in | Updated to reduce bulk |
| Sectional sofa | 108 × 60 × 33 in | Updated |
| Lounge chair | 30 × 33 × 35 in | Within residential range |
| Dining chair | 19 × 21 × 36 in | Updated |
| Dining table | 72 × 36 × 30 in | Updated six-seat module |
| Coffee table | 48 × 24 × 17 in | Updated |
| Media console | 72 × 16 × 24 in | Updated, shallower envelope |
| Queen bed | 60 × 80 × 24 in | Corrected to standard mattress footprint |
| Single/twin bed | 38 × 75 × 22 in | Corrected to standard twin footprint |
| Wardrobe | 72 × 24 × 84 in | Updated |
| Nightstand | 20 × 18 × 20 in | Updated |
| Writing desk | 60 × 30 × 30 in | Updated to usable work depth |
| Kitchen run | 96 × 25 × 36 in | Updated to standard counter depth/height |
| Kitchen island | 84 × 42 × 36 in | Updated |
| Refrigerator | 36 × 30 × 70 in | Updated |
| Kitchen sink | 33 × 22 × 35 in | Within standard module |
| Freestanding tub | 72 × 32 × 24 in | Updated |
| Toilet | 15 × 28 × 30 in | Updated fixture envelope |
| Bathroom vanity | 48 × 22 × 34 in | Updated |
| Glass shower | 36 × 36 × 80 in | Updated minimum planning module |
| Indoor plant | 22 × 22 × 45 in | Suitable movable-object envelope |
| Fiddle-leaf tree | 33 × 33 × 77 in | Suitable movable-object envelope |
| Area rug | 96 × 67 × 0.8 in | Within common 8 ft class |
| Floor lamp | 17 × 17 × 65 in | Within common range |
| Straight stairs | 42 × 120 × 108 in | Updated; 36 in clear flight inside envelope |
| L-shaped stairs | 96 × 120 × 108 in | Updated; 36 in clear flight, 42 in landing, 17 risers |
| U-shaped stairs | 96 × 120 × 108 in | Updated; 36 in clear flights, 42 in landing, 17 risers |
| Round dining table | 48 × 48 × 30 in | Updated four-seat module |
| Television | 57 × 7 × 33 in | Existing envelope retained |
| Four-zone cooktop | 24 × 20.5 × 2 in | Existing 24 in appliance module retained |
| Wall oven | 24 × 23 × 24 in | Existing module retained |
| Dishwasher | 24 × 24.4 × 34 in | Existing module retained |
| Double-bowl sink | 36 × 20.5 × 7 in | Existing module retained |
| Bathroom basin | 23 × 19 × 7 in | Existing module retained |
| Washing machine | 24.4 × 25.6 × 34.6 in | Existing module retained |
| Tumble dryer | 24.4 × 25.6 × 34.6 in | Existing module retained |
| Radiator | 43 × 5.5 × 24 in | Existing shallow wall envelope retained |
| Compact car | 72 × 174 × 58 in | Updated to a realistic compact-car envelope |
| Garage door | 108 × 5 × 84 in | Updated single-car opening |
| Raised planter | 79 × 26 × 19 in | Existing landscape module retained |
| Flower pot | 15 × 15 × 22 in | Existing module retained |
| Garden tree | 94 × 94 × 165 in | Existing canopy envelope retained |
| Garden bench | 63 × 23 × 35 in | Existing module retained |

## Layout critic loops

### Loop 1 — 56/100

- Previous footprint was approximately 47.6 × 26.2 ft, not the requested site.
- Standard-size furniture was compressed into undersized zones.
- Exterior and interior walls used 8 in and 6.3 in visual thicknesses throughout.
- South-facing entry/window positions conflicted with the requested closed edge.

### Loop 2 — 79/100

- Reflowed the design onto an exact 65 × 35 ft footprint.
- North 65 ft and west 35 ft edges became the open frontages.
- Entry, garage access, and exterior windows moved to north/west; south/east received no openings.
- Construction was reduced to approximately 6 in exterior and 4 in interior walls.
- One remaining hard overlap was detected between a dining chair and the kitchen run.

### Loop 3 — 91/100

- Shifted the dining group to preserve the kitchen working zone.
- Browser audit reports zero hard furniture/appliance overlaps.
- Footprint measures exactly 65.0 × 35.0 ft.
- South/east opening audit reports zero violations.
- Feet-and-inches is the default, with a 4 in snap grid and 2 ft major grid.
- Plan annotations identify both open and closed site edges.

The remaining nine points require project-specific information: setbacks, structural grid, wall assembly, local egress rules, plumbing stacks, mechanical systems, and the actual authority having jurisdiction.

### Loop 4 — 94/100 (placement + climate/Vastu pass)

- Added a repair pass for saved/imported plans: freestanding objects are clamped inside their containing room with a 12 cm furniture inset; doors and windows remain wall-aligned.
- Tree/stair collisions are automatically repaired by moving the tree into the planted courtyard, keeping the stair bay clear.
- Replaced solid stair wedges with open-tread L/U flights, side stringers, guard rails, and optional under-stair storage.
- Added a Delhi hot semi-arid climate preset with courtyard cooling, cross-ventilation, west shading, and cool-roof guidance; Vastu guidance is exposed as an explicit advisory panel (not a statutory code).
- The sample remains a reference-ready concept rather than a permit set: verify local setbacks, structure, fire egress, accessibility, drainage, and Vastu decisions with the project team.

### Loop 5 — 96/100 (stair direction and void cleanup)

- Matched the stair ascent sequence to the 2D clockwise symbol: bottom/south → top/north on the left flight, then right/east at the landing.
- Removed visible continuous stair support members that were reading as an upper hanging block.
- Kept the under-stair cabinet optional and disabled it in the default/migrated sample so the stair void reads open by default.
