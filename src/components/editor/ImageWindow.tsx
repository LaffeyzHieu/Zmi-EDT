'use client'

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Minus,
  Crown,
  Ban,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3x3,
  Hand,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'
import {
  computeViewport,
  computeLayerPlacement,
  shouldShowGrid,
  wheelToZoomFactor,
  formatZoom,
  type Viewport,
} from '@/lib/canvas-viewport'
import { measureText } from '@/lib/text-measure'
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
  workspaceRef: React.RefObject<HTMLDivElement | null>
}

type DragKind = 'move' | 'pan' | 'resize-se' | null

interface DragState {
  kind: DragKind
  startX: number
  startY: number
  // move
  origX?: number
  origY?: number
  wsW?: number
  wsH?: number
  w?: number
  h?: number
  // pan
  origPanX?: number
  origPanY?: number
  // resize
  origW?: number
  origH?: number
}

/**
 * A floating, draggable image window.
 *
 * M3 (Canvas/View) additions:
 *   • Per-window zoom/pan/fit/100 controls (spec §20). Wheel = zoom anchored at
 *     cursor; Space+drag (or drag in `view` tool) = pan.
 *   • Floating viewport toolbar: fit / 100 / +/- / zoom% / grid toggle.
 *   • Pixel grid auto-renders when very zoomed in (spec §21).
 *   • SE resize handle (bonus polish).
 *   • `view` tool cursor = Hand; `move` tool cursor = grab on title bar.
 *
 * Zoom/pan/grid are UI state (spec §28) — they do NOT create history (no
 * history system exists yet in M3).
 */
export function ImageWindow({ id, workspaceRef }: ImageWindowProps) {
  const win = useEditorStore((s) => s.windows.find((w) => w.id === id))
  const mainId = useEditorStore((s) => s.mainId)
  const tool = useEditorStore((s) => s.tool)
  const closeWindow = useEditorStore((s) => s.closeWindow)
  const selectWindow = useEditorStore((s) => s.selectWindow)
  const moveWindow = useEditorStore((s) => s.moveWindow)
  const setMain = useEditorStore((s) => s.setMain)
  const toggleBatchEnabled = useEditorStore((s) => s.toggleBatchEnabled)
  const setWindowZoom = useEditorStore((s) => s.setWindowZoom)
  const panWindowBy = useEditorStore((s) => s.panWindowBy)
  const fitWindow = useEditorStore((s) => s.fitWindow)
  const resetWindowZoom100 = useEditorStore((s) => s.resetWindowZoom100)
  const zoomWindowBy = useEditorStore((s) => s.zoomWindowBy)
  const toggleWindowGrid = useEditorStore((s) => s.toggleWindowGrid)
  const resizeWindow = useEditorStore((s) => s.resizeWindow)
  const dropImageIntoWindow = useEditorStore((s) => s.dropImageIntoWindow)
  const beginStroke = useEditorStore((s) => s.beginStroke)
  const extendStroke = useEditorStore((s) => s.extendStroke)
  const setCropRect = useEditorStore((s) => s.setCropRect)

  const isMain = mainId === id
  const isExcluded = win ? !win.isBatchEnabled && !isMain : false
  const isViewTool = tool === 'view'
  const isDrawTool = tool === 'draw'
  const isCropTool = tool === 'crop'

  const [mainDialogOpen, setMainDialogOpen] = useState(false)
  const [bodySize, setBodySize] = useState({ w: 0, h: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [dropHover, setDropHover] = useState(false)
  // In-progress stroke id (for drawing); kept in a ref to avoid re-renders.
  const activeStrokeRef = useRef<string | null>(null)

  const bodyRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<DragState | null>(null)
  // Crop drag: tracks the start document-coord point so we can compute the rect.
  const cropDragRef = useRef<{ startX: number; startY: number } | null>(null)

  // Track Space key for pan mode (global), but only act on the selected window.
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const t = e.target as HTMLElement | null
        if (
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.tagName === 'SELECT' ||
            t.isContentEditable)
        )
          return
        setSpaceHeld(true)
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // Observe body size so the fit viewport recomputes on resize.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const update = () =>
      setBodySize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---- title bar drag (move window) ----
  const onTitlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !win) return
      const target = e.target as HTMLElement
      if (target.closest('[data-window-control]')) return
      const ws = workspaceRef.current
      if (!ws) return
      e.preventDefault()
      const rect = ws.getBoundingClientRect()
      dragState.current = {
        kind: 'move',
        startX: e.clientX,
        startY: e.clientY,
        origX: win.x,
        origY: win.y,
        wsW: rect.width,
        wsH: rect.height,
        w: win.width,
        h: win.height,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      selectWindow(id)
    },
    [win, workspaceRef, selectWindow, id],
  )

  const onTitlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = dragState.current
      if (!st || st.kind !== 'move') return
      const dx = e.clientX - st.startX
      const dy = e.clientY - st.startY
      const minX = -(st.w ?? 0) + 96
      const maxX = (st.wsW ?? 0) - 96
      const minY = 0
      const maxY = (st.wsH ?? 0) - 36
      const nx = Math.min(maxX, Math.max(minX, (st.origX ?? 0) + dx))
      const ny = Math.min(maxY, Math.max(minY, (st.origY ?? 0) + dy))
      moveWindow(id, nx, ny)
    },
    [moveWindow, id],
  )

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState.current) dragState.current = null
    // End any in-progress draw stroke.
    if (activeStrokeRef.current) activeStrokeRef.current = null
    // End any in-progress crop drag (the rect stays until Apply/Cancel).
    if (cropDragRef.current) cropDragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }, [])

  const onTitleDoubleClick = useCallback(() => {
    if (!win || isMain) return
    setMain(id)
  }, [win, isMain, setMain, id])

  // ---- body pan ----
  const onBodyPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!win) return
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('[data-window-control]')) return

      // DRAW tool: begin a stroke on the selected layer (spec §13). Local only.
      if (isDrawTool && win.selectedLayerId && bodyRef.current) {
        e.preventDefault()
        if (!win.isSelected) selectWindow(id)
        const rect = bodyRef.current.getBoundingClientRect()
        const vp = computeViewport(win, rect.width, rect.height)
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        // Convert screen px → document px by dividing by vp.scale and
        // subtracting the layer's transform offset.
        const layer = win.layers.find((l) => l.id === win.selectedLayerId)
        if (!layer) return
        const docX = (px - vp.offsetX) / vp.scale - layer.transform.x
        const docY = (py - vp.offsetY) / vp.scale - layer.transform.y
        const strokeId = beginStroke(win.id, layer.id, { x: docX, y: docY })
        activeStrokeRef.current = strokeId
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }

      // CROP tool: begin a crop rect drag (spec §16). Document coords.
      if (isCropTool && bodyRef.current) {
        e.preventDefault()
        if (!win.isSelected) selectWindow(id)
        const rect = bodyRef.current.getBoundingClientRect()
        const vp = computeViewport(win, rect.width, rect.height)
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        const docX = (px - vp.offsetX) / vp.scale
        const docY = (py - vp.offsetY) / vp.scale
        cropDragRef.current = { startX: docX, startY: docY }
        setCropRect(win.id, { x: docX, y: docY, w: 0, h: 0 })
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }

      // Pan when: view tool active, OR space held (and not in fit mode — fit
      // ignores pan). In move tool without space, a body click just selects.
      const wantPan = isViewTool || (spaceHeld && !win.fitMode)
      if (!wantPan) {
        if (!win.isSelected) selectWindow(id)
        return
      }
      if (win.fitMode) {
        // exit fit so pan/zoom has effect
        resetWindowZoom100(id)
      }
      e.preventDefault()
      dragState.current = {
        kind: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origPanX: win.panX,
        origPanY: win.panY,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      if (!win.isSelected) selectWindow(id)
    },
    [win, isViewTool, isDrawTool, isCropTool, spaceHeld, selectWindow, id, resetWindowZoom100, beginStroke, setCropRect],
  )

  const onBodyPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // CROP: update the crop rect as the user drags.
      if (isCropTool && cropDragRef.current && win && bodyRef.current) {
        const rect = bodyRef.current.getBoundingClientRect()
        const vp = computeViewport(win, rect.width, rect.height)
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        const docX = (px - vp.offsetX) / vp.scale
        const docY = (py - vp.offsetY) / vp.scale
        const x = Math.min(cropDragRef.current.startX, docX)
        const y = Math.min(cropDragRef.current.startY, docY)
        const w = Math.abs(docX - cropDragRef.current.startX)
        const h = Math.abs(docY - cropDragRef.current.startY)
        setCropRect(win.id, { x, y, w, h })
        return
      }
      // DRAW: extend the active stroke if one is in progress.
      if (
        isDrawTool &&
        activeStrokeRef.current &&
        win &&
        win.selectedLayerId &&
        bodyRef.current
      ) {
        const rect = bodyRef.current.getBoundingClientRect()
        const vp = computeViewport(win, rect.width, rect.height)
        const px = e.clientX - rect.left
        const py = e.clientY - rect.top
        const layer = win.layers.find((l) => l.id === win.selectedLayerId)
        if (layer) {
          const docX = (px - vp.offsetX) / vp.scale - layer.transform.x
          const docY = (py - vp.offsetY) / vp.scale - layer.transform.y
          extendStroke(win.id, layer.id, activeStrokeRef.current, { x: docX, y: docY })
        }
        return
      }
      const st = dragState.current
      if (!st || st.kind !== 'pan') return
      const dx = e.clientX - st.startX
      const dy = e.clientY - st.startY
      // Target absolute pan = orig + delta. panWindowBy ADDS to current, so
      // pass (target - current).
      const targetX = (st.origPanX ?? 0) + dx
      const targetY = (st.origPanY ?? 0) + dy
      panWindowBy(id, targetX - win!.panX, targetY - win!.panY)
      // Update the start baseline so subsequent moves are incremental & stable
      // even if React hasn't flushed yet (panWindowBy is synchronous set).
      st.startX = e.clientX
      st.startY = e.clientY
      st.origPanX = targetX
      st.origPanY = targetY
    },
    [panWindowBy, id, win, isDrawTool, isCropTool, extendStroke, setCropRect],
  )

  // ---- wheel zoom (anchored at cursor) ----
  const onBodyWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (!win || !bodyRef.current) return
      // Always handle zoom over a window body — don't let the page scroll.
      e.preventDefault()
      const factor = wheelToZoomFactor(e.deltaY)
      const rect = bodyRef.current.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const vp = computeViewport(win, rect.width, rect.height)
      const curScale = win.fitMode ? vp.scale : win.zoom
      const newScale = Math.min(32, Math.max(0.05, curScale * factor))
      if (Math.abs(newScale - curScale) < 1e-4) return

      // Anchor: keep the image point under the cursor stationary.
      // imageX = (px - vp.offsetX) / vp.scale ; after zoom we want
      // px = newOffsetX + imageX * newScale  => newOffsetX = px - imageX*newScale
      const imageX = (px - vp.offsetX) / vp.scale
      const imageY = (py - vp.offsetY) / vp.scale
      const newOffsetX = px - imageX * newScale
      const newOffsetY = py - imageY * newScale
      const baseOffsetX = (rect.width - win.naturalWidth * newScale) / 2
      const baseOffsetY = (rect.height - win.naturalHeight * newScale) / 2
      setWindowZoom(id, newScale)
      // Apply the pan delta needed to keep the cursor anchor — do it on next tick
      // because setWindowZoom resets panX/panY only when entering from fit? No,
      // setWindowZoom keeps panX/panY. So set panX/panY to match the anchor.
      // We must compute relative to current panX/panY which were preserved.
      // Use requestAnimationFrame-free direct store mutation via panWindowBy:
      // Actually simpler: setWindowZoom keeps pan; we then adjust pan by the
      // difference between desired offset and the offset that the new zoom
      // would produce given the OLD pan.
      const oldPanX = win.panX
      const oldPanY = win.panY
      // offset with old pan at new scale:
      const offsetWithOldPanX = baseOffsetX + oldPanX
      const offsetWithOldPanY = baseOffsetY + oldPanY
      panWindowBy(id, newOffsetX - offsetWithOldPanX, newOffsetY - offsetWithOldPanY)
    },
    [win, setWindowZoom, panWindowBy, id],
  )

  // ---- SE resize ----
  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!win || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      dragState.current = {
        kind: 'resize-se',
        startX: e.clientX,
        startY: e.clientY,
        origW: win.width,
        origH: win.height,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      selectWindow(id)
    },
    [win, selectWindow, id],
  )

  const onResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = dragState.current
      if (!st || st.kind !== 'resize-se' || !win) return
      const dx = e.clientX - st.startX
      const dy = e.clientY - st.startY
      // Clamp so the window can grow up to natural size (or 2x natural for zoomed-in).
      const maxW = Math.max(win.naturalWidth, win.width) * 1.5 + 80
      const maxH = Math.max(win.naturalHeight, win.height) * 1.5 + 80
      const nw = Math.min(maxW, Math.max(160, (st.origW ?? 0) + dx))
      const nh = Math.min(maxH, Math.max(120, (st.origH ?? 0) + dy))
      resizeWindow(id, nw, nh)
    },
    [resizeWindow, id, win],
  )

  const onWindowPointerDown = useCallback(() => {
    if (!win?.isSelected) selectWindow(id)
  }, [win, selectWindow, id])

  if (!win) return null

  const viewport =
    bodySize.w > 0
      ? computeViewport(win, bodySize.w, bodySize.h)
      : null
  const gridOn = viewport ? shouldShowGrid(win, viewport) : false
  const cursor = isCropTool
    ? 'crosshair'
    : isDrawTool
      ? 'crosshair'
      : isViewTool
        ? 'grab'
        : spaceHeld
          ? 'grab'
          : 'default'

  const closeBtn = (
    <button
      type="button"
      data-window-control
      title={isMain ? 'Đóng MAIN…' : 'Đóng window'}
      onClick={(e) => {
        e.stopPropagation()
        if (isMain) setMainDialogOpen(true)
        else closeWindow(win.id)
      }}
      className="flex h-5 w-5 items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-rose-500/85 hover:text-white"
      aria-label="Close window"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )

  // Pixel grid: draw 1px-per-image-pixel lines (auto-shown when very zoomed in).
  const gridStep = 1
  const gridVisible = !!viewport && gridOn && viewport.scale >= 2
  const gridBg = gridVisible && viewport
    ? {
        backgroundImage:
          'linear-gradient(to right, rgba(125,211,252,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(125,211,252,0.18) 1px, transparent 1px)',
        backgroundSize: `${viewport.scale * gridStep}px ${viewport.scale * gridStep}px`,
        backgroundPosition: `${viewport.offsetX}px ${viewport.offsetY}px`,
      }
    : undefined

  const zoomLabel = viewport ? formatZoom(viewport.scale) : '—'

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
      }}
      onPointerDown={onWindowPointerDown}
      role="button"
      tabIndex={0}
      aria-label={`Window ${win.fileName}${isMain ? ' (MAIN)' : win.isSelected ? ' (selected)' : ''}${isExcluded ? ' (excluded)' : ''}`}
    >
      {/* Title bar — drag handle (move tool only) */}
      <div
        className={cn(
          'flex h-8 shrink-0 items-center gap-1.5 bg-black px-2 text-white select-none',
          isViewTool ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
          isMain ? 'bg-gradient-to-r from-amber-950/70 via-black to-black' : '',
        )}
        onPointerDown={isViewTool ? undefined : onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onTitleDoubleClick}
      >
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

        {isMain && (
          <span className="flex shrink-0 items-center gap-0.5 rounded bg-amber-400/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/40">
            <Crown className="h-2.5 w-2.5" />
            MAIN
          </span>
        )}

        {isExcluded && (
          <span className="flex shrink-0 items-center gap-0.5 rounded bg-rose-500/20 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-rose-300 ring-1 ring-rose-500/40">
            <Ban className="h-2.5 w-2.5" />
            EXCLUDED
          </span>
        )}

        {isViewTool && (
          <span className="flex shrink-0 items-center gap-0.5 rounded bg-sky-400/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-sky-300 ring-1 ring-sky-400/40">
            <Hand className="h-2.5 w-2.5" />
            XEM
          </span>
        )}

        <span className="flex-1 truncate text-xs font-medium text-white/90">
          {win.fileName}
        </span>

        {/* `_` — batch toggle */}
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

        {isMain ? (
          <AlertDialog open={mainDialogOpen} onOpenChange={setMainDialogOpen}>
            <AlertDialogTrigger asChild>
              <span
                data-window-control
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-sm text-white/70 transition-colors hover:bg-rose-500/85 hover:text-white"
                aria-label="Close MAIN window"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Đóng MAIN?</AlertDialogTitle>
                <AlertDialogDescription>
                  Window{' '}
                  <span className="font-semibold text-foreground">
                    {win.fileName}
                  </span>{' '}
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

      {/* Image body — viewport for zoom/pan/grid (spec §9, §20, §21).
          Also a drop target: dropping an image here adds it as a layer (§4). */}
      <div
        ref={bodyRef}
        className={cn(
          'relative flex-1 overflow-hidden bg-[repeating-conic-gradient(#1f1f23_0%_25%,#26262b_0%_50%)] bg-[length:16px_16px] transition-[box-shadow]',
          dropHover && 'ring-2 ring-inset ring-sky-400/80',
        )}
        style={{ cursor }}
        onPointerDown={onBodyPointerDown}
        onPointerMove={onBodyPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onBodyWheel}
        onDragOver={(e) => {
          // Allow drop only when the dragged thing carries files.
          if (e.dataTransfer?.types?.includes('Files')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            if (!dropHover) setDropHover(true)
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDropHover(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation() // don't bubble to workspace (which would create a window)
          setDropHover(false)
          const files = e.dataTransfer?.files
          if (!files || files.length === 0) return
          // Spec §4: dropping onto an existing window adds a layer, NOT a window.
          // Process files sequentially; each becomes its own image layer.
          void (async () => {
            for (const f of Array.from(files)) {
              await dropImageIntoWindow(win.id, f)
            }
          })()
        }}
      >
        {/* checkerboard transparency grid for the image area only */}
        {viewport && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: viewport.offsetX,
              top: viewport.offsetY,
              width: viewport.displayW,
              height: viewport.displayH,
              backgroundImage:
                'repeating-conic-gradient(#2a2a30_0%_25%,#1f1f25_0%_50%)',
              backgroundSize: '12px 12px',
            }}
          />
        )}

        {/* layers — placed via layer transform (spec §19). Image layers use the
            window's natural size (the source image); text layers render a
            sized <div> with the layer's text content (M5 preview, full text
            editing in M7). */}
        {viewport &&
          win.layers.map((layer) => {
            if (!layer.visible) return null
            const isSelectedLayer =
              win.isSelected && layer.id === win.selectedLayerId

            if (layer.type === 'text' && layer.text) {
              // Text layer: measure content via canvas 2D for accurate width
              // (spec §18 proper text sizing). Height = fontSize × 1.4 × lines.
              const t = layer.text
              const m = measureText(t)
              const place = computeLayerPlacement(
                m.width,
                m.height,
                layer.transform,
                viewport,
              )
              const sx = place.flipX ? -1 : 1
              const sy = place.flipY ? -1 : 1
              return (
                <div
                  key={layer.id}
                  className="pointer-events-none absolute"
                  style={{
                    left: place.left,
                    top: place.top,
                    width: place.width,
                    height: place.height,
                    transform: `rotate(${place.rotation}deg) scale(${sx}, ${sy})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <div
                    className="absolute inset-0 flex items-start justify-start whitespace-pre-wrap break-words"
                    style={{
                      fontFamily: t.fontFamily,
                      fontSize: `${t.fontSize * viewport.scale * layer.transform.scale}px`,
                      color: t.color,
                      fontWeight: t.bold ? 700 : 400,
                      fontStyle: t.italic ? 'italic' : 'normal',
                      lineHeight: 1.2,
                      textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                    }}
                  >
                    {t.content || ' '}
                  </div>
                  {isSelectedLayer && (
                    <div
                      className="pointer-events-none absolute inset-0 border-2 border-dashed border-sky-400/80"
                      style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }}
                      aria-hidden
                    />
                  )}
                </div>
              )
            }

            // Image layer
            const place = computeLayerPlacement(
              win.naturalWidth,
              win.naturalHeight,
              layer.transform,
              viewport,
            )
            const sx = place.flipX ? -1 : 1
            const sy = place.flipY ? -1 : 1
            const strokes = layer.strokes ?? []
            return (
              <div
                key={layer.id}
                className="pointer-events-none absolute"
                style={{
                  left: place.left,
                  top: place.top,
                  width: place.width,
                  height: place.height,
                  transform: `rotate(${place.rotation}deg) scale(${sx}, ${sy})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={win.imageUrl}
                  alt={layer.name}
                  draggable={false}
                  className={cn(
                    'absolute inset-0 h-full w-full select-none transition-[filter,opacity]',
                    isExcluded && 'grayscale brightness-[0.55] opacity-60',
                  )}
                  style={{
                    imageRendering: viewport.scale * layer.transform.scale >= 8 ? 'pixelated' : 'auto',
                  }}
                />
                {/* Brush strokes overlay (spec §13). SVG sized to the layer's
                    natural dims; stroke points are in document space. */}
                {strokes.length > 0 && (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                    viewBox={`0 0 ${win.naturalWidth} ${win.naturalHeight}`}
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    {strokes.map((s) => {
                      if (s.points.length === 0) return null
                      // Single-point stroke → render a filled circle (a dot).
                      if (s.points.length === 1) {
                        const p = s.points[0]
                        return (
                          <circle
                            key={s.id}
                            cx={p.x}
                            cy={p.y}
                            r={s.size}
                            fill={s.color}
                            opacity={0.95}
                          />
                        )
                      }
                      const d = s.points
                        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
                        .join(' ')
                      return (
                        <path
                          key={s.id}
                          d={d}
                          stroke={s.color}
                          strokeWidth={s.size * 2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          opacity={0.95}
                        />
                      )
                    })}
                  </svg>
                )}
                {isSelectedLayer && (
                  <div
                    className="pointer-events-none absolute inset-0 border-2 border-dashed border-sky-400/80"
                    style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }}
                    aria-hidden
                  />
                )}
              </div>
            )
          })}

        {/* pixel grid overlay (spec §21) */}
        {gridVisible && (
          <div
            className="pointer-events-none absolute inset-0"
            style={gridBg}
            aria-hidden
          />
        )}

        {/* M8 crop overlay (spec §16) — dim outside the rect, bright border inside. */}
        {viewport && win.cropRect && win.cropRect.w > 0 && win.cropRect.h > 0 && (
          <CropOverlay
            cropRect={win.cropRect}
            vp={viewport}
            docW={win.naturalWidth}
            docH={win.naturalHeight}
          />
        )}

        {/* EXCLUDED corner ribbon */}
        {isExcluded && (
          <div className="pointer-events-none absolute right-0 top-0">
            <div className="rounded-bl-md rounded-tr-md bg-rose-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              EXCLUDED
            </div>
          </div>
        )}

        {/* ACTIVE tag */}
        {!isMain && win.isBatchEnabled && (
          <div className="pointer-events-none absolute bottom-1 left-1 rounded bg-emerald-500/85 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
            in batch
          </div>
        )}

        {/* dimension badge */}
        <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
          {win.naturalWidth}×{win.naturalHeight}
        </div>

        {/* Viewport toolbar (spec §11: fit / 100 / zoom in-out) — bottom-center */}
        <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-white/10 bg-black/70 p-0.5 backdrop-blur-sm">
          <button
            type="button"
            data-window-control
            title="Vừa khung (fit)"
            onClick={(e) => {
              e.stopPropagation()
              fitWindow(id)
            }}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded text-white/75 transition-colors hover:bg-white/15 hover:text-white',
              win.fitMode && 'bg-sky-500/30 text-sky-200',
            )}
            aria-label="Fit to window"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-window-control
            title="Thu nhỏ"
            onClick={(e) => {
              e.stopPropagation()
              zoomWindowBy(id, 1 / 1.25)
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-white/75 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-[44px] select-none px-1 text-center text-[11px] font-semibold tabular-nums text-white/90">
            {zoomLabel}
          </div>
          <button
            type="button"
            data-window-control
            title="Phóng to"
            onClick={(e) => {
              e.stopPropagation()
              zoomWindowBy(id, 1.25)
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-white/75 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-window-control
            title="100%"
            onClick={(e) => {
              e.stopPropagation()
              resetWindowZoom100(id)
            }}
            className={cn(
              'flex h-6 items-center justify-center rounded px-1.5 text-[10px] font-semibold text-white/75 transition-colors hover:bg-white/15 hover:text-white',
              !win.fitMode && Math.abs(win.zoom - 1) < 1e-3 && 'bg-sky-500/30 text-sky-200',
            )}
            aria-label="Reset to 100%"
          >
            1:1
          </button>
          <button
            type="button"
            data-window-control
            title={win.showGrid ? 'Tắt lưới pixel' : 'Bật lưới pixel'}
            onClick={(e) => {
              e.stopPropagation()
              toggleWindowGrid(id)
            }}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded text-white/75 transition-colors hover:bg-white/15 hover:text-white',
              win.showGrid && 'bg-sky-500/30 text-sky-200',
            )}
            aria-label="Toggle pixel grid"
            aria-pressed={win.showGrid}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* SE resize handle (bonus polish) */}
        <div
          data-window-control
          className="absolute bottom-0 right-0 z-10 flex h-4 w-4 cursor-nwse-resize items-end justify-end"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Kéo để đổi kích thước window"
          aria-label="Resize window"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-white/45">
            <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {/* MAIN footer hint */}
      {isMain && (
        <div className="shrink-0 bg-amber-400/10 px-2 py-0.5 text-center text-[10px] font-medium text-amber-200/90">
          nguồn batch · nhấp đúp title bar 1 window khác để đổi MAIN
        </div>
      )}
    </motion.div>
  )
}

/** CropOverlay — dims the area outside the crop rect + draws a bright border. */
function CropOverlay({
  cropRect,
  vp,
  docW,
  docH,
}: {
  cropRect: { x: number; y: number; w: number; h: number }
  vp: Viewport
  docW: number
  docH: number
}) {
  // Screen-space rect of the crop region.
  const sx = vp.offsetX + cropRect.x * vp.scale
  const sy = vp.offsetY + cropRect.y * vp.scale
  const sw = cropRect.w * vp.scale
  const sh = cropRect.h * vp.scale
  // Document bounds on screen (for the dim mask).
  const dx = vp.offsetX
  const dy = vp.offsetY
  const dw = docW * vp.scale
  const dh = docH * vp.scale
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {/* Dim mask via 4 rectangles around the crop region (within doc bounds). */}
      {/* top */}
      <div className="absolute bg-black/55" style={{ left: dx, top: dy, width: dw, height: Math.max(0, sy - dy) }} />
      {/* bottom */}
      <div className="absolute bg-black/55" style={{ left: dx, top: sy + sh, width: dw, height: Math.max(0, dy + dh - (sy + sh)) }} />
      {/* left */}
      <div className="absolute bg-black/55" style={{ left: dx, top: sy, width: Math.max(0, sx - dx), height: sh }} />
      {/* right */}
      <div className="absolute bg-black/55" style={{ left: sx + sw, top: sy, width: Math.max(0, dx + dw - (sx + sw)), height: sh }} />
      {/* bright border */}
      <div
        className="absolute border-2 border-emerald-400 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
        style={{ left: sx, top: sy, width: sw, height: sh }}
      >
        {/* rule-of-thirds guides */}
        <div className="absolute inset-0">
          <div className="absolute left-1/3 top-0 h-full w-px bg-emerald-300/30" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-emerald-300/30" />
          <div className="absolute top-1/3 left-0 h-px w-full bg-emerald-300/30" />
          <div className="absolute top-2/3 left-0 h-px w-full bg-emerald-300/30" />
        </div>
        {/* corner handles */}
        {[
          { left: -3, top: -3 },
          { right: -3, top: -3 },
          { left: -3, bottom: -3 },
          { right: -3, bottom: -3 },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute h-2 w-2 rounded-sm bg-emerald-400 ring-1 ring-black/40"
            style={pos}
          />
        ))}
      </div>
    </div>
  )
}
