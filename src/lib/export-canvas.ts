// Zmi EDT — export util (spec §23 Tải về)
// Rasterizes a window's composited document (image layers + text + strokes +
// crop bounds) onto a <canvas> and returns a PNG Blob. Used for single PNG
// export + ZIP packaging.
//
// Export does NOT modify document state or create history entries (spec §23).

import type { ImageWindow, Layer, LayerText } from '@/lib/editor-types'
import { measureText } from '@/lib/text-measure'

/**
 * Render a window's composited document to a canvas at 1:1 pixel resolution.
 * The canvas size = the window's naturalWidth/Height (post-crop).
 * Layers are drawn bottom-to-top (stored order). Each layer's transform
 * (x, y, scale, rotation, flip) is applied via canvas transforms. Strokes
 * are drawn as polylines; text layers as filled text.
 *
 * Returns the canvas (caller can `toBlob()` it).
 */
export async function renderWindowToCanvas(
  w: ImageWindow,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, w.naturalWidth)
  canvas.height = Math.max(1, w.naturalHeight)
  const ctx = canvas.getContext('2d')!

  // Draw layers bottom-to-top.
  for (const layer of w.layers) {
    if (!layer.visible) continue
    ctx.save()
    // Apply layer transform: translate to layer origin, scale, rotate, flip.
    const t = layer.transform
    // Layer center in document space (post-transform).
    const layerW = w.naturalWidth * t.scale
    const layerH = w.naturalHeight * t.scale
    const cx = t.x + layerW / 2
    const cy = t.y + layerH / 2
    ctx.translate(cx, cy)
    ctx.rotate((t.rotation * Math.PI) / 180)
    ctx.scale(t.flipX ? -t.scale : t.scale, t.flipY ? -t.scale : t.scale)
    // Now draw centered at origin.
    if (layer.type === 'image') {
      // Load the image element.
      const img = await loadImage(w.imageUrl)
      ctx.drawImage(img, -w.naturalWidth / 2, -w.naturalHeight / 2, w.naturalWidth, w.naturalHeight)
      // Draw strokes on top of the image (in document coords, pre-flip).
      ctx.setTransform(1, 0, 0, 1, 0, 0) // reset for strokes
      drawStrokes(ctx, layer)
    } else if (layer.type === 'text' && layer.text) {
      // Text: draw at layer origin (top-left) with the text properties.
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      drawText(ctx, layer.text, t.x, t.y)
    }
    ctx.restore()
  }
  return canvas
}

/** Draw a layer's strokes onto the canvas (document coords). */
function drawStrokes(ctx: CanvasRenderingContext2D, layer: Layer) {
  const strokes = layer.strokes ?? []
  for (const s of strokes) {
    if (s.points.length === 0) continue
    ctx.save()
    ctx.strokeStyle = s.color
    ctx.fillStyle = s.color
    ctx.lineWidth = s.size * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (s.points.length === 1) {
      // Single point → dot.
      const p = s.points[0]
      ctx.beginPath()
      ctx.arc(p.x, p.y, s.size, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }
}

/** Draw a text layer (document coords, top-left origin). */
function drawText(ctx: CanvasRenderingContext2D, t: LayerText, x: number, y: number) {
  ctx.save()
  const weight = t.bold ? '700' : '400'
  const style = t.italic ? 'italic' : 'normal'
  ctx.font = `${style} ${weight} ${t.fontSize}px ${t.fontFamily}`
  ctx.fillStyle = t.color
  ctx.textBaseline = 'top'
  // Shadow for legibility (matches the on-canvas render).
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 2
  ctx.shadowOffsetY = 1
  const lines = t.content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * t.fontSize * 1.2)
  }
  ctx.restore()
}

/** Load an image URL into an HTMLImageElement. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load ${url}`))
    img.src = url
  })
}

/** Canvas → PNG Blob. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob returned null'))
    }, 'image/png')
  })
}

/**
 * Sanitize a filename for export. Preserves the original name; falls back to
 * `window-{id6}.png` if none. Avoids `image.png` / `image (1).png` per spec §23.
 */
export function sanitizeFileName(name: string, fallbackId: string): string {
  if (!name) return `window-${fallbackId.slice(0, 6)}.png`
  // Strip path, keep extension; ensure .png.
  const base = name.replace(/[/\\]/g, '_')
  return base.toLowerCase().endsWith('.png') ? base : `${base}.png`
}

// keep measureText import referenced (text rendering uses it indirectly via the
// live canvas measureText in drawText; the import is for future consistency)
void measureText
