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
 * Milestone 4 additions (document state — these WILL participate in history):
 *   `layers`   — ordered list of layers. For M4 each imported window has one
 *                implicit "Image" layer holding the source pixels; the layer
 *                carries the transform (x/y/scale/rotation/flip) that Biến đổi
 *                edits. Full layer panel (add/delete/reorder/rename) is M5.
 *
 *   `history` remains absent → M9.
 */
export interface Layer {
  /** Stable internal layer ID (UUID). Used for batch target matching (spec §8). */
  id: string
  /** Display name. For the implicit image layer, the source filename. */
  name: string
  /** Layer type. M4: 'image'. M5: adds 'text'. M7 will wire full text editing. */
  type: 'image' | 'text'
  /** Whether the layer is visible (eye toggle) (spec §17). */
  visible: boolean
  /** Transform of the layer inside the document (spec §19). */
  transform: LayerTransform
  /**
   * Stable batch identity — used to match the "same" layer across documents
   * when broadcasting batch actions (spec §8 target matching). For imported
   * image layers, 'image'. Text layers default to 'text' but the user can
   * rename the identity to group texts across documents for batch.
   */
  identity: string
  /**
   * Text-layer properties (spec §18). Only meaningful when `type === 'text'`.
   * Full text editing UI lands in M7; M5 seeds text layers so the Layer panel
   * has more than one layer type to demonstrate.
   */
  text?: LayerText
  /**
   * Freehand brush strokes drawn on this layer (spec §13). Stored in document
   * coordinates so they render correctly at any zoom. M6 wires the Draw tool.
   */
  strokes?: BrushStroke[]
}

/** Text layer properties (spec §18). */
export interface LayerText {
  content: string
  fontFamily: string
  fontSize: number // px, in document space (pre-scale)
  color: string // hex
  bold: boolean
  italic: boolean
}

/**
 * A single freehand brush stroke (spec §13). Stored in DOCUMENT coordinates
 * (pre-viewport-scale) so it renders correctly at any zoom. Strokes belong to
 * a layer; a layer can hold zero or more strokes (image layers can be drawn
 * on; text layers can too in principle).
 *
 * Strokes are document state — they WILL participate in history (M9).
 */
export interface BrushStroke {
  /** Stable stroke id. */
  id: string
  /** Hex color. */
  color: string
  /** Brush radius in document px (pre-scale). */
  size: number
  /** Ordered polyline points in document space (pre-viewport-scale). */
  points: { x: number; y: number }[]
}

/** Document-space transform of a layer (spec §9, §19). */
export interface LayerTransform {
  /** Document X (px) of the layer's top-left, before scaling. */
  x: number
  /** Document Y (px) of the layer's top-left, before scaling. */
  y: number
  /** Scale multiplier (1 = natural size). */
  scale: number
  /** Rotation in degrees, clockwise, around the layer center. */
  rotation: number
  /** Flip horizontally. */
  flipX: boolean
  /** Flip vertically. */
  flipY: boolean
}

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
  /** Ordered layer list. Index 0 = bottom. M4 seeds one implicit image layer.
   * `selectedLayerId` points to the active editing target (defaults to the
   * only layer).
   */
  layers: Layer[]
  selectedLayerId: string | null
  /**
   * M8 crop in-progress rect (spec §16). In DOCUMENT px (pre-viewport-scale).
   * `null` when no crop is being drawn. The crop is local to the window until
   * "Apply crop" commits it (which changes naturalWidth/Height + shifts layers).
   */
  cropRect: { x: number; y: number; w: number; h: number } | null
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

/** The active sidebar tool (spec §10 Di chuyển, §11 Xem, §12 Sửa→Biến đổi, §13 Vẽ, §18 Text, §15 Xóa, §16 Cắt ảnh). UI state. */
export type EditorTool = 'move' | 'view' | 'transform' | 'draw' | 'text' | 'crop' | 'delete'

/** Default transform for a freshly imported image layer. */
export function defaultTransform(): LayerTransform {
  return { x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false }
}
