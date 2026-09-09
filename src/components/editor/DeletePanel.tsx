'use client'

import { useShallow } from 'zustand/react/shallow'
import { Trash2, Layers as LayersIcon, Sparkles } from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useState } from 'react'

/**
 * DeletePanel — the `Xóa` tool panel (spec §15 Xóa).
 *
 * Delete the selected layer of the selected window. When the selected window
 * is MAIN and there are batch-enabled windows with a matching layer identity,
 * offers a "Xóa trên batch" action that deletes the matching layer in MAIN +
 * all batch-enabled windows (spec §15 MAIN deletion + §33 confirmation).
 *
 * Refuses to delete the last remaining layer (spec §17).
 */
export function DeletePanel() {
  const {
    selWindowId,
    selLayerName,
    selLayerIdentity,
    selLayerType,
    layerCount,
    canDelete,
  } = useEditorStore(
    useShallow((s) => {
      const w = s.windows.find((x) => x.id === s.selectedWindowId)
      const layer = w?.layers.find((l) => l.id === w?.selectedLayerId) ?? null
      return {
        selWindowId: w?.id ?? null,
        selLayerName: layer?.name ?? '',
        selLayerIdentity: layer?.identity ?? '',
        selLayerType: layer?.type ?? 'image',
        layerCount: w?.layers.length ?? 0,
        canDelete: (w?.layers.length ?? 0) > 1,
      }
    }),
  )
  const deleteSelectedLayer = useEditorStore((s) => s.deleteSelectedLayer)
  const batchDeleteFromMain = useEditorStore((s) => s.batchDeleteFromMain)
  const mainId = useEditorStore((s) => s.mainId)
  const batchCount = useEditorStore(
    (s) => s.windows.filter((w) => w.id !== s.mainId && w.isBatchEnabled).length,
  )

  const [dialogOpen, setDialogOpen] = useState(false)

  if (!selWindowId) {
    return (
      <div className="mx-3 mb-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-center text-[11px] text-white/45">
        Chọn 1 window rồi chọn layer cần xóa
      </div>
    )
  }

  const isMainSelected = selWindowId === mainId
  const canBatchDelete =
    isMainSelected && batchCount > 0 && selLayerIdentity !== 'image'
  // Don't allow batch-deleting the implicit 'image' layer — it's the source
  // pixels and every window has exactly one; deleting it everywhere would
  // leave windows empty (spec §17 keeps ≥1 layer).
  const affectedCount = canBatchDelete ? batchCount + 1 : 0

  return (
    <div className="mx-3 mb-3 rounded-md border border-white/12 bg-black/40 p-2.5 text-white">
      {/* header */}
      <div className="mb-2 flex items-center gap-1.5">
        <Trash2 className="h-3.5 w-3.5 text-rose-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
          Xóa
        </span>
      </div>

      {/* selected layer info */}
      <div className="mb-2 rounded-md bg-white/[0.04] p-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <LayersIcon className="h-3 w-3 text-white/45" />
          <span className="truncate font-medium text-white/85">{selLayerName}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-white/45">
          <span>identity: <span className="text-white/70">{selLayerIdentity}</span></span>
          <span>type: <span className="text-white/70">{selLayerType}</span></span>
        </div>
        <div className="mt-1 text-white/45">
          {layerCount} layer{layerCount === 1 ? '' : 's'} trong window
        </div>
      </div>

      {/* local delete */}
      <button
        type="button"
        disabled={!canDelete}
        onClick={() => deleteSelectedLayer()}
        className={cn(
          'flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-bold transition-colors',
          canDelete
            ? 'bg-rose-600 text-white hover:bg-rose-500'
            : 'cursor-not-allowed bg-white/[0.04] text-white/30',
        )}
        title={
          !canDelete
            ? 'Không thể xóa layer cuối cùng (§17)'
            : 'Xóa layer đang chọn (local)'
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
        Xóa layer này
      </button>
      {!canDelete && (
        <p className="mt-1 text-center text-[10px] text-white/35">
          Window chỉ còn 1 layer — không xóa được
        </p>
      )}

      {/* batch delete (MAIN only, non-image identity) */}
      <button
        type="button"
        disabled={!canBatchDelete}
        onClick={() => setDialogOpen(true)}
        className={cn(
          'mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-bold transition-colors',
          canBatchDelete
            ? 'bg-amber-500 text-black hover:bg-amber-400'
            : 'cursor-not-allowed bg-white/[0.04] text-white/30',
        )}
        title={
          !isMainSelected
            ? 'Chỉ MAIN mới có thể phát batch xóa'
            : batchCount === 0
              ? 'Không có window nào trong batch'
              : selLayerIdentity === 'image'
                ? 'Không batch-xóa layer ảnh gốc (mọi window cần ≥1)'
                : `Xóa layer "${selLayerIdentity}" trong ${batchCount + 1} window`
        }
      >
        <Sparkles className="h-3.5 w-3.5" />
        Xóa trên batch
        {canBatchDelete && (
          <span className="ml-1 rounded bg-black/25 px-1 py-px text-[10px] font-semibold">
            {affectedCount} cửa sổ
          </span>
        )}
      </button>

      <p className="mt-2 text-center text-[10px] leading-relaxed text-white/40">
        Xóa local mặc định · MAIN có thể phát batch xóa (§15)
      </p>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa trên batch?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa layer “<span className="font-semibold text-foreground">{selLayerName}</span>”
              (identity <span className="font-mono text-foreground">{selLayerIdentity}</span>) trong{' '}
              <span className="font-semibold text-foreground">{affectedCount}</span> cửa sổ
              (MAIN + {batchCount} đang active). Các cửa sổ EXCLUDED không bị ảnh hưởng.
              Không thể hoàn tác (history sẽ land ở M9).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                batchDeleteFromMain(selLayerIdentity)
                setDialogOpen(false)
              }}
              className="bg-rose-600 text-white hover:bg-rose-600/90"
            >
              Xóa {affectedCount} cửa sổ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
