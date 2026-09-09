// Zmi EDT — canvas viewport math (spec §9 coordinate system, §20 zoom/pan)
import {
  GRID_AUTO_THRESHOLD,
  type ImageWindow,
  type LayerTransform,
} from '@/lib/editor-types'

export interface Viewport {
  /** Displayed document width in screen px (= natural width × fit-scale). */
  displayW: number
  /** Displayed document height in screen px. */
  displayH: number
  /** Top-left of the document inside the window body (screen px, body-relative). */
  offsetX: number
  /** Top-left of the document inside the window body (screen px, body-relative). */
  offsetY: number
  /** Effective scale: 1 means 1 document px = 1 screen px. */
  scale: number
}

/**
 * Compute the in-window document layout (the canvas onto which layers are
 * placed). The document size equals the source image's natural size; the
 * viewport scales that to fit the window body (fit mode) or to `zoom` (1=100%)
 * with `panX/panY` applied as a screen-space offset.
 */
export function computeViewport(
  w: ImageWindow,
  bodyW: number,
  bodyH: number,
): Viewport {
  const safeW = Math.max(1, bodyW)
  const safeH = Math.max(1, bodyH)
  const nW = Math.max(1, w.naturalWidth)
  const nH = Math.max(1, w.naturalHeight)

  if (w.fitMode) {
    const scale = Math.min(safeW / nW, safeH / nH)
    const displayW = nW * scale
    const displayH = nH * scale
    return {
      displayW,
      displayH,
      offsetX: (safeW - displayW) / 2,
      offsetY: (safeH - displayH) / 2,
      scale,
    }
  }

  const scale = w.zoom
  const displayW = nW * scale
  const displayH = nH * scale
  return {
    displayW,
    displayH,
    offsetX: (safeW - displayW) / 2 + w.panX,
    offsetY: (safeH - displayH) / 2 + w.panY,
    scale,
  }
}

/**
 * A layer's placement on screen, derived from its document transform + the
 * window viewport. Used to render the layer with CSS transforms.
 */
export interface LayerPlacement {
  /** Screen-space left of the layer box (body-relative, pre-transform). */
  left: number
  /** Screen-space top of the layer box (body-relative, pre-transform). */
  top: number
  /** Screen-space width of the layer box (natural × transform.scale × vp.scale). */
  width: number
  /** Screen-space height of the layer box. */
  height: number
  /** Rotation in degrees (passed through from layer.transform.rotation). */
  rotation: number
  /** Flip horizontal (passed through). */
  flipX: boolean
  /** Flip vertical (passed through). */
  flipY: boolean
}

/**
 * Convert a layer's document transform into a screen-space placement.
 *
 * Layer coords: the layer's top-left in document space is (x, y) with size
 * (naturalW × scale, naturalH × scale). We multiply everything by `vp.scale`
 * to get screen px and add `vp.offsetX/Y`.
 */
export function computeLayerPlacement(
  layerNaturalW: number,
  layerNaturalH: number,
  transform: LayerTransform,
  vp: Viewport,
): LayerPlacement {
  return {
    left: vp.offsetX + transform.x * vp.scale,
    top: vp.offsetY + transform.y * vp.scale,
    width: layerNaturalW * transform.scale * vp.scale,
    height: layerNaturalH * transform.scale * vp.scale,
    rotation: transform.rotation,
    flipX: transform.flipX,
    flipY: transform.flipY,
  }
}

/** Whether the pixel grid should be visible for this viewport (spec §21). */
export function shouldShowGrid(w: ImageWindow, vp: Viewport): boolean {
  if (w.showGrid) return true
  // Auto-show when a single image pixel is larger than the threshold.
  return vp.scale >= GRID_AUTO_THRESHOLD
}

/**
 * Convert a wheel delta into a zoom factor. Negative deltaY (wheel up) zooms in.
 * Uses exponential stepping so the perceived speed feels consistent across zoom levels.
 */
export function wheelToZoomFactor(deltaY: number): number {
  const step = -deltaY * 0.0015
  return Math.exp(step)
}

/** Round a zoom level to a sensible display percentage string. */
export function formatZoom(scale: number): string {
  if (scale >= 1) {
    return `${Math.round(scale * 100)}%`
  }
  return `${(scale * 100).toFixed(scale < 0.1 ? 1 : 0)}%`
}
