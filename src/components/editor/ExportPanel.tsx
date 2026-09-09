'use client'

import { useState } from 'react'
import {
  Download,
  Image as ImageIcon,
  Archive,
  Layers as LayersIcon,
  Loader2,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'
import {
  renderWindowToCanvas,
  canvasToPngBlob,
  sanitizeFileName,
} from '@/lib/export-canvas'
import type { ImageWindow } from '@/lib/editor-types'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'

/**
 * ExportPanel — the `Tải về` panel (spec §23).
 *
 * Three export targets:
 *   • Window hiện tại — exports the selected window as a single PNG.
 *   • Tất cả window — packages all windows as a ZIP (one PNG each).
 *   • Tất cả window đang batch — packages MAIN + batch-enabled windows as a ZIP.
 *
 * Single image → PNG download. Multiple → ZIP (spec §23).
 * Preserves original filenames; avoids `image.png`/`image (1).png` (spec §23).
 * Export does NOT modify document state or create history entries (spec §23).
 */
type Target = 'current' | 'all' | 'batch'

export function ExportPanel() {
  const windows = useEditorStore((s) => s.windows)
  const selectedId = useEditorStore((s) => s.selectedWindowId)
  const mainId = useEditorStore((s) => s.mainId)
  const [busy, setBusy] = useState<Target | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const selectedWindow = windows.find((w) => w.id === selectedId) ?? null
  const batchWindows = windows.filter(
    (w) => w.id === mainId || w.isBatchEnabled,
  )

  const handleExport = async (target: Target) => {
    setBusy(target)
    setLastResult(null)
    try {
      let toExport: ImageWindow[]
      if (target === 'current') {
        if (!selectedWindow) {
          setLastResult('Chưa chọn window')
          return
        }
        toExport = [selectedWindow]
      } else if (target === 'all') {
        toExport = windows
      } else {
        // batch
        toExport = batchWindows
      }
      if (toExport.length === 0) {
        setLastResult('Không có window để xuất')
        return
      }

      // Render all windows to canvases (in parallel for speed).
      const canvases = await Promise.all(
        toExport.map((w) => renderWindowToCanvas(w)),
      )
      const blobs = await Promise.all(canvases.map(canvasToPngBlob))

      if (toExport.length === 1) {
        // Single → PNG download.
        const w = toExport[0]
        const name = sanitizeFileName(w.fileName, w.id)
        saveAs(blobs[0], name)
        setLastResult(`Đã xuất ${name}`)
      } else {
        // Multiple → ZIP.
        const zip = new JSZip()
        const usedNames = new Set<string>()
        toExport.forEach((w, i) => {
          let name = sanitizeFileName(w.fileName, w.id)
          // Avoid collisions: append -2, -3, etc.
          if (usedNames.has(name)) {
            const base = name.replace(/\.png$/i, '')
            let n = 2
            while (usedNames.has(`${base}-${n}.png`)) n++
            name = `${base}-${n}.png`
          }
          usedNames.add(name)
          zip.file(name, blobs[i])
        })
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
        saveAs(zipBlob, `zmi-edt-export-${ts}.zip`)
        setLastResult(`Đã xuất ZIP với ${toExport.length} ảnh`)
      }
    } catch (err) {
      console.error('[Zmi EDT] export failed', err)
      setLastResult(`Lỗi: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      setBusy(null)
    }
  }

  const currentDisabled = !selectedWindow
  const batchDisabled = batchWindows.length === 0

  return (
    <div className="mx-3 mb-3 rounded-md border border-white/12 bg-black/40 p-2.5 text-white">
      {/* header */}
      <div className="mb-2 flex items-center gap-1.5">
        <Download className="h-3.5 w-3.5 text-sky-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
          Tải về
        </span>
      </div>

      {/* export buttons */}
      <div className="space-y-1.5">
        <ExportButton
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          label="Window hiện tại"
          sub={selectedWindow ? selectedWindow.fileName : '— chưa chọn —'}
          disabled={currentDisabled || busy !== null}
          busy={busy === 'current'}
          onClick={() => handleExport('current')}
        />
        <ExportButton
          icon={<Archive className="h-3.5 w-3.5" />}
          label="Tất cả window"
          sub={`${windows.length} ảnh → ZIP`}
          disabled={windows.length === 0 || busy !== null}
          busy={busy === 'all'}
          onClick={() => handleExport('all')}
        />
        <ExportButton
          icon={<LayersIcon className="h-3.5 w-3.5" />}
          label="Window đang batch"
          sub={`${batchWindows.length} ảnh → ZIP`}
          disabled={batchDisabled || busy !== null}
          busy={busy === 'batch'}
          onClick={() => handleExport('batch')}
        />
      </div>

      {/* last result */}
      {lastResult && (
        <div
          className={cn(
            'mt-2 rounded-md p-2 text-[10px] leading-relaxed',
            lastResult.startsWith('Lỗi')
              ? 'bg-rose-500/10 text-rose-200'
              : 'bg-emerald-500/10 text-emerald-200',
          )}
        >
          {lastResult}
        </div>
      )}

      <p className="mt-2 text-center text-[10px] leading-relaxed text-white/40">
        PNG cho 1 ảnh · ZIP cho nhiều · giữ tên file gốc (§23)
      </p>
    </div>
  )
}

interface ExportButtonProps {
  icon: React.ReactNode
  label: string
  sub: string
  disabled: boolean
  busy: boolean
  onClick: () => void
}

function ExportButton({
  icon,
  label,
  sub,
  disabled,
  busy,
  onClick,
}: ExportButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-white/10 bg-white/[0.02] text-white/30'
          : 'border-white/15 bg-white/[0.04] text-white/85 hover:bg-white/10',
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
        ) : (
          icon
        )}
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-[11px] font-medium">{label}</span>
        <span className="text-[9px] text-white/45">{sub}</span>
      </span>
    </button>
  )
}
