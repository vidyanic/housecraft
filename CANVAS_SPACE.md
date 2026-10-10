# Canvas space revision

The previous shell reserved 158 px above the desktop drawing and 34 px below it, with two permanent side docks. At 1440 × 900 the stage was about 868 × 708. The compact shell reserves one 48 px workspace header, giving a 1440 × 852 stage. Expand mode removes that header too. These are drawing surface bounds; visible overlays can cover part of the drawing.

## Critique before implementation

| Idea | Benefit | Critique |
| --- | --- | --- |
| Merge all three toolbar rows | Reduces height | Too many competing file, drawing and workspace commands in one row, particularly on touch screens. |
| Hide all navigation by default | Maximum space | Weak discoverability and no persistent workspace identity. |
| Compact header with canvas overlays and an expand mode | Keeps workspace identity while reclaiming drawing space | Requires explicit touch toggles, keyboard access and careful focus retention. Selected. |

## Interaction rules

- Architecture, Structure, Services and 3D remain in one 48 px header. Project actions reveal as an overlay.
- Drawing commands float at the canvas top. Tools toggles their visibility. Floor selection, add floor, zoom and Expand canvas sit at the bottom.
- Library and Properties are overlays on every screen size, including mobile. The canvas stays visible behind them. Opening or hiding a sheet does not change stage bounds, canvas bitmap size or camera position.
- Fine mouse hover reveals a surface. Leaving schedules a 450 ms hide, allowing travel from its handle to its controls. A focused field or an open dialog prevents automatic dismissal.
- Touch uses explicit tap toggles and panel close buttons. Hover from touch events is ignored. Keyboard activation enters the revealed controls; Escape closes and returns focus to the handle.
- Expand canvas hides all four surfaces, the workspace header and the drawing annotations/controls. Compact reveal handles, View controls and Restore workspace remain available. Project reveals workspace navigation in this mode. Escape restores the workspace when outside a panel.
- Expand/restore changes the actual stage dimensions and resizes the canvas once. Reveal/hide performs no resize. Model geometry and history remain unchanged.

The visual critique found and removed an inherited two-row mobile navigation rule, avoided hover followed by click immediately closing a panel, and ensured a toolbar does not disappear while its dialog is open.

Validation covers desktop 1440 px, tablet 820 px and mobile 390 px, stable overlay bounds/camera/bitmap, touch toggles, focused-input retention, mouse reveal/dismissal, Escape focus return and expand/restore.
