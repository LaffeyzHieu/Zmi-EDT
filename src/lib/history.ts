// Zmi EDT — history model (spec §25, §26, §27)
//
// Design: snapshot-based history. Each history entry captures the affected
// windows' state BEFORE the edit (an "undo snapshot"). Redo stores the AFTER
// state. This is the simplest correct approach for v0.1 — no inverse-action
// math, deterministic, and trivially handles compound changes (e.g. crop
// changes naturalW/H + shifts layers + resets viewport in one entry).
//
// Two stacks per spec §25:
//   - mainHistory: batch actions (source = MAIN, affected = MAIN + batch windows)
//   - windowHistory[id]: local actions on a single window
// Undo pops from the relevant stack; the global undo command checks MAIN first
// (if the selected window is MAIN and mainHistory is non-empty) else the
// selected window's local history.

import type { ImageWindow } from '@/lib/editor-types'

/** A captured snapshot of one window's document state (spec §26 `before`/`after`). */
export interface WindowSnapshot {
  windowId: string
  // Captured fields (the mutable document state). UI-only state (zoom/pan/grid/
  // position/zIndex/isSelected/isBatchEnabled/cropRect) is NOT snapshotted —
  // spec §28 view state must not enter history.
  layers: ImageWindow['layers']
  naturalWidth: number
  naturalHeight: number
  selectedLayerId: string | null
}

/** A single history entry (spec §26 Action). */
export interface HistoryEntry {
  /** Stable id for React keys. */
  id: string
  /** Human label e.g. "Batch transform", "Draw stroke", "Add text layer". */
  label: string
  /** 'batch' = MAIN-originated (lives in mainHistory); 'local' = single window. */
  scope: 'batch' | 'local'
  /** Window snapshots BEFORE the edit (for undo). Keyed by windowId. */
  before: WindowSnapshot[]
  /** Window snapshots AFTER the edit (for redo). Keyed by windowId. */
  after: WindowSnapshot[]
  /** Unix ms — for stable ordering + debug. */
  at: number
}

/** Capture a snapshot of a window's document state. */
export function snapshotWindow(w: ImageWindow): WindowSnapshot {
  return {
    windowId: w.id,
    // Deep-clone layers (with strokes + text) so later edits don't mutate the snapshot.
    layers: w.layers.map((l) => ({
      ...l,
      transform: { ...l.transform },
      text: l.text ? { ...l.text } : undefined,
      strokes: l.strokes ? l.strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })) : undefined,
    })),
    naturalWidth: w.naturalWidth,
    naturalHeight: w.naturalHeight,
    selectedLayerId: w.selectedLayerId,
  }
}

/** Restore a window's document state from a snapshot (UI state preserved). */
export function restoreSnapshot(w: ImageWindow, snap: WindowSnapshot): ImageWindow {
  return {
    ...w,
    layers: snap.layers.map((l) => ({
      ...l,
      transform: { ...l.transform },
      text: l.text ? { ...l.text } : undefined,
      strokes: l.strokes ? l.strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })) : undefined,
    })),
    naturalWidth: snap.naturalWidth,
    naturalHeight: snap.naturalHeight,
    selectedLayerId: snap.selectedLayerId,
  }
}
