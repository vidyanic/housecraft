# Canvas interaction and performance audit

Historical baseline before the interaction implementation. For current changes, browser measurements and remaining gaps, see `CANVAS_INTERACTION_IMPLEMENTATION.md`.

10 October 2026. Reviewed the current working tree, including the preceding autosave/history changes. This is an analysis and implementation backlog; application behavior was not changed during this audit.

## Main conclusion

The largest improvements will come from a shared edit transaction, correct transform geometry, and a rendering scheduler. Faster drawing alone would leave several operations unpredictable or unsafe. Architecture, Structure, Services, and 3D currently use different rules for selection, manipulation, cancellation, and model synchronization.

The existing foundation is useful: offline assets, centimetre geometry, rotated object bounds, hosted openings, associative dimensions, reversible 2D pointer edits, a bounded history, incremental 3D scene records, and an idle-aware 3D render loop. Preserve these while fixing the gaps below.

## Evidence and limits

Read the project guide and implementation of state/history, persistence/library, pointer handlers, object operations, 2D rendering, architecture relationships, services, structural workspace, inspector, studio wrappers, accessibility, 3D interaction/cache, and existing tests.

Ran `node validation/interaction-audit.cjs` against isolated in-memory fixtures. The probe script and `validation/interaction-audit-results.json` contain reproducible geometry results and CPU measurements. These probes use the real geometry/operation functions but stub drawing, inspector, and persistence. They do not touch browser storage.

Confirmed by executable probes:

- Resizing a 100 × 50 cm object to 150 × 75 cm with aspect lock moves the supposedly fixed corner from (0, 0) to (0, −12.5).
- A snapped resize with the same resulting dimensions still moves the fixed corner approximately 0.2 cm in both axes.
- Resizing a 10 × 5 cm service fixture clamps it to 20 × 20 cm.
- `scaleSelected(NaN)` produces nonfinite dimensions; JSON serializes width as `null`.
- Removing B from a selection containing A and B leaves `selected = B` while `selectedIds = {A}`.
- A structural grid is absent from both `findEntity` and `allEntities`.
- A route with a 100 cm horizontal run and 100 cm rise has length 141.42 cm. A 200% scale produces 223.61 cm, rather than a uniformly scaled length of 282.84 cm; the rise stays 100 cm.

Other findings are source-confirmed control-flow gaps or proposed usability improvements, marked below. No new browser interaction, real touch-device testing, visual QA, GPU profiling, or FPS measurement was performed. Timings identify CPU scaling problems, not measured end-user frame rates. A complete implementation should add those measurements before setting final performance thresholds.

## Element and operation coverage

| Element | Current operations | Main gaps |
|---|---|---|
| Furniture, equipment, roofs | Select, move, four-corner resize, rotate, numeric scale, duplicate, order, delete | Resize anchor drift, no side handles, broad minimum size, weak scale validation, no group scale |
| Doors and windows | Item operations plus automatic wall hosting | Hosting can override rotation/depth; drag, resize, and scale need explicit wall constraints |
| Manual rooms | Select, drag, property edits, duplicate/delete | No direct resize handles; weak shape-specific constraints and inconsistent multi-selection |
| Traced rooms | Selection and properties; boundary walls control geometry | Keyboard nudge and generic operations do not consistently enforce the boundary-derived restriction |
| Walls | Move, endpoints, rotation handle, numeric edits, duplicate/delete | No axis-lock gesture, length constraints, explicit junction policy, or mixed group transforms |
| Dimensions | Move and numeric endpoints; associative anchors | Moving an attached dimension is overwritten by synchronization; no endpoint/offset-specific interaction |
| Structural columns and beams | Canvas selection, keyboard nudge, form edits, delete; beam joints follow columns | Structure intercepts pointer-down before move/resize logic; locks are not enforced everywhere |
| Slabs, RC walls, point loads | Canvas selection and form edits; keyboard movement | Missing direct manipulation and consistent relationship constraints; layers do not consistently govern selection |
| Structural grids | Create and draw | Missing standard entity lookup, selection, property edit, and deletion path |
| Service fixtures | Item move, resize, rotate, properties | Generic minima are inappropriate; invisible snapping targets and workspace hit-test mismatch |
| Service routes | Draw vertices, text vertex editor, generic move/resize/rotate/scale | No vertex handles, insert/delete vertex or segment drag; scaling semantics incomplete |
| 3D objects | Click selection, Shift-drag move, inspector edits | Different history/cancel rules; move accepts entities without item coordinates; no direct resize/rotate gizmo |
| View/navigation | Pan, wheel zoom, pinch, Fit, workspace/floor switching | No shared pointer ownership; pinch can interrupt edits; inconsistent view persistence and shortcut handling |

## Prioritized findings

Priority H means correctness or loss of edit/history integrity; M means a substantial interaction or scaling problem; L means polish or a useful workflow extension. “Source” means confirmed in code, not reproduced in a live browser.

### Correctness and edit integrity

| ID | Priority / evidence | Gap and user effect | Required improvement / acceptance check |
|---|---|---|---|
| 01 | H / probe | `resizeItemFromCorner` computes dimensions after ratio/minimum/snap constraints, but computes the center from the raw cursor. The opposite corner drifts, including on rotated objects. | Compute the constrained dragged corner from the fixed anchor, signed extents, and final dimensions. Test all corners at 0°, 30°, 90°, with snapping and aspect lock. Fixed anchor must remain invariant. |
| 02 | H / source | Resize handles sit 7 screen pixels outside the actual object. Resize starts from the pointer position without recording that grab offset. Starting to drag at the displayed handle can enlarge the object immediately. Crossing the opposite corner uses absolute dimensions but an unconstrained center. | Store the pointer-to-handle offset. Define whether crossing clamps or flips the active corner. A subthreshold gesture must leave geometry unchanged. |
| 03 | H / probe | Generic resize minimum is 20 × 20 cm, except opening depth. Many sockets, valves, lights, and narrow objects are smaller. Tiny resizing can enlarge them dramatically. | Add per-type/capability minimums and preserve aspect ratio after all clamps/snaps. Valid small catalog objects must resize smoothly. |
| 04 | H / probe + source | `scaleSelected` does not reject nonfinite input. Empty numeric input becomes zero and clamps to 10%; NaN corrupts dimensions. Scaling always alters height and reports the original percentage even when clamped. | Validate finite positive input before checkpointing. Show the applied percentage and define footprint-only versus full 3D scaling. Invalid/empty input changes neither model nor history. |
| 05 | H / probe | `toggleSelection` makes the removed object primary. Inspector, Delete, group actions, and handles can then target different objects. | Keep primary within the selection, or explicitly model single non-item selection separately. Test removing primary/non-primary/last selection. |
| 06 | H / source | 3D Shift-drag checkpoints immediately. A click without movement never queues a save, so the no-op checkpoint is not settled. Cancel/Escape restores x/y but leaves history/redo changes. `hasMoved` stays true even after returning to origin. | Use the same before/after transaction as 2D. Click, return-to-origin, cancel, and Escape must preserve history and redo. Restore all related changes, not only coordinates. |
| 07 | H / source | 3D drag accepts any raycast entity or selected fallback. Walls/beams have x1/y1/x2/y2 rather than x/y/w/d, so the item move path can calculate NaN. | Dispatch transforms by entity capability; reject unsupported targets before starting a transaction. Never store nonfinite geometry. |
| 08 | H / source | Generic Delete, keyboard nudge, duplication, and 3D movement do not consistently honor structural `locked`. Traced-room nudging also bypasses the boundary-wall restriction enforced by the inspector and pointer path. | Apply one capability/lock policy to every command and pointer path. Locked geometry and derived-room bounds must resist unsupported changes. |
| 09 | H / source | The first touch can move an object before the second touch switches interaction to pinch. That mutation is neither rolled back nor committed to geometry history; pinch release can save it. Pointer-up is not restricted to an owning pointer. | Add explicit gesture states and pointer ownership. On edit-to-navigation transition, cancel or deliberately commit the edit. Test fingers added/removed in different orders. |
| 10 | H / source | An autosave timer scheduled before a gesture can fire while the live model contains a drag preview. Canceling restores the model but does not necessarily restore the saved snapshot or library recovery entry. | Suspend persistence during previews; save committed state only. Test a prior pending save, a long drag, and cancellation after the timer would have fired. |
| 11 | H / source | `draw()` runs architecture synchronization; the structural draw wrapper also rewrites beam endpoints. Rendering can mutate persisted data. Some inspector paths call `queueSave` before this synchronization, so dirty detection can precede the final model state. | Move relationship propagation into the edit commit/update pipeline. Drawing, selection, navigation, and export reads should not silently change the model. |
| 12 | H / source | Generic copying gives new entity IDs without remapping relationship IDs. Copied dimensions can still anchor original objects; copied traced rooms still reference original walls; beam/load relationships can remain tied to original supports. Floor copying has a more complete remap than object copying. | Introduce a shared copy/remap policy. Preserve intentionally external links and remap relationships within a copied set. Test copy/paste across floors and deletion of originals. |
| 13 | M / source | Dragging an associative dimension changes endpoint coordinates, but `syncArchitecture` immediately recomputes them from unchanged anchor offsets. The visible move can disappear. | Treat dimension movement as offset editing; endpoint dragging should re-anchor or detach explicitly. Undo must restore the anchor/offset state. |
| 14 | M / source | Hosted openings are ordinary items to transform commands, but synchronization forces wall rotation, depth, and placement. Numeric rotation, resize depth, and generic scaling may be immediately overridden. | Provide explicit along-wall movement and opening-width resizing; expose attach/detach and host limits. Resolve the final constrained geometry before displaying/save/history commit. |

Sources: `js/pointer-interaction.js:92`, `js/object-operations.js:30`, `:67`, `:87`, `js/pointer-interaction.js:148`, `renderer3d.js:1577`, `:1640`, `:1695`, `:1732`, `:1774`, `js/ui-wiring.js:97`, `:181`, `:291`, `js/persistence.js:45`, `js/architecture.js:77`, `js/canvas-drawing.js:761`, `js/structural-workspace.js:69`.

### Selection, precision, and workspace consistency

| ID | Priority / evidence | Gap and user effect | Required improvement / acceptance check |
|---|---|---|---|
| 15 | M / source | Structure uses a capturing pointer-down handler that stops the shared handler. It selects members but never starts direct move/resize operations. Beam handles rendered through the shared drawing path do not enter its endpoint-drag logic. | Share the gesture controller with structure-specific constraints. Support column move/resize, beam endpoints, slab handles, point-load placement, and grid movement with locks respected. |
| 16 | M / probe + source | Grids are not in `allEntities`, `findEntity`, normal deletion collections, or structural hit testing. They can be created and drawn but cannot follow the standard editing workflow. | Add an entity registry/capability adapter for grids. Verify create → select → edit → move → delete → undo → save/load. |
| 17 | M / source | Services hit testing first finds the topmost object across all disciplines, then rejects it if it is not a service. An overlapping invisible/non-service object can block selecting a visible service. Structure selection ignores layer visibility. | Filter candidates by workspace/layer before ranking hits. Share visible/selectable predicates with rendering. |
| 18 | M / source | Marquee selects every overlapping item AABB, including hidden roofs or unrelated items in Services. Generic hit testing also does not consistently mirror framing visibility. | Apply the same eligibility predicates to point hit, marquee, object lists, and snapping. Decide crossing versus containment selection and show the mode. |
| 19 | M / source | No drag threshold exists for move/resize/rotate. Pointer jitter triggers model work immediately. Smart guides or hosting can cause jumps on the first tiny movement. | Add a screen-space activation threshold, preserve click selection, and begin transformations only after activation. Test mouse, pen, and touch. |
| 20 | M / source | Space-to-pan checks `e.code` on a pointer event, without tracking Space key state. Keyboard tool shortcuts can choose tools hidden/disabled for the active workspace. Modifier shortcuts can fall through into tool activation. | Maintain explicit temporary pan key state and enforce workspace capabilities in `setTool`, not just button visibility. Exclude modified shortcut fallthrough. |
| 21 | M / source | Snapping uses a fresh nearest candidate every move, without hysteresis, target indication, or temporary override. Invisible/hidden items remain candidates. It favors axis-aligned wall guides and AABBs. | Filter visible targets, cache candidates, add acquisition/release tolerances, indicate the snapped feature, and support precision/axis-lock modifiers. Later add rotated/local-axis and endpoint snapping. |
| 22 | M / source | Group operations only cover items. Rotate toolbar/context commands act on the primary item even when a group is selected. There is no group scale, alignment/distribution, persistent grouping, or mixed wall/item selection. | Define capabilities for group commands; operate on the complete selection or disable unsupported commands. Add group scale about a pivot before expanding to mixed constrained entities. |
| 23 | M / source | Arrow-key repetition checkpoints, redraws, rebuilds the inspector, and queues saves for each keydown. One held key can create many undo steps and heavy DOM work. | Group a held-key nudge into one transaction, finalize on keyup/blur, and update readouts without reconstructing the inspector. |
| 24 | M / source | Item resize has corner handles only; room/dimension/service editing lacks appropriate handles. Hover cursor uses one diagonal resize cursor for all item corners/rotations; wall/beam handle feedback is missing from the shared hover branch. | Add edge handles and entity-specific cursor directions. Show live dimensions/angle/delta and fixed-anchor feedback. Keep handle hit areas usable at low zoom and avoid overlap on tiny items. |
| 25 | M / source | Service route editing requires redrawing the route or typing all vertices. No vertex drag, segment move, vertex insertion/deletion, rubber-band next segment, or undo-last-draft-point operation is provided. | Add a route editing mode with vertex/segment handles and a draft-local undo stack. Validate geometry on commit. |
| 26 | M / probe | Route “uniform scale” changes horizontal bounds and item height but leaves vertex z offsets and diameter unchanged. Its meaning is ambiguous for installation layouts. | Define footprint scale versus full spatial scale. For full scale, transform all vertices about a pivot; decide whether diameter remains an engineering property. Label the mode clearly. |
| 27 | M / source | 3D movement requires Shift, lacks a touch equivalent, and does not provide direct rotate/resize handles. All-floor move is disabled; lookup resolves the active floor only. | Expose Move/Rotate/Scale modes and floor-aware entity lookup. Use touch-operable gizmos; keep all-floor manipulation explicitly constrained until supported. |
| 28 | L / source | Single-object labels/handles can fall outside the viewport; overlapping entities have no cycle-through selection. Touch has no dedicated additive selection or context menu action. | Clamp essential feedback; add overlap cycling/object-list targeting and explicit touch selection controls. |
| 29 | M / source | 2D gesture lifecycle lacks `lostpointercapture`/window-blur handling. Tool/view/floor changes can replace the interaction without consistently finalizing or canceling it; route drafts also need invalidation when their floor/object context changes. | Route every context switch through cancel/commit. Clean up pointer maps, capture, guides, draft UI, and pending edit sessions. |

Sources: `js/structural-workspace.js:74`, `js/app-state.js:53`, `:59`, `js/structural-workspace.js:71`, `js/pointer-interaction.js:115`, `:155`, `:58`, `js/ui-wiring.js:118`, `:147`, `:280`, `js/canvas-drawing.js:595`, `js/services.js:46`, `renderer3d.js:1577`.

### Performance and maintainability

| ID | Priority / evidence | Gap and user effect | Required improvement / acceptance check |
|---|---|---|---|
| 30 | M / source | 2D pointermove and wheel invoke synchronous full redraws. Each draw also invokes the studio shell wrapper. Multiple events can redraw the same state before a display frame. | Coalesce rendering into one requestAnimationFrame task using the latest pointer state. Keep commit logic independent of scheduling. Count redraws and input-to-paint latency. |
| 31 | M / source + benchmark | `findEntity` creates a combined collection and scans it for every lookup. Group move/rotate repeats lookup for each selected item, approaching quadratic work for large selections. | Maintain an ID map by floor and resolve gesture targets once at start. Refresh references when replacing project state. |
| 32 | M / source + benchmark | Smart guides rebuild all item bounds/candidates on every movement, then compare them to moving edges. Selection bounds, structural joint lookup, and shell object-tree signatures also repeatedly scan collections. | Cache immutable gesture candidates; index entities/relationships. Invalidate caches using geometry/collection versions rather than unrelated redraws. |
| 33 | M / source + benchmark | Wall-face tracing tests every wall pair. Moving a wall in a floor with traced rooms can retrace on every render update. Architecture endpoint propagation also scans wall neighbors. | Index junctions/intersections; update affected relationships during preview and defer expensive face reconstruction to commit or a bounded preview rate. Preserve live feedback without blocking pointer input. |
| 34 | M / source | The 2D renderer repaints grid, all entities, shadows, text, and overlays without viewport culling. `syncShell` updates DOM and computes tree signatures on every wrapped draw. | Cull offscreen entities, cache grid/static layers or symbols where beneficial, and separate canvas rendering from shell updates. Profile shadow/text cost before disabling visual quality. |
| 35 | M / source | 3D drag rebuilds the inspector on every changed movement and calls draw → scene synchronization. Every scene update scans/signatures all records, recreates selection helpers, updates sunlight/reflections, and may recompute bounds. Walls share one floor-wide geometry record. | Update dragged transforms and lightweight readouts directly; rebuild inspector on commit/selection. Use dirty entity IDs, separate selection/camera/lighting updates, and rebuild only affected wall sections. Preserve the existing geometry cache and idle loop. |
| 36 | M / source | Whole-project JSON snapshots are created on every 2D pointer-down, including navigation. History uses full snapshots, up to 40. Saves write the active project and serialize the library with recovery copies synchronously. | Start snapshots only for activated edits; measure memory and storage cost. Keep full snapshots initially for reliability, then consider compact commands/deltas. Batch committed saves and avoid rewriting unchanged recovery data. |
| 37 | M / source | Drawing/inspector/selection/save functions are monkey-patched by multiple modules; some earlier lexical calls or captured bridge references bypass later wrappers. Update ordering and workspace behavior are difficult to reason about. | Introduce explicit update phases/events: model edit, dependency sync, history commit, selection, render, inspector, persistence. Keep wrappers as migration adapters until callers are consolidated. |
| 38 | M / test review | Existing tests cover useful model and browser workflows but do not systematically verify transform invariants, pointer ownership, interrupted gestures, 3D no-op history, lock bypass, or performance distributions. The preceding change-tracking test uses several stubs. | Add real browser gesture integration tests plus pure geometry invariants. Keep deterministic cancellation/history checks and add synthetic large-plan performance scenarios. |

Sources: `js/ui-wiring.js:147`, `:275`, `js/app-state.js:59`, `js/pointer-interaction.js:58`, `js/architecture.js:44`, `:77`, `js/canvas-drawing.js:761`, `js/studio-ui.js:70`, `:158`, `renderer3d.js:1389`, `:1640`, `js/project-library.js:6`.

## Measured CPU scaling

Synthetic fixture: N ordinary items plus N parallel walls on one floor. Each operation was warmed up; medians below are from repeated runs in Node v24.19.0 on this Windows host. Group lookup resolves all N items with the existing `findEntity` path. Smart guides process one moving item. Wall tracing uses the real `wallFaces` algorithm on parallel segments. The VM and synthetic fixture affect absolute timings.

| N items + N walls | JSON size | Serialize project | Resolve N group targets | Smart guides | Wall-face tracing |
|---|---:|---:|---:|---:|---:|
| 100 + 100 | 17 KB | 0.077 ms | 0.806 ms | 1.400 ms | 2.427 ms |
| 500 + 500 | 87 KB | 0.381 ms | 16.421 ms | 6.549 ms | 44.682 ms |
| 1,000 + 1,000 | 175 KB | 0.930 ms | 62.161 ms | 12.992 ms | 176.135 ms |

The group lookup and tracing paths show much worse scaling than serialization in these fixtures. A 60 Hz display provides approximately 16.7 ms for an entire frame, including drawing and browser work. At 500 targets, lookup alone reaches that budget in this probe; at 500 walls, tracing exceeds it. These results support prioritizing lookup/indexing and bounded dependency work before a complex history/storage rewrite. Larger or richer project serialization still requires measurement.

## Recommended implementation order

1. **Edit integrity and transforms.** Fix resize anchor/grab offset/minimums, finite scale validation, primary selection, locks, and dimension offsets. Add invariant tests first. Consolidate 2D/3D begin/update/commit/cancel behavior and prevent saving previews. Acceptance: no-op/cancel preserves history, redo, model, and persisted state; one completed operation creates one history action.
2. **Gesture consistency.** Add screen-space activation thresholds, pointer ownership, pinch transitions, context-switch cancellation, Space pan, axis lock, precision/snap override, and capability checks. Acceptance: the same action behaves predictably across mouse, touch, pen, keyboard, and workspaces.
3. **Rendering and dependency scheduling.** Use one queued paint per frame; make rendering read-only; index entity/junction lookup; cache guide candidates; separate shell/inspector updates; defer expensive tracing until an appropriate phase. Acceptance: interaction stays within measured budgets on defined small/medium/large fixtures without changing geometry semantics.
4. **Complete element manipulation.** Add structural handles/grid editing, constrained openings, room/dimension controls, route vertex tools, coherent group operations, and 3D gizmos. Acceptance: each supported element has a documented select/edit/move/resize/rotate/scale/copy/delete matrix, with unsupported operations disabled or explained.
5. **Profile remaining costs.** Measure canvas shadows/text, culling/layers, 3D wall geometry/reflections, storage quota/library serialization, and history memory. Optimize only the measured bottlenecks; retain existing rendering quality and offline compatibility.

## Validation plan

Use isolated browser storage. Cover desktop 1440 px, tablet 820 px, mobile 390 px; mouse, actual touch, and pen where available. Fixtures should include rotated furniture, small service objects, hosted openings, connected walls/traced rooms, anchored dimensions, locked structural members, grids, vertical service routes, overlapping/hidden objects, and multi-floor 3D.

For each operation, verify geometry validity, pivot/anchor invariants, relationship integrity, selection consistency, one-step undo/redo, canceled state, autosave timing, and JSON round-trip compatibility. Include pending-save-during-drag, keyboard auto-repeat, pointercancel/lost capture/blur, pinch transitions, floor/workspace switches, and return-to-origin gestures.

Record p50/p95 frame time, pointer-to-paint latency, event/paint counts, long tasks, entity lookup/dependency-sync time, DOM rebuild counts, 3D geometry/transform counters, save duration, and retained memory. Define performance targets against named devices and project sizes; do not infer browser FPS from the Node table.

Provisional target: on the agreed reference desktop and representative medium plan, keep p95 interaction CPU work below one 60 Hz frame budget, avoid work beyond 50 ms during drag, and perform no whole-inspector reconstruction or storage write inside an active gesture. Validate the target with real traces before treating it as a release guarantee.

## Changes produced by this audit

- This report.
- `validation/interaction-audit.cjs`: isolated probes and microbenchmarks; prints JSON to stdout.
- `validation/interaction-audit-results.json`: captured results from the run described above.

The preceding autosave implementation remains in the working tree. No additional application fixes were made as part of this analysis.
