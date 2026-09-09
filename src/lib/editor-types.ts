// Zmi EDT — shared editor types
// Spec §3 (Window model), §38 (stable internal ID, never filename-as-id)

export type SupportedImageMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'

export const SUPPORTED_IMAGE_MIMES: SupportedImageMime[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
]

export const SUPPORTED_IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp']

/**
 * A floating editor window in the workspace.
 *
 * Milestone 2 additions:
 *   `isBatchEnabled` — per-window flag controlling whether this window
 *   receives MAIN's batch actions (spec §5 `_` toggle, §7 batch rule).
 *
 *   `isMain` is NOT stored on the window — it lives in `store.mainId` to avoid
 *   duplicating state across many windows (spec §39 single source of truth).
 *
 *   `layers`, `history` remain absent → M5 (layers) / M9 (history).
 */
export interface ImageWindow {
  /** Stable internal ID (UUID). Never the filename. */
  id: string
  /** Original uploaded filename, preserved for display & export. */
  fileName: string
  /** Object URL for the source image (revoked on close). */
  imageUrl: string
  /** Decoded natural pixel dimensions of the source image. */
  naturalWidth: number
  naturalHeight: number
  /** Workspace coordinates of the window's top-left corner (px). */
  x: number
  y: number
  /** Displayed window size (px). Independent of natural size. */
  width: number
  height: number
  /** Stacking order. Higher = in front. */
  zIndex: number
  /** Whether this window is the active editing/inspection target. */
  isSelected: boolean
  /** Whether this window participates in MAIN batch operations (spec §5). */
  isBatchEnabled: boolean
  /** Unix ms of import — used for stable cascading placement. */
  importedAt: number
}

export const MIN_WINDOW_W = 160
export const MIN_WINDOW_H = 120
export const MAX_DISPLAY_W = 360
