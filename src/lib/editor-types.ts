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
 * Milestone 3 additions (UI state per spec §28 — zoom/pan/grid are NOT document
 * state, must NOT create history):
 *   `zoom`     — pixel zoom multiplier (1 = 100%). Only meaningful when
 *                `fitMode === false`.
 *   `panX/panY`— screen-space px offset from the centered fit position.
 *   `fitMode`  — when true, the image auto-fits the window (zoom is ignored).
 *   `showGrid` — pixel grid visibility (auto-shown when very zoomed in).
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
  /** Pixel zoom multiplier (1 = 100%). Used only when `fitMode` is false. */
  zoom: number
  /** Screen-space pan offset X (px), applied on top of centered layout. */
  panX: number
  /** Screen-space pan offset Y (px), applied on top of centered layout. */
  panY: number
  /** When true, image auto-fits the window (zoom/pan ignored). */
  fitMode: boolean
  /** Pixel grid visibility (spec §21). */
  showGrid: boolean
  /** Unix ms of import — used for stable cascading placement. */
  importedAt: number
}

export const MIN_WINDOW_W = 160
export const MIN_WINDOW_H = 120
export const MAX_DISPLAY_W = 360

/** Zoom multiplier bounds (spec §20 — wheel zoom should be sane). */
export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 32
/** When `zoom` (or fit-scale) exceeds this, the pixel grid auto-appears (§21). */
export const GRID_AUTO_THRESHOLD = 8

/** The active sidebar tool (spec §10 Di chuyển, §11 Xem). UI state, not history. */
export type EditorTool = 'move' | 'view'
