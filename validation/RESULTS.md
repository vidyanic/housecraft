# Validation results

Validated on 9 October 2026 using the local Node server and Codex in-app browser.

- Backup before changes: `e333822`; checkpoint before structural overhaul: `025bbc6`.
- `node tests/regression.cjs`: all 8 regression groups passed; all application scripts parsed.
- `node tests/engineering.cjs`: all 17 benchmark groups passed, including analytical frame solutions, equilibrium, modal mass/participation, spectra, CQC, rigid diaphragms, combinations and proposal invariants.
- `tests/browser.html`: all 26 checks passed with isolated test storage, including editing, undo, cancellation, import validation, attachments, rooms, floor duplication, recovery snapshots, SVG/PDF output, accessibility, 3D geometry reuse, service routes and structural workspace/proposal/report/export workflows.
- No uncaught application errors were captured by the test workspace.
- Responsive layouts inspected at 1440 × 900, 820 × 900 and 390 × 844; screenshots are in this directory.
- `git diff --check`: passed.

PDF checks cover rasterization, physical page dimensions and byte offsets. PDF exports use a JPEG drawing; SVG exports remain vector. Structural reports are preliminary modeled checks with the limitations documented in README.md.

Structural screenshots: `structure-desktop.png`, `structure-tablet-properties.png`, `structure-mobile-plan.png`, `structure-mobile-properties.png`, `structure-elevation.png` and `structure-3d.png`. These show the isolated two-storey sample, not a replacement of the user's saved project. The final 3D visual check includes the complete stacked frame after using Fit.

Lucknow defaults use Zone III, provisional soil II and provisional allowable bearing of 150 kPa. See `STRUCTURAL_IMPLEMENTATION.md` for verified equation scope, BIS edition review and unimplemented design checks.

To repeat browser validation, start `node server.cjs`, open `http://127.0.0.1:4173/tests/browser.html`, wait for Ready and choose Run browser checks.
