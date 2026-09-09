'use client'

import { useRef } from 'react'
import {
  Move,
  Eye,
  PencilLine,
  Brush,
  Trash2,
  Scissors,
  Layers,
  Pipette,
  Sparkles,
  Crown,
  Download,
  FolderOpen,
  Undo2,
  Redo2,
  Plus,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'

/**
 * Sidebar — black navigation panel (matches the `ZmiEDT (1).png` mockup).
 *
 * Milestone 1 scope: only the import affordance is wired up. The other tool
 * entries are rendered as the spec/mockup requires but marked "soon" so the
 * UI is honest about what is implemented. They will be activated in later
 * milestones (M2+).
 */

interface NavItemProps {
  icon: React.ReactNode
  label: string
  soon?: boolean
  active?: boolean
  emoji?: string
  onClick?: () => void
}

function NavItem({ icon, label, soon, active, emoji, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
        'text-white/85 hover:bg-white/10 hover:text-white',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent',
        active && 'bg-white/15 text-white',
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-white/70 group-hover:text-white">
        {icon ?? (emoji ? <span className="text-base leading-none">{emoji}</span> : null)}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {soon && (
        <span className="rounded bg-white/10 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-white/55">
          soon
        </span>
      )}
    </button>
  )
}

function NavGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-0.5">{children}</div>
}

function Divider() {
  return <div className="my-2 h-px bg-white/12" aria-hidden />
}

export function Sidebar() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addImages = useEditorStore((s) => s.addImages)

  const openPicker = () => fileInputRef.current?.click()

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    await addImages(e.target.files)
    // reset so the same file can be re-picked
    e.target.value = ''
  }

  return (
    <aside
      className="flex h-full w-56 shrink-0 flex-col bg-black text-white select-none"
      aria-label="Editor sidebar"
    >
      {/* Brand / header */}
      <div className="px-3 pt-3">
        <div className="rounded-md bg-zinc-800/80 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-base">✦</span>
            <span className="text-sm font-semibold tracking-wide">Zmi EDT</span>
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/45">
            Batch Image Editor
          </div>
        </div>
      </div>

      {/* Import affordance (primary action for M1) */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={openPicker}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/25 bg-white/5 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-white/45 hover:bg-white/10"
        >
          <Plus className="h-4 w-4" />
          Nhập ảnh
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          aria-label="Nhập ảnh vào workspace"
          className="sr-only"
          onChange={handlePick}
        />
      </div>

      {/* Scrollable nav */}
      <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-2 [scrollbar-width:thin]">
        <NavGroup>
          <NavItem icon={<Move className="h-4 w-4" />} label="Di chuyển" soon />
          <NavItem icon={<Eye className="h-4 w-4" />} label="Xem" soon />
          <NavItem icon={<PencilLine className="h-4 w-4" />} label="Sửa" soon />
        </NavGroup>
        <Divider />
        <NavGroup>
          <NavItem icon={<Brush className="h-4 w-4" />} label="Vẽ" soon />
          <NavItem icon={<Trash2 className="h-4 w-4" />} label="Xóa" soon />
          <NavItem icon={<Scissors className="h-4 w-4" />} label="Cắt" soon />
          <NavItem icon={<Layers className="h-4 w-4" />} label="Xem lớp" soon />
          <NavItem icon={<Pipette className="h-4 w-4" />} label="Color Picker" soon />
        </NavGroup>
        <Divider />
        <NavGroup>
          <NavItem
            icon={<Sparkles className="h-4 w-4" />}
            label="Ngắm waifu"
            emoji="🫠"
            soon
          />
          <NavItem icon={<Crown className="h-4 w-4" />} label="Chọn MAIN" soon />
          <NavItem icon={<Download className="h-4 w-4" />} label="Tải về" soon />
          <NavItem
            icon={<FolderOpen className="h-4 w-4" />}
            label="Xem file đã upload"
            soon
          />
        </NavGroup>
      </nav>

      {/* Footer: Undo / Redo */}
      <div className="border-t border-white/10 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-white/45 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Redo2 className="h-3.5 w-3.5" />
            Redo
          </button>
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-white/45 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>
        <div className="mt-1.5 text-center text-[10px] uppercase tracking-[0.18em] text-white/30">
          v0.1 · Milestone 1
        </div>
      </div>
    </aside>
  )
}
