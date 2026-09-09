// Zmi EDT — single Zustand store (spec §39: single source of truth)
'use client'

import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import {
  type ImageWindow,
  type Layer,
  type LayerTransform,
  type EditorTool,
  type BrushStroke,
  MIN_WINDOW_W,
  MIN_WINDOW_H,
  MAX_DISPLAY_W,
  MIN_ZOOM,
  MAX_ZOOM,
  defaultTransform,
} from '@/lib/editor-types'
import {
  type HistoryEntry,
  type WindowSnapshot,
  snapshotWindow,
  restoreSnapshot,
} from '@/lib/history'
import {
  isSupportedImage,
  readImageFile,
  computeDisplaySize,
} from '@/lib/image-utils'

interface EditorState {
  // ---- state ----
  windows: ImageWindow[]
  /** Single source of truth for selection. `windows[].isSelected` mirrors this. */
  selectedWindowId: string | null
  /** Single source of truth for MAIN (spec §39). `isMain` is derived, never stored per-window. */
  mainId: string | null
  /** Monotonic z-index counter — incremented to bring a window to front. */
  zCounter: number
  /** Cursor for cascading placement of newly imported windows. */
  placementCursor: { x: number; y: number; n: number }
  /** Active sidebar tool (spec §10 Di chuyển, §11 Xem). UI state. */
  tool: EditorTool

  // ---- actions ----
  /**
   * Import image files as new windows. Silently skips unsupported files.
   * Resolves with the number of windows actually created.
   */
  addImages: (files: File[] | FileList) => Promise<number>
  /** Close a window, revoke its object URL, clear selection if it was selected.
   * If the closed window was MAIN, auto-reassign MAIN to the topmost remaining
   * window (or null). Callers must gate MAIN close behind a confirmation (§5). */
  closeWindow: (id: string) => void
  /** Select a window (or null to clear). Also brings it to front. */
  selectWindow: (id: string | null) => void
  /** Move a window to workspace coordinates (window position only — never image content). */
  moveWindow: (id: string, x: number, y: number) => void
  /** Bring a window to the top of the stacking order. */
  bringToFront: (id: string) => void
  /** Set a window as MAIN (spec §7). Pass null to clear MAIN. Also selects it. */
  setMain: (id: string | null) => void
  /** Toggle a window's batch participation (spec §5 `_`). No-op if the window is MAIN. */
  toggleBatchEnabled: (id: string) => void
  /** Set the active sidebar tool (spec §10/§11). */
  setTool: (tool: EditorTool) => void
  /** Set a window's zoom multiplier (clamped). Turns off fitMode. (spec §20) */
  setWindowZoom: (id: string, zoom: number) => void
  /** Add a screen-space delta to a window's pan offset. (spec §20) */
  panWindowBy: (id: string, dx: number, dy: number) => void
  /** Reset a window to fit-to-window mode. (spec §11/§20) */
  fitWindow: (id: string) => void
  /** Reset a window to 100% zoom, centered. (spec §11/§20) */
  resetWindowZoom100: (id: string) => void
  /** Step a window's zoom by a factor (anchored at the window center). */
  zoomWindowBy: (id: string, factor: number) => void
  /** Toggle the pixel grid on a window. (spec §21) */
  toggleWindowGrid: (id: string) => void
  /** Resize a window (px). Clamps to min size. (bonus polish) */
  resizeWindow: (id: string, width: number, height: number) => void

  // ---- M4: transform (spec §19) — document state, will participate in history (M9) ----
  /** Update the transform of the selected layer in a window (local, not batch). */
  setLayerTransform: (windowId: string, layerId: string, patch: Partial<LayerTransform>) => void
  /** Patch the selected layer's transform in the selected window. Convenience. */
  patchSelectedLayerTransform: (patch: Partial<LayerTransform>) => void
  /**
   * Batch transform from MAIN (spec §7 batch rule, §8 action system).
   * Copies MAIN's selected layer's CURRENT transform to the layer with
   * matching `targetIdentity` in every batch-enabled window (MAIN included,
   * where it's a no-op since the source IS MAIN). Excluded windows are NOT
   * touched. Returns the list of affected window ids.
   *
   * NOTE: We broadcast the ABSOLUTE transform (not a delta). This keeps
   * per-window local edits out of the broadcast — windows that previously had
   * a different local transform are overwritten to match MAIN, which matches
   * the spec's "MAIN is the source of batch actions" rule. M9 (history) will
   * make this undoable.
   */
  batchTransformFromMain: (
    targetIdentity: string,
    absoluteTransform: LayerTransform,
  ) => string[]
  /** Flip the selected layer on X or Y (local; also available as batch). */
  flipSelectedLayer: (axis: 'x' | 'y') => void

  // ---- M5: Layers (spec §17) — document state ----
  /** Add an image layer to a window (spec §4 drop-onto-window). Returns the new layer id. */
  addImageLayer: (windowId: string, imageUrl: string, naturalWidth: number, naturalHeight: number, name?: string) => string
  /** Add a text layer to a window (spec §18, M5 preview). Returns the new layer id. */
  addTextLayer: (windowId: string, content?: string) => string
  /** Select a layer within a window (spec §17). */
  selectLayer: (windowId: string, layerId: string | null) => void
  /** Toggle layer visibility (spec §17 hide/show). */
  toggleLayerVisibility: (windowId: string, layerId: string) => void
  /** Rename a layer (spec §17). */
  renameLayer: (windowId: string, layerId: string, name: string) => void
  /** Reorder a layer (move by `delta` positions; negative = down). */
  reorderLayer: (windowId: string, layerId: string, delta: number) => void
  /** Delete a layer (spec §17). Refuses to delete the last remaining layer. */
  deleteLayer: (windowId: string, layerId: string) => void
  /** Drop an image file onto an existing window → adds it as a layer (spec §4). */
  dropImageIntoWindow: (windowId: string, file: File) => Promise<boolean>

  // ---- M6: Draw (spec §13) — document state, local-only by default (§13 batch rule) ----
  /** Current brush color (hex). UI state shared across windows. */
  brushColor: string
  /** Current brush radius in document px. UI state. */
  brushSize: number
  /** Set the brush color. */
  setBrushColor: (color: string) => void
  /** Set the brush radius (clamped to [1, 200]). */
  setBrushSize: (size: number) => void
  /**
   * Begin a new stroke on the selected layer of the given window. Returns the
   * stroke id (so the caller can `extendStroke`/`endStroke`). The stroke starts
   * with a single point. Local-only (spec §13 batch rule).
   */
  beginStroke: (windowId: string, layerId: string, point: { x: number; y: number }) => string
  /** Append a point to the in-progress stroke. */
  extendStroke: (windowId: string, layerId: string, strokeId: string, point: { x: number; y: number }) => void
  /** Remove the last stroke from a layer (local undo for the current gesture; M9 will wire full history). */
  undoLastStroke: (windowId: string, layerId: string) => void

  // ---- M7: Text (spec §18) — document state on text layers ----
  /** Patch the text properties of a text layer (content/font/size/color/bold/italic). */
  patchLayerText: (
    windowId: string,
    layerId: string,
    patch: Partial<import('@/lib/editor-types').LayerText>,
  ) => void
  /** Convenience: patch the text of the selected layer in the selected window. */
  patchSelectedLayerText: (
    patch: Partial<import('@/lib/editor-types').LayerText>,
  ) => void

  // ---- M8: Delete / Crop (spec §15 Xóa, §16 Cắt ảnh) ----
  /**
   * Delete the selected layer of the selected window. Refuses to delete the
   * last remaining layer (spec §17). Returns true if deleted.
   * (Use `batchDeleteFromMain` for batch-aware deletion from MAIN.)
   */
  deleteSelectedLayer: () => void
  /**
   * Batch delete from MAIN (spec §15 MAIN deletion + §33 confirmation).
   * Deletes the layer with matching `targetIdentity` in MAIN + all batch-enabled
   * windows. Returns the list of affected window ids.
   */
  batchDeleteFromMain: (targetIdentity: string) => string[]
  /** Set the in-progress crop rect on a window (spec §16). Document px. */
  setCropRect: (windowId: string, rect: { x: number; y: number; w: number; h: number } | null) => void
  /**
   * Commit the in-progress crop on a window (spec §16). Changes the document
   * bounds (naturalWidth/Height) and shifts all layer transforms + stroke
   * points + text positions by (-rect.x, -rect.y) so the cropped region
   * becomes the new origin. Local by default (spec §16 batch crop is explicit).
   */
  applyCrop: (windowId: string) => void

  // ---- M9: History (spec §25, §26, §27) ----
  /** Per-window local history stacks (spec §25 windowHistory[id]). */
  windowHistory: Record<string, import('@/lib/history').HistoryEntry[]>
  /** Redo stacks for per-window local history. */
  windowRedo: Record<string, import('@/lib/history').HistoryEntry[]>
  /** MAIN batch history stack (spec §25 mainHistory). */
  mainHistory: import('@/lib/history').HistoryEntry[]
  /** MAIN batch redo stack. */
  mainRedo: import('@/lib/history').HistoryEntry[]
  /**
   * Undo the most recent edit. If the selected window is MAIN and mainHistory
   * is non-empty, undo the last batch action (spec §25). Otherwise undo the
   * selected window's last local action. Returns the label of the undone
   * action, or null if nothing to undo.
   */
  undo: () => string | null
  /** Redo the most recently undone edit (same scope rule as undo). */
  redo: () => string | null
  /** Whether undo is available for the current selection scope. */
  canUndo: () => boolean
  /** Whether redo is available for the current selection scope. */
  canRedo: () => boolean

  // ---- M11: Asset Library (spec §24) ----
  /** Registry of uploaded assets (spec §24). Reusable across windows. */
  assets: import('@/lib/editor-types').UploadedAsset[]
  /**
   * Add an uploaded file to the asset library (dedup by fileName + dims).
   * Returns the asset id. Called by `addImages` automatically on import.
   */
  addAsset: (file: File) => Promise<string>
  /** Delete an asset from the library (revokes its object URL). */
  deleteAsset: (assetId: string) => void
  /** Create a new window from an existing asset (no file re-read). */
  createWindowFromAsset: (assetId: string) => string | null
  /** Add an asset as a new image layer to an existing window (spec §4/§24 reuse). */
  addAssetAsLayer: (windowId: string, assetId: string) => string | null

  // ---- M12: Ngắm waifu (spec §22) — viewing mode, UI state only ----
  /** Whether waifu viewing mode is active (spec §22). UI state, not history. */
  waifuMode: boolean
  /** Toggle waifu viewing mode (spec §22). Does not alter document state. */
  toggleWaifuMode: () => void
}

/** Initial offset for the first imported window (relative to workspace origin). */
const FIRST_OFFSET = { x: 64, y: 48 }
/** Step between cascading windows. */
const CASCADE_STEP = { x: 28, y: 28 }
/** Wrap cascade after this many consecutive windows to avoid drifting off-screen. */
const CASCADE_WRAP = 6

export const useEditorStore = create<EditorState>((set, get) => {
  // ---- M9 history helpers (closure over set/get) ----
  /**
   * Record a LOCAL history entry for a single window. Captures BEFORE snapshots
   * now (caller calls this BEFORE mutating), then captures AFTER snapshots
   * post-mutation via `commitLocal`. Returns a commit function.
   *
   * Usage:
   *   const commit = beginLocal(windowId, 'Draw stroke')
   *   // ... mutate state ...
   *   commit()
   */
  const beginLocal = (windowId: string, label: string) => {
    const w = get().windows.find((x) => x.id === windowId)
    if (!w) return () => {}
    const before: WindowSnapshot[] = [snapshotWindow(w)]
    return () => {
      const w2 = get().windows.find((x) => x.id === windowId)
      if (!w2) return
      const after: WindowSnapshot[] = [snapshotWindow(w2)]
      const entry: HistoryEntry = {
        id: uuid(),
        label,
        scope: 'local',
        before,
        after,
        at: Date.now(),
      }
      set((s) => ({
        windowHistory: {
          ...s.windowHistory,
          [windowId]: [...(s.windowHistory[windowId] ?? []), entry],
        },
        // Clear redo for this window on new edit (standard undo/redo semantics).
        windowRedo: {
          ...s.windowRedo,
          [windowId]: [],
        },
      }))
    }
  }

  /**
   * Record a BATCH history entry (MAIN-originated). Captures BEFORE snapshots
   * of MAIN + all batch-enabled windows now; caller mutates; `commitBatch`
   * captures AFTER. Lives in mainHistory (spec §25).
   */
  const beginBatch = (label: string) => {
    const state = get()
    const mainId = state.mainId
    if (!mainId) return () => {}
    const affected = state.windows.filter(
      (w) => w.id === mainId || w.isBatchEnabled,
    )
    const before: WindowSnapshot[] = affected.map(snapshotWindow)
    return () => {
      const afterState = get()
      const afterAffected = afterState.windows.filter((w) =>
        affected.some((a) => a.id === w.id),
      )
      const after: WindowSnapshot[] = afterAffected.map(snapshotWindow)
      const entry: HistoryEntry = {
        id: uuid(),
        label,
        scope: 'batch',
        before,
        after,
        at: Date.now(),
      }
      set((s) => ({
        mainHistory: [...s.mainHistory, entry],
        mainRedo: [], // clear batch redo on new batch edit
      }))
    }
  }

  return {
  windows: [],
  selectedWindowId: null,
  mainId: null,
  zCounter: 10,
  placementCursor: { ...FIRST_OFFSET, n: 0 },
  tool: 'move',
  // M6 draw defaults (spec §13: brush size + color)
  brushColor: '#ff3b6b',
  brushSize: 8,
  // M9 history (spec §25)
  windowHistory: {},
  windowRedo: {},
  mainHistory: [],
  mainRedo: [],
  // M11 asset library (spec §24)
  assets: [],
  // M12 waifu viewing mode (spec §22) — UI state only
  waifuMode: false,

  addImages: async (files) => {
    const list = Array.from(files)
    const supported = list.filter(isSupportedImage)
    if (supported.length === 0) return 0

    const created: ImageWindow[] = []
    let firstCreatedId: string | null = null

    for (const file of supported) {
      try {
        const { imageUrl, naturalWidth, naturalHeight } = await readImageFile(file)
        // M11: register the file as a reusable asset (dedup). The asset shares
        // the SAME object URL as the window (so no double-revoke). Closing the
        // window won't revoke it; only deleting the asset will.
        void get().addAsset(file).catch(() => {})
        const { width, height } = computeDisplaySize(
          naturalWidth,
          naturalHeight,
          MAX_DISPLAY_W,
        )
        const id = uuid()
        const cursor = get().placementCursor
        // wrap cascade so windows don't drift forever
        const wrapIndex = cursor.n % CASCADE_WRAP
        const x = FIRST_OFFSET.x + wrapIndex * CASCADE_STEP.x
        const y = FIRST_OFFSET.y + wrapIndex * CASCADE_STEP.y
        const nextZ = get().zCounter + 1

        const win: ImageWindow = {
          id,
          fileName: file.name || `image-${id.slice(0, 6)}.png`,
          imageUrl,
          naturalWidth,
          naturalHeight,
          x,
          y,
          width: Math.max(MIN_WINDOW_W, width),
          height: Math.max(MIN_WINDOW_H, height),
          zIndex: nextZ,
          isSelected: false,
          isBatchEnabled: true,
          // M3 view state (UI state, not history — spec §28)
          zoom: 1,
          panX: 0,
          panY: 0,
          fitMode: true,
          showGrid: false,
          // M4 document state: one implicit image layer holding source pixels.
          // Every imported image shares identity='image' so MAIN transforms
          // broadcast to the image layer of every batch-enabled window (§8).
          layers: [
            {
              id: uuid(),
              name: file.name || `image-${id.slice(0, 6)}.png`,
              type: 'image',
              visible: true,
              transform: defaultTransform(),
              identity: 'image',
            } satisfies Layer,
          ],
          selectedLayerId: null,
          // M8 crop in-progress rect (null = no crop being drawn)
          cropRect: null,
          importedAt: Date.now(),
        }
        // default selection = the only layer
        win.selectedLayerId = win.layers[0].id
        created.push(win)
        if (!firstCreatedId) firstCreatedId = id

        set((s) => ({
          windows: [...s.windows, win],
          zCounter: nextZ,
          placementCursor: { x, y, n: cursor.n + 1 },
        }))
      } catch (err) {
        // Per spec §32: a corrupt image must not crash the workspace.
        console.error('[Zmi EDT] import failed for', file.name, err)
      }
    }

    // Select the first newly created window (spec §6: one active target).
    if (firstCreatedId) {
      get().selectWindow(firstCreatedId)
      // Auto-assign MAIN when there is none yet, so the batch concept is
      // immediately visible (spec §5: keep a valid MAIN whenever possible).
      if (get().mainId === null) {
        get().setMain(firstCreatedId)
      }
    }
    return created.length
  },

  closeWindow: (id) => {
    const win = get().windows.find((w) => w.id === id)
    if (!win) return
    // M11: only revoke the object URL if NO asset in the library shares it.
    // Windows created via `createWindowFromAsset` reuse the asset's URL, so
    // revoking here would break the asset + other windows using it.
    const urlSharedWithAsset = get().assets.some((a) => a.imageUrl === win.imageUrl)
    if (!urlSharedWithAsset) {
      URL.revokeObjectURL(win.imageUrl)
    }

    const remaining = get().windows.filter((w) => w.id !== id)
    const wasSelected = win.isSelected
    const wasMain = get().mainId === id
    let nextSelectedId: string | null = get().selectedWindowId
    let nextMainId: string | null = get().mainId

    if (wasSelected) {
      nextSelectedId =
        remaining.length > 0
          ? [...remaining].sort((a, b) => b.zIndex - a.zIndex)[0].id
          : null
    }

    if (wasMain) {
      // §5: after MAIN is removed, choose another eligible active window as
      // MAIN automatically if possible; otherwise MAIN becomes null.
      nextMainId =
        remaining.length > 0
          ? [...remaining].sort((a, b) => b.zIndex - a.zIndex)[0].id
          : null
    }

    set({
      windows: remaining.map((w) => ({
        ...w,
        isSelected: w.id === nextSelectedId,
      })),
      selectedWindowId: nextSelectedId,
      mainId: nextMainId,
    })
  },

  selectWindow: (id) => {
    if (id === null) {
      set((s) => ({
        windows: s.windows.map((w) => ({ ...w, isSelected: false })),
        selectedWindowId: null,
      }))
      return
    }
    const nextZ = get().zCounter + 1
    set((s) => ({
      windows: s.windows.map((w) => ({
        ...w,
        isSelected: w.id === id,
        zIndex: w.id === id ? nextZ : w.zIndex,
      })),
      selectedWindowId: id,
      zCounter: nextZ,
    }))
  },

  moveWindow: (id, x, y) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, x: Math.round(x), y: Math.round(y) }
          : w,
      ),
    }))
  },

  bringToFront: (id) => {
    const nextZ = get().zCounter + 1
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, zIndex: nextZ } : w,
      ),
      zCounter: nextZ,
    }))
  },

  setMain: (id) => {
    if (id === null) {
      set({ mainId: null })
      return
    }
    // The window must exist; making it MAIN also selects it (spec §6).
    if (!get().windows.some((w) => w.id === id)) return
    const nextZ = get().zCounter + 1
    set((s) => ({
      mainId: id,
      selectedWindowId: id,
      windows: s.windows.map((w) => ({
        ...w,
        isSelected: w.id === id,
        // MAIN is always part of the batch (it is the source). Lock it on.
        isBatchEnabled: w.id === id ? true : w.isBatchEnabled,
        zIndex: w.id === id ? nextZ : w.zIndex,
      })),
      zCounter: nextZ,
    }))
  },

  toggleBatchEnabled: (id) => {
    // §5: MAIN cannot be excluded (it is the source of batch actions).
    if (get().mainId === id) return
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, isBatchEnabled: !w.isBatchEnabled } : w,
      ),
    }))
  },

  setTool: (tool) => set({ tool }),

  setWindowZoom: (id, zoom) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, zoom: z, fitMode: false } : w,
      ),
    }))
  },

  panWindowBy: (id, dx, dy) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, panX: Math.round(w.panX + dx), panY: Math.round(w.panY + dy) }
          : w,
      ),
    }))
  },

  fitWindow: (id) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, fitMode: true, panX: 0, panY: 0, zoom: 1 }
          : w,
      ),
    }))
  },

  resetWindowZoom100: (id) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? { ...w, fitMode: false, zoom: 1, panX: 0, panY: 0 }
          : w,
      ),
    }))
  },

  zoomWindowBy: (id, factor) => {
    const w = get().windows.find((x) => x.id === id)
    if (!w) return
    // If currently in fit mode, switch to explicit zoom anchored at 1x first.
    const baseZoom = w.fitMode ? 1 : w.zoom
    get().setWindowZoom(id, baseZoom * factor)
  },

  toggleWindowGrid: (id) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, showGrid: !w.showGrid } : w,
      ),
    }))
  },

  resizeWindow: (id, width, height) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              width: Math.max(MIN_WINDOW_W, Math.round(width)),
              height: Math.max(MIN_WINDOW_H, Math.round(height)),
            }
          : w,
      ),
    }))
  },

  setLayerTransform: (windowId, layerId, patch) => {
    // M9: record local history (spec §25). Skip if this is part of an active
    // stroke drag (those record one entry on pointer-up via commitStrokeHistory).
    const commit = beginLocal(windowId, 'Biến đổi layer')
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              layers: w.layers.map((l) =>
                l.id === layerId
                  ? { ...l, transform: { ...l.transform, ...patch } }
                  : l,
              ),
            }
          : w,
      ),
    }))
    commit()
  },

  patchSelectedLayerTransform: (patch) => {
    const sel = get().selectedWindowId
    if (!sel) return
    const w = get().windows.find((x) => x.id === sel)
    if (!w || !w.selectedLayerId) return
    get().setLayerTransform(sel, w.selectedLayerId, patch)
  },

  batchTransformFromMain: (targetIdentity, absoluteTransform) => {
    const mainId = get().mainId
    if (!mainId) return []
    // M9: record ONE batch history entry (spec §25 mainHistory + §27).
    const commitBatch = beginBatch('Batch biến đổi')
    // Eligible windows: MAIN + all non-MAIN batch-enabled windows (spec §7).
    const affected: string[] = []
    set((s) => ({
      windows: s.windows.map((w) => {
        const eligible = w.id === mainId || w.isBatchEnabled
        if (!eligible) return w
        // Find the layer with matching identity (spec §8 target matching).
        const layer = w.layers.find((l) => l.identity === targetIdentity)
        if (!layer) return w // no match → leave unchanged (§8: do not modify unrelated)
        affected.push(w.id)
        return {
          ...w,
          layers: w.layers.map((l) =>
            l.id === layer.id
              ? { ...l, transform: { ...absoluteTransform } }
              : l,
          ),
        }
      }),
    }))
    commitBatch()
    return affected
  },

  flipSelectedLayer: (axis) => {
    const sel = get().selectedWindowId
    if (!sel) return
    const w = get().windows.find((x) => x.id === sel)
    if (!w || !w.selectedLayerId) return
    const layer = w.layers.find((l) => l.id === w.selectedLayerId)
    if (!layer) return
    const patch =
      axis === 'x' ? { flipX: !layer.transform.flipX } : { flipY: !layer.transform.flipY }
    get().setLayerTransform(sel, layer.id, patch)
  },

  addImageLayer: (windowId, imageUrl, naturalWidth, naturalHeight, name) => {
    const commit = beginLocal(windowId, 'Thêm image layer')
    const id = uuid()
    const layer: Layer = {
      id,
      name: name || `image-${id.slice(0, 6)}.png`,
      type: 'image',
      visible: true,
      transform: defaultTransform(),
      identity: 'image',
    }
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              layers: [...w.layers, layer],
              selectedLayerId: id,
            }
          : w,
      ),
    }))
    commit()
    void naturalWidth
    void naturalHeight
    void imageUrl
    return id
  },

  addTextLayer: (windowId, content) => {
    const commit = beginLocal(windowId, 'Thêm text layer')
    const id = uuid()
    const layer: Layer = {
      id,
      name: `Text ${id.slice(0, 4)}`,
      type: 'text',
      visible: true,
      transform: { ...defaultTransform(), x: 16, y: 16 },
      identity: 'text',
      text: {
        content: content ?? 'Văn bản mới',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 32,
        color: '#ffffff',
        bold: false,
        italic: false,
      },
    }
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              layers: [...w.layers, layer],
              selectedLayerId: id,
            }
          : w,
      ),
    }))
    commit()
    return id
  },

  selectLayer: (windowId, layerId) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId ? { ...w, selectedLayerId: layerId } : w,
      ),
    }))
  },

  toggleLayerVisibility: (windowId, layerId) => {
    const commit = beginLocal(windowId, 'Ẩn/hiện layer')
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              layers: w.layers.map((l) =>
                l.id === layerId ? { ...l, visible: !l.visible } : l,
              ),
            }
          : w,
      ),
    }))
    commit()
  },

  renameLayer: (windowId, layerId, name) => {
    const commit = beginLocal(windowId, 'Đổi tên layer')
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              layers: w.layers.map((l) =>
                l.id === layerId ? { ...l, name: name.slice(0, 64) } : l,
              ),
            }
          : w,
      ),
    }))
    commit()
  },

  reorderLayer: (windowId, layerId, delta) => {
    const commit = beginLocal(windowId, 'Sắp xếp layer')
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== windowId) return w
        const idx = w.layers.findIndex((l) => l.id === layerId)
        if (idx < 0) return w
        const newIdx = Math.min(w.layers.length - 1, Math.max(0, idx + delta))
        if (newIdx === idx) return w
        const layers = [...w.layers]
        const [moved] = layers.splice(idx, 1)
        layers.splice(newIdx, 0, moved)
        return { ...w, layers }
      }),
    }))
    commit()
  },

  deleteLayer: (windowId, layerId) => {
    const commit = beginLocal(windowId, 'Xóa layer')
    set((s) => ({
      windows: s.windows.map((w) => {
        if (w.id !== windowId) return w
        if (w.layers.length <= 1) return w // spec §17: keep at least one layer
        const layers = w.layers.filter((l) => l.id !== layerId)
        const selectedLayerId =
          w.selectedLayerId === layerId
            ? layers[layers.length - 1].id
            : w.selectedLayerId
        return { ...w, layers, selectedLayerId }
      }),
    }))
    commit()
  },

  dropImageIntoWindow: async (windowId, file) => {
    if (!isSupportedImage(file)) return false
    try {
      const { imageUrl, naturalWidth, naturalHeight } = await readImageFile(file)
      get().addImageLayer(windowId, imageUrl, naturalWidth, naturalHeight, file.name)
      return true
    } catch (err) {
      console.error('[Zmi EDT] drop-into-window failed for', file.name, err)
      return false
    }
  },

  setBrushColor: (color) => set({ brushColor: color }),
  setBrushSize: (size) =>
    set({ brushSize: Math.max(1, Math.min(200, Math.round(size))) }),

  beginStroke: (windowId, layerId, point) => {
    // M9: record ONE history entry per stroke. Capture before = no stroke;
    // commit() captures after = 1-point stroke. extendStroke updates the
    // entry's `after` so undo removes the whole stroke in one step.
    const commit = beginLocal(windowId, 'Vẽ nét')
    const strokeId = uuid()
    const stroke: BrushStroke = {
      id: strokeId,
      color: get().brushColor,
      size: get().brushSize,
      points: [{ x: Math.round(point.x), y: Math.round(point.y) }],
    }
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              layers: w.layers.map((l) =>
                l.id === layerId
                  ? { ...l, strokes: [...(l.strokes ?? []), stroke] }
                  : l,
              ),
            }
          : w,
      ),
    }))
    commit()
    return strokeId
  },

  extendStroke: (windowId, layerId, strokeId, point) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              layers: w.layers.map((l) => {
                if (l.id !== layerId) return l
                const strokes = l.strokes ?? []
                return {
                  ...l,
                  strokes: strokes.map((st) =>
                    st.id === strokeId
                      ? {
                          ...st,
                          points: [
                            ...st.points,
                            { x: Math.round(point.x), y: Math.round(point.y) },
                          ],
                        }
                      : st,
                  ),
                }
              }),
            }
          : w,
      ),
      // M9: update the last local history entry's `after` snapshot so the
      // stroke's full final state is redoable. (No new entry — same stroke.)
      windowHistory: (() => {
        const stack = s.windowHistory[windowId] ?? []
        if (stack.length === 0) return s.windowHistory
        const last = stack[stack.length - 1]
        const w2 = s.windows.find((x) => x.id === windowId)
        if (!w2) return s.windowHistory
        const updated = { ...last, after: [snapshotWindow(w2)] }
        return { ...s.windowHistory, [windowId]: [...stack.slice(0, -1), updated] }
      })(),
    }))
  },

  undoLastStroke: (windowId, _layerId) => {
    // M9: delegate to the proper undo (which restores the last history entry
    // for this window — works for strokes AND any other local edit).
    // Select the window first so undo targets the right scope.
    get().selectWindow(windowId)
    get().undo()
  },

  patchLayerText: (windowId, layerId, patch) => {
    const commit = beginLocal(windowId, 'Sửa text')
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              layers: w.layers.map((l) => {
                if (l.id !== layerId) return l
                if (l.type !== 'text' || !l.text) return l
                return { ...l, text: { ...l.text, ...patch } }
              }),
            }
          : w,
      ),
    }))
    commit()
  },

  patchSelectedLayerText: (patch) => {
    const sel = get().selectedWindowId
    if (!sel) return
    const w = get().windows.find((x) => x.id === sel)
    if (!w || !w.selectedLayerId) return
    get().patchLayerText(sel, w.selectedLayerId, patch)
  },

  deleteSelectedLayer: () => {
    const sel = get().selectedWindowId
    if (!sel) return
    const w = get().windows.find((x) => x.id === sel)
    if (!w || !w.selectedLayerId) return
    get().deleteLayer(sel, w.selectedLayerId)
  },

  batchDeleteFromMain: (targetIdentity) => {
    const mainId = get().mainId
    if (!mainId) return []
    const commitBatch = beginBatch('Batch xóa layer')
    const affected: string[] = []
    set((s) => ({
      windows: s.windows.map((w) => {
        const eligible = w.id === mainId || w.isBatchEnabled
        if (!eligible) return w
        // Find layers with matching identity; delete ALL of them (usually 1).
        const matches = w.layers.filter((l) => l.identity === targetIdentity)
        if (matches.length === 0) return w
        // Refuse if this would delete the last layer (spec §17 keeps ≥1).
        if (matches.length >= w.layers.length) return w
        affected.push(w.id)
        const remaining = w.layers.filter((l) => l.identity !== targetIdentity)
        const selectedLayerId =
          w.selectedLayerId && matches.some((m) => m.id === w.selectedLayerId)
            ? remaining[remaining.length - 1].id
            : w.selectedLayerId
        return { ...w, layers: remaining, selectedLayerId }
      }),
    }))
    commitBatch()
    return affected
  },

  setCropRect: (windowId, rect) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId ? { ...w, cropRect: rect } : w,
      ),
    }))
  },

  applyCrop: (windowId) => {
    const w = get().windows.find((x) => x.id === windowId)
    if (!w || !w.cropRect) return
    const commit = beginLocal(windowId, 'Cắt ảnh')
    const r = w.cropRect
    // Clamp to document bounds.
    const cx = Math.max(0, Math.min(w.naturalWidth, r.x))
    const cy = Math.max(0, Math.min(w.naturalHeight, r.y))
    const cw = Math.max(1, Math.min(w.naturalWidth - cx, r.w))
    const ch = Math.max(1, Math.min(w.naturalHeight - cy, r.h))
    set((s) => ({
      windows: s.windows.map((win) => {
        if (win.id !== windowId) return win
        return {
          ...win,
          naturalWidth: Math.round(cw),
          naturalHeight: Math.round(ch),
          // Shift all layer transforms + stroke points + text positions by
          // (-cx, -cy) so the cropped region becomes the new (0,0) origin.
          layers: win.layers.map((l) => ({
            ...l,
            transform: {
              ...l.transform,
              x: l.transform.x - cx,
              y: l.transform.y - cy,
            },
            strokes: l.strokes?.map((st) => ({
              ...st,
              points: st.points.map((p) => ({ x: p.x - cx, y: p.y - cy })),
            })),
          })),
          // Reset crop + viewport so the new bounds fit cleanly.
          cropRect: null,
          fitMode: true,
          zoom: 1,
          panX: 0,
          panY: 0,
        }
      }),
    }))
    commit()
  },

  // ---- M9: undo / redo ----
  undo: () => {
    const s = get()
    const sel = s.selectedWindowId
    // MAIN-selected + batch history non-empty → undo batch.
    if (sel === s.mainId && s.mainHistory.length > 0) {
      const entry = s.mainHistory[s.mainHistory.length - 1]
      set((st) => ({
        windows: st.windows.map((w) => {
          const snap = entry.before.find((b) => b.windowId === w.id)
          return snap ? restoreSnapshot(w, snap) : w
        }),
        mainHistory: st.mainHistory.slice(0, -1),
        mainRedo: [...st.mainRedo, entry],
      }))
      return entry.label
    }
    // Otherwise undo the selected window's local history.
    if (sel && (s.windowHistory[sel]?.length ?? 0) > 0) {
      const stack = s.windowHistory[sel]
      const entry = stack[stack.length - 1]
      set((st) => ({
        windows: st.windows.map((w) => {
          const snap = entry.before.find((b) => b.windowId === w.id)
          return snap ? restoreSnapshot(w, snap) : w
        }),
        windowHistory: {
          ...st.windowHistory,
          [sel]: (st.windowHistory[sel] ?? []).slice(0, -1),
        },
        windowRedo: {
          ...st.windowRedo,
          [sel]: [...(st.windowRedo[sel] ?? []), entry],
        },
      }))
      return entry.label
    }
    return null
  },

  redo: () => {
    const s = get()
    const sel = s.selectedWindowId
    // MAIN-selected + batch redo non-empty → redo batch.
    if (sel === s.mainId && s.mainRedo.length > 0) {
      const entry = s.mainRedo[s.mainRedo.length - 1]
      set((st) => ({
        windows: st.windows.map((w) => {
          const snap = entry.after.find((b) => b.windowId === w.id)
          return snap ? restoreSnapshot(w, snap) : w
        }),
        mainRedo: st.mainRedo.slice(0, -1),
        mainHistory: [...st.mainHistory, entry],
      }))
      return entry.label
    }
    if (sel && (s.windowRedo[sel]?.length ?? 0) > 0) {
      const stack = s.windowRedo[sel]
      const entry = stack[stack.length - 1]
      set((st) => ({
        windows: st.windows.map((w) => {
          const snap = entry.after.find((b) => b.windowId === w.id)
          return snap ? restoreSnapshot(w, snap) : w
        }),
        windowRedo: {
          ...st.windowRedo,
          [sel]: (st.windowRedo[sel] ?? []).slice(0, -1),
        },
        windowHistory: {
          ...st.windowHistory,
          [sel]: [...(st.windowHistory[sel] ?? []), entry],
        },
      }))
      return entry.label
    }
    return null
  },

  canUndo: () => {
    const s = get()
    const sel = s.selectedWindowId
    if (sel === s.mainId && s.mainHistory.length > 0) return true
    if (sel && (s.windowHistory[sel]?.length ?? 0) > 0) return true
    return false
  },

  canRedo: () => {
    const s = get()
    const sel = s.selectedWindowId
    if (sel === s.mainId && s.mainRedo.length > 0) return true
    if (sel && (s.windowRedo[sel]?.length ?? 0) > 0) return true
    return false
  },

  // ---- M11: Asset Library (spec §24) ----
  addAsset: async (file) => {
    const { imageUrl, naturalWidth, naturalHeight } = await readImageFile(file)
    // Dedup by fileName + dims (same source uploaded twice → reuse).
    const existing = get().assets.find(
      (a) =>
        a.fileName === file.name &&
        a.naturalWidth === naturalWidth &&
        a.naturalHeight === naturalHeight,
    )
    if (existing) {
      // Revoke the new URL since we're reusing the existing asset's URL.
      URL.revokeObjectURL(imageUrl)
      return existing.id
    }
    const id = uuid()
    const asset = {
      id,
      fileName: file.name || `image-${id.slice(0, 6)}.png`,
      imageUrl,
      naturalWidth,
      naturalHeight,
      uploadedAt: Date.now(),
    }
    set((s) => ({ assets: [...s.assets, asset] }))
    return id
  },

  deleteAsset: (assetId) => {
    const asset = get().assets.find((a) => a.id === assetId)
    if (!asset) return
    URL.revokeObjectURL(asset.imageUrl)
    set((s) => ({ assets: s.assets.filter((a) => a.id !== assetId) }))
  },

  createWindowFromAsset: (assetId) => {
    const asset = get().assets.find((a) => a.id === assetId)
    if (!asset) return null
    const { width, height } = computeDisplaySize(
      asset.naturalWidth,
      asset.naturalHeight,
      MAX_DISPLAY_W,
    )
    const id = uuid()
    const cursor = get().placementCursor
    const wrapIndex = cursor.n % CASCADE_WRAP
    const x = FIRST_OFFSET.x + wrapIndex * CASCADE_STEP.x
    const y = FIRST_OFFSET.y + wrapIndex * CASCADE_STEP.y
    const nextZ = get().zCounter + 1
    const win: ImageWindow = {
      id,
      fileName: asset.fileName,
      imageUrl: asset.imageUrl, // share the asset's URL — closing the window won't revoke it
      naturalWidth: asset.naturalWidth,
      naturalHeight: asset.naturalHeight,
      x,
      y,
      width: Math.max(MIN_WINDOW_W, width),
      height: Math.max(MIN_WINDOW_H, height),
      zIndex: nextZ,
      isSelected: false,
      isBatchEnabled: true,
      zoom: 1,
      panX: 0,
      panY: 0,
      fitMode: true,
      showGrid: false,
      layers: [
        {
          id: uuid(),
          name: asset.fileName,
          type: 'image',
          visible: true,
          transform: defaultTransform(),
          identity: 'image',
        } satisfies Layer,
      ],
      selectedLayerId: null,
      cropRect: null,
      importedAt: Date.now(),
    }
    win.selectedLayerId = win.layers[0].id
    set((s) => ({
      windows: [...s.windows, win],
      zCounter: nextZ,
      placementCursor: { x, y, n: cursor.n + 1 },
    }))
    get().selectWindow(id)
    if (get().mainId === null) get().setMain(id)
    return id
  },

  addAssetAsLayer: (windowId, assetId) => {
    const asset = get().assets.find((a) => a.id === assetId)
    if (!asset) return null
    return get().addImageLayer(
      windowId,
      asset.imageUrl,
      asset.naturalWidth,
      asset.naturalHeight,
      asset.fileName,
    )
  },

  toggleWaifuMode: () => {
    set((s) => ({ waifuMode: !s.waifuMode }))
  },
}
})

// ---- M4 selectors ----
/** The transform of the selected layer in the selected window (for the Transform panel). */
export const selectSelectedLayerTransform = (s: EditorState) => {
  const w = s.windows.find((x) => x.id === s.selectedWindowId)
  if (!w || !w.selectedLayerId) return null
  const layer = w.layers.find((l) => l.id === w.selectedLayerId)
  return layer ? { layer, transform: layer.transform, window: w } : null
}

// ---- selectors ----
export const selectWindowCount = (s: EditorState) => s.windows.length
export const selectSelectedWindow = (s: EditorState) =>
  s.windows.find((w) => w.id === s.selectedWindowId) ?? null
export const selectMainWindow = (s: EditorState) =>
  s.windows.find((w) => w.id === s.mainId) ?? null
/** Count of non-MAIN windows that will receive MAIN's batch actions (spec §7). */
export const selectBatchCount = (s: EditorState) =>
  s.windows.filter((w) => w.id !== s.mainId && w.isBatchEnabled).length
/** Count of windows currently excluded from batch (spec §5 EXCLUDED state). */
export const selectExcludedCount = (s: EditorState) =>
  s.windows.filter((w) => w.id !== s.mainId && !w.isBatchEnabled).length
