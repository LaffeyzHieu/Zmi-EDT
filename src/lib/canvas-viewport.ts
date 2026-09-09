// Zmi EDT — canvas viewport math (spec §9 coordinate system, §20 zoom/pan)
import { GRID_AUTO_THRESHOLD, type ImageWindow } from '@/lib/editor-types'

export interface Viewport {
  /** Displayed image width in screen px. */
  displayW: number
  /** Displayed image height in screen px. */
  displayH: number
  /** Top-left of the image inside the window body (screen px, body-relative). */
  offsetX: number
  /** Top-left of the image inside the window body (screen px, body-relative). */
  offsetY: number
  /** Effective scale: 1 means 1 image px = 1 screen px. */
  scale: number
}

/**
 * Compute the in-window image layout.
 *
 * Layout model:
 *   - In `fitMode`, the image is centered and scaled to fit inside the body
 *     while preserving aspect ratio.
 *   - Otherwise, scale = `zoom` (1 = 100%), and the image is centered with
 *     `panX/panY` applied as a screen-space offset.
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
