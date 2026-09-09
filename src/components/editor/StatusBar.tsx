'use client'

import { Layers } from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'

/**
 * Status bar — surfaces workspace facts the user needs to know (spec §7).
 *
 * M1 shows: total window count + the currently selected filename.
 * M2 will extend this with MAIN + batch membership counts.
 */
export function StatusBar() {
  const count = useEditorStore((s) => s.windows.length)
  const selected = useEditorStore((s) =>
    s.windows.find((w) => w.id === s.selectedWindowId),
  )

  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-white/10 bg-black px-3 text-[11px] text-white/70">
      <span className="flex items-center gap-1.5">
        <Layers className="h-3.5 w-3.5 text-white/55" />
        <span className="font-medium text-white/85">{count}</span>
        {count === 1 ? 'window' : 'windows'}
      </span>
      {selected && (
        <>
          <span className="text-white/25">·</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
            đang chọn
            <span className="font-medium text-white/90">{selected.fileName}</span>
          </span>
        </>
      )}
      <span className="ml-auto text-white/35">
        MAIN: <span className="text-white/55">chưa chọn</span> · 0 trong batch
      </span>
    </div>
  )
}
