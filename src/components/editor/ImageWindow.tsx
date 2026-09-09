'use client'

import { useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import { X, Minus } from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'

interface ImageWindowProps {
  id: string
  workspaceRef: React.RefObject<HTMLDivElement>
}

/**
 * A floating, draggable image window (Milestone 1).
 *
 * Dragging the title bar moves the WINDOW in workspace coordinates — it never
 * touches the image content (spec §10 — `Di chuyển` affects window only).
 *
 * The `_` button is intentionally inert in M1: per spec §5 it is the batch
 * participation toggle, which lands in M2.
 */
export function ImageWindow({ id, workspaceRef }: ImageWindowProps) {
  // Subscribe to this window's slice only → siblings don't re-render on move.
  const win = useEditorStore((s) => s.windows.find((w) => w.id === id))
  const closeWindow = useEditorStore((s) => s.closeWindow)
  const selectWindow = useEditorStore((s) => s.selectWindow)
  const moveWindow = useEditorStore((s) => s.moveWindow)
  const bringToFront = useEditorStore((s) => s.bringToFront)

  // Track drag state in refs to avoid re-renders during the gesture.
  const dragState = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
    wsW: number
    wsH: number
    w: number
    h: number
  } | null>(null)

  const onTitlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      if (!win) return
      const ws = workspaceRef.current
      if (!ws) return
      // Only initiate drag from the title bar background, not from buttons.
      const target = e.target as HTMLElement
      if (target.closest('[data-window-control]')) return

      e.preventDefault()
      const rect = ws.getBoundingClientRect()
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: win.x,
        origY: win.y,
        wsW: rect.width,
        wsH: rect.height,
        w: win.width,
        h: win.height,
      }
      const titleEl = e.currentTarget
      titleEl.setPointerCapture(e.pointerId)
      // Selecting + fronting on drag-start gives immediate, predictable feedback.
      selectWindow(id)
    },
    [win, workspaceRef, selectWindow, id],
  )

  const onTitlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = dragState.current
      if (!st) return
      const dx = e.clientX - st.startX
      const dy = e.clientY - st.startY
      // Clamp so the title bar stays at least partially reachable inside the workspace.
      const minX = -st.w + 96
      const maxX = st.wsW - 96
      const minY = 0
      const maxY = st.wsH - 36
      const nx = Math.min(maxX, Math.max(minX, st.origX + dx))
      const ny = Math.min(maxY, Math.max(minY, st.origY + dy))
      moveWindow(id, nx, ny)
    },
    [moveWindow, id],
  )

  const onTitlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (dragState.current) dragState.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    },
    [],
  )

  // Click anywhere on the window body to select it (without dragging).
  const onWindowPointerDown = useCallback(() => {
    if (!win?.isSelected) selectWindow(id)
  }, [win, selectWindow, id])

  if (!win) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className={cn(
        'absolute flex flex-col overflow-hidden rounded-md bg-zinc-900 shadow-2xl',
        'ring-1 transition-shadow',
        win.isSelected
          ? 'ring-2 ring-sky-300/90 shadow-[0_0_0_2px_rgba(56,189,248,0.35),0_20px_40px_-12px_rgba(0,0,0,0.7)]'
          : 'ring-white/10 hover:ring-white/25',
      )}
      style={{
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
        cursor: 'default',
      }}
      onPointerDown={onWindowPointerDown}
      role="button"
      tabIndex={0}
      aria-label={`Window ${win.fileName}${win.isSelected ? ' (selected)' : ''}`}
    >
      {/* Title bar — drag handle */}
      <div
        className={cn(
          'flex h-8 shrink-0 items-center gap-2 bg-black px-2.5 text-white',
          'cursor-grab active:cursor-grabbing',
          win.isSelected && 'bg-gradient-to-r from-zinc-900 to-black',
        )}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onPointerCancel={onTitlePointerUp}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            win.isSelected ? 'bg-sky-400' : 'bg-white/30',
          )}
        />
        <span className="flex-1 truncate text-xs font-medium text-white/90">
          {win.fileName}
        </span>
        <button
          type="button"
          data-window-control
          title="Bật/tắt batch (sắp có — M2)"
          onClick={(e) => e.stopPropagation()}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          aria-label="Toggle batch participation (soon)"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          data-window-control
          title="Đóng window"
          onClick={(e) => {
            e.stopPropagation()
            closeWindow(win.id)
          }}
          className="flex h-5 w-5 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-rose-500/80 hover:text-white"
          aria-label="Close window"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Image content — object-contain so aspect ratio is never distorted (spec §4) */}
      <div className="relative flex-1 overflow-hidden bg-[repeating-conic-gradient(#1f1f23_0%_25%,#26262b_0%_50%)] bg-[length:16px_16px]">
        <img
          src={win.imageUrl}
          alt={win.fileName}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
        {/* subtle dimension badge */}
        <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
          {win.naturalWidth}×{win.naturalHeight}
        </div>
      </div>
    </motion.div>
  )
}
