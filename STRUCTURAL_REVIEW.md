# Structural planning review

Reviewed 9 October 2026. This is a code audit and proposed implementation plan; application behavior has not been changed by this review.

## Recommendation: a Structure workspace

Add top-level Architecture, Structure, Services and 3D workspaces. Structure should have its own 2D canvas view, inspector, toolbar, layer defaults, selection filters and remembered camera. All views must edit one shared building model with stable entity identifiers, floor elevations and one undo history. Avoid maintaining a second independent copy of the floor plan.

Keep architectural walls/openings visible as a faded, locked reference in Structure. Keep an optional structure overlay in Architecture for coordination. The new workspace should offer Plan, Frame elevation and Section views; separate foundation, column, beam and slab layers; grid axes; floor-above/below overlays; and result overlays for loads, reactions, drift and member demand.

Structure tools: nodes, columns, beams, structural walls, slab panels, foundations, support conditions, member releases, grid lines and loads. The inspector should expose section orientation, material grades, cover, reinforcement groups, member level and end connections. An issue list should select and zoom to the relevant member.

## Confirmed code findings

| Priority | Finding | Evidence and required change |
|---|---|---|
| Critical | Auto-reduction deletes columns even when no valid replacement beam is created | `autoReduceRedundantPillars`, structural-analysis.js:1078. Candidate IDs are deleted unconditionally after a conditional merge. An isolated fixture with three unconnected columns lost one column and still had zero beams. Turn removal into a proposal; require a validated support/load path and reanalysis before applying it. |
| Critical | Tributary load assignment does not conserve floor area | `calculateColumnTributaryArea`, line 41. A 4 × 4 m slab with four corner columns assigns 16 m² to each column: 64 m² in total for a 16 m² slab. The routine ignores slab boundaries and clamps areas to 4–45 m². Use explicit slab polygons and support-based load distribution, clipped to panels, and verify equilibrium. |
| High | Gravity loads do not accumulate through the building | Lines 135–141 estimate each column's local slab load. The upper-floor check at line 326 checks alignment only. Assemble a building-wide load path; transfer slab reactions to beams, beam reactions to columns, and column loads down through every storey to foundations. |
| High | Beam effective depth is treated as overall depth | Lines 197–210 use `beam.depth` directly in L/d. Store overall depth, cover, stirrup diameter and longitudinal bar diameter separately; derive effective depth with unit-checked arithmetic. Add flexure and shear checks rather than using span/depth as a complete design check. |
| High | Auto-size can shrink a cantilever using ordinary span buckets | `autoSizeStructure`, line 651, chooses beam sections without consulting support condition. It also overwrites selected reinforcement and footing dimensions. Preserve locked member data; use the same validated demand/capacity calculations as analysis; reject proposals that worsen any governing check. |
| High | Depth rounding formulas disagree with their comments | Lines 1110, 777 and 875–895 use expressions such as `ceil((spanM / ratio) * 10) * 5`, labeled L/13, L/14 or L/7. For a 5.2 m primary beam, the L/13 branch gives 35 cm after its minimum clamp, while the stated raw L/13 target is 40 cm. Convert metres to centimetres explicitly, then round the intended value to a chosen increment. A sizing heuristic is still not a strength calculation. |
| High | Proximity is used as proof of structural support | `classifyBeamHierarchy`, line 811, considers a column within 45 cm or a beam within 30 cm a support; an unsupported beam falls back to secondary. Store explicit node/member connectivity, joint offsets, elevations and support conditions. A primary/secondary label is independent of simply supported/continuous/cantilever behavior. |
| High | Auto-alignment can disconnect framing | `autoImprovePillarGrid`, line 1137, moves columns and then uses proximity to their new centers to move beam ends. Store end-node references so connected ends move together. Coordinate all affected storeys and preserve locked elements. |
| High | Regeneration discards manually planned framing | `autoGenerateFraming`, lines 725–726, resets columns and beams. `autoAlignWallsForGrid`, line 474, changes architecture and calls regeneration. Keep generated/manual provenance, stable IDs and locks; preview additions/removals and preserve manual framing. |
| Medium | Reinforcement and quantities are approximate | The first bar-count match is used for column steel area; mixed groups are not summed. Steel estimates do not use a bar schedule. Circular column capacity uses elliptical area while concrete/self-weight still use rectangular area. Store structured bars/ties and derive capacity, weight and schedules consistently. |
| Medium | Floor identity and reporting need correction | Checks use `project.activeFloor` even when a different floor is passed to analysis, and assume array order means elevation order. Reports include broad code-compliance and safe-removal claims, although the implemented checks are limited. Resolve floor identity from IDs/elevations; show individual checks, assumptions, unsupported cases and analysis status. |

These findings concern the algorithms, not just the presentation. Existing regression tests passing does not validate engineering accuracy.

## Better auto-fix workflow

1. Analyze an immutable snapshot with the current model revision.
2. Generate candidate changes with reasons, affected members, before/after sizes and quantities.
3. Respect locks, grid constraints, architectural openings and all-storey support paths.
4. Preview candidate geometry with added/removed/moved members in separate colors.
5. Reanalyze each candidate using the same load cases and combinations. Verify connectivity, equilibrium and all affected checks.
6. Apply selected proposals as one undo transaction, with a change report. Mark prior analysis stale whenever its inputs change.

Automatic cleanup can address duplicate nodes, coincident endpoints and inconsistent metadata within explicit tolerances. Column removal, support changes, shear-wall changes and reinforcement redesign require a validated structural analysis and a reviewable proposal. Cost savings should be calculated from the resulting quantities, not a fixed amount per deleted column.

## Earthquake calculation roadmap

### 1. Design basis and seismic mass

Record country/code edition, amendments, site hazard or zone, soil/site class, importance, occupancy, structural system, response reduction assumptions, damping, floor elevations and diaphragm model. Separate dead/live/wind/earthquake load cases and code-defined combinations. Include actual slab, beam, column, wall, equipment and tank weights, with the appropriate participation of imposed loads. The new plumbing/electrical geometry does not automatically supply equipment mass.

### 2. Preliminary lateral-force calculation

For buildings eligible for the selected code's equivalent-static method, compute the period and spectral coefficient, then design base shear `V = C × W` in both principal directions. Distribute forces to levels using that code's height/weight rule. Show the mass table, coefficient inputs, floor forces and storey shears. Check sum of floor forces equals base shear. This step estimates demand; it does not establish member adequacy.

### 3. Structural analysis

Assemble connected frame/wall members with stiffness, boundary conditions, diaphragms, offsets and documented cracked-section assumptions. Solve displacements and forces for the required directions and combinations, including applicable accidental torsion, orthogonal effects and vertical actions. Add modal/response-spectrum analysis where required, with mass participation, mode combination and scaling checks. Singular/unstable models must stop calculation and identify mechanisms.

### 4. Checks and design

Report storey drift, torsion, soft/weak storeys, vertical/plan irregularities, P-delta applicability, beam flexure/shear, column axial-plus-biaxial bending, joint behavior and ductile detailing. Include strong-column/weak-beam checks where applicable, confinement regions, bar anchorage/laps and reinforcement congestion. Add foundation bearing, sliding, overturning and punching checks using project soil inputs. Support shear walls as explicit structural elements rather than architectural wall lines.

### 5. Validation

Use hand-checkable simply supported/cantilever benchmarks, a single-storey portal frame, a multi-storey frame and irregular-building cases. Check load/reaction balance, dimensional consistency, mesh/convergence behavior, results invariant to floor-array ordering, and comparison with an independently validated structural solver. Validate each code profile against worked examples reviewed by a structural engineer. Browser tests should separately verify editing, overlays, stale results and undo.

## Code edition caution

BIS's current standard-details listing marks IS 1893 (Part 1):2025 as withdrawn on 5 March 2026. Do not select a seismic profile merely because it has the newest year, or implement coefficients from a draft. Record the applicable approved edition and amendments in the project design basis, and confirm local adoption independently.

- [BIS standard-details listing for IS 1893 (Part 1):2025](https://standards.bis.gov.in/website/standard-details?encryptedId=eyJpdiI6ImEwZDZ0L0Jtbk5pZnc2bTNYdGxuNFE9PSIsInZhbHVlIjoiWVlGYm1FdjZmWmpqRzBjeWtEWGUydz09IiwibWFjIjoiYjU2NGEwYmEzYjgxYTIyZTllMDZiNmQ1ZTc0NWI4ODhjMGU1YzAzMzhhNzgxNTk0ZDg0ODBjZWE4ZTA5YmZlNSIsInRhZyI6IiJ9)
- [IIT Kanpur/BMTPC Earthquake Tips: configuration, twisting, ductility and shear walls](https://www.nicee.org/eqtips.php)

## Recommended implementation order

1. Correct destructive auto-fixes, load assignment, unit/depth errors and misleading results; add targeted regression tests.
2. Introduce the Structure workspace, structural graph, slabs, loads, stable joints and all-storey column stacks.
3. Implement verifiable gravity analysis and beam/column/foundation checks.
4. Add code-profile-based seismic demand and irregularity screening, explicitly identifying uncomputed checks.
5. Integrate validated lateral analysis, seismic detailing, optimization proposals and independent engineering benchmarks.
