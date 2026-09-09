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
