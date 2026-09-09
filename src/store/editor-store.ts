// Zmi EDT — single Zustand store (spec §39: single source of truth)
'use client'

import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import {
  type ImageWindow,
  type EditorTool,
  MIN_WINDOW_W,
  MIN_WINDOW_H,
  MAX_DISPLAY_W,
  MIN_ZOOM,
  MAX_ZOOM,
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
          importedAt: Date.now(),
        }
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
}))

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
