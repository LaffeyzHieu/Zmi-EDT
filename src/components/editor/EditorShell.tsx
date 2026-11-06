'use client'

import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Workspace } from './Workspace'
import { StatusBar } from './StatusBar'
import { WaifuOverlay } from './WaifuOverlay'
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
 * M6: P (Vẽ tool), [ (brush smaller), ] (brush larger), Ctrl+Z (undo last stroke).
 * M9: History (undo/redo) via Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
 * M10: S (toggle Tải về / Export panel).
 * M11: A (toggle Xem file đã upload / Asset Library panel).
 * M12: W (toggle Ngắm waifu viewing mode, spec §22). Esc also exits waifu.
 * All ignore focus inside input/textarea/select/contenteditable — EXCEPT
 * Ctrl+Z which is also allowed there (so undo works while editing a layer name).
 */
export function EditorShell() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const inField =
        !!t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)

      // Ctrl/Cmd+Z → undo (spec §25, §34). Shift = redo.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const s = useEditorStore.getState()
        if (e.shiftKey) {
          s.redo()
        } else {
          s.undo()
        }
        return
      }
      // Ctrl/Cmd+Y → redo (spec §34).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        useEditorStore.getState().redo()
        return
      }

      if (inField) return
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
      } else if (k === 'p') {
        s.setTool('draw')
      } else if (k === 't') {
        s.setTool('text')
      } else if (k === 'c') {
        s.setTool('crop')
      } else if (k === 'x') {
        s.setTool('delete')
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected layer (spec §15). Refuses last layer (store guard).
        s.deleteSelectedLayer()
      } else if (k === 'l') {
        // Toggle the Layers panel via a window event the Sidebar subscribes to.
        window.dispatchEvent(new CustomEvent('zmi:toggle-layers'))
      } else if (k === 's') {
        // Toggle the Export panel via a window event the Sidebar subscribes to.
        window.dispatchEvent(new CustomEvent('zmi:toggle-export'))
      } else if (k === 'a') {
        // Toggle the Asset Library panel via a window event the Sidebar subscribes to.
        window.dispatchEvent(new CustomEvent('zmi:toggle-assets'))
      } else if (k === 'w') {
        // Toggle Ngắm waifu viewing mode (spec §22).
        s.toggleWaifuMode()
      } else if (k === '[') {
        s.setBrushSize(s.brushSize - 2)
      } else if (k === ']') {
        s.setBrushSize(s.brushSize + 2)
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
            s.setLayerTransform(w.id, layer.id, { rotation: r })
          }
        }
      } else if (e.key === 'Escape') {
        if (s.waifuMode) {
          s.toggleWaifuMode()
        } else if (s.selectedWindowId) {
          s.selectWindow(null)
        }
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
      {/* M12: Ngắm waifu overlay (spec §22) — renders above everything when active */}
      <WaifuOverlay />
    </div>
  )
}
