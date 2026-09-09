'use client'

import { useState } from 'react'
import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  Type,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'
import type { Layer } from '@/lib/editor-types'

/**
 * LayerPanel — the `Xem lớp` panel (spec §17).
 *
 * Lists the selected window's layers (top of list = front). Supports:
 *   • select layer (click row)
 *   • hide/show (eye toggle)
 *   • rename (double-click name, or pencil icon)
 *   • reorder (up/down chevrons)
 *   • delete (refuses to delete the last layer — spec §17 implies ≥1 layer)
 *   • add image layer (file picker) — spec §4 "+"
 *   • add text layer (preview for M7) — spec §18
 *
 * Layer identity is shown as a small badge so the user can see which layers
 * will be batch-targeted (spec §8).
 */
export function LayerPanel() {
  // Select the selected WINDOW object directly — its reference is stable
  // unless the store actually mutates that window, so this is safe (no
  // infinite re-render). We then read layers/selectedLayerId off it.
  const selWindow = useEditorStore((s) =>
    s.windows.find((w) => w.id === s.selectedWindowId) ?? null,
  )
  const selWindowId = selWindow?.id ?? null
  const layers = selWindow?.layers ?? []
  const selectedLayerId = selWindow?.selectedLayerId ?? null
  const canDelete = layers.length > 1
  const selectLayer = useEditorStore((s) => s.selectLayer)
  const toggleLayerVisibility = useEditorStore((s) => s.toggleLayerVisibility)
  const renameLayer = useEditorStore((s) => s.renameLayer)
  const reorderLayer = useEditorStore((s) => s.reorderLayer)
  const deleteLayer = useEditorStore((s) => s.deleteLayer)
  const addImageLayer = useEditorStore((s) => s.addImageLayer)
  const addTextLayer = useEditorStore((s) => s.addTextLayer)
  const dropImageIntoWindow = useEditorStore((s) => s.dropImageIntoWindow)
  const mainId = useEditorStore((s) => s.mainId)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  if (!selWindowId) {
    return (
      <div className="mx-3 mb-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-center text-[11px] text-white/45">
        Chọn 1 window để xem lớp
      </div>
    )
  }

  // Render top-to-bottom = front-to-back (reverse of stored bottom-to-top order).
  const ordered = [...layers].reverse()
  const isMain = selWindowId === mainId

  const commitRename = () => {
    if (editingId && selWindowId) {
      renameLayer(selWindowId, editingId, draftName.trim() || 'Layer')
    }
    setEditingId(null)
  }

  return (
    <div className="mx-3 mb-3 rounded-md border border-white/12 bg-black/40 p-2 text-white">
      {/* Header */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
          Lớp
        </span>
        <span className="ml-auto text-[10px] text-white/40">
          {layers.length} layer{layers.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Layer list */}
      <div className="max-h-64 space-y-0.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        {ordered.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isSelected={layer.id === selectedLayerId}
            isEditing={layer.id === editingId}
            draftName={draftName}
            canDelete={canDelete}
            canMoveUp={ordered.indexOf(layer) > 0}
            canMoveDown={ordered.indexOf(layer) < ordered.length - 1}
            onSelect={() => selectLayer(selWindowId, layer.id)}
            onToggleVis={() => toggleLayerVisibility(selWindowId, layer.id)}
            onStartRename={() => {
              setEditingId(layer.id)
              setDraftName(layer.name)
            }}
            onChangeDraft={setDraftName}
            onCommitRename={commitRename}
            onCancelRename={() => setEditingId(null)}
            onMoveUp={() => reorderLayer(selWindowId, layer.id, 1)}
            onMoveDown={() => reorderLayer(selWindowId, layer.id, -1)}
            onDelete={() => deleteLayer(selWindowId, layer.id)}
          />
        ))}
      </div>

      {/* Add menu */}
      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => setAddMenuOpen((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-white/25 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-white/85 transition-colors hover:border-white/45 hover:bg-white/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm layer
        </button>
        {addMenuOpen && (
          <>
            {/* click-away catcher */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setAddMenuOpen(false)}
              aria-hidden
            />
            <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-md border border-white/15 bg-zinc-900 shadow-xl">
              <AddMenuItem
                icon={<ImageIcon className="h-3.5 w-3.5" />}
                label="Ảnh (file)"
                onClick={() => {
                  setAddMenuOpen(false)
                  // Use a synthetic file input to let the user pick an image.
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/png,image/jpeg,image/webp'
                  input.onchange = async () => {
                    const f = input.files?.[0]
                    if (f) {
                      await dropImageIntoWindow(selWindowId, f)
                    }
                  }
                  input.click()
                }}
              />
              <AddMenuItem
                icon={<ImageIcon className="h-3.5 w-3.5" />}
                label="Ảnh (lắp từ MAIN)"
                disabled={!isMain}
                title={isMain ? '' : 'Chỉ dùng được khi đang chọn MAIN'}
                onClick={() => {
                  if (!isMain) return
                  setAddMenuOpen(false)
                  const main = useEditorStore
                    .getState()
                    .windows.find((w) => w.id === mainId)
                  if (main) {
                    addImageLayer(
                      selWindowId,
                      main.imageUrl,
                      main.naturalWidth,
                      main.naturalHeight,
                      main.fileName,
                    )
                  }
                }}
              />
              <AddMenuItem
                icon={<Type className="h-3.5 w-3.5" />}
                label="Văn bản"
                onClick={() => {
                  setAddMenuOpen(false)
                  addTextLayer(selWindowId)
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface LayerRowProps {
  layer: Layer
  isSelected: boolean
  isEditing: boolean
  draftName: string
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onSelect: () => void
  onToggleVis: () => void
  onStartRename: () => void
  onChangeDraft: (v: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

function LayerRow(props: LayerRowProps) {
  const {
    layer,
    isSelected,
    isEditing,
    draftName,
    canDelete,
    canMoveUp,
    canMoveDown,
    onSelect,
    onToggleVis,
    onStartRename,
    onChangeDraft,
    onCommitRename,
    onCancelRename,
    onMoveUp,
    onMoveDown,
    onDelete,
  } = props

  return (
    <div
      className={cn(
        'group flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition-colors',
        isSelected
          ? 'bg-sky-400/15 ring-1 ring-sky-400/40 text-white'
          : 'text-white/80 hover:bg-white/[0.06]',
        !layer.visible && 'opacity-50',
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
    >
      {/* visibility toggle */}
      <button
        type="button"
        title={layer.visible ? 'Ẩn layer' : 'Hiện layer'}
        onClick={(e) => {
          e.stopPropagation()
          onToggleVis()
        }}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
        aria-pressed={layer.visible}
        aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
      >
        {layer.visible ? (
          <Eye className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5" />
        )}
      </button>

      {/* type icon */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-white/55">
        {layer.type === 'image' ? (
          <ImageIcon className="h-3.5 w-3.5" />
        ) : (
          <Type className="h-3.5 w-3.5" />
        )}
      </span>

      {/* name / rename input */}
      {isEditing ? (
        <div className="flex flex-1 items-center gap-0.5">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => onChangeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename()
              if (e.key === 'Escape') onCancelRename()
            }}
            className="min-w-0 flex-1 rounded bg-black/60 px-1 py-0.5 text-[11px] text-white outline-none ring-1 ring-sky-400/50"
            aria-label="Layer name"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCommitRename()
            }}
            className="flex h-4 w-4 items-center justify-center rounded text-emerald-300 hover:bg-white/10"
            aria-label="Save name"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCancelRename()
            }}
            className="flex h-4 w-4 items-center justify-center rounded text-rose-300 hover:bg-white/10"
            aria-label="Cancel rename"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <span
          className="flex-1 truncate"
          onDoubleClick={(e) => {
            e.stopPropagation()
            onStartRename()
          }}
          title={layer.name}
        >
          {layer.name}
        </span>
      )}

      {/* identity badge */}
      <span className="shrink-0 rounded bg-white/[0.08] px-1 py-px text-[9px] font-medium uppercase tracking-wide text-white/50">
        {layer.identity}
      </span>

      {/* hover actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="Đổi tên"
          onClick={(e) => {
            e.stopPropagation()
            onStartRename()
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-white/55 hover:bg-white/10 hover:text-white"
          aria-label="Rename layer"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          title="Lên trên"
          disabled={!canMoveUp}
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          aria-label="Move layer up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Xuống dưới"
          disabled={!canMoveDown}
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
          aria-label="Move layer down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Xóa layer"
          disabled={!canDelete}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-rose-300/80 hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-25 disabled:hover:bg-transparent"
          aria-label="Delete layer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function AddMenuItem({
  icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors',
        disabled
          ? 'cursor-not-allowed text-white/30'
          : 'text-white/85 hover:bg-white/10',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
