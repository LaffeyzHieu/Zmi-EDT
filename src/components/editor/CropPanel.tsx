'use client'

import { useShallow } from 'zustand/react/shallow'
import { Crop, Check, X, Scissors } from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'

/**
 * CropPanel — the `Cắt ảnh` (Crop) tool panel (spec §16).
 *
 * Crop changes the document bounds (naturalWidth/Height). The user drags a
 * rect on the canvas (handled in ImageWindow); this panel shows the current
 * crop rect (document px), Apply/Cancel buttons, and a hint.
 *
 * Crop is LOCAL by default (spec §16: "For v0.1, crop can be local by default.
 * Batch crop should be explicit because it can change canvas dimensions.").
 */
export function CropPanel() {
  const { selWindowId, cropRect, naturalW, naturalH } = useEditorStore(
    useShallow((s) => {
      const w = s.windows.find((x) => x.id === s.selectedWindowId)
      return {
        selWindowId: w?.id ?? null,
        cropRect: w?.cropRect ?? null,
        naturalW: w?.naturalWidth ?? 0,
        naturalH: w?.naturalHeight ?? 0,
      }
    }),
  )
  const setCropRect = useEditorStore((s) => s.setCropRect)
  const applyCrop = useEditorStore((s) => s.applyCrop)

  if (!selWindowId) {
    return (
      <div className="mx-3 mb-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-center text-[11px] text-white/45">
        Chọn 1 window để cắt ảnh
      </div>
    )
  }

  const hasRect = !!cropRect && cropRect.w > 0 && cropRect.h > 0

  return (
    <div className="mx-3 mb-3 rounded-md border border-white/12 bg-black/40 p-2.5 text-white">
      {/* header */}
      <div className="mb-2 flex items-center gap-1.5">
        <Crop className="h-3.5 w-3.5 text-emerald-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
          Cắt ảnh
        </span>
      </div>

      {/* current rect / doc size */}
      <div className="mb-2 rounded-md bg-white/[0.04] p-2 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-white/45">Kích thước ảnh</span>
          <span className="font-medium tabular-nums text-white/85">
            {naturalW} × {naturalH}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-white/45">Vùng cắt</span>
          {hasRect ? (
            <span className="font-medium tabular-nums text-emerald-300">
              {Math.round(cropRect!.x)},{Math.round(cropRect!.y)} ·{' '}
              {Math.round(cropRect!.w)}×{Math.round(cropRect!.h)}
            </span>
          ) : (
            <span className="text-white/40">— chưa chọn —</span>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!hasRect}
          onClick={() => applyCrop(selWindowId)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-bold transition-colors',
            hasRect
              ? 'bg-emerald-500 text-black hover:bg-emerald-400'
              : 'cursor-not-allowed bg-white/[0.04] text-white/30',
          )}
        >
          <Check className="h-3.5 w-3.5" />
          Áp dụng cắt
        </button>
        <button
          type="button"
          disabled={!hasRect}
          onClick={() => setCropRect(selWindowId, null)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
            hasRect
              ? 'border-white/15 bg-white/[0.04] text-white/80 hover:bg-white/10'
              : 'cursor-not-allowed border-white/10 bg-white/[0.02] text-white/30',
          )}
        >
          <X className="h-3.5 w-3.5" />
          Hủy
        </button>
      </div>

      {/* hint */}
      <div className="mt-2 flex items-start gap-1.5 rounded-md bg-emerald-400/5 p-2 text-[10px] leading-relaxed text-emerald-200/70">
        <Scissors className="mt-px h-3 w-3 shrink-0" />
        <span>
          Kéo trên ảnh để chọn vùng cắt. “Áp dụng” sẽ đổi kích thước ảnh +
          dịch layer cho khớp. Local — không phát batch (§16).
        </span>
      </div>
    </div>
  )
}
