'use client'

import { Sidebar } from './Sidebar'
import { Workspace } from './Workspace'
import { StatusBar } from './StatusBar'

/**
 * EditorShell — top-level layout: black sidebar + workspace + status bar.
 * The status bar sits at the bottom (sticky-footer rule) and the workspace
 * fills all remaining space.
 */
export function EditorShell() {
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
