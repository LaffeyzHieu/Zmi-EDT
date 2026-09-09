'use client'

import { useCallback, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  MoveHorizontal,
  MoveVertical,
  Maximize,
  RotateCw,
  FlipHorizontal2,
  FlipVertical2,
  Layers as LayersIcon,
  Sparkles,
  X,
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

/**
 * TransformPanel — the `Biến đổi` tool panel (spec §19).
 *
 * Shows numeric inputs for the selected layer's transform (X/Y/W/H/Scale/
 * Rotation/Flip). Edits are LOCAL by default (only the selected window's
 * layer). The "Áp dụng batch" button broadcasts the *delta* of the change
 * from MAIN's current transform to all batch-enabled windows (spec §7 batch
 * rule), with a confirmation dialog when more than one window is affected.
 *
 * Width/Height are derived from natural × scale (read-only display) — the
 * authoritative numeric is Scale, since the implicit image layer's pixel
 * size equals the source natural size.
 */
interface NumFieldProps {
  icon: React.ReactNode
  label: string
  value: number
  step?: number
  min?: number
  max?: number
  suffix?: string
  onChange: (v: number) => void
  decimals?: number
}

function NumField({
  icon,
  label,
  value,
  step = 1,
  min,
  max,
  suffix,
  onChange,
  decimals = 0,
}: NumFieldProps) {
  return (
    <label className="flex flex-1 items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1 text-white/85 focus-within:bg-white/[0.08]">
      <span className="flex h-4 w-4 items-center justify-center text-white/50">
        {icon}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-white/45">
        {label}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          onChange(Number.isFinite(v) ? v : 0)
        }}
        className="w-full min-w-0 flex-1 bg-transparent text-right text-[12px] font-semibold tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label={label}
      />
      {suffix && <span className="text-[10px] text-white/40">{suffix}</span>}
    </label>
  )
}

export function TransformPanel() {
  // Select only the primitive fields the panel needs, with useShallow so the
  // component doesn't re-render every store tick (the selector returns a new
  // object each call — useShallow compares the picked fields shallowly).
  const {
    selWindowId,
    selLayerId,
    tx,
    ty,
    tscale,
    trotation,
    tflipX,
    tflipY,
    naturalW,
    naturalH,
    fileName,
  } = useEditorStore(
    useShallow((s) => {
      const w = s.windows.find((x) => x.id === s.selectedWindowId)
      const layer = w?.layers.find((l) => l.id === w.selectedLayerId) ?? null
      if (!w || !layer) {
        return {
          selWindowId: null as string | null,
          selLayerId: null as string | null,
          tx: 0,
          ty: 0,
          tscale: 1,
          trotation: 0,
          tflipX: false,
          tflipY: false,
          naturalW: 0,
          naturalH: 0,
          fileName: '',
        }
      }
      return {
        selWindowId: w.id,
        selLayerId: layer.id,
        tx: layer.transform.x,
        ty: layer.transform.y,
        tscale: layer.transform.scale,
        trotation: layer.transform.rotation,
        tflipX: layer.transform.flipX,
        tflipY: layer.transform.flipY,
        naturalW: w.naturalWidth,
        naturalH: w.naturalHeight,
        fileName: w.fileName,
      }
    }),
  )
  const patchSelectedLayerTransform = useEditorStore(
    (s) => s.patchSelectedLayerTransform,
  )
  const flipSelectedLayer = useEditorStore((s) => s.flipSelectedLayer)
  const batchTransformFromMain = useEditorStore((s) => s.batchTransformFromMain)
  const mainId = useEditorStore((s) => s.mainId)
  const batchCount = useEditorStore(
    (s) => s.windows.filter((w) => w.id !== s.mainId && w.isBatchEnabled).length,
  )

  // Reconstruct a `sel`-like object for the helpers below (keeps the rest of the
  // code from M4 readable). `sel` is null when there's no selected layer.
  const sel =
    selWindowId && selLayerId
      ? {
          windowId: selWindowId,
          layerId: selLayerId,
          fileName,
          naturalW,
          naturalH,
          transform: {
            x: tx,
            y: ty,
            scale: tscale,
            rotation: trotation,
            flipX: tflipX,
            flipY: tflipY,
          },
        }
      : null

  // Snapshot of MAIN's layer transform — captured when the user opens the
  // batch dialog — used to compute the delta to broadcast (spec §7). Stored
  // as plain state, set only in the openDialog event handler (no effect, no
  // render-time ref mutation).
  const [snapshot, setSnapshot] = useState<{
    x: number
    y: number
    scale: number
    rotation: number
    flipX: boolean
    flipY: boolean
  } | null>(null)
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)

  const openBatchDialog = useCallback(() => {
    if (!sel) return
    // Snapshot MAIN's CURRENT transform so we can show the user what will be
    // broadcast (we broadcast the ABSOLUTE transform, not a delta — see store).
    setSnapshot({ ...sel.transform })
    setBatchDialogOpen(true)
  }, [sel])

  const isMainSelected = !!sel && sel.windowId === mainId
  const canBatch = isMainSelected && batchCount > 0
  // Total windows that would be affected = MAIN + batch-enabled non-MAIN.
  const affectedCount = canBatch ? batchCount + 1 : 0

  const setX = useCallback(
    (v: number) => patchSelectedLayerTransform({ x: Math.round(v) }),
    [patchSelectedLayerTransform],
  )
  const setY = useCallback(
    (v: number) => patchSelectedLayerTransform({ y: Math.round(v) }),
    [patchSelectedLayerTransform],
  )
  const setScale = useCallback(
    (v: number) =>
      patchSelectedLayerTransform({ scale: Math.max(0.01, Math.min(100, v)) }),
    [patchSelectedLayerTransform],
  )
  const setRotation = useCallback(
    (v: number) => {
      // Normalize rotation to [-180, 180] for clean numeric display.
      let r = v % 360
      if (r > 180) r -= 360
      if (r < -180) r += 360
      patchSelectedLayerTransform({ rotation: r })
    },
    [patchSelectedLayerTransform],
  )

  const confirmBatch = useCallback(() => {
    if (!sel || !snapshot) return
    // Broadcast MAIN's CURRENT (absolute) transform to all batch-enabled
    // windows' image layer (see store: absolute, not delta). MAIN itself is
    // a no-op since it's already at this transform.
    const absolute = {
      x: sel.transform.x,
      y: sel.transform.y,
      scale: sel.transform.scale,
      rotation: sel.transform.rotation,
      flipX: sel.transform.flipX,
      flipY: sel.transform.flipY,
    }
    batchTransformFromMain('image', absolute)
    setBatchDialogOpen(false)
  }, [sel, snapshot, batchTransformFromMain])

  if (!sel) {
    return (
      <div className="mx-3 mb-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-center text-[11px] text-white/45">
        Chọn 1 window để chỉnh Biến đổi
      </div>
    )
  }

  const t = sel.transform
  const dispW = Math.round(sel.naturalW * t.scale)
  const dispH = Math.round(sel.naturalH * t.scale)

  return (
    <div className="mx-3 mb-3 rounded-md border border-white/12 bg-black/40 p-2.5 text-white">
      {/* header */}
      <div className="mb-2 flex items-center gap-1.5">
        <LayersIcon className="h-3.5 w-3.5 text-sky-300" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
          Biến đổi
        </span>
        <span className="ml-auto truncate text-[10px] text-white/45">
          {sel.fileName}
        </span>
      </div>

      {/* X / Y */}
      <div className="flex gap-1.5">
        <NumField
          icon={<MoveHorizontal className="h-3.5 w-3.5" />}
          label="X"
          value={t.x}
          step={1}
          onChange={setX}
        />
        <NumField
          icon={<MoveVertical className="h-3.5 w-3.5" />}
          label="Y"
          value={t.y}
          step={1}
          onChange={setY}
        />
      </div>

      {/* W / H (derived, read-only display) */}
      <div className="mt-1.5 flex gap-1.5">
        <NumField
          icon={<Maximize className="h-3.5 w-3.5" />}
          label="W"
          value={dispW}
          onChange={() => {}}
        />
        <NumField
          icon={<Maximize className="h-3.5 w-3.5" />}
          label="H"
          value={dispH}
          onChange={() => {}}
        />
      </div>

      {/* Scale % */}
      <div className="mt-1.5">
        <NumField
          icon={<Maximize className="h-3.5 w-3.5" />}
          label="Scale"
          value={Math.round(t.scale * 100)}
          step={1}
          min={1}
          max={10000}
          suffix="%"
          onChange={(v) => setScale(v / 100)}
        />
      </div>

      {/* Rotation */}
      <div className="mt-1.5">
        <NumField
          icon={<RotateCw className="h-3.5 w-3.5" />}
          label="Rotation"
          value={Math.round(t.rotation)}
          step={1}
          min={-180}
          max={180}
          suffix="°"
          onChange={setRotation}
        />
      </div>

      {/* Flip buttons */}
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => flipSelectedLayer('x')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
            t.flipX
              ? 'border-sky-400/60 bg-sky-400/15 text-sky-200'
              : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10',
          )}
          aria-pressed={t.flipX}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5" />
          Flip X
        </button>
        <button
          type="button"
          onClick={() => flipSelectedLayer('y')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
            t.flipY
              ? 'border-sky-400/60 bg-sky-400/15 text-sky-200'
              : 'border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10',
          )}
          aria-pressed={t.flipY}
        >
          <FlipVertical2 className="h-3.5 w-3.5" />
          Flip Y
        </button>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={() => {
          patchSelectedLayerTransform({
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            flipX: false,
            flipY: false,
          })
        }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-white/15 bg-white/[0.04] px-2 py-1.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10"
      >
        <X className="h-3.5 w-3.5" />
        Đặt lại (reset)
      </button>

      {/* Batch action */}
      <button
        type="button"
        disabled={!canBatch}
        onClick={openBatchDialog}
        className={cn(
          'mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-bold transition-colors',
          canBatch
            ? 'bg-amber-500 text-black hover:bg-amber-400'
            : 'cursor-not-allowed bg-white/[0.04] text-white/35',
        )}
        title={
          !isMainSelected
            ? 'Chỉ MAIN mới có thể phát batch (chọn MAIN)'
            : batchCount === 0
              ? 'Không có window nào trong batch (cần ≥1)'
              : `Áp dụng delta Biến đổi cho ${batchCount + 1} window (MAIN + ${batchCount})`
        }
      >
        <Sparkles className="h-3.5 w-3.5" />
        Áp dụng batch
        {canBatch && (
          <span className="ml-1 rounded bg-black/25 px-1 py-px text-[10px] font-semibold">
            {affectedCount} cửa sổ
          </span>
        )}
      </button>

      <p className="mt-2 text-center text-[10px] leading-relaxed text-white/40">
        {isMainSelected
          ? 'Chỉnh MAIN rồi bấm “Áp dụng batch” để phát tới mọi window active.'
          : 'Sửa local — không ảnh hưởng batch.'}
      </p>

      <AlertDialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Áp dụng batch?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ áp dụng Biến đổi của MAIN (<span className="font-semibold text-foreground">{sel.fileName}</span>) cho{' '}
              <span className="font-semibold text-foreground">{affectedCount}</span> cửa sổ
              (MAIN + {batchCount} đang active trong batch). Các cửa sổ EXCLUDED không bị ảnh hưởng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBatch}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              Áp dụng
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
