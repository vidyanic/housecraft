# Working on Atelier Plan

Read `INDEX.md` before changing features or objects. It is the developer guide for module responsibilities, data relationships, extension steps, current UI decisions and verification. Read the relevant source files as well; documentation does not replace inspecting the implementation.

## Project conventions

- This is an offline, framework-free browser application using script tags and `window.Atelier`. No build step is required. Preserve local assets and existing saved-project compatibility.
- `index.html` defines script dependency order and stable control IDs. Bootstrap initializes the base UI, structural workspace, studio UI, then canvas-space layout. Inspect later method wrappers before changing a base method.
- Internal plan lengths are centimetres. Structural analysis uses kN, metres and radians. Persisted fields need migration/default handling and import validation. Preserve unique IDs and remap relationships when copying floors or objects.
- Checkpoint before model mutation. Continuous edits should produce one undo action; canceled gestures must restore the model. Navigation and visibility changes must not mutate geometry or create history entries.
- Catalog objects belong in `js/furniture-catalog.js`; plumbing/electrical definitions and route behavior belong in `js/services.js`. Check 2D symbols, catalog thumbnails, inspector fields, transformations, exports and cached 3D geometry when extending objects.

## Current UI requirements

- Architecture, Structure, Services and 3D share the project. Architecture does not draw or select structural beams/columns; retain them in the model and Structure workspace.
- Keep the permanent left tool rail. Bars and sheets are initially visible; explicit Hide or Expand canvas collapses them. Restore reinstates previous visibility.
- Canvas controls: unlabelled floor dropdown upper-left, Grid/Fit upper-right, Undo/Redo bottom-left, Zoom/Expand bottom-right and grid legend bottom-centre. Add floor stays in the workspace bar. Help stays beside command search. Avoid duplicate controls and floor labels.
- Bars collapse with upward arrows and reveal through explicit downward-arrow activation at the app top, outside the canvas. Hidden sheet hover previews overlay the canvas without resizing it or changing camera/model state. Preserve inert hidden surfaces, keyboard focus return, Escape and touch access.
- `js/studio-ui.js` owns studio navigation/property sheets; `js/canvas-space.js` and `css/canvas-space.css` own final placement/visibility. CSS loads base, studio, then canvas-space overrides. Reuse existing controls and event handlers.

## Structural work

Read `STRUCTURAL_IMPLEMENTATION.md` and `STRUCTURAL_REVIEW.md` for calculation scope and unresolved checks. Default context is Lucknow, India, Zone III, with provisional soil II and 150 kPa bearing capacity; these remain editable assumptions. Preserve report limitations and required reviews. Do not label preliminary checks as complete BIS compliance.

Proposals preview on a clone, reject stale/invalid changes, preserve manual framing and apply as one undo action. Automatic column deletion remains disabled without a validated alternate load-path method.

## Validation

- Run `node tests/regression.cjs` for application/model changes. Run `node tests/engineering.cjs` when changing structural modeling, calculations or proposals.
- Start `node server.cjs` and run `tests/browser.html` for affected browser workflows. Use `tests/ui-preview.html` to visually check desktop, tablet and mobile layouts (1440, 820 and 390 px), including affected workspaces, overlay/Expand behavior and keyboard/touch controls.
- Use isolated test pages/storage; preserve the user's working project. Add meaningful checks for changed behavior and relationships. Record relevant results/screenshots in `validation/RESULTS.md` and `validation/`.
- Documentation-only changes need a consistency review and `git diff --check`, not a browser rerun. Do not claim old verification as a newly completed run.
- Update `INDEX.md` when module ownership, feature extension guidance or established UI behavior changes. Keep this file concise and avoid duplicating the detailed index.
