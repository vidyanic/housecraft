# Canvas interaction: research, implementation and browser verification

10 October 2026. This follows the historical baseline in `CANVAS_INTERACTION_AUDIT.md`. Changes were applied in successive batches, checked in an isolated browser project, reviewed for failures and refined. The working project and production storage were preserved.

## Control research and decisions

| Reference | Useful control idea | Decision for Atelier Plan |
|---|---|---|
| [Figma scale tool](https://help.figma.com/hc/en-us/articles/360040451453-Scale-layers-while-maintaining-proportions) | Proportional scaling, numeric multiplier and an explicit fixed anchor | Keep resize distinct from uniform scale. Fix the opposite resize anchor; scale a selected item group around its shared center. Reject invalid input before history mutation. |
| [FigJam resize controls](https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam) | Side handles and Shift-constrained proportions | Add side handles to rectangular objects, retain corner/aspect resizing and provide directional cursor feedback. |
| [SketchUp move](https://help.sketchup.com/en/sketchup/moving-entities-around) | Reference points, axis inference locks and precise measurements | Add Shift dominant-axis movement and Alt temporary snap bypass. Keep existing numeric properties. Full inference-point selection and typed distances during a gesture remain future work. |
| [SketchUp iPad move](https://help.sketchup.com/en/sketchup-ipad/move-tool) | Explicit Move tool and touch-oriented operation | Add a visible 3D Move/Return to orbit command so moving does not require a keyboard modifier. Keep unsupported 3D entity types constrained. |
| [Sweet Home 3D guide](https://www.sweethome3d.com/users-guide/) | Dedicated furniture handles, wall endpoints and temporary magnetism override | Extend entity-specific handles and snap override. Preserve wall hosting and architectural relationships rather than applying unrestricted transforms to every entity. |

These are adaptations based on documented controls, not measured performance comparisons against the products. The comparison does not claim feature parity.

## Critique and correction loops

1. **History and persistence:** immediate checkpoints conflated selection with editing, and pending saves could persist a preview. Added shared begin/commit/cancel transactions, final-state comparison, no-op checkpoint settlement and deferred preview saving. Verified click, jitter, snapped no-op, return-to-origin, cancellation, redo and close flushing.
2. **Geometry:** aspect correction and snapping changed dimensions after the center was calculated, causing anchor drift. Recomputed the center from the fixed anchor and final dimensions, retained the pointer grab offset, clamped corner crossing and preserved small valid fixtures. Tested every corner on rotated objects and padded handle starts.
3. **Gesture ownership:** a second touch could strand a partial object edit. Added pointer ownership, mouse/touch activation thresholds and rollback before pinch. Added cancellation on context switches, lost capture and blur; added Space pan, Shift axis lock and Alt snap bypass.
4. **Performance:** the baseline performed 97 draws for 96 move events. Added frame-coalesced paints, offscreen item culling, indexed entity lookup, cached guide candidates, indexed structural joints and a broad-phase wall intersection sweep. Deferred room-face rebuilding until commit while keeping relationship preview updates.
5. **Element coverage:** the structural pointer interceptor prevented direct edits, Services selected invisible occluders, grids lacked entity lifecycle support, and associative dimensions lost movement. Routed structural editing through shared gestures, filtered hits before ranking, added grid move/delete/undo and dimension offset/end controls. Added service vertex/segment editing, midpoint insertion and vertex removal.
6. **Group and 3D operations:** group scale and reverse rotation affected inconsistent targets; 3D used a separate cancellation/history path. Added common-pivot item group scale/rotation in both directions, finite scale validation, spatial route scaling and shared 3D transactions. Stopped rebuilding the inspector during 3D movement and stopped geometry updates from recentering the camera.
7. **Touch critique:** expanding hit targets alone made small fixtures impossible to move because handles occupied their centers. Reserved the central area for movement and tested the small-fixture touch target explicitly.
8. **Final review:** found duplicate grid counts, wheel changes during drag and repeated shell attribute/tree work during paints. Fixed the counts, blocked wheel zoom during an active gesture and deferred shell synchronization during activated previews. Added checks for each. The measured desktop frame interval improved after shell deferral, but remains variable.

## Measured results

The browser harness dispatches real browser `PointerEvent` objects with mouse/touch pointer types, 96 moves in 12 batches of eight separated by animation frames. It measures synchronous event handling, draw calls and batch-start to animation-frame callback time. The latter includes browser scheduling; it is not a GPU presentation timestamp or an end-to-end input latency trace. Synthetic tests temporarily stub pointer capture for their synthetic pointer IDs. Native mouse drags were also performed separately with real capture.

Initial same-width comparison at a 1,233 px app viewport:

| Items / input | Draws before → after first optimization | Handler p95 before → after | Batch-to-frame p95 before → after |
|---|---:|---:|---:|
| 100 / mouse | 97 → 12 | 4.6 → 0.2 ms | 47.6 → 18.5 ms |
| 100 / touch | 97 → 10 | 2.3 → 0.2 ms | 19.0 → 18.9 ms |
| 500 / mouse | 97 → 12 | 8.1 → 0.2 ms | 78.3 → 18.7 ms |
| 500 / touch | 97 → 10 | 6.0 → 0.2 ms | 66.6 → 19.4 ms |

The latest desktop measurement at an actual 1,440 px iframe width recorded handler p95 0.3–0.5 ms, 11–13 draws for 96 moves, and batch-to-frame p95 17.7–35.3 ms. Preview dependency updates were 9–11 rather than one per move, and selection serialization was zero. The harness preserves the requested iframe width even when the outer browser is narrower, avoiding a misleading desktop label. Earlier desktop repeats reached 58–77 ms on the 500-item fixture. Absolute timings vary with viewport, host load and browser instrumentation. This is evidence of less redundant work, not a 60 fps release guarantee. Desktop/tablet/mobile raw measurements are in `validation/interaction-profile-*.json`.

The independent Node microbenchmark retains the original fixture: 1,000 items plus 1,000 parallel walls. Indexed target lookup and the wall broad phase substantially reduce their previous ~62 ms and ~176 ms medians. See `validation/interaction-audit-after.json` for this run, and `interaction-audit-results.json` for the unchanged baseline. Parallel walls favor broad-phase rejection; dense intersections can still approach quadratic cost. The standalone smart-guide probe does not exercise a persistent gesture cache and still scans the full candidate set.

## Verification

- 54 interaction checks passed at each app width: 1,440, 820 and 390 px, including the application runtime-error check. Raw results: `validation/interaction-checks-{desktop,tablet,mobile}.json`.
- All 46 browser workflow groups passed on the follow-up code.
- All 9 application regression groups passed, including analytic rotated bounds against transformed corners. Change-tracking checks passed. The last engineering run passed 17 benchmark groups. All application scripts parsed; `git diff --check` passed.
- Native desktop mouse movement and corner resizing were visually checked: the table moved to (140, 120), then resized to 130 × 70 while retaining that opposite anchor. Responsive screenshots are in `validation/interaction-*.jpg`.
- Touch checks use browser-dispatched touch pointer events. No physical touchscreen, pen, device CPU/GPU trace or retained-memory profile was available in this run. Physical-device gesture latency and browser-native multi-touch capture still require device validation.

Repeat with `node server.cjs`, open `http://127.0.0.1:4173/tests/interaction-profile.html`, choose the app width, and run **Verify interaction invariants** or **Profile mouse and touch**. Use **Prepare manual canvas demo** for actual pointer interaction. The page uses isolated test storage.

## Audit coverage and remaining gaps

| Original audit IDs | Current status |
|---|---|
| 01–10 | Core corrections implemented: fixed anchors/grab offset/minima, scale validation, selection primary, shared 3D history, unsupported 3D movement guards, transformation locks, pinch ownership and preview persistence. Per-type capability policy can be expanded beyond the current lock/derived-room guards. |
| 11 | Read-only 2D rendering implemented: relationships update in an explicit model phase, and structural analysis returns cached annotations rather than writing member status into saved data. Tests repaint all three workspaces with pending relationship changes and verify unchanged model bytes. |
| 12–13 | Copy relationship remapping/detachment and associative dimension movement implemented. Larger mixed-entity copy workflows need broader fixtures. |
| 14 | Hosted openings now project movement onto the current wall, clamp width/station to its ends and expose width-only handles. Properties provides station and Attach/Detach controls. Detached mode survives save/load. Free rotation/scale remain unavailable while attached. |
| 15–18 | Shared structural gestures, grid lifecycle and workspace/layer-aware hit/marquee filtering implemented. Structural elevation/section views still need their own manipulation policy. |
| 19–21 | Core pointer ownership, pinch rollback, temporary pan, workspace tool guards, axis/snap modifiers and guide hysteresis implemented. Explicit local/plan axes, stable Shift locking and direction/distance guides now implemented. Full inference-point/target selection remains. |
| 22 | Item group scale/rotation, rotated-bounds alignment, equal-gap distribution and complete-selection stacking implemented with lock/no-op guards and one undo. Persistent and mixed-entity groups remain. |
| 23–24 | Held-key transaction, edge/entity handles and cursor feedback implemented. Expanded live angle/anchor feedback and handle placement outside viewport bounds remain. |
| 25–26 | Route vertex/segment drag, insert/remove vertices, vertical route scaling, draft rubber-band preview and local draft undo/redo implemented. Route Properties now distinguishes footprint-only and spatial scaling; pipe diameter stays an engineering property. Group scaling retains its spatial default. |
| 27–29 | Touch-accessible 3D Move/Rotate/uniform Scale modes with pivot guides, live values and shared transactions implemented. Scale previews reuse meshes until commit; cancel/no-op reset the preview. Second touch cancels ownership. 2D additive touch selection and overlap cycling implemented. Independent 3D axis/elevation handles, 3D groups and all-floor transforms remain. |
| 30–35 | Core scheduling/index/cache/culling/room-tracing improvements implemented. Pinch paints now share frame scheduling and retain the final release paint. Static canvas layers, wider entity culling, dirty-ID 3D updates, wall-record splitting and lighting/reflection cost still require profiling. Other navigation/3D paths retain synchronous work. |
| 36–37 | Unchanged/preview saves avoided; update phases partially consolidated. Pointer-down arms a lightweight transaction; snapshots/history copies start only before an activated transform. Click/jitter tests verify zero project serializations, and 2D/3D move dependencies run once per queued preview frame. The profiler records click cost, snapshot cost and encoded undo payload. Retained-heap/storage quota workloads and explicit phase/event migration remain. |
| 38 | Added deterministic browser transform/history/lifecycle coverage and reproducible mouse/touch workloads. Physical devices, GPU traces, long-task attribution and memory/large real-project workloads remain. |

Next optimization should measure drawing/dependency/3D costs separately on representative real plans before adding static layer caches or replacing history snapshots. The known gaps above remain an explicit backlog; this pass does not claim that all 38 audit findings are fully closed.

## Sequential follow-up critique

The follow-up prioritised removing hidden mutations before adding controls, then wall-hosted constraints, group arrangement, route draft lifecycle, touch selection and 3D transforms. Existing walls, relationships, locks and undo rules constrain each operation. Arbitrary transforms on hosted openings were rejected because they conflict with the wall model. Group distribution retains the outer objects and refuses negative gaps. Route draft undo is local until Finish, so an unfinished route never replaces project history. Horizontal 3D gestures provide touch-accessible rotation and uniform scale; the ring/cross guides are visual pivot cues, not independent draggable axes. Mesh scaling previews the same pivot and returns to unit scale on rebuild after cancellation.

Each batch added behavioral browser checks before proceeding. The responsive critique found overlapping 3D instructions and a Properties overlay hiding the canvas after choosing a transform. The final view uses one mode badge above the corner controls, and transform commands reveal the canvas. Remaining work is explicitly listed above rather than treating a passing fixture as proof of physical-device smoothness or closure of the entire audit.

## Snapshot and dependency performance follow-up

The next critique found two costs hidden behind the existing no-op correctness: a click serialized the entire project despite creating no undo entry, and every pointer event performed relationship synchronization before the coalesced paint. `armEdit` now retains navigation state and marks a pending gesture without copying the project/history. `beginEdit` captures the original model before the first activated mutation. Commit/cancel of an unactivated gesture safely ends the lightweight transaction. Keyboard nudges still capture immediately before mutation. New editing paths must activate before changing model fields.

`requestDraw` now queues both relationship updates and drawing together. 3D Move shares that path while its mesh still follows the pointer directly. Commit remains an explicit synchronization boundary, so rapid release before a queued frame and canceled previews retain their existing model/history behavior. Bounds now use analytic rotated half-extents instead of allocating corners and coordinate arrays for every culling/guide/collision query; actual handle/anchor geometry still uses corners.

The desktop fixtures made zero full-project serializations for eight repeated clicks. One undo snapshot encoded 25,237 bytes for 100 items and 118,127 bytes for 500 items. The latter would total about 4.7 MB of UTF-8 payload over 40 similarly sized entries; this is an encoded-size estimate, not retained JavaScript heap usage. Selection still draws and updates UI, so zero snapshot work does not imply zero click latency. Raw CPU probes compare analytic/corner bounds within the same VM and retain the original lookup/wall fixtures; their results are not browser FPS measurements.

## Route scale follow-up — 11 October 2026

Route Properties now places a Scale dimensions selector directly above Uniform scale. The default scales footprint and vertical runs; footprint-only scales X/Y about the existing shared center while preserving vertex elevations and height. Neither mode changes diameter or base elevation. The selector is transient and resets on inspector rebuild. The generic field checkpoint listener initially treated this selector as an edit; the new browser check exposed it, and the selector is now excluded. Visual review moved the selector beside the scale input instead of separating it in the route vertex section. Mixed item groups retain existing spatial scaling; this change adds no persisted fields.

## Highest-value follow-up — precise movement and touch navigation

11 October 2026. Prioritization is based on the project's remaining gaps and editing workflows, rather than a claim of measured competitor parity. Precise movement was chosen first because repeated X/Y corrections affect every placement task and keyboard-only constraints exclude touch users. Properties now provides free, plan X/Y and primary-object X/Y directions for unlocked unattached items and item selections. The selected direction controls pointer projection and signed numeric distance. Numeric moves use project units, validate before mutation and apply once; typing and direction changes do not checkpoint or save. Membership/primary changes reset direction. Hosted openings retain their wall constraint, and structural members retain existing policies.

Shift in free movement now latches the first dominant axis until released. Previously dominance could switch mid-drag. Explicit constraints snap projected distance instead of independently snapping X/Y, preserving rotated axes; smart guides cannot pull the result off that axis. A canvas line, origin mark and signed distance identify the active direction. Group members receive the same translation and retain their spacing. Move on canvas closes the touch sheet and exits additive selection. The guide disappears at commit/cancel. These are explicit direction controls; they do not implement arbitrary reference-point inference.

Pinch navigation was the next small, high-value scheduling correction: raw touch moves previously painted synchronously. Eight moves now queue one paint; a release before that paint schedules the final state after clearing gesture ownership. No model or undo changes are introduced by 2D pinch.

Remaining priorities after this batch:

| Priority | Gap | Value and constraints |
|---|---|---|
| 1 | Persistent furniture groups | Avoid rebuilding selections for room arrangements. Requires validated member IDs, copy/floor remapping, deletion cleanup, import compatibility and undo; mixed structural/architectural groups should follow a separate relationship policy. |
| 2 | Large-plan render/dependency phase profiling and targeted 3D updates | Highest remaining performance opportunity. Measure real wall/service-heavy scenes, isolate drawing/dependency/scene costs, then optimize dirty IDs or static layers where evidence supports it. Avoid adding cache invalidation complexity without that evidence. |
| 3 | Direct 3D axis/elevation manipulation and group transforms | Reduce repeated inspector edits for vertical placement and arrangements. Must preserve hosted restrictions, local floor elevation, camera state and one-undo/cancel rules. |
| 4 | Reference-point inference, live angle/anchor feedback and viewport-edge handles | Improve exact alignment, rotation and access when handles leave the viewport. Needs richer hit/target feedback and touch-safe controls. |
| 5 | Physical-device and retained-memory/storage validation | Validate sustained gesture latency, native multi-touch/pen capture and large undo/save workloads. Synthetic events and encoded snapshot sizes do not establish these outcomes. |

Fresh desktop mouse/touch profile on 100/500 items: handler p95 0.4–0.6 ms, 11–13 draws and 9–11 dependency updates for 96 moves, zero click project serializations and one undo. Batch-to-frame p95 was 46.6–62.7 ms, higher than the previous run and within the historical variability seen on this host. This batch establishes interaction correctness and removes redundant pinch paints; it does not establish an FPS improvement. The movement profile uses the free-movement workload; constrained-guide rendering needs a separate sustained workload. Raw data: validation/movement-profile-desktop.json.
