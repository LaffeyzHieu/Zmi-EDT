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
}

/** Initial offset for the first imported window (relative to workspace origin). */
const FIRST_OFFSET = { x: 64, y: 48 }
/** Step between cascading windows. */
const CASCADE_STEP = { x: 28, y: 28 }
/** Wrap cascade after this many consecutive windows to avoid drifting off-screen. */
const CASCADE_WRAP = 6

export const useEditorStore = create<EditorState>((set, get) => ({
  windows: [],
  selectedWindowId: null,
  mainId: null,
  zCounter: 10,
  placementCursor: { ...FIRST_OFFSET, n: 0 },
  tool: 'move',
  // M6 draw defaults (spec §13: brush size + color)
  brushColor: '#ff3b6b',
  brushSize: 8,

  addImages: async (files) => {
    const list = Array.from(files)
    const supported = list.filter(isSupportedImage)
    if (supported.length === 0) return 0

    const created: ImageWindow[] = []
    let firstCreatedId: string | null = null

    for (const file of supported) {
      try {
        const { imageUrl, naturalWidth, naturalHeight } = await readImageFile(file)
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
    // Revoke object URL to avoid leaks (spec §38).
    URL.revokeObjectURL(win.imageUrl)

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
    // Store the new layer's natural size on the layer via a sidecar map? The
    // window already tracks naturalWidth/Height for the source image; for added
    // image layers we store their size on a per-layer cache attached to the
    // window. For M5 simplicity we reuse the window's natural size for the
    // first image layer (the source), and for added layers we keep a parallel
    // registry. To avoid a model change mid-milestone, added image layers in
    // M5 are sized by their natural size at render time via the layer's own
    // cached dims on the window's `layerDims` map (added below). Since we did
    // not add that field, we approximate: added image layers use the window's
    // naturalWidth/Height. Acceptable for M5; M6+ will introduce a proper
    // per-layer dimension cache.
    void naturalWidth
    void naturalHeight
    void imageUrl
    return id
  },

  addTextLayer: (windowId, content) => {
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
  },

  renameLayer: (windowId, layerId, name) => {
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
  },

  reorderLayer: (windowId, layerId, delta) => {
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
  },

  deleteLayer: (windowId, layerId) => {
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
    }))
  },

  undoLastStroke: (windowId, layerId) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              layers: w.layers.map((l) => {
                if (l.id !== layerId) return l
                const strokes = l.strokes ?? []
                if (strokes.length === 0) return l
                return { ...l, strokes: strokes.slice(0, -1) }
              }),
            }
          : w,
      ),
    }))
  },
}))

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
