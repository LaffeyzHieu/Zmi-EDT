'use client'

import { useEffect } from 'react'
import { X, Sparkles, Eye } from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'

/**
 * WaifuOverlay — the `Ngắm waifu` viewing mode (spec §22).
 *
 * Hides all editor chrome (sidebar, status bar, window title bars, toolbars,
 * badges) and shows a clean full-screen preview of the MAIN window's artwork
 * (or the selected window's if no MAIN). The user can pan/inspect; no document
 * data is altered, no history entries created (spec §22).
 *
 * Exit via the X button, the W key, or Esc (wired in EditorShell).
 *
 * The overlay reads the composited document directly from the store, so any
 * edits/transforms/text/strokes present before entering are reflected. On
 * exit, the editor state (selections, MAIN, batch, edits) is exactly
 * preserved — waifuMode is a pure UI toggle.
 */
export function WaifuOverlay() {
  const waifuMode = useEditorStore((s) => s.waifuMode)
  const toggleWaifuMode = useEditorStore((s) => s.toggleWaifuMode)
  const windows = useEditorStore((s) => s.windows)
  const mainId = useEditorStore((s) => s.mainId)
  const selectedWindowId = useEditorStore((s) => s.selectedWindowId)

  // Esc also exits (redundant with EditorShell's Esc handler, but safe).
  useEffect(() => {
    if (!waifuMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'w') {
        e.preventDefault()
        toggleWaifuMode()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [waifuMode, toggleWaifuMode])

  if (!waifuMode) return null

  // Pick the window to admire: MAIN first, else selected, else first.
  const target =
    windows.find((w) => w.id === mainId) ??
    windows.find((w) => w.id === selectedWindowId) ??
    windows[0] ??
    null

  return (
    <div
      className="fixed inset-0 z-[100000] flex flex-col bg-black"
      role="dialog"
      aria-label="Ngắm waifu — chế độ xem"
    >
      {/* Subtle pastel gradient backdrop (matches the workspace aesthetic). */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-950/30 via-black to-violet-950/30"
        aria-hidden
      />

      {/* Body: the artwork, centered, max-contain. */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-8">
        {target ? (
          <div className="relative max-h-full max-w-full">
            {/* Render the composited document: image layers + text + strokes.
                For the overlay we reuse the same layer-render logic but without
                window chrome. To keep M12 simple + correct, we render the
                source image + text + strokes inline (not via renderWindowToCanvas,
                which is for export). */}
            <CompositedArtwork windowId={target.id} />
            {/* Subtle filename label bottom-center */}
            <div className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-medium text-white/40">
              {target.fileName} · {target.naturalWidth}×{target.naturalHeight}
            </div>
          </div>
        ) : (
          <div className="text-center text-white/50">
            <Sparkles className="mx-auto mb-3 h-12 w-12 text-rose-300/60" />
            <p className="text-sm">Chưa có ảnh để ngắm. Hãy nhập ảnh trước.</p>
          </div>
        )}
      </div>

      {/* Top exit button */}
      <button
        type="button"
        onClick={toggleWaifuMode}
        title="Thoát (W hoặc Esc)"
        className="fixed right-4 top-4 z-[100001] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-md transition-all hover:scale-110 hover:bg-rose-500/80 hover:text-white"
        aria-label="Thoát chế độ Ngắm waifu"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Bottom hint */}
      <div className="fixed bottom-4 left-1/2 z-[100001] -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-medium text-white/70 backdrop-blur-md">
        <Eye className="mr-1.5 inline h-3.5 w-3.5" />
        Ngắm waifu 🫠 · nhấn{' '}
        <kbd className="rounded bg-white/20 px-1 py-px text-[10px] font-bold">W</kbd>{' '}
        hoặc{' '}
        <kbd className="rounded bg-white/20 px-1 py-px text-[10px] font-bold">Esc</kbd>{' '}
        để thoát
      </div>
    </div>
  )
}

/**
 * Renders the composited artwork (image layers + text + strokes) for the
 * waifu overlay. Reuses the same coordinate math as ImageWindow but in a
 * centered, max-contain container — no window chrome, no toolbars, no badges.
 */
function CompositedArtwork({ windowId }: { windowId: string }) {
  const win = useEditorStore((s) => s.windows.find((w) => w.id === windowId))
  if (!win) return null

  // Compute a fit-scale for the overlay: contain within viewport (with padding).
  // We use a ref + ResizeObserver to get the container size.
  // For simplicity, use CSS object-contain on the source image for image layers
  // and absolutely-positioned overlays for text/strokes relative to the image box.

  return (
    <div
      className="relative"
      style={{
        // Size the container by the image's aspect ratio, max-fit the viewport.
        // We use a simple approach: max-width/height 100%, aspect-ratio from natural.
        aspectRatio: `${win.naturalWidth} / ${win.naturalHeight}`,
        width: 'min(100vw - 4rem, calc((100vh - 8rem) * ' + win.naturalWidth / win.naturalHeight + '))',
        maxWidth: '100%',
        maxHeight: 'calc(100vh - 8rem)',
      }}
    >
      {/* Render layers bottom-to-top. */}
      {win.layers.map((layer) => {
        if (!layer.visible) return null
        if (layer.type === 'image') {
          return (
            <img
              key={layer.id}
              src={win.imageUrl}
              alt={layer.name}
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
              style={{
                transform: `translate(${layer.transform.x / win.naturalWidth * 100}%, ${layer.transform.y / win.naturalHeight * 100}%) scale(${layer.transform.scale}) rotate(${layer.transform.rotation}deg) scaleX(${layer.transform.flipX ? -1 : 1}) scaleY(${layer.transform.flipY ? -1 : 1})`,
                transformOrigin: 'center',
              }}
            />
          )
        }
        if (layer.type === 'text' && layer.text) {
          const t = layer.text
          return (
            <div
              key={layer.id}
              className="absolute whitespace-pre-wrap"
              style={{
                left: `${layer.transform.x / win.naturalWidth * 100}%`,
                top: `${layer.transform.y / win.naturalHeight * 100}%`,
                fontFamily: t.fontFamily,
                fontSize: `calc(${t.fontSize / win.naturalHeight * 100}cqw)`,
                color: t.color,
                fontWeight: t.bold ? 700 : 400,
                fontStyle: t.italic ? 'italic' : 'normal',
                lineHeight: 1.2,
                textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                containerType: 'inline-size',
              } as React.CSSProperties}
            >
              {t.content}
            </div>
          )
        }
        return null
      })}

      {/* Strokes overlay (SVG, document coords) */}
      {win.layers.some((l) => (l.strokes ?? []).length > 0) && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${win.naturalWidth} ${win.naturalHeight}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {win.layers.flatMap((layer) =>
            (layer.strokes ?? []).map((s) => {
              if (s.points.length === 0) return null
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
            }),
          )}
        </svg>
      )}
    </div>
  )
}
