// Zmi EDT — text measurement util (spec §18 proper text sizing).
// Uses a single cached canvas 2D context to measure text width accurately.

import type { LayerText } from '@/lib/editor-types'

let measureCtx: CanvasRenderingContext2D | null = null

function getCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    measureCtx = c.getContext('2d')!
  }
  return measureCtx
}

export interface TextMetrics {
  width: number // document px
  height: number // document px
}

/**
 * Measure a text layer's content in DOCUMENT pixels (pre-viewport-scale).
 * Height = fontSize × 1.4 (approx, includes ascender/descender + a little).
 * Width = the canvas measureText result, accounting for bold weight.
 */
export function measureText(t: LayerText): TextMetrics {
  const ctx = getCtx()
  const weight = t.bold ? '700' : '400'
  const style = t.italic ? 'italic' : 'normal'
  ctx.font = `${style} ${weight} ${t.fontSize}px ${t.fontFamily}`
  // Use the longest line for width (handle multi-line content).
  const lines = t.content.split('\n')
  let maxW = 0
  for (const line of lines) {
    const m = ctx.measureText(line || ' ')
    if (m.width > maxW) maxW = m.width
  }
  const height = t.fontSize * 1.4 * Math.max(1, lines.length)
  return { width: Math.max(20, maxW), height }
}
