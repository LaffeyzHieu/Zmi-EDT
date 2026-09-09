// Zmi EDT — single Zustand store (spec §39: single source of truth)
'use client'

import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import {
  type ImageWindow,
  MIN_WINDOW_W,
  MIN_WINDOW_H,
  MAX_DISPLAY_W,
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
  /** Monotonic z-index counter — incremented to bring a window to front. */
  zCounter: number
  /** Cursor for cascading placement of newly imported windows. */
  placementCursor: { x: number; y: number; n: number }

  // ---- actions ----
  /**
   * Import image files as new windows. Silently skips unsupported files.
   * Resolves with the number of windows actually created.
   */
  addImages: (files: File[] | FileList) => Promise<number>
  /** Close a window, revoke its object URL, clear selection if it was selected. */
  closeWindow: (id: string) => void
  /** Select a window (or null to clear). Also brings it to front. */
  selectWindow: (id: string | null) => void
  /** Move a window to workspace coordinates (window position only — never image content). */
  moveWindow: (id: string, x: number, y: number) => void
  /** Bring a window to the top of the stacking order. */
  bringToFront: (id: string) => void
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
  zCounter: 10,
  placementCursor: { ...FIRST_OFFSET, n: 0 },

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
    let nextSelectedId: string | null = get().selectedWindowId

    if (wasSelected) {
      // Pick the topmost remaining window as the new selection (if any).
      nextSelectedId =
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
}))

// ---- selectors ----
export const selectWindowCount = (s: EditorState) => s.windows.length
export const selectSelectedWindow = (s: EditorState) =>
  s.windows.find((w) => w.id === s.selectedWindowId) ?? null
