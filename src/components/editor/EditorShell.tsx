'use client'

import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Workspace } from './Workspace'
import { StatusBar } from './StatusBar'
import { useEditorStore } from '@/store/editor-store'

/**
 * EditorShell — top-level layout: black sidebar + workspace + status bar.
 * The status bar sits at the bottom (sticky-footer rule) and the workspace
 * fills all remaining space.
 *
 * M2 shortcuts (spec §34): M (set MAIN), B (toggle batch), Esc (deselect).
 * M3: V (Xem), D (Di chuyển), 0 (fit), 1 (100%), +/= (zoom in), -/_ (zoom out), G (grid).
 * M4: E (Sửa/Biến đổi tool), F (flip X selected layer), R (rotate selected +15°).
 * M5: L (toggle Layers panel via a custom window event the Sidebar listens to).
 * All ignore focus inside input/textarea/select/contenteditable and modifier-held combos.
 */
export function EditorShell() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t) {
        const tag = t.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          t.isContentEditable
        ) {
          return
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const s = useEditorStore.getState()
      const k = e.key.toLowerCase()
      const sel = s.selectedWindowId

      if (k === 'm') {
        if (sel && sel !== s.mainId) s.setMain(sel)
      } else if (k === 'b') {
        if (sel && sel !== s.mainId) s.toggleBatchEnabled(sel)
      } else if (k === 'v') {
        s.setTool('view')
      } else if (k === 'd') {
        s.setTool('move')
      } else if (k === 'e') {
        s.setTool('transform')
      } else if (k === 'l') {
        // Toggle the Layers panel via a window event the Sidebar subscribes to.
        window.dispatchEvent(new CustomEvent('zmi:toggle-layers'))
      } else if (k === '0') {
        if (sel) s.fitWindow(sel)
      } else if (k === '1') {
        if (sel) s.resetWindowZoom100(sel)
      } else if (k === '+' || k === '=') {
        if (sel) s.zoomWindowBy(sel, 1.25)
      } else if (k === '-' || k === '_') {
        if (sel) s.zoomWindowBy(sel, 1 / 1.25)
      } else if (k === 'g') {
        if (sel) s.toggleWindowGrid(sel)
      } else if (k === 'f') {
        s.flipSelectedLayer('x')
      } else if (k === 'r') {
        const w = s.windows.find((x) => x.id === sel)
        if (w && w.selectedLayerId) {
          const layer = w.layers.find((l) => l.id === w.selectedLayerId)
          if (layer) {
            let r = (layer.transform.rotation + 15) % 360
            if (r > 180) r -= 360
            s.setLayerTransform(sel, layer.id, { rotation: r })
          }
        }
      } else if (e.key === 'Escape') {
        if (s.selectedWindowId) s.selectWindow(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1">
          <Workspace />
        </main>
        <StatusBar />
      </div>
    </div>
  )
}
