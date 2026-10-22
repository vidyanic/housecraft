# Persistent studio shell

The current revision supersedes the initial auto-hidden shell. Desktop opens with the project header, workspace row, Library and Properties visible. Both side panels are 280 px wide, aligned beneath a 54 px project header and a 48 px workspace row. A permanent 64 px modeling rail sits at the left on desktop/tablet. Below 700 px, the same controls form a horizontally scrollable bottom toolbar with safe-area padding; canvas controls and overlay sheets stay above it. Expand retains the toolbar.

## Comparison and critique

Primary references reviewed:

- [SketchUp for Web navigation](https://help.sketchup.com/en/sketchup-web/navigating-sketchup-web): distinct modeling tools and option panels.
- [Figma navigation and panels](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar): distinct navigation, panels and canvas.
- [SketchUp main toolbar](https://help.sketchup.com/en/sketchup-web/sketchup-web-main-toolbar): help alongside search controls.

| Candidate | Critique | Decision |
| --- | --- | --- |
| Dense horizontal ribbon | Reintroduces competing rows and repeated controls | Reject |
| Auto-hidden floating shell | Saves space but obscures routine commands and looks fragmented | Replace |
| Persistent tool rail and balanced panels | Clear spatial roles and predictable access; explicit collapse gives more canvas space | Implement |

The visual critique corrected inherited mobile panel insets that covered the rail, prevented two overlapping sheets after resizing, and moved collapsed-sheet handles to the bottom of the rail so they do not cover sheet headings.

## Interaction model

- Project header contains project identity, search, Help immediately beside search and file actions. Its upward arrow explicitly hides the bar.
- Workspace row contains workspace tabs and Add floor. Compact active floor selection lives in the canvas's upper-left corner, with the 3D floor display where relevant. Grid, Fit and icon-only Expand occupy the upper-right corner; zoom occupies the bottom-right. Fit aligns the plan immediately below the corner controls with small side margins and bottom-control clearance. The repeated floor crumb and architecture Structure overlay toggle are removed from the visible UI.
- Undo/Redo occupy the canvas bottom-left. Grid spacing appears in the Help & shortcuts feature guide. Floor selection has an accessible name without a visible label. Bars collapse with upward arrows. Architecture omits structural members from drawing and hit testing; the Structure workspace retains them.
- Hidden project/workspace bars expose compact, labeled downward arrows at the top of the app, outside the canvas. The arrows use explicit click, tap or keyboard activation, so hiding a bar does not immediately reopen it under the pointer. There are no named Project/Workspace reveal buttons in the canvas.
- The left rail contains the active workspace's drawing/modeling tools and context commands. It stays visible in normal and expanded modes.
- Library and Properties stay open until their Hide buttons are used. Desktop reserves their space. Explicit collapse/open changes the canvas bounds; hovering a hidden-panel handle reveals an overlay without changing bounds, bitmap size, geometry or camera state.
- Expand canvas hides the headers and sheets, keeps the permanent rail, bottom zoom and upper-right Restore icon, and remembers which panels were visible. Restore returns that visibility state.
- Keyboard in the toolbar opens a precise-move overlay and focuses an input for the device keyboard. Its touch arrows move selected objects by 1 cm, 5 cm or the grid step, including on keyboards without arrows. Held arrows form one undo action; canceled pointers roll back. Escape closes the overlay and returns focus to the button. Step changes and typing do not create project edits. The overlay follows the visible viewport when a software keyboard opens.
- Resume repaints the plan and restarts 3D rendering without fitting, changing selection or creating history. WebGL restoration regenerates the environment and shadows so materials recover with the scene after sleep or GPU context loss.
- Hover previews dismiss after 450 ms, except while a field has focus or a dialog is open. Explicitly opened sheets do not dismiss on pointer leave. Touch has explicit reveal and Hide controls. Escape dismisses temporary overlays and returns focus.
- Workspace switches preserve explicitly hidden sheets. Library content changes to Objects for Structure and back to the catalog for other workspaces.
- Tablet and phone sheets overlay the canvas, with one sheet open at a time. A sheet remains visible by default; both headers and tools remain available. Desktop uses matching panel widths.
- Objects has one primary entry in Library. Duplicate, Rotate and Delete appear once in the selected-object action strip; the distinct Align wall action is retained. Services routes stay on the rail without a duplicate Library shortcut.

Validation covers 1440, 820 and 390 px layouts, permanent vertical tools, default visible chrome, explicit visibility retention, expanded-state restoration, hover invariants, keyboard focus, touch dismissal, imports/exports, model editing and 3D reuse. Screenshots use isolated preview storage.
