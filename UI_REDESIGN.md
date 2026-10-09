# Studio navigation redesign

## Analysis and critique

The old header mixed workspaces, panel toggles and file actions. Drawing tools were icon-only, and exports required opening Properties and expanding a second menu. The structural inspector combined creation, basis, member editing, proposals, schedules and results in one scroll. Mobile floor navigation opened an add-floor dialog instead of a direct floor switcher. CSS and panel handlers used inconsistent breakpoints. Duplicate/rotate/delete sat below long property forms.

Three options were critiqued before implementation:

| Option | Strength | Weakness | Decision |
| --- | --- | --- | --- |
| Full ribbon | Exposes commands grouped by task | Consumes excessive space on touch devices | Reject |
| Minimal canvas with drawers | Maximizes drawing space | Keeps frequent actions hidden and obscures current mode | Reject |
| Compact workspace shell | Stable navigation, contextual tools and focused editors | Requires careful adaptive panel rules | Implement |

The second critique removed the duplicated structural schedule, exposed mobile structural commands in two rows, preserved selection during project-settings edits and moved selected-object actions above the form. The visual pass removed duplicate desktop selection chips, kept tablet panel labels visible, wrapped library names, prioritized drawing settings and enlarged touch controls.

## Implemented interaction model

- Project header: name, Projects, Objects, command search, Undo/Redo, Export, Save and a project menu. Less frequent import/sample/help actions stay in that menu. Mobile offers command search and Redo there too.
- Persistent labeled Architecture / Structure / Services / 3D tabs. Arrow keys navigate tabs; Alt 1–4 switches workspace. Ctrl/Cmd K searches commands and objects; Ctrl/Cmd S saves.
- Contextual tools expose architecture drawing, structural creation/screening/modal analysis, service routing and 3D presets. Drawing tools return touch users to the canvas.
- Floor selector and Add floor are always visible. 3D floor display is separate from drawing export.
- Left dock: searchable library/category selector or existing Objects. Object selection opens its editor directly. Services filters the catalog to its 19 routing/fixture objects.
- Right dock: Properties/Checks/Project for selected objects; Member/Model/Basis/Review/Results for Structure; View/Sun/Project for 3D. Member selection opens Member; calculations open Results. Project settings preserve selection and provide a return action.
- Export sheet: SVG, PDF, print, scale, portable project JSON and structural calculation JSON. Escape, focus return and keyboard interaction are tested.
- Desktop ≥1200 px: library, canvas and property docks. Tablet 700–1199 px: canvas plus one selected panel. Mobile <700 px: labeled bottom navigation and full-width sheets. Workspace navigation and tools remain visible.

Primary touch actions and form controls use 44 px targets. Focus rings, labeled fields, tab semantics and reduced-motion handling follow [WCAG 2.2 guidance](https://www.w3.org/TR/WCAG22/). Adapting panes to width follows [Material adaptive layout examples](https://m3.material.io/foundations/layout/canonical-examples/overview). These checks are not a full accessibility conformance audit.

## Validation

8 application regression groups, 17 engineering benchmarks and 33 browser workflows passed. Seven new browser groups cover workspace keyboard navigation without geometry changes, selection-preserving project edits/undo, Export focus/selection restoration, command search, direct structural creation/results, service search and responsive overflow/panel visibility.

Visual previews use isolated storage: `tests/ui-preview.html` for the courtyard sample and `tests/structural-demo.html` for an explicit frame. Screenshots are in `validation/ui-*.png`. Existing editing, undo, recovery, exports, service routing and engineering calculations remain covered.
