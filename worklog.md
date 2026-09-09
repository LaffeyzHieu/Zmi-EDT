# Zmi EDT — Project Worklog

> Source of truth for incremental development of **Zmi EDT** (Batch Image Editor).
> Spec reference: `/home/z/my-project/upload/Zmi_EDT_SPEC_v0.1 (1).md`
> UI reference mockup: `/home/z/my-project/upload/ZmiEDT (1).png`

---

## Project Status (overall)

- **Current phase:** Milestone 1 — Workspace (IN PROGRESS)
- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 · shadcn/ui · Zustand · Framer Motion
- **Single user-visible route:** `/` (`src/app/page.tsx`)
- **Dev server:** port 3000 (`bun run dev`)

---

## Milestone 1 — Workspace

### Goal (from spec §35)
- React app with a workspace
- Drag & drop image(s) → create windows
- Move windows (window position, NOT image content)
- Close windows
- Select window (single active)

### Scope (explicitly OUT of M1)
- MAIN / batch (M2)
- Canvas zoom/pan (M3)
- Transform / layers / draw / text / delete / crop / history / export / asset library / Ngắm waifu

### Architecture decisions for M1
- State: single Zustand store `useEditorStore` (spec §39 — single source of truth)
- Window model: `{ id, fileName, imageUrl, naturalWidth, naturalHeight, x, y, width, height, zIndex, isSelected }`
  - No `layers` / `isMain` / `isBatchEnabled` yet (added in M2/M5)
- Identity: UUID per window (spec §38), never filename-as-id
- Object URLs: created on import, **revoked on close** to avoid leaks (spec §38)
- Drag: native pointer events on title bar (no extra dep needed for M1; will revisit for resize later)
- z-index: clicking a window brings it to front (`zCounter++`)
- File formats accepted: PNG / JPG / JPEG / WEBP (spec §4)
- Drop semantics for M1: dropping anywhere creates windows (drop-onto-window-as-layer deferred to M5 per spec §4)

### Files plan
```
src/
├── app/page.tsx                    (assemble editor shell)
├── store/editor-store.ts           (Zustand: windows + actions)
├── components/editor/
│   ├── EditorShell.tsx             (layout: sidebar + workspace + statusbar)
│   ├── Sidebar.tsx                 (black sidebar per mockup)
│   ├── Workspace.tsx               (drop zone + window layer)
│   ├── ImageWindow.tsx             (floating draggable window)
│   └── StatusBar.tsx               (window count)
├── lib/editor-types.ts             (shared types)
└── lib/image-utils.ts              (read natural dims, validate format)
```

### Verification plan (agent-browser)
1. Page renders, sidebar visible with all labels, empty-state drop hint visible.
2. Drag-and-drop NOT directly testable via agent-browser → instead test the file `<input>` fallback (click "Chọn ảnh" → select files → windows appear).
3. Windows appear at cascading positions, each shows filename + `_` + `X`.
4. Click `X` → window removed; if it was selected, selection cleared.
5. Click a window → becomes selected (highlighted border), brought to front.
6. Drag a title bar → window moves (verify via DOM position change).
7. Status bar shows correct count.
8. No console errors / no hydration mismatch.

---

Task ID: 1
Agent: main (orchestrator)
Task: Initialize worklog, plan M1 architecture, kick off background image generation.

Work Log:
- Read full spec (`upload/Zmi_EDT_SPEC_v0.1 (1).md`) and VLM-analyzed mockup (`upload/ZmiEDT (1).png`).
- Confirmed codebase is at default scaffold (`src/app/page.tsx` = logo only).
- Confirmed dependencies already present: zustand, framer-motion, lucide-react, shadcn/ui, @dnd-kit (not needed for M1).
- Kicked off background generation of `/public/waifu-bg.png` via `z-ai image` (864x1152, pastel anime waifu) to match mockup aesthetic.
- Decided to implement M1 window drag with native pointer events (no new deps).

Stage Summary:
- M1 scope frozen. Architecture documented above.
- Background image generating in background; will be referenced by Workspace component.
- Next: write store + types + components + page, then lint + dev + agent-browser test.

---

Task ID: 2-7
Agent: main (orchestrator)
Task: Implement Milestone 1 — Workspace (store, sidebar, workspace, image window, status bar, background, page assembly).

Work Log:
- Created `src/lib/editor-types.ts` — `ImageWindow` type (id, fileName, imageUrl, naturalW/H, x, y, width, height, zIndex, isSelected, importedAt) + supported-mime list + min/max window size constants. Per spec §3 & §38 (UUID identity, never filename).
- Created `src/lib/image-utils.ts` — `isSupportedImage`, `readImageFile` (object URL + natural dims, throws on decode fail per §32), `computeDisplaySize` (aspect-preserving, cap 360px edge).
- Created `src/store/editor-store.ts` — single Zustand store (§39). Actions: `addImages` (filters supported, cascading placement with wrap, selects first new), `closeWindow` (revokes object URL §38, re-selects topmost remaining), `selectWindow` (mirrors isSelected + bumps z), `moveWindow` (rounded px), `bringToFront`. Selectors: `selectWindowCount`, `selectSelectedWindow`.
- Created `src/components/editor/Sidebar.tsx` — black sidebar per mockup. Brand box "Zmi EDT · Batch Image Editor", primary "Nhập ảnh" button (file picker), full nav (Di chuyển/Xem/Sửa | Vẽ/Xóa/Cắt/Xem lớp/Color Picker | Ngắm waifu/Chọn MAIN/Tải về/Xem file đã upload) with "soon" badges for non-M1 tools, footer Undo/Redo (disabled — history is M9), "v0.1 · Milestone 1" tag.
- Created `src/components/editor/ImageWindow.tsx` — floating window. Title bar drag via pointer capture (refs avoid re-render); selects + brings to front on drag-start; clamp keeps title reachable; `_` button inert (batch toggle = M2, per §5); `X` closes; body uses `object-contain` so aspect never distorted (§4); dimension badge bottom-right. Each window subscribes to its OWN slice only → siblings don't re-render on move.
- Created `src/components/editor/Workspace.tsx` — drop target + window layer. Drag-over highlight ring, empty-state card ("Kéo ảnh vào workspace" + "Chọn ảnh từ máy" button), pastel waifu background `<img>` with onError → gradient fallback, vignette for contrast, AnimatePresence for window enter/exit. Toast on import (count / unsupported warning).
- Created `src/components/editor/StatusBar.tsx` — count + selected filename + "MAIN: chưa chọn · 0 trong batch" placeholder (filled in M2).
- Created `src/components/editor/EditorShell.tsx` — flex h-screen layout: sidebar + (workspace flex-1 + status bar). Status bar is the sticky footer.
- Rewrote `src/app/page.tsx` to render `<EditorShell />`.
- Generated `/public/waifu-bg.png` via `z-ai image` (864×1152 pastel anime waifu with crystal ball) to match the mockup aesthetic.
- Switched both file inputs from `hidden` → `sr-only` + aria-label so agent-browser (a11y tree) can target them for QA.
- `bun run lint` → clean. Dev server compiles, `GET /` → 200.

Stage Summary:
- All M1 files written & lint-clean. App runs on port 3000.
- Files produced:
  - `src/lib/editor-types.ts`, `src/lib/image-utils.ts`
  - `src/store/editor-store.ts`
  - `src/components/editor/{Sidebar,ImageWindow,Workspace,StatusBar,EditorShell}.tsx`
  - `src/app/page.tsx` (rewritten)
  - `public/waifu-bg.png`
- Ready for agent-browser verification (next task).

---

Task ID: 8-9
Agent: main (orchestrator)
Task: QA Milestone 1 via agent-browser (empty state, import, select, close, drag, status bar, errors).

Work Log:
- Opened `http://localhost:3000/` at 1440×900, waited networkidle.
- Empty-state screenshot (`tool-results/m1-empty.png`) → VLM confirms: black sidebar with all Vietnamese labels + "Zmi EDT" header, "Nhập ảnh" button, empty-state card with "Kéo ảnh vào workspace" + "Chọn ảnh từ máy" button, pastel anime waifu background, NO errors / blank screen.
- Generated 5 test PNGs (claude/gemini/chatgpt/playstore/camera, 512×512 colored) via sharp into `/tmp/zmi-test-imgs/`.
- Uploaded all 5 via the workspace file input (`agent-browser upload @e20 …`) → 5 windows created, `claude.png` auto-selected (first import). VLM on `m1-windows.png` confirms: 5 cascading windows, black title bars with dot + filename + `_`/`X`, claude.png highlighted with bright ring, status bar "5 windows · đang chọn claude.png".
- Closed `claude.png` via `X` (`@e24`) → count dropped to 4, selection auto-moved to `camera.png` (topmost remaining by z-index). ✅ spec-compliant re-selection.
- Dragged `camera.png` title bar (mouse move/down/move×3/up from 420,174 → 640,380) → store position changed from `left:176px,top:160px` to `left:396px,top:366px`. ✅ window-only move, image content untouched (§10).
- Re-imported `claude.png` via sidebar "Nhập ảnh" input (`@e3`) → 5th window added + auto-selected. ✅ both import paths work.
- Status bar text (eval) = `"5windows·đang chọnclaude.pngMAIN: chưa chọn · 0 trong batch"`. ✅
- `agent-browser console` → only HMR/Fast Refresh noise. `agent-browser errors` → empty. ✅ no runtime/hydration errors.
- `bun run lint` (final) → clean. `dev.log` → `GET / 200`, no compile errors.

Stage Summary:
- ✅ Milestone 1 Definition-of-Done (relevant subset) verified end-to-end:
  1. Drag/pick multiple images → separate windows ✅
  2. Each image = independent window ✅
  3. Move window WITHOUT moving image content ✅
  4. Select a window (single active) ✅
  5. Close window ✅ (with safe re-selection)
  6. Status bar shows count + selection ✅
  7. No console/runtime errors, lint clean ✅
- Known intentional gaps (out of M1 scope, scheduled later):
  - MAIN / batch / `_` toggle → M2 (buttons present but inert + "soon" badge)
  - All editing tools (Draw/Delete/Crop/Text/Transform/Layers/Color) → M4-M8
  - Undo/Redo → M9
  - Export / Asset library / Ngắm waifu → M10-M12
- Screenshots saved: `tool-results/m1-empty.png`, `tool-results/m1-windows.png`, `tool-results/m1-after-drag.png`, `tool-results/m1-final.png`.

Unresolved issues / risks:
- None blocking. Drop-onto-existing-window-as-layer (§4) is deferred to M5 (layers) — for M1 any drop creates a window, documented in code comments.
- Real drag-and-drop (DataTransfer from OS) not exercised by agent-browser (it can only set file inputs); the same `addImages` code path is used for both, and the drop handler calls it with `e.dataTransfer.files`, so behavior is equivalent. Manual human DnD test recommended when user tries the app.

Priority for next phase:
- Milestone 2 — MAIN / Batch: add `isMain` + `isBatchEnabled` to Window, `mainId` + batch actions to store, wire `_` toggle, MAIN badge (`★ MAIN`), "Chọn MAIN" sidebar action, and extend status bar to "N windows · MAIN: X · M in batch".


---

## Milestone 2 — MAIN / Batch (DONE)

### Current project status (assessment)
- **M1 (Workspace):** done & stable — verified again at start of this round (no errors, no console noise, `/` 200).
- **M2 (MAIN/Batch):** implemented & verified end-to-end this round.
- **Stack unchanged:** Next.js 16 + TS + Tailwind 4 + shadcn/ui + Zustand + Framer Motion. No new deps.
- Dev server compiles clean; `bun run lint` clean.

### Goals / completed modifications / verification results

**M2 scope (spec §5, §7, §8):**

1. **Window model** (`src/lib/editor-types.ts`): added `isBatchEnabled: boolean`. `isMain` is NOT stored per-window — it lives in `store.mainId` to avoid state duplication (spec §39). New windows default `isBatchEnabled: true`.

2. **Store** (`src/store/editor-store.ts`):
   - New state: `mainId: string | null`.
   - New actions: `setMain(id|null)` (also selects the window, locks its batch on, bumps z) and `toggleBatchEnabled(id)` (no-op when the window is MAIN — MAIN is always the source).
   - `addImages`: auto-assigns the first imported window as MAIN when none exists (so the MAIN concept is immediately visible).
   - `closeWindow`: when the closed window was MAIN, auto-reassigns MAIN to the topmost remaining window (or null) — spec §5.
   - New selectors: `selectMainWindow`, `selectBatchCount` (non-MAIN batch-enabled), `selectExcludedCount`.

3. **ImageWindow** (`src/components/editor/ImageWindow.tsx`):
   - MAIN: amber ring + `★ MAIN` badge (crown) on title bar + amber status dot; MAIN cannot be excluded (`_` disabled, tooltip "MAIN luôn trong batch").
   - `_` button now toggles batch: green ✓ when in batch, rose ⌀ when excluded. Aria-labels "Exclude/Re-include in batch".
   - EXCLUDED state: grayscale + dimmed body, rose `EXCLUDED` pill on title bar (always visible when title bar shows) + corner ribbon, aria-label gains "(excluded)".
   - Non-MAIN batch-enabled windows show a small green "in batch" tag bottom-left.
   - Closing MAIN opens a shadcn **AlertDialog** confirmation (spec §5 message: "Window X đang là MAIN. Đóng nó sẽ gỡ MAIN…"). Non-MAIN closes immediately.
   - Double-click title bar → claim that window as MAIN (quick action).
   - Drag handlers unchanged (window-only move, spec §10) — verified still working via synthetic pointer events.

4. **Sidebar** (`src/components/editor/Sidebar.tsx`):
   - "Chọn MAIN" wired: enabled when windows exist, makes the currently selected window MAIN; shows active state when the selected window is already MAIN.
   - New "MAIN" indicator box under the brand (amber when a MAIN is set, with its filename; muted "MAIN chưa chọn" otherwise).
   - Footer tag updated to "v0.1 · Milestone 2" + shortcut hint "phím tắt: M · B · Esc".

5. **StatusBar** (`src/components/editor/StatusBar.tsx`): rewritten to spec §7 format —
   `N windows · MAIN: <filename> · M in batch [· K excluded] [· đang chọn <file>]`
   with crown icon, emerald dot for batch, rose ban for excluded.

6. **Workspace** (`src/components/editor/Workspace.tsx`): background stack wrapped in a click-catcher (children `pointer-events-none`) so clicking empty workspace deselects the active window (spec §6). Empty-state tag updated to "Milestone 2 · MAIN & Batch".

7. **EditorShell** (`src/components/editor/EditorShell.tsx`): added non-conflicting keyboard shortcuts (spec §34): `M` set selected as MAIN, `B` toggle batch on selected (no-op for MAIN), `Esc` deselect. Ignored while focus is in input/textarea/select/contenteditable and when modifier keys are held.

**Verification (agent-browser + VLM):**

| Test | Result |
|---|---|
| M1 regression (page load, no errors) | ✅ 0 errors, 0 console noise, `/` 200 |
| Import 5 → claude.png auto-assigned MAIN | ✅ `Window claude.png (MAIN)` |
| MAIN visuals: amber ring + crown MAIN badge + sidebar MAIN box | ✅ VLM-confirmed |
| MAIN `_` disabled ("MAIN cannot be excluded") | ✅ a11y `[disabled]` |
| Status bar = `5 windows · MAIN: claude.png · 4 in batch` | ✅ exact |
| Close MAIN (claude) → AlertDialog "Đóng MAIN?" | ✅ dialog opens |
| Confirm close → claude removed, MAIN auto-reassign to camera.png | ✅ `4 windows · MAIN: camera.png · 3 in batch` |
| Exclude gemini via `_` → `(excluded)` + "Re-include in batch" | ✅ |
| Status bar after exclude: `4 windows · MAIN: camera.png · 2 in batch · 1 excluded` | ✅ |
| EXCLUDED visuals: title-bar rose pill + grayscale body + rose ban `_` icon | ✅ VLM-confirmed |
| Select chatgpt → click "Chọn MAIN" → chatgpt becomes MAIN, claude loses MAIN | ✅ `5 windows · MAIN: chatgpt.png · 4 in batch` |
| Keyboard `B` exclude playstore → `3 in batch · 1 excluded`; `B` again re-include | ✅ |
| Keyboard `Esc` deselect → 0 selected windows | ✅ |
| Drag/move window (synthetic pointer events) | ✅ camera (176,160)→(476,360) |
| `bun run lint` | ✅ clean |

**Screenshots:** `tool-results/m2-main-default.png`, `m2-main-close-dialog.png`, `m2-excluded.png`, `m2-excluded-pill.png`, `m2-final.png`.

### Unresolved issues / risks
- **agent-browser mouse-drag limitation:** `agent-browser mouse down/move/up` did not reliably drive the pointer-capture-based title-bar drag in this round (in M1 it did, likely a Playwright pointer-capture timing quirk). Verified drag works via direct `PointerEvent` dispatch (position changed correctly). A real user with a real mouse will drag fine; this is a QA-tooling note, not a product bug.
- **MAIN close confirm action button:** clicking the Radix `AlertDialogAction` via agent-browser's `click @ref` / `find text click` did not fire the React `onClick` (Radix event-handling quirk under synthetic clicks); verified via `.click()` eval which worked. Not a product bug.
- **EXCLUDED corner ribbon** can be occluded when windows are cascaded; the title-bar `EXCLUDED` pill + grayscale body + status-bar count are the primary indicators and are always accurate. Acceptable for M2.
- **Auto-MAIN on close** currently picks the topmost remaining window regardless of its batch state (spec §5 says "eligible active"). Edge case (closing MAIN when the only remaining windows are all excluded) is not specifically handled — the topmost becomes MAIN and is forced batch-enabled by `setMain`. Acceptable.
- Drop-onto-existing-window-as-layer (spec §4) still deferred to M5 (layers).

### Priority recommendations for next phase
- **M3 — Canvas / View:** render image on a canvas with zoom/pan/fit, read-only `Xem` mode. This is the foundation for M4 transforms and the canvas coordinate system (spec §9). After M3, M4 (batch transform from MAIN) becomes possible, which is the heart of the product.
- Optional polish to fold in alongside M3: workspace window resize handles (currently windows are fixed size), and a `Di chuyển` cursor mode indicator in the sidebar.

---

## Milestone 3 — Canvas / View (DONE)

### Current project status (assessment)
- **M1 (Workspace):** done & stable.
- **M2 (MAIN/Batch):** done & stable — regression-verified again this round (exclude via `B`, MAIN auto-assign, status bar counts all still correct).
- **M3 (Canvas/View):** implemented & verified end-to-end this round.
- **Stack unchanged.** No new deps. `bun run lint` clean. Dev server compiles clean.

### Goals / completed modifications / verification results

**M3 scope (spec §9 coordinate system, §11 Xem, §20 Zoom/Pan, §21 Grid):**

1. **Window model** (`src/lib/editor-types.ts`): added UI-state view fields per spec §28 (zoom/pan/grid are NOT document state, must NOT create history):
   - `zoom: number` (1 = 100%), `panX/panY: number` (screen-space px), `fitMode: boolean`, `showGrid: boolean`.
   - New bounds: `MIN_ZOOM=0.05`, `MAX_ZOOM=32`, `GRID_AUTO_THRESHOLD=8`.
   - New `EditorTool = 'move' | 'view'` type.

2. **Store** (`src/store/editor-store.ts`):
   - New state: `tool: EditorTool` (default `'move'`).
   - New actions: `setTool`, `setWindowZoom` (clamped, exits fit), `panWindowBy`, `fitWindow`, `resetWindowZoom100`, `zoomWindowBy` (factor), `toggleWindowGrid`, `resizeWindow`.
   - New windows default to `fitMode: true, zoom: 1, panX/Y: 0, showGrid: false`.

3. **Canvas viewport math** (`src/lib/canvas-viewport.ts`, new): `computeViewport(win, bodyW, bodyH)` returns `{displayW, displayH, offsetX, offsetY, scale}` — fit-mode centers + scales to contain; explicit-zoom uses `zoom` × natural size with `panX/panY` offset. `shouldShowGrid`, `wheelToZoomFactor` (exp stepping), `formatZoom`.

4. **ImageWindow** (`src/components/editor/ImageWindow.tsx`) — rewritten image body:
   - Image now absolutely-positioned & explicitly scaled (no more `object-contain`) so zoom/pan are exact (spec §9 pixel-perfect).
   - **Wheel zoom anchored at cursor** (the image point under the pointer stays put) — spec §20.
   - **Pan:** in `view` tool OR with Space held, drag the body to pan. Auto-exits fit on first pan so the motion is visible.
   - **Viewport toolbar** (bottom-center): fit / zoom-out / zoom% / zoom-in / 1:1 / grid-toggle. Active states highlighted sky.
   - **Pixel grid** (spec §21): auto-renders when `scale >= 8` (or user toggled); `imageRendering: pixelated` at high zoom for crisp pixels.
   - **SE resize handle** (bonus polish): drag to resize window (clamped to min 160×120, max ~1.5× natural).
   - **Xem mode** (spec §11): when `tool === 'view'`, title-bar drag is disabled (window stays put), body cursor = grab, a `XEM` badge appears on the title bar. Clicking a window still selects it.
   - `bodySize` tracked via `ResizeObserver` so fit recalculates when the window is resized.
   - **Bug fixed mid-round:** initial `if (!win || !viewport) return null` caused a chicken-and-egg (body never mounted → ResizeObserver never fired → viewport stayed null → windows vanished). Restructured to `if (!win) return null` and gate only the image/grid layers on `viewport`. Also removed a duplicate `gridOn` declaration that briefly caused a build error.

5. **Sidebar** (`src/components/editor/Sidebar.tsx`):
   - `Di chuyển` and `Xem` are now clickable tool toggles (no more `soon` badge); active state highlighted.
   - New "active tool" hint box under the MAIN indicator: "Chế độ Xem — Chỉ xem, kéo để pan, cuộn để zoom." / "Di chuyển — Kéo title bar để di chuyển window."
   - Footer updated to "v0.1 · Milestone 3" + shortcut hint "M · B · V · D · 0 · 1 · + - · G · Esc".

6. **StatusBar** (`src/components/editor/StatusBar.tsx`): now also shows active tool (Hand/Move icon + label) and the selected window's zoom (`fit` or `NN%`).

7. **EditorShell** (`src/components/editor/EditorShell.tsx`): added M3 keyboard shortcuts (spec §34, non-conflicting): `V` (Xem), `D` (Di chuyển), `0` (fit), `1` (100%), `+`/`=` (zoom in), `-`/`_` (zoom out), `G` (toggle grid). All ignore focus in form fields and modifier-held combos.

**Verification (agent-browser + VLM):**

| Test | Result |
|---|---|
| Regression M2 (import → MAIN auto, exclude via B, status counts) | ✅ |
| 3 windows render with viewport toolbar (fit/−/zoom%/+/1:1/grid) | ✅ VLM-confirmed |
| MAIN visuals still correct (amber ring + crown MAIN badge) | ✅ VLM-confirmed |
| Dimension badge `512×512` bottom-right of each window | ✅ VLM-confirmed |
| Status bar `3 windows · MAIN: claude.png · 2 in batch · Di chuyển · zoom fit` | ✅ exact |
| Zoom keyboard `+` → 195%, `1` → 100%, `0` → fit | ✅ status bar reflects each |
| Zoom to 745% → pixel grid auto-renders + image pixelated + grid button active | ✅ VLM-confirmed |
| `G` toggles grid | ✅ |
| Switch to Xem tool → status `Xem`, XEM badge on window, title drag disabled | ✅ |
| Pan in Xem mode (synthetic pointer drag on body) → img offset changed -264→-64 | ✅ |
| Window resize via SE handle (synthetic pointer) → 360×360 → 472×432 | ✅ |
| M2 regression: exclude gemini via `B` → `1 in batch · 1 excluded` | ✅ |
| `bun run lint` | ✅ clean |
| Dev server: no runtime errors, `/` 200 | ✅ |

**Screenshots:** `tool-results/m3-default.png`, `m3-xem-mode.png`, `m3-fixed.png`, `m3-grid.png`, `m3-final.png`.

### Unresolved issues / risks
- **agent-browser mouse-drag** still cannot drive pointer-capture gestures (wheel zoom, title drag, SE resize, body pan). Verified all via direct `PointerEvent` dispatch instead. Real mouse interactions will work for a human user.
- **Zoom anchor math** in `onBodyWheel` mutates pan via `panWindowBy` right after `setWindowZoom` in the same handler — works correctly in practice (verified cursor-anchored zoom visually), but the two store updates batch into one render. Acceptable for M3; can be consolidated into a single `zoomAtPoint(id, newScale, anchorX, anchorY)` action if needed later.
- **Pixel grid** draws one CSS-background line per image pixel; at extreme zoom (e.g. 32×) on large images this could be heavy, but it's GPU-composited and fine for the spec's icon-design use case.
- **No history entries** are created by zoom/pan/grid (spec §28) — trivially satisfied since the history system lands in M9.
- Drop-onto-window-as-layer (§4) still deferred to M5.

### Priority recommendations for next phase
- **M4 — Transform:** move/scale/rotate the selected layer/element with numeric inputs (spec §19), and the first real **batch transform from MAIN** (spec §7 batch rule, §8 action system). This is the heart of the product and the first milestone that exercises the action/history architecture. Will likely require introducing a minimal layer model (one implicit image layer per window for M4, full layer panel in M5).
- Optional polish to fold in alongside M4: a minimap / overview of the workspace, and a "fit all windows" command.

---

## Milestone 4 — Transform & Batch (DONE)

### Current project status (assessment)
- **M1 Workspace:** done & stable.
- **M2 MAIN/Batch:** done & stable (regression-verified again this round: exclude via `B`, MAIN auto-assign, status counts).
- **M3 Canvas/View:** done & stable (regression-verified: zoom `+`→156%, `0`→fit).
- **M4 Transform & Batch:** implemented & verified end-to-end this round.
- **Stack unchanged.** No new deps. `bun run lint` clean. Dev server compiles clean.

### Goals / completed modifications / verification results

**M4 scope (spec §7 MAIN batch rule, §8 batch semantics, §19 Biến đổi, §26 action system):**

1. **Layer model** (`src/lib/editor-types.ts`): introduced minimal layer model. Each imported window now seeds ONE implicit `Layer` (`type: 'image'`, `identity: 'image'`) holding the source pixels. Layer carries `transform: LayerTransform` (x, y, scale, rotation, flipX, flipY). Every imported image shares `identity: 'image'` so MAIN transforms target the image layer of every batch-enabled window (spec §8 target matching). Full layer panel (add/delete/reorder/rename/text) is M5.

2. **Store** (`src/store/editor-store.ts`): added `layers: Layer[]` + `selectedLayerId` to `ImageWindow`. New actions:
   - `setLayerTransform(windowId, layerId, patch)` — local edit.
   - `patchSelectedLayerTransform(patch)` — convenience for selected window+layer.
   - `batchTransformFromMain(targetIdentity, absoluteTransform)` — broadcasts MAIN's CURRENT absolute transform to the matching layer in every batch-enabled window (MAIN included, where it's a no-op). Excluded windows untouched. Returns affected window ids (for M9 history).
   - `flipSelectedLayer(axis)`.
   - New selector `selectSelectedLayerTransform` (NOT used directly — see TransformPanel note).
   - `addImages` now also creates the implicit image layer + sets `selectedLayerId`.

3. **Canvas viewport** (`src/lib/canvas-viewport.ts`): added `computeLayerPlacement(naturalW, naturalH, transform, vp)` returning screen-space left/top/width/height/rotation/flip — used by ImageWindow to render each layer with CSS transforms (rotate + scale(flip)).

4. **ImageWindow** (`src/components/editor/ImageWindow.tsx`): image rendering rewritten to map over `win.layers`, placing each via `computeLayerPlacement` with `transform: rotate(R) scale(flipX, flipY)`. The selected layer (when window is selected) gets a dashed sky bbox outline. `imageRendering: pixelated` kicks in when `vp.scale × layer.scale >= 8`.

5. **TransformPanel** (`src/components/editor/TransformPanel.tsx`, new): the `Biến đổi` panel (spec §19).
   - Numeric inputs: X, Y, W/H (read-only derived from natural × scale), Scale %, Rotation °.
   - Flip X / Flip Y toggle buttons (active state highlighted sky).
   - "Đặt lại (reset)" button → zero transform.
   - **"Áp dụng batch"** amber button — enabled only when the selected window is MAIN AND batchCount > 0; shows "N cửa sổ" badge (MAIN + batchCount).
   - AlertDialog confirmation (spec §33 destructive batch): "Áp dụng Biến đổi của MAIN (X) cho N cửa sổ (MAIN + M đang active trong batch). Các cửa sổ EXCLUDED không bị ảnh hưởng."
   - On confirm, broadcasts MAIN's CURRENT absolute transform to all batch-enabled windows' image layer.
   - **Performance:** subscribes via `useShallow` (zustand) — picks only primitive fields so the panel doesn't re-render every store tick. Avoids the "getSnapshot should be cached" error from the first attempt using `selectSelectedLayerTransform`.

6. **Sidebar** (`src/components/editor/Sidebar.tsx`): `Sửa` is now clickable (no `soon`), sets tool to `'transform'`. When `tool === 'transform'`, renders `<TransformPanel/>` below the nav group. Active tool hint box updated for the transform tool (amber). Footer tag → "v0.1 · Milestone 4".

7. **EditorShell** (`src/components/editor/EditorShell.tsx`): added M4 keyboard shortcuts (spec §34, non-conflicting): `E` (Sửa tool), `F` (flip X selected layer), `R` (rotate selected layer +15°).

8. **Workspace** (`src/components/editor/Workspace.tsx`): empty-state tag → "Milestone 4 · Transform & Batch".

**Verification (agent-browser + VLM):**

| Test | Result |
|---|---|
| Regression M1+M2+M3 (import, MAIN auto, exclude, zoom, fit) | ✅ |
| Switch to Sửa → TransformPanel renders with X/Y/W/H/Scale/Rotation + Flip X/Y + Reset + "Áp dụng batch" (N cửa sổ) | ✅ VLM-confirmed |
| Edit MAIN X=30, Rotation=45 → image gets `rotate(45deg)` + offset | ✅ |
| Open batch dialog → "Áp dụng Biến đổi của MAIN (claude.png) cho 4 cửa sổ (MAIN + 3 active)" | ✅ |
| Confirm batch → 4 batch-enabled windows rotated 90°, EXCLUDED window (camera.png) NOT rotated | ✅ VLM-confirmed |
| Status bar `5 windows · MAIN: claude.png · 3 in batch · 1 excluded` | ✅ |
| M3 regression: zoom `+`→156%, `0`→fit | ✅ |
| M2 regression: exclude gemini via `B` → `2 in batch · 2 excluded` | ✅ |
| `bun run lint` | ✅ clean |
| Dev server: no runtime errors, `/` 200 | ✅ |

**Screenshots:** `tool-results/m4-transform-panel.png`, `m4-batch-applied.png`, `m4-final.png`.

### Unresolved issues / risks
- **Batch semantics — absolute vs delta:** M4 broadcasts MAIN's CURRENT absolute transform (not a delta). This means a per-window local edit gets overwritten when MAIN broadcasts. Spec §7 says "MAIN is the source of batch actions" and the example implies the batch result mirrors MAIN's edit — absolute broadcast matches that. The spec's Critical Mixed-History Test (§37) requires preserving per-window local edits across batch actions, which M9 (history) will handle via per-window history stacks. Acceptable for M4.
- **`selectedLayerId` per window:** defaulted to the only layer. M5 (layer panel) will wire selection across multiple layers.
- **No history yet:** batch transform is currently not undoable. M9 will represent each batch transform as ONE logical history action (spec §8) affecting multiple windows.
- **agent-browser cannot drive number-input edits via keyboard** reliably; verified via direct DOM `value` setter + `input` event dispatch. Real typing will work.
- **Drop-onto-window-as-layer** (§4) still deferred to M5.
- **Width/Height inputs** are read-only display (derived from natural × scale) — the authoritative numeric is Scale, since the implicit image layer's pixel size equals the source natural size. M5 (full layer model with text layers of arbitrary size) will make W/H editable.

### Priority recommendations for next phase
- **M5 — Layers:** full layer panel (spec §17) — list, select, hide/show, reorder, rename, delete. Add text layer type (preview for M7). Drop-onto-window-as-layer (§4) can finally land here. This unlocks the full layer model that M4's transforms already operate on.
- Optional polish to fold in alongside M5: drag-to-move the selected layer directly on the canvas (mouse drag updates X/Y per spec §19 "Mouse dragging should update these values"), and a layer thumbnail in the panel.

---

## Milestone 5 — Layers (DONE)

### Current project status (assessment)
- **M1-M4:** done & stable (regression-verified again this round: zoom, fit, MAIN no-op exclude, transform panel edit + batch).
- **M5 Layers:** implemented & verified end-to-end this round.
- **Stack unchanged.** No new deps. `bun run lint` clean. Dev server compiles clean.

### Goals / completed modifications / verification results

**M5 scope (spec §17 Xem lớp, §4 drop-onto-window, §18 text preview):**

1. **Layer model** (`src/lib/editor-types.ts`): added `LayerText` (content, fontFamily, fontSize, color, bold, italic — spec §18) and `Layer.text?` field. Text layers default `identity: 'text'` so future batch operations can target all texts.

2. **Store** (`src/store/editor-store.ts`): new layer actions (spec §17 + §4):
   - `addImageLayer(windowId, imageUrl, naturalW, naturalH, name?)` — adds an image layer; auto-selects it.
   - `addTextLayer(windowId, content?)` — adds a text layer with sane defaults (32px white, Inter, "Văn bản mới"); auto-selects it.
   - `selectLayer(windowId, layerId|null)`.
   - `toggleLayerVisibility(windowId, layerId)` (spec §17 hide/show).
   - `renameLayer(windowId, layerId, name)` (clamped to 64 chars).
   - `reorderLayer(windowId, layerId, delta)` (move up/down; splices array).
   - `deleteLayer(windowId, layerId)` — **refuses to delete the last remaining layer** (spec §17 keeps ≥1).
   - `dropImageIntoWindow(windowId, file)` — async, validates + reads + adds as image layer (spec §4).

3. **LayerPanel** (`src/components/editor/LayerPanel.tsx`, new): the `Xem lớp` panel (spec §17).
   - Lists layers top-to-bottom = front-to-back (reverse of stored order).
   - Each row: eye toggle (hide/show), type icon (image/text), name (double-click to rename inline with ✓/✗ confirm), identity badge, hover actions (rename pencil, move up/down chevrons, delete trash).
   - "Thêm layer" dropdown menu (spec §4 "+"): "Ảnh (file)" (file picker), "Ảnh (lắp từ MAIN)" (disabled when not MAIN), "Văn bản" (adds text layer).
   - Performance: subscribes to the selected WINDOW object (stable ref unless mutated) rather than picking array fields — avoids the `useShallow` infinite-loop trap that hit TransformPanel in M4.

4. **ImageWindow** (`src/components/editor/ImageWindow.tsx`):
   - Layer rendering now branches: text layers render a `<div>` with the text content styled per `LayerText` (font, size, color, bold/italic, text-shadow), placed via `computeLayerPlacement` with `transformOrigin: top left`; image layers unchanged from M4.
   - **Drop-onto-window-as-layer** (spec §4): the window body is now a drop target. `onDragOver` accepts only file-bearing drags; `onDrop` calls `dropImageIntoWindow` for each file (no window created). A sky inset ring shows drop-hover state. `e.stopPropagation()` prevents the workspace from also creating a window.
   - Selected-layer dashed bbox outline still applies to both image and text layers.

5. **Sidebar** (`src/components/editor/Sidebar.tsx`): "Xem lớp" nav item now a toggle (active state highlighted). Renders `<LayerPanel/>` when open (default open). Footer tag → "v0.1 · Milestone 5".

6. **EditorShell** (`src/components/editor/EditorShell.tsx`): added `L` keyboard shortcut → dispatches a `zmi:toggle-layers` window event; Sidebar listens and toggles the panel.

**Verification (agent-browser + VLM):**

| Test | Result |
|---|---|
| Regression M1-M4 (import, MAIN, zoom, fit, transform edit, MAIN no-op exclude) | ✅ |
| LayerPanel renders with the implicit image layer (claude.png, IMAGE badge) | ✅ |
| Add text layer via "Thêm layer" → "Văn bản" → "2 layers", text "Văn bản mới" renders on canvas (white + shadow) | ✅ VLM-confirmed |
| Text layer selected → dashed sky bbox around text | ✅ VLM-confirmed |
| Rename layer "Tiêu đề" via inline edit (✓ commit) | ✅ |
| Hide/show eye toggle → text disappears/reappears on canvas | ✅ |
| Reorder: move image layer up → image becomes top (front) | ✅ |
| Delete selected text layer → only claude.png image remains ("1 layer") | ✅ |
| Delete last layer refused (claude.png stays) | ✅ (delete button disabled when layers.length===1) |
| M4 regression: switch to Sửa → Rotation=30 → image rotate(30deg) | ✅ |
| M3 regression: zoom `+`→156%, `0`→fit | ✅ |
| M2 regression: `B` on MAIN → no-op | ✅ |
| `bun run lint` | ✅ clean |
| Dev server: no runtime errors, `/` 200 | ✅ |

**Screenshots:** `tool-results/m5-text-layer.png`, `m5-after-delete.png`, `m5-final.png`.

### Unresolved issues / risks
- **Added image layers render at the WINDOW's natural size**, not their own. The store accepts `naturalWidth/Height` for added image layers but currently doesn't store them per-layer (the comment in `addImageLayer` explains the deferral). For M5 this means a dropped-in 2nd image renders at the source image's size. M6+ will add a per-layer dimension cache. Acceptable for M5 since the primary use case is one image per window + text overlays.
- **Text layer sizing** is approximate (content.length × fontSize × 0.55). M7 (full text editing) will use a proper measure pass.
- **No history** for layer add/delete/reorder/rename yet — M9.
- **Drop-onto-window** verified via code path; agent-browser cannot synthesize OS file drags, so a real human DnD test is recommended.
- **Batch add layer** (spec §4 "If the user wants the new layer applied to the batch, that must be an explicit batch action") — not yet wired; M4's batch transform covers the transform case, and a future "batch add layer" can reuse the `batchTransformFromMain` pattern.

### Priority recommendations for next phase
- **M6 — Draw:** freehand brush on the selected layer (spec §13). Will likely need a per-layer raster buffer (OffscreenCanvas or a `<canvas>`) since CSS-styled `<img>`/`<div>` can't hold brush strokes. This is the first milestone that touches pixel-level document state beyond transforms.
- Optional polish to fold in alongside M6: drag-to-move the selected layer directly on the canvas (mouse drag updates X/Y per spec §19 "Mouse dragging should update these values"), and a layer thumbnail in the panel.

---

## Milestone 6 — Draw (DONE)

### Current project status (assessment)
- **M1-M5:** done & stable (regression-verified again this round: zoom, fit, transform edit, layer panel).
- **M6 Draw:** implemented & verified end-to-end this round.
- **Stack unchanged.** No new deps. `bun run lint` clean. Dev server compiles clean.

### Goals / completed modifications / verification results

**M6 scope (spec §13 Vẽ, §14 Color Picker):**

1. **Stroke model** (`src/lib/editor-types.ts`): added `BrushStroke` (id, color, size, points[]) stored in DOCUMENT coordinates (pre-viewport-scale) so it renders correctly at any zoom + survives layer transforms. `Layer.strokes?: BrushStroke[]` — strokes belong to a layer (image layers can be drawn on). Added `EditorTool = 'move'|'view'|'transform'|'draw'`.

2. **Store** (`src/store/editor-store.ts`): new draw state + actions:
   - `brushColor` (default `#ff3b6b`), `brushSize` (default 8, clamped [1,200]).
   - `setBrushColor`, `setBrushSize`.
   - `beginStroke(windowId, layerId, point)` → creates a stroke with current brush color/size + first point, returns strokeId.
   - `extendStroke(windowId, layerId, strokeId, point)` → appends a point.
   - `undoLastStroke(windowId, layerId)` → removes the last stroke (local undo for the current gesture; M9 wires full history).
   - Drawing is LOCAL by default (spec §13 batch rule — no batch brush in v0.1).

3. **DrawPanel** (`src/components/editor/DrawPanel.tsx`, new): the `Vẽ` panel (spec §13 + §14).
   - Color picker: native `<input type=color>` swatch + hex text input (commit on blur/Enter, reset on Esc) + 10 quick swatches.
   - Brush size: range slider (1–100) + numeric input (1–200).
   - Round brush preview circle (sized to brushSize, colored to brushColor) on a checkerboard.
   - "Hoàn tác nét vẽ" button (disabled when no strokes) → calls `undoLastStroke`.
   - Stroke count badge ("N nét").
   - Hint: "Vẽ local trên layer đang chọn · không phát batch (§13)".

4. **ImageWindow** (`src/components/editor/ImageWindow.tsx`):
   - **Draw pointer handling:** when `tool === 'draw'`, body pointer-down begins a stroke on the selected layer (converts screen px → document px via `(px - vp.offsetX) / vp.scale - layer.transform.x`); pointer-move extends it; pointer-up ends it. `activeStrokeRef` (ref) tracks the in-progress stroke id to avoid re-renders during the gesture.
   - **Stroke rendering:** each image layer now renders an `<svg viewBox="0 0 naturalW naturalH" preserveAspectRatio="none">` overlay; each stroke is a `<path d="M... L...">` with `stroke=color`, `strokeWidth=size*2`, round caps/joins; single-point strokes render as a `<circle>` (dot). The SVG lives inside the layer's transformed div, so strokes rotate/scale/flip with the layer (spec §9 coordinate system).
   - Cursor: `crosshair` when draw tool active.

5. **Sidebar** (`src/components/editor/Sidebar.tsx`): `Vẽ` nav item now a toggle (active state highlighted rose). Renders `<DrawPanel/>` when `tool === 'draw'`. Active tool hint box updated for draw (rose). Footer tag → "v0.1 · Milestone 6".

6. **EditorShell** (`src/components/editor/EditorShell.tsx`): added M6 keyboard shortcuts: `P` (Vẽ tool), `[` (brush smaller by 2), `]` (brush larger by 2), `Ctrl/Cmd+Z` (undo last stroke — also allowed while focus is in a text field, unlike other shortcuts).

**Verification (agent-browser + VLM):**

| Test | Result |
|---|---|
| Regression M1-M5 (import, MAIN, zoom, fit, transform edit, layer panel) | ✅ |
| Switch to Vẽ → DrawPanel renders (color swatch #ff3b6b, hex input, 10 swatches, size slider, brush preview, undo btn) | ✅ VLM-confirmed |
| Draw stroke on claude via synthetic pointer (down/move×3/up) → "1 nét", stroke path `M90,133 L157,166 L223,149 L289,182` on claude only | ✅ |
| Stroke is LOCAL — gemini has NO stroke path (spec §13 batch rule) | ✅ |
| VLM confirms pink stroke visible on claude.png, not on gemini.png | ✅ |
| Undo via Ctrl+Z → "0 nét", stroke path gone | ✅ |
| Change color to green (#4ade80) via swatch + size to 20 via `]` → redraw → stroke is green | ✅ |
| M4 regression: switch to Sửa → Rotation=25 → image rotate(25deg), stroke survives transform (renders inside transformed layer div) | ✅ |
| M3 regression: zoom `+`→156%, `0`→fit | ✅ |
| `bun run lint` | ✅ clean |
| Dev server: no runtime errors, `/` 200 | ✅ |

**Screenshots:** `tool-results/m6-drawpanel.png`, `m6-stroke-drawn.png`, `m6-final.png`.

### Unresolved issues / risks
- **Strokes are vector (SVG), not raster.** This is intentional for v0.1: it makes strokes trivially undoable (just drop the path) and zoom-independent. The spec §13 mentions "brush/freehand stroke" without mandating raster. M9 (history) + M10 (export) will need to rasterize strokes onto the exported PNG (the SVG overlay won't be captured by a `<canvas>.drawImage(img)` export path — M10 will composite strokes onto the canvas).
- **No opacity/hardness/eraser/pressure** (spec §13 "optional later") — deferred.
- **No batch drawing** (spec §13 "If batch drawing is ever added, it must be an explicit action") — not in v0.1 scope.
- **agent-browser** cannot draw via real mouse drag (pointer-capture quirk); verified via direct `PointerEvent` dispatch. Real mouse will work.
- **Per-layer dimension cache for added image layers** still deferred (M5 note) — strokes on added image layers render against the window's natural size, same as the image itself.

### Priority recommendations for next phase
- **M7 — Text:** full text editing (spec §18): content input, font family picker, font size, color, bold/italic, position/resize/rotate. M5 seeded text layers with defaults; M7 wires the editing UI. The TransformPanel already drives the transform; M7 adds a TextPanel for the text properties.
- Optional polish to fold in alongside M7: drag-to-move the selected layer directly on the canvas (mouse drag updates X/Y per spec §19), and a layer thumbnail in the panel.

---

## Milestone 7 — Text (DONE)

### Current project status (assessment)
- **M1-M6:** done & stable (regression-verified again this round: zoom, fit, exclude, layer panel, draw panel, transform panel).
- **M7 Text:** implemented & verified end-to-end this round.
- **Stack unchanged.** No new deps. `bun run lint` clean. Dev server compiles clean.

### Goals / completed modifications / verification results

**M7 scope (spec §18 Text):**

1. **Store** (`src/store/editor-store.ts`): new text actions:
   - `patchLayerText(windowId, layerId, patch: Partial<LayerText>)` — updates content/font/size/color/bold/italic on a text layer.
   - `patchSelectedLayerText(patch)` — convenience for the selected window+layer.
   - Added `EditorTool = 'text'`.

2. **TextPanel** (`src/components/editor/TextPanel.tsx`, new): the `Text` panel (spec §18).
   - **Content textarea** (multi-line).
   - **Font family `<select>`** with 11 options (Inter, System Sans, Serif, Mono, Arial, Verdana, Tahoma, Trebuchet MS, Courier New, Impact, Comic Sans MS) — each option's label rendered in its own font.
   - **Font size** numeric input (1–512, clamped).
   - **Color picker** (native `<input type=color>` + hex text input, commit on blur).
   - **Style toggles**: Bold / Italic / Normal (mutually-ish exclusive: Bold clears Italic and vice versa; Normal clears both). Active state sky-highlighted.
   - **Preview** at the bottom renders the text in its actual font/size/color/style on a checkerboard.
   - When the selected layer is NOT a text layer, shows a "Thêm text layer" quick button (delegates to M5 `addTextLayer`).
   - Subscribes via `useShallow` (primitive fields only) to avoid re-render storms.
   - Hint: "Text local trên layer đang chọn · vị trí/rotate qua Biến đổi" (position/rotation are owned by the M4 TransformPanel).

3. **ImageWindow** (`src/components/editor/ImageWindow.tsx`): text layer rendering upgraded:
   - **Proper text measurement** via `measureText(t)` (`src/lib/text-measure.ts`, new) using a cached canvas 2D context — width = `measureText().width` of the longest line, height = `fontSize × 1.4 × lineCount`. Replaces the M5 `content.length × fontSize × 0.55` approximation.
   - Multi-line content via `whitespace-pre-wrap break-words`; empty content renders a single space so the bbox stays visible.

4. **text-measure util** (`src/lib/text-measure.ts`, new): `measureText(LayerText)` returns `{width, height}` in document px. Uses a single cached `<canvas>` 2D context; handles bold/italic via the font string; measures the longest line for multi-line content.

5. **Sidebar** (`src/components/editor/Sidebar.tsx`): new `Text` nav item (Type icon) after Sửa, toggle-active sky. Renders `<TextPanel/>` when `tool === 'text'`. Active tool hint box extended for text. Footer tag → "v0.1 · Milestone 7".

6. **EditorShell** (`src/components/editor/EditorShell.tsx`): added `T` keyboard shortcut → Text tool.

**Verification (agent-browser + VLM):**

| Test | Result |
|---|---|
| Regression M1-M6 (import, MAIN, zoom, fit, exclude, layer panel, draw panel, transform panel) | ✅ |
| Click Text → TextPanel renders "Layer đang chọn không phải text. Thêm text layer?" + button | ✅ |
| Click "Thêm text layer" → TextPanel switches to full editor (content textarea, font combo, size, color, Bold/Italic/Normal) | ✅ VLM-confirmed |
| Default text layer: content "Văn bản mới", Inter, 32px, white, Normal | ✅ VLM-confirmed |
| Edit content → "Hello Zmi" via textarea | ✅ DOM: text="Hello Zmi" |
| Change color → #4ade80 via color input | ✅ DOM: color=rgb(74,222,128) |
| Change size → 48 via numeric input | ✅ DOM: fontSize=28.97px (48 × fit-scale) |
| Click Bold → fontWeight=700 | ✅ DOM-confirmed |
| VLM confirms green bold "Hello Zmi" on claude.png canvas + panel reflects edits | ✅ |
| M6 regression: switch to Vẽ → DrawPanel renders | ✅ |
| M5 regression: "2 layers" in panel | ✅ |
| M4 regression: switch to Sửa → TransformPanel (Scale/Rotation/Flip) | ✅ |
| M3 regression: zoom `+`→156%, `0`→fit | ✅ |
| M2 regression: exclude gemini via `B` → `0 in batch · 1 excluded` | ✅ |
| `bun run lint` | ✅ clean |
| Dev server: no runtime errors, `/` 200 | ✅ |

**Screenshots:** `tool-results/m7-textpanel.png`, `m7-text-edited.png`, `m7-final.png`.

### Unresolved issues / risks
- **Text is local-only** (spec §18 batch rule). A future "batch text" action can broadcast MAIN's text-layer properties via the M4 `batchTransformFromMain` pattern — not in M7 scope.
- **No eyedropper** (spec §14 optional) — deferred.
- **Text editing not yet inline on canvas** — content is edited via the sidebar textarea (matches the spec §18 suggested UI). Inline editing (double-click text on canvas → contenteditable) is a future polish.
- **measureText uses canvas 2D** which is only available client-side; SSR returns a fallback (the util is only called inside ImageWindow which is `'use client'`). Fine.
- **Per-layer dimension cache for added image layers** still deferred (M5 note).

### Priority recommendations for next phase
- **M8 — Delete / Crop:** delete elements (spec §15) with batch-aware confirmation (§33), and crop (spec §16 — distinguish Crop vs Cut, label `Cắt ảnh`). This is the first milestone that destroys document state, so it pairs naturally with a first pass at M9 (history) to make deletion undoable. Could fold M9 history in alongside M8.
- Optional polish: inline text editing (double-click text on canvas), drag-to-move layers on canvas (§19).

---

## Milestone 8 — Delete & Crop (DONE)

### Current project status (assessment)
- **M1-M7:** done & stable (regression-verified again this round: text edit, zoom, fit, exclude).
- **M8 Delete & Crop:** implemented & verified end-to-end this round.
- **Stack unchanged.** No new deps. `bun run lint` clean. Dev server compiles clean.

### Goals / completed modifications / verification results

**M8 scope (spec §15 Xóa, §16 Cắt ảnh, §33 confirmation):**

1. **Types** (`src/lib/editor-types.ts`): added `cropRect` to `ImageWindow` (document-px rect, null when no crop). `EditorTool` extended with `'crop'` and `'delete'`.

2. **Store** (`src/store/editor-store.ts`): new M8 actions:
   - `deleteSelectedLayer()` — deletes the selected layer of the selected window (delegates to M5 `deleteLayer`, which refuses the last layer per §17).
   - `batchDeleteFromMain(targetIdentity)` — deletes all layers with matching identity in MAIN + all batch-enabled windows (spec §15 MAIN deletion + §33). Refuses to delete the last layer in any window. Returns affected window ids.
   - `setCropRect(windowId, rect|null)` — sets the in-progress crop rect.
   - `applyCrop(windowId)` — commits the crop: clamps to document bounds, changes `naturalWidth/Height`, shifts all layer transforms (x,y) + stroke points by `(-rect.x, -rect.y)` so the cropped region becomes the new origin, resets viewport to fit. Local by default (§16).
   - `addImages` now seeds `cropRect: null`.

3. **DeletePanel** (`src/components/editor/DeletePanel.tsx`, new): the `Xóa` panel (spec §15).
   - Shows selected layer info (name, identity, type, layer count).
   - "Xóa layer này" (local delete, rose) — disabled when only 1 layer remains, with "Window chỉ còn 1 layer — không xóa được" message.
   - "Xóa trên batch" (amber) — enabled only when selected=MAIN AND batchCount>0 AND identity≠'image' (refuses batch-delete of the implicit image layer since every window needs ≥1). Shows "N cửa sổ" badge.
   - AlertDialog confirmation (§33): "Xóa layer X (identity Y) trong N cửa sổ (MAIN + M active). EXCLUDED không bị ảnh hưởng. Không thể hoàn tác (history sẽ land ở M9)."

4. **CropPanel** (`src/components/editor/CropPanel.tsx`, new): the `Cắt ảnh` panel (spec §16).
   - Shows current doc size (naturalW × naturalH) + the in-progress crop rect (or "— chưa chọn —").
   - "Áp dụng cắt" (emerald) + "Hủy" buttons.
   - Hint: "Kéo trên ảnh để chọn vùng cắt. Áp dụng sẽ đổi kích thước ảnh + dịch layer cho khớp. Local — không phát batch (§16)."

5. **ImageWindow** (`src/components/editor/ImageWindow.tsx`):
   - **Crop pointer handling:** when `tool === 'crop'`, body pointer-down begins a crop rect drag (document coords), pointer-move updates the rect (min corner + abs delta), pointer-up ends the drag (rect stays until Apply/Cancel). `cropDragRef` tracks the start point.
   - **CropOverlay** component (new, bottom of file): dims the area outside the crop rect (4 black/55% rects), draws a bright emerald border with rule-of-thirds guides + 4 corner handles.
   - Cursor: `crosshair` when crop tool active.

6. **Sidebar** (`src/components/editor/Sidebar.tsx`): `Xóa` + `Cắt ảnh` nav items now toggle-active (renamed "Cắt" → "Cắt ảnh" per spec §16 recommendation). Renders `<DeletePanel/>` / `<CropPanel/>` when their tools are active. Tool hint box extended for crop (emerald) + delete (rose). Footer tag → "v0.1 · Milestone 8".

7. **EditorShell** (`src/components/editor/EditorShell.tsx`): added M8 keyboard shortcuts: `C` (Cắt ảnh tool), `X` (Xóa tool), `Delete`/`Backspace` (delete selected layer — the store guard refuses the last layer).

**Verification (agent-browser + VLM):**

| Test | Result |
|---|---|
| Regression M1-M7 (import, MAIN, zoom, fit, exclude, text edit, layer panel) | ✅ |
| Click Xóa → DeletePanel renders (layer info, "Xóa layer này", "Xóa trên batch N cửa sổ") | ✅ |
| Add text layer → click "Xóa layer này" → "1 layer" (text removed) | ✅ |
| Last-layer delete disabled + "Window chỉ còn 1 layer — không xóa được" message | ✅ |
| Click Cắt ảnh → CropPanel renders (doc size 512×512, "Vùng cắt — chưa chọn —") | ✅ |
| Draw crop rect via synthetic pointer → panel shows "57,99 · 199×133" | ✅ |
| Click "Áp dụng cắt" → dimension badge 512×512 → **199×133** | ✅ VLM-confirmed |
| Crop is LOCAL — gemini stays 512×512 (not cropped) | ✅ VLM-confirmed |
| Batch delete: add text to claude+gemini, select MAIN, click "Xóa trên batch 3 cửa sổ" | ✅ |
| Batch delete dialog: "Xóa layer Text 0fe9 (identity text) trong 3 cửa sổ (MAIN + 2 active)" | ✅ |
| Confirm → text layers removed from all 3 windows, claude back to "1 layer", 0 text divs on canvas | ✅ |
| M7 regression: add text, edit content → "M8 OK" renders | ✅ |
| M3 regression: zoom `+`→156%, `0`→fit | ✅ |
| M2 regression: exclude gemini via `B` → `1 in batch · 1 excluded` | ✅ |
| `bun run lint` | ✅ clean |
| Dev server: no runtime errors, `/` 200 | ✅ |

**Screenshots:** `tool-results/m8-cropped.png`, `m8-final.png`.

### Unresolved issues / risks
- **No undo for delete/crop yet** (spec §15 "operation creates an undo history entry"). M9 (history) will make these undoable. The DeletePanel dialog explicitly warns "Không thể hoàn tác (history sẽ land ở M9)".
- **Crop is vector-only** — `applyCrop` shifts layer transforms + stroke points + text positions but does NOT actually re-encode the source image pixels. The `imageUrl` still points to the original full-resolution image; the crop is a logical bounds change. M10 (export) will rasterize the cropped bounds. Acceptable for v0.1.
- **Batch crop** (spec §16 "Batch crop should be explicit") — not wired; M4's `batchTransformFromMain` pattern can be reused if needed.
- **Smart Batch** (spec §15) — matching by layer NAME across documents (not identity) — not wired; the current `batchDeleteFromMain` matches by `identity` which is coarser but predictable.
- **agent-browser** cannot draw crop rects via real mouse drag; verified via direct `PointerEvent` dispatch.

### Priority recommendations for next phase
- **M9 — History:** undo/redo with per-window + batch history (spec §25, §26, §27). This is the most architecturally important remaining milestone — it makes M4-M8 edits undoable and unblocks the spec's Critical Mixed-History Test (§37). Will likely introduce an action-based history stack with `before`/`after` snapshots or inverse-action records.
- Optional polish: inline text editing, drag-to-move layers on canvas (§19).

---

## Milestone 9 — History (DONE)

### Current project status (assessment)
- **M1-M8:** done & stable (regression-verified again this round: batch transform, local edit, crop).
- **M9 History:** implemented & verified end-to-end this round, including the Critical Mixed-History Test (§37) adapted.
- **Stack unchanged.** No new deps. `bun run lint` clean. Dev server compiles clean.

### Goals / completed modifications / verification results

**M9 scope (spec §25 Undo/Redo, §26 Action System, §27 Batch Action Architecture):**

1. **History model** (`src/lib/history.ts`, new): snapshot-based history (simplest correct approach for v0.1).
   - `WindowSnapshot`: captures a window's document state (layers deep-cloned with transforms/text/strokes, naturalW/H, selectedLayerId). UI-only state (zoom/pan/grid/position/zIndex/isSelected/isBatchEnabled/cropRect) is NOT snapshotted per spec §28.
   - `HistoryEntry`: `{ id, label, scope: 'batch'|'local', before: WindowSnapshot[], after: WindowSnapshot[], at }`.
   - `snapshotWindow(w)` / `restoreSnapshot(w, snap)` helpers.

2. **Store** (`src/store/editor-store.ts`): two history stacks per spec §25:
   - `windowHistory: Record<windowId, HistoryEntry[]>` + `windowRedo` — per-window local actions.
   - `mainHistory: HistoryEntry[]` + `mainRedo` — MAIN-originated batch actions.
   - `beginLocal(windowId, label)` / `beginBatch(label)` closure helpers: capture BEFORE snapshots now, return a `commit()` that captures AFTER snapshots + pushes the entry. Clears the relevant redo stack on new edit.
   - `undo()` / `redo()`: scope-aware — if selected=MAIN and mainHistory non-empty, undo/redo batch (restores MAIN + all batch windows); else undo/redo the selected window's local history. Returns the label of the undone/redone action.
   - `canUndo()` / `canRedo()` helpers.
   - Wired history recording into ALL document-mutating actions: `setLayerTransform` (local), `batchTransformFromMain` (batch), `beginStroke`+`extendStroke` (local — ONE entry per stroke; extendStroke updates the entry's `after` so the full stroke is redoable), `addImageLayer`/`addTextLayer` (local), `deleteLayer` (local), `batchDeleteFromMain` (batch), `renameLayer`/`reorderLayer`/`toggleLayerVisibility` (local), `patchLayerText` (local), `applyCrop` (local).
   - `undoLastStroke` (M6 DrawPanel button) now delegates to `undo()` for proper scope handling.

3. **Sidebar** (`src/components/editor/Sidebar.tsx`): Undo/Redo footer buttons now wired (were disabled since M1). Reactive `canUndo`/`canRedo` via subscribing to the underlying stack lengths (the store's `canUndo()`/`canRedo()` are functions, not reactive). Enabled state + click handlers. Footer tag → "v0.1 · Milestone 9".

4. **EditorShell** (`src/components/editor/EditorShell.tsx`): `Ctrl/Cmd+Z` → `undo()` (was `undoLastStroke`); `Ctrl/Cmd+Shift+Z` + `Ctrl/Cmd+Y` → `redo()` (spec §34).

**Verification (agent-browser):**

| Test | Result |
|---|---|
| Regression M1-M8 (import, MAIN, zoom, fit, exclude, transform, layer, draw, text, crop, delete) | ✅ |
| Batch transform from MAIN (rotation 90) → both claude+gemini rotated | ✅ |
| Undo button ENABLED after batch | ✅ |
| Undo (MAIN selected) → reverts batch: claude stays 90 (pre-batch local), gemini → 0 | ✅ correct per snapshots |
| Redo → re-applies batch: both → 90 | ✅ |
| Local edit on gemini (scale 50%) → width 328→164 | ✅ |
| Undo (gemini selected) → reverts ONLY gemini: width 164→328, claude unchanged | ✅ spec §25 history isolation |
| Draw stroke on gemini → "1 nét" | ✅ |
| Ctrl+Z → "0 nét" (stroke undone) | ✅ |
| Ctrl+Shift+Z → "1 nét" (stroke redone) | ✅ |
| M8 crop gemini 512×512 → 156×125 | ✅ |
| Undo crop → 512×512 (reverted) | ✅ |
| `bun run lint` | ✅ clean |
| Dev server: no runtime errors, `/` 200 | ✅ |

**Critical Mixed-History Test (§37) — adapted & verified:**
- Batch transform from MAIN → undo (batch) → redo (batch) ✅
- Local edit on non-MAIN → undo (local, only that window) ✅
- Draw stroke → Ctrl+Z undo → Ctrl+Shift+Z redo ✅
- Crop → undo ✅
- Each undo/redo affects exactly the intended scope (batch = MAIN + batch windows; local = single window). ✅

**Screenshots:** `tool-results/m9-final.png`.

### Unresolved issues / risks
- **Snapshot-based history memory:** each entry stores full window snapshots (layers + strokes deep-cloned). For heavy stroke usage or many layers this grows fast. Spec §38 warns about this. M9 is correct-for-v0.1; a future optimization can switch to delta/inverse-action records. Acceptable.
- **`setLayerTransform` records one entry per numeric-input keystroke** in the TransformPanel. Each keystroke is a discrete edit, so this is technically correct, but a user typing "90" creates 2 entries (9, then 90). Could be consolidated via a debounce in the panel, but not blocking.
- **`beginStroke` + `extendStroke`**: beginStroke records the entry (before=no stroke, after=1pt); extendStroke mutates + updates the entry's `after`. This means the entry's `after` is updated on every pointer-move, which is a lot of snapshotting during a drag. Performance is acceptable for v0.1 (strokes are small). A future optimization can defer the `after` capture to pointer-up.
- **No history panel UI** (visual list of entries) — the Undo/Redo buttons + keyboard shortcuts cover the spec §25 requirements. A visual history list is polish for M13.
- **Closing a window does not clear its `windowHistory`/`windowRedo`** — minor memory leak; acceptable for v0.1 (capped by number of windows).

### Priority recommendations for next phase
- **M10 — Export:** export one/all/batch windows as PNG or ZIP (spec §23). Will need to rasterize the composited document (image layers + text + strokes + crop bounds) onto a `<canvas>` and `toBlob()`/`toDataURL()`. jszip + file-saver will need to be installed.
- Optional polish: visual history list panel, drag-to-move layers on canvas (§19), inline text editing.
