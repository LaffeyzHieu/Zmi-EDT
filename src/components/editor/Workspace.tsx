'use client'

import { useCallback, useRef, useState, type DragEvent } from 'react'
import { AnimatePresence } from 'framer-motion'
import { UploadCloud, ImageIcon } from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { useToast } from '@/hooks/use-toast'
import { ImageWindow } from './ImageWindow'

/**
 * Workspace — the drop target + floating window layer (Milestone 1).
 *
 * Handles drag & drop image import (spec §4). Clicking the empty-state button
 * is an equivalent fallback for environments where synthetic drag is hard
 * (including automated QA).
 */
export function Workspace() {
  const workspaceRef = useRef<HTMLDivElement>(null)
  const windows = useEditorStore((s) => s.windows)
  const addImages = useEditorStore((s) => s.addImages)
  const selectWindow = useEditorStore((s) => s.selectWindow)
  const { toast } = useToast()
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      const before = useEditorStore.getState().windows.length
      const created = await addImages(files)
      const unsupported = files.length - created
      if (created > 0) {
        toast({
          title: `Đã nhập ${created} ảnh`,
          description:
            unsupported > 0
              ? `${unsupported} file bị bỏ qua (không hỗ trợ).`
              : undefined,
        })
      } else if (unsupported > 0) {
        toast({
          title: 'Không có ảnh hợp lệ',
          description: 'Chỉ hỗ trợ PNG, JPG, JPEG, WebP.',
          variant: 'destructive',
        })
      }
      void before
    },
    [addImages, toast],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Required to allow drop.
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    if (!isDragOver) setIsDragOver(true)
  }, [isDragOver])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only clear when leaving the workspace itself, not a child.
    if (e.currentTarget === e.target) setIsDragOver(false)
  }, [])

  const isEmpty = windows.length === 0

  return (
    <div
      ref={workspaceRef}
      className="relative flex-1 overflow-hidden bg-zinc-950"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      aria-label="Workspace"
    >
      {/* Background — pastel waifu artwork (matches mockup). Falls back to a
          gradient if the image asset is missing or fails to load. The whole
          background stack is wrapped in a click-catcher so clicking empty
          workspace deselects the active window (spec §6). */}
      <div
        className="absolute inset-0"
        aria-hidden
        onPointerDown={(e) => {
          // Only deselect when the click lands on this background layer itself,
          // not on a window above it. Windows stopPropagation on their own
          // pointerdown so they never reach here.
          if (e.target === e.currentTarget) selectWindow(null)
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-200/50 via-violet-200/40 to-sky-200/45"
        />
        <img
          src="/waifu-bg.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
        {/* Dark vignette so floating windows read clearly. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.45)_100%)]" />
      </div>

      {/* Drag-over highlight ring */}
      {isDragOver && (
        <div className="pointer-events-none absolute inset-3 z-[100000] rounded-xl border-2 border-dashed border-sky-300/80 bg-sky-400/10" />
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-white/15 bg-black/55 p-8 text-center text-white backdrop-blur-md">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <UploadCloud className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold">Kéo ảnh vào workspace</h2>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-white/70">
              Thả nhiều ảnh để tạo các window độc lập. Hỗ trợ PNG, JPG, JPEG,
              WebP.
            </p>
            <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90">
              <ImageIcon className="h-4 w-4" />
              Chọn ảnh từ máy
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                aria-label="Chọn ảnh để nhập vào workspace"
                className="sr-only"
                onChange={async (e) => {
                  if (!e.target.files) return
                  await addImages(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
            <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/40">
              Milestone 3 · Canvas / View
            </p>
          </div>
        </div>
      )}

      {/* Drag-over hint while windows already exist */}
      {isDragOver && !isEmpty && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[100001] -translate-x-1/2 rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
          Thả để nhập ảnh
        </div>
      )}

      {/* Window layer */}
      <div className="absolute inset-0">
        <AnimatePresence>
          {windows.map((w) => (
            <ImageWindow key={w.id} id={w.id} workspaceRef={workspaceRef} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
