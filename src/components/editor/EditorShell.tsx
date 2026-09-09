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
 * M2 keyboard shortcuts (spec §34 — non-conflicting additions):
 *   M       → make the selected window MAIN
 *   B       → toggle batch participation of the selected window
 *   Esc     → deselect the active window
 * Shortcuts are ignored while focus is in an input/textarea/contenteditable
 * so typing is never hijacked.
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
      if (k === 'm') {
        if (s.selectedWindowId && s.selectedWindowId !== s.mainId) {
          s.setMain(s.selectedWindowId)
        }
      } else if (k === 'b') {
        if (s.selectedWindowId && s.selectedWindowId !== s.mainId) {
          s.toggleBatchEnabled(s.selectedWindowId)
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
