'use client'

import { Crown, Layers, Ban, Hand, Move } from 'lucide-react'
import {
  useEditorStore,
  selectBatchCount,
  selectExcludedCount,
} from '@/store/editor-store'
import { formatZoom } from '@/lib/canvas-viewport'

/**
 * Status bar — surfaces workspace facts the user needs to know (spec §7).
 *
 * M3 additions: active tool + zoom% of the selected window.
 */
export function StatusBar() {
  const count = useEditorStore((s) => s.windows.length)
  const mainId = useEditorStore((s) => s.mainId)
  const mainWindow = useEditorStore((s) =>
    s.windows.find((w) => w.id === s.mainId),
  )
  const selected = useEditorStore((s) =>
    s.windows.find((w) => w.id === s.selectedWindowId),
  )
  const batchCount = useEditorStore(selectBatchCount)
  const excludedCount = useEditorStore(selectExcludedCount)
  const tool = useEditorStore((s) => s.tool)

  // Compute the selected window's zoom label. We need the window body size;
  // approximate with the window's own w/h minus title (32px) and footer hint.
  // For a stable label we only show when not in fit mode (exact zoom) — in fit
  // mode we show "fit".
  const zoomLabel = selected
    ? selected.fitMode
      ? 'fit'
      : formatZoom(selected.zoom)
    : null

  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-white/10 bg-black px-3 text-[11px] text-white/70">
      <span className="flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5 text-white/55" />
        <span className="font-medium text-white/85">{count}</span>
        {count === 1 ? 'window' : 'windows'}
      </span>

      <span className="text-white/15">·</span>

      <span className="flex items-center gap-1.5">
        <Crown
          className={`h-3.5 w-3.5 ${mainWindow ? 'text-amber-400' : 'text-white/30'}`}
        />
        <span className="text-white/45">MAIN:</span>
        {mainWindow ? (
          <span className="font-medium text-amber-200">{mainWindow.fileName}</span>
        ) : (
          <span className="text-white/40">chưa chọn</span>
        )}
      </span>

      <span className="text-white/15">·</span>

      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="font-medium text-white/85">{batchCount}</span>
        in batch
      </span>

      {excludedCount > 0 && (
        <>
          <span className="text-white/15">·</span>
          <span className="flex items-center gap-1.5">
            <Ban className="h-3 w-3 text-rose-400/80" />
            <span className="font-medium text-white/85">{excludedCount}</span>
            excluded
          </span>
        </>
      )}

      <span className="ml-auto flex items-center gap-3 text-white/40">
        <span className="flex items-center gap-1">
          {tool === 'view' ? (
            <Hand className="h-3 w-3 text-sky-300" />
          ) : (
            <Move className="h-3 w-3 text-white/55" />
          )}
          <span className="text-white/55">{tool === 'view' ? 'Xem' : 'Di chuyển'}</span>
        </span>
        {zoomLabel && (
          <span className="flex items-center gap-1">
            <span className="text-white/30">zoom</span>
            <span className="font-medium tabular-nums text-white/80">{zoomLabel}</span>
          </span>
        )}
        {selected && selected.id !== mainId && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
            đang chọn
            <span className="font-medium text-white/80">{selected.fileName}</span>
          </span>
        )}
      </span>
    </div>
  )
}

