'use client'

import { useState } from 'react'
import {
  FolderOpen,
  Trash2,
  Plus,
  ImagePlus,
  Image as ImageIcon,
} from 'lucide-react'
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
import type { UploadedAsset } from '@/lib/editor-types'

/**
 * AssetLibraryPanel — the `Xem file đã upload` panel (spec §24).
 *
 * Shows a grid of uploaded assets (preview + filename + dims). Actions:
 *   • Reuse as new window (click the + overlay) — creates a new window from the asset.
 *   • Add as layer to selected window (the "image-plus" button).
 *   • Delete from library (trash) — revokes the object URL.
 *
 * The asset library is distinct from workspace windows (spec §24): closing a
 * window does NOT delete the underlying asset. The asset keeps its object URL
 * until explicitly deleted here.
 */
export function AssetLibraryPanel() {
  const assets = useEditorStore((s) => s.assets)
  const createWindowFromAsset = useEditorStore((s) => s.createWindowFromAsset)
  const addAssetAsLayer = useEditorStore((s) => s.addAssetAsLayer)
  const deleteAsset = useEditorStore((s) => s.deleteAsset)
  const selectedWindowId = useEditorStore((s) => s.selectedWindowId)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleReuse = (asset: UploadedAsset) => {
    createWindowFromAsset(asset.id)
    setFeedback(`Đã tạo window mới từ "${asset.fileName}"`)
    setTimeout(() => setFeedback(null), 2500)
  }

  const handleAddAsLayer = (asset: UploadedAsset) => {
    if (!selectedWindowId) {
      setFeedback('Chọn 1 window trước khi thêm layer')
      setTimeout(() => setFeedback(null), 2500)
      return
    }
    addAssetAsLayer(selectedWindowId, asset.id)
    setFeedback(`Đã thêm "${asset.fileName}" như layer`)
    setTimeout(() => setFeedback(null), 2500)
  }

  const handleDelete = () => {
    if (!confirmDeleteId) return
    const asset = assets.find((a) => a.id === confirmDeleteId)
    deleteAsset(confirmDeleteId)
    setConfirmDeleteId(null)
    if (asset) {
      setFeedback(`Đã xóa asset "${asset.fileName}"`)
      setTimeout(() => setFeedback(null), 2500)
    }
  }

  return (
    <div className="mx-3 mb-3 rounded-md border border-white/12 bg-black/40 p-2.5 text-white">
      {/* header */}
      <div className="mb-2 flex items-center gap-1.5">
        <FolderOpen className="h-3.5 w-3.5 text-sky-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
          File đã upload
        </span>
        <span className="ml-auto text-[10px] text-white/40">
          {assets.length} file
        </span>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/15 bg-white/[0.02] p-4 text-center text-[11px] text-white/45">
          Chưa có file nào. Nhập ảnh để thêm vào thư viện.
        </div>
      ) : (
        <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onReuse={() => handleReuse(asset)}
              onAddAsLayer={() => handleAddAsLayer(asset)}
              onDelete={() => setConfirmDeleteId(asset.id)}
              canAddAsLayer={!!selectedWindowId}
            />
          ))}
        </div>
      )}

      {/* feedback */}
      {feedback && (
        <div className="mt-2 rounded-md bg-sky-500/10 p-2 text-[10px] leading-relaxed text-sky-200">
          {feedback}
        </div>
      )}

      <p className="mt-2 text-center text-[10px] leading-relaxed text-white/40">
        Asset ≠ window · đóng window không xóa asset (§24)
      </p>

      {/* delete confirm */}
      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa asset?</AlertDialogTitle>
            <AlertDialogDescription>
              Asset{' '}
              <span className="font-semibold text-foreground">
                {assets.find((a) => a.id === confirmDeleteId)?.fileName}
              </span>{' '}
              sẽ bị xóa khỏi thư viện. Các window đang dùng asset này sẽ không
              còn hiển thị ảnh. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 text-white hover:bg-rose-600/90"
            >
              Xóa asset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface AssetCardProps {
  asset: UploadedAsset
  onReuse: () => void
  onAddAsLayer: () => void
  onDelete: () => void
  canAddAsLayer: boolean
}

function AssetCard({
  asset,
  onReuse,
  onAddAsLayer,
  onDelete,
  canAddAsLayer,
}: AssetCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-white/10 bg-white/[0.02]">
      {/* preview */}
      <div className="relative aspect-square overflow-hidden bg-[repeating-conic-gradient(#1f1f23_0%_25%,#26262b_0%_50%)] bg-[length:8px_8px]">
        <img
          src={asset.imageUrl}
          alt={asset.fileName}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        {/* hover overlay actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onReuse}
            title="Tạo window mới từ asset"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500 text-black transition-transform hover:scale-110 hover:bg-sky-400"
            aria-label="Reuse as new window"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onAddAsLayer}
            disabled={!canAddAsLayer}
            title={
              canAddAsLayer
                ? 'Thêm như layer vào window đang chọn'
                : 'Chọn 1 window trước'
            }
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-transform hover:scale-110',
              canAddAsLayer
                ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                : 'cursor-not-allowed bg-white/10 text-white/30',
            )}
            aria-label="Add as layer to selected window"
          >
            <ImagePlus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Xóa khỏi thư viện"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-600 text-white transition-transform hover:scale-110 hover:bg-rose-500"
            aria-label="Delete asset from library"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* type badge */}
        <div className="pointer-events-none absolute left-1 top-1 rounded bg-black/65 px-1 py-px text-[9px] font-medium text-white/70">
          <ImageIcon className="inline h-2.5 w-2.5" /> image
        </div>
      </div>
      {/* filename + dims */}
      <div className="p-1.5">
        <div className="truncate text-[10px] font-medium text-white/85" title={asset.fileName}>
          {asset.fileName}
        </div>
        <div className="text-[9px] tabular-nums text-white/40">
          {asset.naturalWidth}×{asset.naturalHeight}
        </div>
      </div>
    </div>
  )
}
