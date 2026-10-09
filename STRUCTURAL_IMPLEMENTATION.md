# Structural implementation progress

Checkpoint before this work: `025bbc6`.

1. Correct legacy calculation, identity, auto-fix and reporting defects; add engineering regression fixtures.
2. Add a shared-model Structure workspace with layers, grids, adjacent floors, members, slabs, supports and schedules.
3. Add explicit gravity loads, slab load conservation, cumulative column loads and section checks.
4. Add a Lucknow/BIS design basis with editable, provisional soil inputs, seismic mass, demand and irregularity screening.
5. Add a bounded, verifiable frame solver, modal response, reviewable optimization proposals and calculation reports.
6. Test numerical benchmarks, browser workflows, exports and responsive layouts. Record unsupported analyses explicitly.

Default location: Lucknow, India. Zone III is a location preset. Soil class and allowable bearing are provisional user inputs, not inferred geotechnical results. Design references: IS 456:2000, IS 875 Parts 1/2, IS 1893 (Part 1):2016 and IS 13920:2016, with edition/amendment status recorded in the basis. The withdrawn 2025 seismic edition is not selected.

Verification sources:
- https://moes.gov.in/sites/default/files/LS_US_4407_14122016.pdf
- https://www.nitsri.ac.in/Department/Civil%20Engineering/CSE_202_Chapter_4-1893-part-1-2016-1pdf.pdf
- https://www.bis.gov.in/know-your-standard/

Independent professional validation and site-soil testing cannot be supplied by application tests. Results must retain their computed scope and assumptions.

## Delivered planning and numerical changes

- Dedicated shared-model Architecture / Structure / Services / 3D workspaces, structural layers, adjacent floors, grid axes, panels, point loads, RC walls, explicit beam connections, base supports, locks and schedules. Elevation / section projections fit their own extents. Slabs and RC walls render in 3D, and structural annotations export to SVG/PDF.
- Clipped tributary areas, cumulative gravity loads by elevation, mixed reinforcement groups, circular quantities, overall-to-effective-depth conversion and consistent rounding. Analysis model construction is pure. Explicit missing joints remain missing; free cantilever tips are represented.
- Framing generation preserves manual members. Section/grid/wall changes use clone/compare/preview/apply, reject stale/new failures and apply in one undo step. Automatic removal is unavailable because alternative load paths cannot be certified by these checks.
- Linear 3D frame solver, rigid-diaphragm transformations, massless condensation, modal frequencies/participation, BIS static/dynamic spectra, CQC, base-shear scaling, modal drift and member forces. Gravity and static seismic screening have 97 signed/directional/eccentricity combinations.
- Reports/export retain numerical scope, inputs, issue lists and uncomputed checks. Invalid imports/basis edits are rejected. Floor duplication remaps structural IDs and load/joint references.

## Explicit remaining design scope

These suggestions require further implementation and engineering verification: a slab/shell or plate solver and actual distributed beam gravity loading; RC wall lateral stiffness; full bending/shear and biaxial/slender-column reinforcement design; joint shear/confinement/anchorage detailing; nonlinear/P-delta; vertical earthquake and amplified static eccentricity; geotechnical/foundation interaction; code wind design and independently validated optimization/removal. They are not silently treated as passing. The added solver supplies a bounded elastic planning foundation and exports its model/results for review.

## Validation completed

All 8 application regression groups, 17 engineering benchmark groups and 26 browser workflows passed. Numerical fixtures cover equilibrium, analytical cantilevers, rotated axes, mechanisms, eigenvalues, rigid diaphragms, modal mass, CQC, seismic mass and load combinations. Browser checks cover shared workspaces, invalid edits, references, proposal preview/apply/undo, stale results, report serialization, structural exports and 3D geometry. Desktop (1440 × 900), tablet (820 × 900), mobile (390 × 844), elevation and stacked 3D previews were inspected. The 3D fit command now centres and frames the full rendered building bounds.

Screenshots and the repeatable workflow are recorded in `validation/RESULTS.md`. Passing application tests verifies these implementations and fixtures; it does not complete the remaining engineering design scope above.

## Edition audit — 9 October 2026

The BIS catalogue lists IS 1893 (Part 1):2025 as withdrawn on 5 March 2026, and the 2016 entry lists amendments 1 (2017) and 2 (2020). This implementation uses the verified base 2016 equations with consolidated amendments marked for verification. BIS lists IS 875 (Part 1):1987 as withdrawn on 20 September 2026 and superseded by Part 1:2026, so the recorded reference is updated to 2026. The editable unit-weight presets have not been validated against its complete new tables. IS 875 (Part 2):1987 remains the imposed-load reference. See the BIS catalogue for current legal applicability and the approving authority's requirements.
