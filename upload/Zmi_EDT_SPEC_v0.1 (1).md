# Zmi EDT — Product & Engineering Specification
## Version 0.1 — Batch Image Editor

> **Purpose:** This document is the source of truth for implementing Zmi EDT.
> Build incrementally. Do not attempt to implement every feature in one pass.
> After each milestone, run/build/test the application before moving on.

---

## 1. Product Goal

Zmi EDT is a browser-based image editor designed around a specific workflow:

- Import many images by drag & drop.
- Display each image as an independent floating editor window.
- Choose one window as **MAIN**.
- Editing MAIN can broadcast supported actions to all currently active batch windows.
- Any individual window can be edited independently.
- Windows can be temporarily excluded from batch operations without deleting them.
- Inspect the whole workspace or temporarily hide editor chrome with **Ngắm waifu** mode.
- Export one image, all images, or the active batch as individual PNG files or a ZIP.

The product is **not** intended to become Photoshop. Prioritize reliability, predictable state, and the batch workflow.

### Primary use case

The user has many images with the same aspect ratio and wants to normalize/edit them together while retaining the ability to make per-image corrections.

---

# 2. Design Principles

1. **Batch operations must be explicit and predictable.**
2. **Individual edits must never unexpectedly modify other windows.**
3. **MAIN is the source of batch actions.**
4. **Excluded windows remain in the workspace but do not receive MAIN batch actions.**
5. **Every meaningful edit must be undoable.**
6. **Do not destroy source data unnecessarily.**
7. **Do not add large features unless they support the core workflow.**
8. **Prefer deterministic pixel/coordinate behavior over clever automatic behavior.**
9. **Keep modules/components separated so one feature can be implemented without rewriting unrelated features.**
10. **The application must remain usable even when a later feature is unfinished.**

---

# 3. Workspace Model

The application contains a workspace with zero or more image windows.

Each window represents one imported image/document.

A window has at least:

```text
Window
- id: unique internal ID
- fileName
- sourceImage
- canvas/document state
- position: x, y (workspace coordinates)
- size: window width/height
- isMain: boolean
- isBatchEnabled: boolean
- isSelected: boolean
- layers
- history
```

### Window lifecycle

```text
Drag/drop image
    ↓
Create window
    ↓
Window becomes available in workspace
    ↓
User can:
    - move it
    - select it
    - exclude/include it in batch
    - make it MAIN
    - edit it
    - close/delete it
```

Closing a window removes it from the current workspace. It should not silently delete the original uploaded asset from the uploaded-file library.

---

# 4. Import / Drag & Drop

## Required behavior

The user can drag supported image files into the application.

There are two distinct import semantics:

### Drop onto workspace

- A supported image dropped onto an empty workspace is imported as a **new document/window**.
- Multiple files dropped at once create multiple windows.

### Drop onto an existing window

- A supported image dropped onto an existing window is imported as a **new image layer/element in that window**.
- It must NOT create another editor window.
- The target window should visibly indicate that it is the current drop target.

The UI should also provide a `+` control on each window for adding an asset/layer without drag & drop. At minimum:

```text
+
├── Import image as layer
├── Add text
└── Create empty layer
```

Importing a layer is local by default, including when the target is MAIN. It does not automatically broadcast to the batch. If the user wants the new layer applied to the batch, that must be an explicit batch action.

## Initial supported formats

At minimum:

- PNG
- JPG/JPEG
- WebP

SVG can be added later if the rendering architecture supports it cleanly.

## Same-ratio assumption

The primary workflow assumes images use the same aspect ratio.

The editor does not need to automatically normalize arbitrary aspect ratios in v0.1.

If an image has a different ratio, warn the user rather than silently stretching it.

## Important

Never modify the original uploaded file merely because the user edits the canvas.

The document should have its own editable state.

---

# 5. Window Controls

Every image window has:

- title / filename
- `_` control
- `X` control

## `X` — Close window

Removes the window from the workspace.

If the window is not MAIN:
- close immediately or with a lightweight confirmation if unsaved changes are involved.

If the window is MAIN:
- show a confirmation dialog.

Suggested message:

> Are you sure?
> This window is currently MAIN. Closing it will remove it from the batch workspace.

After MAIN is removed:
- choose another eligible active window as MAIN automatically if possible.
- otherwise MAIN becomes null.

Never leave the application in an invalid state.

## `_` — Toggle batch participation

This is NOT a normal minimize button.

It means:

> Toggle whether this window participates in MAIN batch operations.

When excluded:
- keep the window visible.
- keep all its edits/state.
- do not delete it.
- do not apply future MAIN batch operations to it.

The UI should visibly indicate excluded state.

Example:

```text
ACTIVE
Window participates in batch.

EXCLUDED
Window remains open but does not participate in batch.
```

---

# 6. Selection

There are two concepts:

### Selected window
The window currently being inspected/edited.

### MAIN window
The master window whose supported actions can be broadcast.

They are not necessarily the same concept internally, although selecting MAIN may also select it.

Only one window may be MAIN.

Only one window should normally be the active editing target at a time.

---

# 7. MAIN

MAIN is the core concept of the application.

The MAIN window receives a strong visual indicator, such as a highlighted border and/or `MAIN` badge.

Example:

```text
┌─────────────────────────┐
│ ★ MAIN              _ X │
│                         │
│          image          │
│                         │
└─────────────────────────┘
```

## Selecting MAIN

The `Chọn MAIN` feature lets the user choose the current MAIN window.

Selecting another window as MAIN:
- removes MAIN state from the previous window.
- adds MAIN state to the new window.
- updates the visual highlight.
- does not alter image content.

## MAIN batch rule

MAIN is the reference document for creating batch actions, but MAIN does **not** mean that every edit to the entire image is automatically copied.

For a batchable operation, the user selects a specific layer/element as the target. The resulting action is then applied to the corresponding target in all batch-enabled windows.

```text
MAIN
  ↓
select target layer/element
  ↓
perform batchable action
  ↓
create ONE batch action
  ↓
apply to corresponding target in all batch-enabled windows
```

Example:

```text
MAIN → select `Character` → Move X +3px, Y -1px

A Character       +3, -1
B Character       +3, -1
C Character       +3, -1
D Character       +3, -1
E excluded        unchanged
```

The batch target should therefore be explicit in the action model. Do not broadcast an ambiguous `Move` operation to an entire document unless the operation explicitly targets the canvas/document.

Excluded windows do not receive the action.

The MAIN itself is included.

## Status indicator

The workspace should show useful information such as:

```text
6 windows · MAIN: claude.png · 5 in batch
```

This is important because the user needs to know exactly how many documents will be affected.

---

# 8. Batch Semantics

Not every action should automatically be batchable.

Every action should declare whether it supports batch application.

Suggested action categories:

### Safe / naturally batchable

- move selected layer/element
- scale selected layer/element
- rotate selected layer/element
- flip selected layer/element
- delete matching layer/element
- add text with identical parameters
- some layer operations
- some crop operations if explicitly confirmed

### Batch target rule

A batchable action should carry an explicit target, for example:

```text
Action
├── type: MOVE
├── scope: BATCH
├── sourceWindowId: MAIN
├── targetType: LAYER
├── targetIdentity: Character
└── parameters: { x: +3, y: -1 }
```

For v0.1, batch transforms operate on the **selected layer/element**, not the whole image by default.

Target matching should use stable internal identity where possible. Layer name matching can be provided by Smart Batch as a more flexible matching strategy. If a corresponding target cannot be found, the application must not silently modify an unrelated layer.

### Usually local-only

- freehand drawing
- manual selection
- pixel-specific edits
- arbitrary brush strokes

The UI must make batch behavior clear.

A batch action should be represented as ONE logical history action, even though it affects many windows.

Example:

```text
MAIN:
Move +3px X

History:
[BatchMove +3px]

NOT:

[Move window 1]
[Move window 2]
[Move window 3]
...
```

This is essential for usable Undo.

---

# 9. Coordinate System

The main editing workflow assumes equal aspect ratios.

For transformations:

- use absolute pixel values by default.
- do not silently convert a user-entered `+1px` into a percentage.
- maintain a clear document/canvas coordinate system.

Example:

```text
x = 120
y = 80
width = 512
height = 512
rotation = 0
```

The UI should expose numeric values where precision matters.

Pixel-perfect editing is an explicit product goal.

---

# 10. Sidebar — `Di chuyển`

Purpose:

> Move editor windows in the workspace.

This mode affects the WINDOW, not the image contents.

Behavior:
- drag window → window moves.
- image coordinates remain unchanged.

This separation is mandatory.

The user must be able to move a floating window without accidentally moving the artwork inside it.

---

# 11. Sidebar — `Xem`

Read-only inspection mode.

Behavior:

- click a window → highlight it.
- zoom.
- pan.
- inspect artwork.
- no document modifications.
- no history entries are created.

Useful controls:

- Fit to window
- 100% zoom
- zoom in/out
- pan

`Xem` should be safe for inspection.

---

# 12. Sidebar — `Sửa`

`Sửa` opens a tool dropdown.

Suggested structure:

```text
Sửa
├── Vẽ
├── Xóa
├── Cắt
├── Text
└── Biến đổi
```

Do not implement unrelated advanced image-processing features in v0.1.

---

# 13. `Vẽ`

Freehand drawing.

Required:

- brush/freehand stroke
- brush size
- color
- drawing on the currently selected window/layer
- undo/redo

Optional later:

- opacity
- hardness
- eraser
- pressure sensitivity

## Batch rule

Freehand drawing should be local by default.

Do not automatically broadcast arbitrary mouse/stylus coordinates to other images.

If batch drawing is ever added, it must be an explicit action.

---

# 14. Color Picker

Used by tools that need a color.

At minimum:

- color selection
- hex input if practical
- visual color preview

The same color picker can be reused by:
- brush
- text
- future shape tools

Optional later:
- eyedropper/sample color from canvas.

---

# 15. `Xóa`

Delete the selected element/layer.

Behavior:

1. user selects an element.
2. presses delete or uses the tool.
3. element is removed.
4. operation creates an undo history entry.

## Batch behavior

If the element has a stable identity across documents, deletion can be batchable.

If the element is arbitrary pixel content, do not assume matching structure across documents.

## Smart Batch

Smart Batch is an explicit matching mode for applying an action to semantically matching layers/elements across documents. It is especially useful when the same layer name exists in multiple images but internal layer IDs differ.

Example:

```text
Smart Batch
Apply to all matching layers: [ Background ]
Action: Delete
```

Expected behavior:

- find the `Background` layer in each eligible document.
- apply the requested action only to matching layers.
- do not rely on layer index/position alone.
- if a document has no match, leave it unchanged and report the missing target.

Smart Batch must be an explicit user choice; normal batch editing remains target-based and predictable.

## MAIN deletion

If deleting an element from MAIN with batch enabled:
- if the action is batchable, warn that multiple images will be affected.
- require confirmation for destructive batch deletion if appropriate.

Suggested dialog:

> Are you sure?
> This action will affect 5 images.

---

# 16. `Cắt`

The UI should distinguish:

### Crop
Change the image/canvas bounds.

### Cut
Remove an element and optionally place it on an internal clipboard.

Do not overload `Ctrl+X` ambiguously.

Recommended:
- label the tool `Cắt ảnh` if it means crop.
- use `Ctrl+X` only if the intended behavior is standard Cut.

For v0.1, crop can be local by default.

Batch crop should be explicit because it can change canvas dimensions.

---

# 17. `Xem lớp`

Layer panel.

Minimum layer functionality:

- list all layers.
- select a layer.
- hide/show.
- reorder.
- rename.
- delete.

Example:

```text
Layers
──────────────
👤 Character
✦ Decoration
▣ Background
```

Keep the layer model simple in v0.1.

Do NOT implement:
- masks
- blend-mode systems
- adjustment layers
- complex grouping
unless needed later.

---

# 18. Text

Text element support.

Required properties:

- content
- font family
- font size
- color
- normal
- bold
- italic
- position
- resize/scale
- rotation

Suggested UI:

```text
Text: [__________]

Font: [Arial ▼]
Size: [24]
Color: [■]

Style:
[Normal] [Bold] [Italic]
```

Text is an editable layer/element, not permanently painted into pixels immediately.

## Batch

Adding/editing text from MAIN may be batchable when explicitly treated as a batch action.

Do not make every text interaction automatically affect all images.

---

# 19. `Biến đổi`

Core precision editing tool.

Properties:

- X
- Y
- Width
- Height
- Scale
- Rotation
- Flip horizontal
- Flip vertical

Example:

```text
X:        120
Y:         80
Width:    512
Height:   512
Rotation:   0°
```

Mouse dragging should update these values.

Numeric input should update the selected element precisely.

Supported transforms should be represented as actions so they can participate in batch and history.

---

# 20. Zoom / Pan

Needed in both inspection and editing.

Suggested controls:

- mouse wheel / trackpad → zoom
- space + drag → pan
- fit-to-window
- 100%

Zoom/pan state should NOT create document history entries.

---

# 21. Grid / Pixel Precision

Optional but recommended for v0.1.

When zoomed in:
- display a grid/pixel grid.
- allow the user to see exact alignment.

This is particularly useful for the project's icon-design use case.

Grid visibility is a view state, not document history.

---

# 22. `Ngắm waifu` 🫠

This is a viewing mode, not an editing tool.

Purpose:

> Hide editor UI/windows so the user can inspect the artwork cleanly.

When enabled:
- hide editor windows and/or editing chrome.
- show a clean workspace/preview.
- do not alter document data.
- do not create history entries.

Toggle again:
- restore the previous editor state.

This feature must not reset selections, MAIN, batch state, or edits.

---

# 23. `Tải về`

Export options:

```text
Tải về
├── Window hiện tại
├── Tất cả window
└── Tất cả window đang batch
```

Single image:
- download PNG.

Multiple images:
- package into ZIP.

Recommended ZIP filenames:

```text
chatgpt.png
gemini.png
claude.png
playstore.png
camera.png
settings.png
```

Preserve original filenames unless the user explicitly renames them.

Avoid automatic names like:

```text
image.png
image (1).png
image (2).png
```

when meaningful source filenames exist.

Export should not modify document state or create history entries.

---

# 24. Uploaded File Library

`Xem file đã upload`

Purpose:

> Reuse uploaded assets without importing them again.

Show:
- preview
- filename
- available files

Actions:
- view
- reuse
- drag into workspace
- delete from library

Important distinction:

### Workspace window
An active editable document.

### Uploaded asset
A reusable source file.

Closing a window should not necessarily delete the asset.

---

# 25. Undo / Redo

Both are required.

## Individual edit

If user edits a non-MAIN window locally:

```text
Window 17 history:
A → B → C

Undo
→ only Window 17 changes
```

## MAIN batch edit

If MAIN performs a batchable action:

```text
MAIN action
    ↓
apply to 5 active windows
    ↓
one batch history entry
```

Undo:
- revert the action on all affected windows.

Redo:
- reapply the same logical batch action.

## History isolation

Use separate histories or a carefully scoped action system so local edits do not accidentally get undone by another window's local history.

A good conceptual model:

```text
mainHistory = [
    batchAction1,
    batchAction2
]

windowHistory[id] = [
    localAction1,
    localAction2
]
```

The exact implementation can differ, but observable behavior must follow this rule.

---

# 26. Action System

All document modifications should ideally be represented by actions.

Example:

```text
Action {
    type,
    targetWindowIds,
    targetLayerId,
    before,
    after,
    batchId?,
    metadata?
}
```

Possible action types:

```text
MOVE
TRANSFORM
DRAW
DELETE
ADD_TEXT
EDIT_TEXT
CROP
LAYER_CREATE
LAYER_DELETE
LAYER_REORDER
LAYER_VISIBILITY
```

An action should contain enough information to undo and redo deterministically.

## Important

View-only state should NOT be an edit action.

Examples that should not enter document history:

- zoom
- pan
- selecting a window
- selecting a layer
- changing workspace window position
- toggling Ngắm waifu
- opening/closing panels

---

# 27. Batch Action Architecture

A batch action is one logical action with multiple targets.

Conceptually:

```text
BatchAction
- sourceWindowId = MAIN
- targetWindowIds = [1,2,3,4,5]
- action = TRANSFORM
- parameters = { x: +3, y: -1 }
```

The engine applies the action to each eligible target.

If a target cannot accept the action:
- do not corrupt the document.
- report/handle the failure deterministically.
- ideally skip unsupported targets while informing the user.

Do not silently partially apply a destructive action.

---

# 28. UI State vs Document State

Keep these separate.

## UI state

Examples:
- selected tool
- selected window
- MAIN ID
- batch enabled/disabled
- window position
- zoom
- pan
- sidebar state
- Ngắm waifu state

## Document state

Examples:
- pixels/elements
- layers
- text
- transforms
- canvas dimensions

This separation prevents UI interactions from polluting Undo/Redo.

---

# 29. Suggested Component / Module Structure

A possible React structure:

```text
src/
├── app/
│   ├── App
│   └── routes/
│
├── workspace/
│   ├── Workspace
│   ├── ImageWindow
│   ├── WindowManager
│   └── WindowControls
│
├── canvas/
│   ├── EditorCanvas
│   ├── CanvasRenderer
│   └── CoordinateSystem
│
├── tools/
│   ├── ViewTool
│   ├── MoveTool
│   ├── DrawTool
│   ├── DeleteTool
│   ├── CropTool
│   ├── TextTool
│   └── TransformTool
│
├── layers/
│   ├── LayerPanel
│   └── LayerManager
│
├── batch/
│   ├── MainManager
│   ├── BatchEngine
│   └── BatchRules
│
├── history/
│   ├── HistoryManager
│   ├── Action
│   └── UndoRedo
│
├── files/
│   ├── Upload
│   ├── AssetLibrary
│   └── Export
│
└── ui/
    ├── Sidebar
    ├── Dialog
    └── StatusBar
```

This is a guideline, not a requirement to create every file immediately.

---

# 30. Rendering Technology

If using Konva.js:

- use a stage/layer structure appropriate to each document.
- keep editor interaction state outside the rendered artwork where possible.
- avoid unnecessary React rerenders for high-frequency pointer movement.
- clean up event listeners and Konva nodes when a window is removed.

For draggable workspace windows, a library such as `react-rnd` may be used if it fits the project.

Do not introduce a second window-management system unnecessarily.

---

# 31. Performance Rules

The app may eventually contain dozens of windows.

Therefore:

- do not render huge duplicated image buffers unnecessarily.
- avoid rerendering all windows for a local edit.
- batch operations may update multiple documents, but UI updates should be controlled.
- clean up object URLs when no longer needed.
- avoid memory leaks from imported images.
- do not keep unlimited full-resolution bitmap copies in history if avoidable.

If history becomes memory-heavy, use action/state deltas rather than cloning entire images for every operation.

For v0.1, correctness is more important than premature optimization.

---

# 32. Error Handling

The app must fail gracefully.

Examples:

### Unsupported file

Show:

> Unsupported image format.

Do not crash the whole workspace.

### Corrupt image

Show an import error for that file.

Other imported images remain usable.

### Failed export

Show a clear error and allow retry.

### Failed batch action

Do not leave documents half-mutated.

Prefer transactional behavior:

```text
validate
→ apply
→ commit

if failure:
→ rollback
```

For complex operations where full transactionality is expensive, ensure partial failure is clearly reported.

---

# 33. Confirmation Dialog Rules

Do not spam confirmation dialogs for harmless operations.

Require confirmation for destructive/high-impact actions such as:

- deleting MAIN window
- deleting many elements through a batch action
- clearing many documents
- destructive crop affecting many images

Do not require confirmation for:

- selecting MAIN
- zooming
- moving a workspace window
- normal local edits with Undo available

---

# 34. Keyboard Shortcuts

Recommended baseline:

```text
Ctrl + Z       Undo
Ctrl + Y       Redo
Ctrl + Shift + Z  Redo alternative
Delete         Delete selected element
Ctrl + D       Duplicate selected element
Ctrl + X       Cut, only if Cut semantics are implemented
Ctrl + S       Optional project save later
```

Do not assign a shortcut to a function if it conflicts with standard browser behavior unless the app has a clear reason.

---

# 35. Milestone-Based Development

DO NOT implement the entire product in one AI coding request.

Recommended sequence:

## Milestone 1 — Workspace

- React app
- workspace
- drag/drop image
- create windows
- move windows
- close windows
- select window

## Milestone 2 — MAIN / Batch

- MAIN selection
- MAIN border/badge
- batch enabled/excluded state
- `_` behavior
- status bar

## Milestone 3 — Canvas / View

- render image
- zoom
- pan
- fit
- read-only Xem mode

## Milestone 4 — Transform

- move image/element
- scale
- rotate
- numeric values
- batch transform from MAIN

## Milestone 5 — Layers

- layer list
- select
- hide/show
- reorder
- rename
- delete

## Milestone 6 — Draw / Color

- brush
- size
- color
- local drawing
- undo

## Milestone 7 — Text

- add text
- edit text
- font
- size
- color
- normal/bold/italic
- transform text

## Milestone 8 — Delete / Crop

- delete elements
- crop
- confirmation for destructive batch operations

## Milestone 9 — History

- individual undo/redo
- batch undo/redo
- action-based history
- verify mixed local + batch edits

## Milestone 10 — Export

- current image
- all images
- active batch
- PNG
- ZIP

## Milestone 11 — Uploaded Asset Library

- reusable uploaded files
- drag from library
- asset management

## Milestone 12 — Ngắm waifu

- clean viewing mode
- preserve editor state

## Milestone 13 — Polish

- keyboard shortcuts
- grid
- empty states
- error messages
- performance improvements
- responsive layout
- accessibility improvements

---

# 36. Testing Strategy

After each milestone, test manually before adding the next feature.

## Minimum batch test

Use 6 images.

```text
A MAIN
B active
C active
D active
E excluded
F active
```

Perform:

```text
MAIN transform
```

Expected:

```text
A B C D F → changed
E → unchanged
```

Then:

```text
local edit C
```

Expected:
- C changes.
- A/B/D/F unchanged.

Then:

```text
MAIN another transform
```

Expected:
- A/B/D/F receive it.
- E remains excluded.
- C receives the batch action too, while preserving its previous local edit where mathematically appropriate.

---

# 37. Critical Mixed-History Test

This is one of the most important tests.

Sequence:

```text
1. MAIN batch move +3px
2. Local edit on window C
3. MAIN batch scale 90%
4. Undo MAIN scale
5. Undo local C edit
6. Undo MAIN move
```

Every step must affect exactly the intended scope.

The final state should equal the original imported state.

If this test fails, fix the history/action architecture before adding more tools.

---

# 38. Large Image / Performance Guardrails

Zmi EDT may receive large images such as 4K assets. A compressed file size is not the same as decoded memory usage: an RGBA 3840×2160 image is roughly 31.6 MiB for one raw pixel buffer before additional canvas, layer, thumbnail, or history memory is considered.

For v0.1:

- do not duplicate full-resolution pixel buffers unnecessarily.
- keep original uploaded files separate from editable document state.
- revoke temporary object URLs when no longer needed.
- avoid storing full bitmap copies for every history entry when a transform/action representation is sufficient.
- warn or fail gracefully when imports exceed reasonable memory limits.
- keep the architecture compatible with moving heavy image processing to `OffscreenCanvas`/Web Worker later.
- do not block the UI with avoidable synchronous batch processing.

Worker/offscreen processing is an optimization path, not a requirement to over-engineer the initial milestone.

---

# 38. Naming / Identity

Every workspace document must have a stable internal ID.

Do NOT use filename as the sole identity.

Bad:

```text
window["claude.png"]
```

Better:

```text
windowId = "uuid-or-stable-generated-id"
fileName = "claude.png"
```

Two files may have identical filenames.

---

# 39. Source of Truth

The application should have a clear single source of truth for:

- workspace windows
- document state
- MAIN ID
- batch membership

Avoid duplicating the same state across many components.

If using a state manager, choose one approach and keep it consistent.

Do not create multiple competing global stores.

---

# 40. AI Coding Instructions

When asking an AI coding assistant to implement a milestone:

1. State exactly ONE milestone.
2. Tell it which existing modules it may modify.
3. Tell it which features are explicitly out of scope.
4. Require it to preserve existing functionality.
5. Ask it to run/build/test after implementation.
6. Ask for a concise summary of changed files and known issues.
7. Commit the working state before the next milestone.

Example:

```text
Implement Milestone 2 only.

Add:
- MAIN selection
- MAIN visual indicator
- batch enabled/excluded state
- `_` toggle
- status bar

Do NOT implement:
- drawing
- text
- layers
- undo/redo
- export

Preserve Milestone 1 behavior.

Run the build and fix errors before finishing.
```

This prevents the coding model from consuming its entire context/output budget attempting to build the whole application.

---

# 41. Definition of Done — v0.1

Zmi EDT v0.1 is considered complete when the user can:

1. Drag multiple images into the app.
2. See each image as a separate window.
3. Move windows without moving their image content.
4. Select a window.
5. Select a MAIN window.
6. See which windows are included in batch.
7. Exclude/re-include windows using `_`.
8. Edit MAIN with supported batchable transformations.
9. Edit an individual window locally.
10. Use layers.
11. Draw.
12. Add/edit text.
13. Delete elements.
14. Crop when supported.
15. Zoom and pan.
16. Undo and redo both local and batch actions.
17. Inspect all uploaded assets.
18. Export one or many images.
19. Export multiple images as ZIP.
20. Enter and leave Ngắm waifu mode without losing editor state.

Most importantly:

> **The application must remain stable when the user mixes MAIN batch edits, excluded windows, local edits, undo/redo, window closing, and export.**

---

# 42. Explicit Non-Goals for v0.1

Do NOT add unless separately requested:

- user accounts
- cloud collaboration
- social features
- AI image generation
- AI image editing
- filters
- advanced color correction
- masks
- complex blend modes
- animation timeline
- video editing
- 3D
- real-time multiplayer
- complicated plugin system
- full Photoshop compatibility

Zmi EDT is a focused batch artwork editor.

---

# 43. Final Implementation Philosophy

The application should feel simple to use even if its internal state management is sophisticated.

The ideal mental model is:

```text
                 MAIN 🐐
                   │
                   │ batch action
                   ▼
       ┌───────────┼───────────┐
       ▼           ▼           ▼
     IMG A       IMG B       IMG C
     active      active      excluded
       │           │
       │           └── local edits allowed
       │
       └── local edits allowed
```

MAIN is not a permanently linked clone of every other document.

It is the **source of supported batch actions**.

Each document remains independently editable.

That distinction is the foundation of Zmi EDT.

---

## End of specification

Build small.
Test often.
Commit after every stable milestone.

And do not let the coding assistant turn a 38-icon editor into Photoshop 2.0 before the first PNG can even be exported.
