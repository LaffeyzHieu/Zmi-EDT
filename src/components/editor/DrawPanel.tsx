'use client'

import { useState } from 'react'
import { Brush, Undo2, Palette } from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'

/**
 * DrawPanel — the `Vẽ` tool panel (spec §13 Vẽ, §14 Color Picker).
 *
 * Controls:
 *   • brush size (slider + numeric, 1–200 doc px)
 *   • color picker (native <input type=color> + hex input, spec §14)
 *   • quick swatches
 *   • "Undo nét vẽ" — removes the last stroke on the selected layer (local;
 *     M9 will wire full history)
 *
 * Drawing is LOCAL by default (spec §13 batch rule). No batch brush in v0.1.
 */
const SWATCHES = [
  '#ffffff',
  '#000000',
  '#ff3b6b',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#22d3ee',
  '#60a5fa',
  '#a78bfa',
  '#f472b6',
]

export function DrawPanel() {
  const brushColor = useEditorStore((s) => s.brushColor)
  const brushSize = useEditorStore((s) => s.brushSize)
  const setBrushColor = useEditorStore((s) => s.setBrushColor)
  const setBrushSize = useEditorStore((s) => s.setBrushSize)
  const undoLastStroke = useEditorStore((s) => s.undoLastStroke)
  const selectedWindowId = useEditorStore((s) => s.selectedWindowId)
  const selectedLayerId = useEditorStore(
    (s) => {
      const w = s.windows.find((x) => x.id === s.selectedWindowId)
      return w?.selectedLayerId ?? null
    },
  )
  const strokeCount = useEditorStore((s) => {
    const w = s.windows.find((x) => x.id === s.selectedWindowId)
    if (!w || !w.selectedLayerId) return 0
    return w.layers.find((l) => l.id === w.selectedLayerId)?.strokes?.length ?? 0
  })

  const [hexDraft, setHexDraft] = useState(brushColor)

  const commitHex = () => {
    let v = hexDraft.trim()
    if (!v.startsWith('#')) v = '#' + v
    if (/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) {
      setBrushColor(v.toLowerCase())
    } else {
      setHexDraft(brushColor) // reset on invalid
    }
  }

  return (
    <div className="mx-3 mb-3 rounded-md border border-white/12 bg-black/40 p-2.5 text-white">
      {/* header */}
      <div className="mb-2 flex items-center gap-1.5">
        <Brush className="h-3.5 w-3.5 text-rose-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
          Vẽ
        </span>
        <span className="ml-auto text-[10px] text-white/40">
          {strokeCount} nét
        </span>
      </div>

      {/* color preview + picker */}
      <div className="mb-2 flex items-center gap-2 rounded-md bg-white/[0.04] p-1.5">
        <label className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md ring-1 ring-white/20" style={{ background: brushColor }} title="Chọn màu">
          <input
            type="color"
            value={brushColor}
            onChange={(e) => {
              setBrushColor(e.target.value)
              setHexDraft(e.target.value)
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Brush color picker"
          />
          <Palette className="h-4 w-4 mix-blend-difference text-white" />
        </label>
        <div className="flex flex-1 items-center gap-1">
          <span className="text-[10px] font-medium uppercase text-white/45">#</span>
          <input
            type="text"
            value={hexDraft.replace(/^#/, '')}
            onChange={(e) => setHexDraft('#' + e.target.value.replace(/^#/, ''))}
            onBlur={commitHex}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHex()
              if (e.key === 'Escape') setHexDraft(brushColor)
            }}
            maxLength={7}
            className="min-w-0 flex-1 rounded bg-black/40 px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-white outline-none focus:ring-1 focus:ring-sky-400/50"
            aria-label="Hex color"
          />
        </div>
      </div>

      {/* swatches */}
      <div className="mb-2 grid grid-cols-5 gap-1">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setBrushColor(c)
              setHexDraft(c)
            }}
            className={cn(
              'h-5 w-full rounded ring-1 transition-transform hover:scale-110',
              brushColor.toLowerCase() === c
                ? 'ring-2 ring-sky-300 ring-offset-1 ring-offset-black'
                : 'ring-white/20',
            )}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            aria-pressed={brushColor.toLowerCase() === c}
          />
        ))}
      </div>

      {/* brush size */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase text-white/45">Cỡ</span>
        <input
          type="range"
          min={1}
          max={100}
          value={Math.min(100, brushSize)}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="flex-1 accent-rose-400"
          aria-label="Brush size slider"
        />
        <input
          type="number"
          min={1}
          max={200}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value) || 1)}
          className="w-12 rounded bg-white/[0.06] px-1 py-0.5 text-right text-[11px] tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="Brush size number"
        />
      </div>

      {/* preview */}
      <div className="mb-2 flex items-center justify-center rounded-md bg-[repeating-conic-gradient(#1f1f23_0%_25%,#26262b_0%_50%)] bg-[length:10px_10px] py-2">
        <div
          className="rounded-full"
          style={{
            background: brushColor,
            width: `${Math.min(60, brushSize)}px`,
            height: `${Math.min(60, brushSize)}px`,
          }}
          aria-hidden
        />
      </div>

      {/* undo */}
      <button
        type="button"
        disabled={!selectedWindowId || !selectedLayerId || strokeCount === 0}
        onClick={() => {
          if (selectedWindowId && selectedLayerId) {
            undoLastStroke(selectedWindowId, selectedLayerId)
          }
        }}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
          selectedWindowId && selectedLayerId && strokeCount > 0
            ? 'border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/10'
            : 'cursor-not-allowed border-white/10 bg-white/[0.02] text-white/30',
        )}
        title="Hoàn tác nét vẽ cuối (local)"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Hoàn tác nét vẽ
      </button>

      <p className="mt-2 text-center text-[10px] leading-relaxed text-white/40">
        Vẽ local trên layer đang chọn · không phát batch (§13)
      </p>
    </div>
  )
}
