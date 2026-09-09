'use client'

import { Crown, Layers, Ban } from 'lucide-react'
import {
  useEditorStore,
  selectBatchCount,
  selectExcludedCount,
} from '@/store/editor-store'

/**
 * Status bar — surfaces workspace facts the user needs to know (spec §7).
 *
 * M2 shows: total window count · MAIN filename · non-MAIN batch count ·
 * excluded count. Matches the spec example format:
 *   `6 windows · MAIN: claude.png · 5 in batch`
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

      <span className="ml-auto flex items-center gap-2 text-white/40">
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
