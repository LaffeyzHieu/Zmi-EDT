'use client'

import { useShallow } from 'zustand/react/shallow'
import {
  Type,
  Bold,
  Italic,
  Palette,
  Plus,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'

/**
 * TextPanel — the `Text` tool panel (spec §18).
 *
 * Shows the text properties of the selected layer IF it is a text layer:
 *   • content (textarea)
 *   • font family (select)
 *   • font size (number)
 *   • color (native color picker + hex)
 *   • style: Normal / Bold / Italic toggles
 *
 * If the selected layer is NOT a text layer, the panel offers a quick
 * "Add text layer" button (delegates to the M5 LayerPanel's addTextLayer).
 *
 * Position/resize/scale/rotation of the text layer are driven by the M4
 * TransformPanel (Biến đổi), so this panel only owns the text properties.
 *
 * Text edits are LOCAL by default (spec §18 batch rule). MAIN can broadcast
 * the text via the M4 batch-transform path is not applicable to text props;
 * a future "batch text" action can reuse the M4 pattern. Not in M7 scope.
 */
const FONT_OPTIONS = [
  { label: 'Inter (mặc định)', value: 'Inter, system-ui, sans-serif' },
  { label: 'System Sans', value: 'system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  { label: 'Mono', value: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", "Comic Sans", cursive' },
]

export function TextPanel() {
  // Subscribe to the selected layer's text props via useShallow (primitive fields).
  const {
    selWindowId,
    selLayerId,
    isText,
    content,
    fontFamily,
    fontSize,
    color,
    bold,
    italic,
  } = useEditorStore(
    useShallow((s) => {
      const w = s.windows.find((x) => x.id === s.selectedWindowId)
      const layer = w?.layers.find((l) => l.id === w?.selectedLayerId) ?? null
      const t = layer?.text
      return {
        selWindowId: w?.id ?? null,
        selLayerId: layer?.id ?? null,
        isText: layer?.type === 'text' && !!t,
        content: t?.content ?? '',
        fontFamily: t?.fontFamily ?? 'Inter, system-ui, sans-serif',
        fontSize: t?.fontSize ?? 32,
        color: t?.color ?? '#ffffff',
        bold: t?.bold ?? false,
        italic: t?.italic ?? false,
      }
    }),
  )
  const patchSelectedLayerText = useEditorStore((s) => s.patchSelectedLayerText)
  const addTextLayer = useEditorStore((s) => s.addTextLayer)

  if (!selWindowId) {
    return (
      <div className="mx-3 mb-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-center text-[11px] text-white/45">
        Chọn 1 window để chỉnh Text
      </div>
    )
  }

  if (!isText) {
    return (
      <div className="mx-3 mb-3 rounded-md border border-white/12 bg-black/40 p-2.5 text-white">
        <div className="mb-2 flex items-center gap-1.5">
          <Type className="h-3.5 w-3.5 text-sky-300" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
            Text
          </span>
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-white/55">
          Layer đang chọn không phải text. Thêm 1 text layer mới?
        </p>
        <button
          type="button"
          onClick={() => addTextLayer(selWindowId)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-500 px-2 py-1.5 text-[11px] font-bold text-black transition-colors hover:bg-sky-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm text layer
        </button>
      </div>
    )
  }

  const commitHex = (v: string) => {
    let hex = v.trim()
    if (!hex.startsWith('#')) hex = '#' + hex
    if (/^#[0-9a-fA-F]{6}$/.test(hex) || /^#[0-9a-fA-F]{3}$/.test(hex)) {
      patchSelectedLayerText({ color: hex.toLowerCase() })
    }
  }

  return (
    <div className="mx-3 mb-3 rounded-md border border-white/12 bg-black/40 p-2.5 text-white">
      {/* header */}
      <div className="mb-2 flex items-center gap-1.5">
        <Type className="h-3.5 w-3.5 text-sky-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
          Text
        </span>
      </div>

      {/* content textarea */}
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-white/45">
        Nội dung
      </label>
      <textarea
        value={content}
        onChange={(e) => patchSelectedLayerText({ content: e.target.value })}
        rows={3}
        placeholder="Nhập văn bản…"
        className="mb-2 w-full resize-y rounded-md bg-black/50 px-2 py-1.5 text-[12px] text-white outline-none ring-1 ring-white/10 focus:ring-sky-400/60"
        aria-label="Text content"
      />

      {/* font + size row */}
      <div className="mb-2 flex gap-1.5">
        <label className="flex flex-1 flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/45">Font</span>
          <select
            value={fontFamily}
            onChange={(e) => patchSelectedLayerText({ fontFamily: e.target.value })}
            className="rounded-md bg-black/50 px-1.5 py-1 text-[11px] text-white outline-none ring-1 ring-white/10 focus:ring-sky-400/60"
            aria-label="Font family"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-16 flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/45">Cỡ</span>
          <input
            type="number"
            min={1}
            max={512}
            value={fontSize}
            onChange={(e) =>
              patchSelectedLayerText({ fontSize: Math.max(1, Math.min(512, Number(e.target.value) || 1)) })
            }
            className="rounded-md bg-black/50 px-1.5 py-1 text-right text-[11px] tabular-nums text-white outline-none ring-1 ring-white/10 focus:ring-sky-400/60"
            aria-label="Font size"
          />
        </label>
      </div>

      {/* color */}
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-white/45">
        Màu
      </label>
      <div className="mb-2 flex items-center gap-2 rounded-md bg-white/[0.04] p-1.5">
        <label
          className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md ring-1 ring-white/20"
          style={{ background: color }}
          title="Chọn màu"
        >
          <input
            type="color"
            value={color}
            onChange={(e) => patchSelectedLayerText({ color: e.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Text color picker"
          />
          <Palette className="h-3.5 w-3.5 mix-blend-difference text-white" />
        </label>
        <input
          type="text"
          value={color.replace(/^#/, '')}
          onChange={(e) => commitHex('#' + e.target.value.replace(/^#/, ''))}
          onBlur={(e) => commitHex(e.target.value)}
          maxLength={7}
          className="flex-1 rounded bg-black/40 px-1.5 py-0.5 text-[11px] font-mono tabular-nums text-white outline-none focus:ring-1 focus:ring-sky-400/50"
          aria-label="Hex color"
        />
      </div>

      {/* style toggles */}
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-white/45">
        Kiểu
      </label>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => patchSelectedLayerText({ bold: !bold, italic: false })}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-bold transition-colors',
            bold
              ? 'border-sky-400/60 bg-sky-400/15 text-sky-200'
              : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10',
          )}
          aria-pressed={bold}
          aria-label="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
          B
        </button>
        <button
          type="button"
          onClick={() => patchSelectedLayerText({ italic: !italic, bold: false })}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] italic transition-colors',
            italic
              ? 'border-sky-400/60 bg-sky-400/15 text-sky-200'
              : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10',
          )}
          aria-pressed={italic}
          aria-label="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
          I
        </button>
        <button
          type="button"
          onClick={() => patchSelectedLayerText({ bold: false, italic: false })}
          className={cn(
            'flex flex-1 items-center justify-center rounded-md border px-2 py-1.5 text-[11px] transition-colors',
            !bold && !italic
              ? 'border-sky-400/60 bg-sky-400/15 text-sky-200'
              : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10',
          )}
          aria-pressed={!bold && !italic}
          aria-label="Normal style"
        >
          Normal
        </button>
      </div>

      {/* preview */}
      <div className="mt-2 overflow-hidden rounded-md bg-[repeating-conic-gradient(#1f1f23_0%_25%,#26262b_0%_50%)] bg-[length:10px_10px] p-2">
        <div
          className="truncate"
          style={{
            fontFamily,
            fontSize: `${Math.min(28, fontSize)}px`,
            color,
            fontWeight: bold ? 700 : 400,
            fontStyle: italic ? 'italic' : 'normal',
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {content || 'Xem trước'}
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] leading-relaxed text-white/40">
        Text local trên layer đang chọn · vị trí/rotate qua Biến đổi
      </p>
    </div>
  )
}
