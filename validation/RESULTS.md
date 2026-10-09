# Validation results

Validated on 9 October 2026 using the local Node server and Codex in-app browser.

- Backup before changes: `e333822`.
- `node tests/regression.cjs`: all 8 regression groups passed; all application scripts parsed.
- `tests/browser.html`: all 18 checks passed with isolated test storage, including editing, undo, cancellation, import validation, attachments, rooms, floor duplication, recovery snapshots, SVG/PDF output, accessibility, 3D geometry reuse, service route editing, vertical runs and drawing cancellation.
- No uncaught application errors were captured by the test workspace.
- Responsive layouts inspected at 1440 × 900, 820 × 900 and 390 × 844; screenshots are in this directory.
- `git diff --check`: passed.

PDF checks cover rasterization, physical page dimensions and byte offsets. PDF exports use a JPEG drawing; SVG exports remain vector. Structural reports are preliminary modeled checks with the limitations documented in README.md.

To repeat browser validation, start `node server.cjs`, open `http://127.0.0.1:4173/tests/browser.html`, wait for Ready and choose Run browser checks.
