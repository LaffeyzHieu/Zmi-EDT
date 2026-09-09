'use client'

import {
  useRef,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { motion } from 'framer-motion'
import { X, Minus, Crown, Ban, Check } from 'lucide-react'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface ImageWindowProps {
  id: string
  workspaceRef: React.RefObject<HTMLDivElement>
}

/**
 * A floating, draggable image window.
 *
 * Milestone 2 additions:
 *   • MAIN badge (`★ MAIN`) + amber ring + double-click title to claim MAIN.
 *   • `_` toggles batch participation (spec §5). Excluded windows get a
 *     desaturated body + "EXCLUDED" ribbon. MAIN cannot be excluded.
 *   • Closing MAIN requires a confirmation dialog (spec §5). Non-MAIN closes
 *     immediately.
 *
 * Dragging the title bar moves the WINDOW in workspace coordinates — it never
 * touches image content (spec §10).
 */
export function ImageWindow({ id, workspaceRef }: ImageWindowProps) {
  // Per-window slice subscription so siblings don't re-render on move.
  const win = useEditorStore((s) => s.windows.find((w) => w.id === id))
  const mainId = useEditorStore((s) => s.mainId)
  const closeWindow = useEditorStore((s) => s.closeWindow)
  const selectWindow = useEditorStore((s) => s.selectWindow)
  const moveWindow = useEditorStore((s) => s.moveWindow)
  const setMain = useEditorStore((s) => s.setMain)
  const toggleBatchEnabled = useEditorStore((s) => s.toggleBatchEnabled)

  const isMain = mainId === id
  const isExcluded = win ? !win.isBatchEnabled && !isMain : false

  const [mainDialogOpen, setMainDialogOpen] = useState(false)

  // Drag state in refs to avoid re-renders during the gesture.
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

  const endDrag = useCallback(
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

  const onTitleDoubleClick = useCallback(() => {
    if (!win || isMain) return
    setMain(id)
  }, [win, isMain, setMain, id])

  const onWindowPointerDown = useCallback(() => {
    if (!win?.isSelected) selectWindow(id)
  }, [win, selectWindow, id])

  if (!win) return null

  const closeBtn = (
    <button
      type="button"
      data-window-control
      title={isMain ? 'Đóng MAIN…' : 'Đóng window'}
      onClick={(e) => {
        e.stopPropagation()
        if (isMain) {
          setMainDialogOpen(true)
        } else {
          closeWindow(win.id)
        }
      }}
      className="flex h-5 w-5 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-rose-500/85 hover:text-white"
      aria-label="Close window"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className={cn(
        'absolute flex flex-col overflow-hidden rounded-md bg-zinc-900 shadow-2xl ring-1 transition-shadow',
        isMain
          ? 'ring-2 ring-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.35),0_20px_40px_-12px_rgba(0,0,0,0.7)]'
          : win.isSelected
            ? 'ring-2 ring-sky-300/90 shadow-[0_0_0_2px_rgba(56,189,248,0.35),0_20px_40px_-12px_rgba(0,0,0,0.7)]'
            : 'ring-white/10 hover:ring-white/25',
        isExcluded && 'opacity-90',
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
      aria-label={`Window ${win.fileName}${isMain ? ' (MAIN)' : win.isSelected ? ' (selected)' : ''}${isExcluded ? ' (excluded)' : ''}`}
    >
      {/* Title bar — drag handle */}
      <div
        className={cn(
          'flex h-8 shrink-0 items-center gap-1.5 bg-black px-2 text-white',
          'cursor-grab active:cursor-grabbing select-none',
          isMain ? 'bg-gradient-to-r from-amber-950/70 via-black to-black' : '',
        )}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onTitleDoubleClick}
      >
        {/* status dot */}
        <span
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            isMain
              ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]'
              : win.isSelected
                ? 'bg-sky-400'
                : 'bg-white/30',
          )}
        />

        {/* MAIN badge */}
        {isMain && (
          <span className="flex shrink-0 items-center gap-0.5 rounded bg-amber-400/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/40">
            <Crown className="h-2.5 w-2.5" />
            MAIN
          </span>
        )}

        {/* EXCLUDED pill (§5) — on title bar so it stays visible when cascaded */}
        {isExcluded && (
          <span className="flex shrink-0 items-center gap-0.5 rounded bg-rose-500/20 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-rose-300 ring-1 ring-rose-500/40">
            <Ban className="h-2.5 w-2.5" />
            EXCLUDED
          </span>
        )}

        <span className="flex-1 truncate text-xs font-medium text-white/90">
          {win.fileName}
        </span>

        {/* `_` — batch participation toggle (§5) */}
        <button
          type="button"
          data-window-control
          title={
            isMain
              ? 'MAIN luôn trong batch'
              : win.isBatchEnabled
                ? 'Loại trừ khỏi batch (EXCLUDED)'
                : 'Bật lại batch (ACTIVE)'
          }
          disabled={isMain}
          onClick={(e) => {
            e.stopPropagation()
            toggleBatchEnabled(win.id)
          }}
          aria-pressed={win.isBatchEnabled}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-sm transition-colors',
            isMain
              ? 'cursor-not-allowed text-white/25'
              : win.isBatchEnabled
                ? 'text-emerald-300/90 hover:bg-emerald-500/20 hover:text-emerald-200'
                : 'text-rose-300/90 hover:bg-rose-500/20 hover:text-rose-200',
          )}
          aria-label={
            isMain
              ? 'MAIN cannot be excluded'
              : win.isBatchEnabled
                ? 'Exclude from batch'
                : 'Re-include in batch'
          }
        >
          {isMain ? (
            <Minus className="h-3.5 w-3.5" />
          ) : win.isBatchEnabled ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Ban className="h-3.5 w-3.5" />
          )}
        </button>

        {/* `X` — close (with MAIN confirm) */}
        {isMain ? (
          <AlertDialog open={mainDialogOpen} onOpenChange={setMainDialogOpen}>
            <AlertDialogTrigger asChild>
              <span
                data-window-control
                className="flex h-5 w-5 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-rose-500/85 hover:text-white"
                aria-label="Close MAIN window"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Đóng MAIN?</AlertDialogTitle>
                <AlertDialogDescription>
                  Window <span className="font-semibold text-foreground">{win.fileName}</span>{' '}
                  đang là MAIN. Đóng nó sẽ gỡ MAIN khỏi batch workspace. Một
                  window khác sẽ tự được chọn làm MAIN nếu còn window.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => closeWindow(win.id)}
                  className="bg-rose-600 text-white hover:bg-rose-600/90"
                >
                  Đóng MAIN
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          closeBtn
        )}
      </div>

      {/* Image content — object-contain so aspect ratio is never distorted (§4) */}
      <div className="relative flex-1 overflow-hidden bg-[repeating-conic-gradient(#1f1f23_0%_25%,#26262b_0%_50%)] bg-[length:16px_16px]">
        <img
          src={win.imageUrl}
          alt={win.fileName}
          draggable={false}
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full object-contain transition-[filter,opacity]',
            isExcluded && 'grayscale brightness-[0.55] opacity-60',
          )}
        />

        {/* EXCLUDED ribbon (spec §5: visibly indicate excluded state) */}
        {isExcluded && (
          <div className="pointer-events-none absolute right-0 top-0 rotate-0">
            <div className="rounded-bl-md rounded-tr-md bg-rose-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              EXCLUDED
            </div>
          </div>
        )}

        {/* ACTIVE tag for batch-enabled non-MAIN windows (subtle) */}
        {!isMain && win.isBatchEnabled && (
          <div className="pointer-events-none absolute bottom-1 left-1 rounded bg-emerald-500/85 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
            in batch
          </div>
        )}

        {/* dimension badge */}
        <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
          {win.naturalWidth}×{win.naturalHeight}
        </div>
      </div>

      {/* Footer hint bar — only on MAIN, to surface the double-click affordance elsewhere */}
      {isMain && (
        <div className="shrink-0 bg-amber-400/10 px-2 py-0.5 text-center text-[10px] font-medium text-amber-200/90">
          nguồn batch · nhấp đúp title bar 1 window khác để đổi MAIN
        </div>
      )}
    </motion.div>
  )
}
