'use client'

import { useRef, useState, useEffect } from 'react'
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
  Type,
} from 'lucide-react'
import { useEditorStore } from '@/store/editor-store'
import { cn } from '@/lib/utils'
import { TransformPanel } from './TransformPanel'
import { LayerPanel } from './LayerPanel'
import { DrawPanel } from './DrawPanel'
import { TextPanel } from './TextPanel'
import { DeletePanel } from './DeletePanel'
import { CropPanel } from './CropPanel'

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
  const [layersOpen, setLayersOpen] = useState(true)
  const addImages = useEditorStore((s) => s.addImages)
  const setMain = useEditorStore((s) => s.setMain)
  const setTool = useEditorStore((s) => s.setTool)
  const selectedId = useEditorStore((s) => s.selectedWindowId)
  const mainId = useEditorStore((s) => s.mainId)
  const tool = useEditorStore((s) => s.tool)
  const mainWindow = useEditorStore((s) =>
    s.windows.find((w) => w.id === s.mainId),
  )
  const hasWindows = useEditorStore((s) => s.windows.length > 0)

  // M9: reactive undo/redo availability (the store's canUndo/canRedo are
  // functions; subscribe to the underlying stacks to get reactive booleans).
  const mainHistoryLen = useEditorStore((s) => s.mainHistory.length)
  const mainRedoLen = useEditorStore((s) => s.mainRedo.length)
  const winHistLen = useEditorStore(
    (s) => (s.selectedWindowId ? (s.windowHistory[s.selectedWindowId]?.length ?? 0) : 0),
  )
  const winRedoLen = useEditorStore(
    (s) => (s.selectedWindowId ? (s.windowRedo[s.selectedWindowId]?.length ?? 0) : 0),
  )
  const isMainSel = selectedId === mainId
  const canUndo = isMainSel ? mainHistoryLen > 0 : winHistLen > 0
  const canRedo = isMainSel ? mainRedoLen > 0 : winRedoLen > 0
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  // Listen for the keyboard-shortcut event (L) dispatched by EditorShell.
  useEffect(() => {
    const onToggle = () => setLayersOpen((v) => !v)
    window.addEventListener('zmi:toggle-layers', onToggle)
    return () => window.removeEventListener('zmi:toggle-layers', onToggle)
  }, [])

  const openPicker = () => fileInputRef.current?.click()

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    await addImages(e.target.files)
    e.target.value = ''
  }

  const handleChooseMain = () => {
    if (!selectedId) return
    if (selectedId === mainId) return
    setMain(selectedId)
  }

  const mainActionActive = !!selectedId && selectedId === mainId

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

      {/* MAIN indicator */}
      <div className="px-3 pt-2">
        <div
          className={cn(
            'rounded-md border px-2.5 py-1.5 text-[11px] transition-colors',
            mainWindow
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
              : 'border-white/10 bg-white/[0.03] text-white/45',
          )}
        >
          <div className="flex items-center gap-1.5">
            <Crown
              className={cn(
                'h-3 w-3',
                mainWindow ? 'text-amber-300' : 'text-white/30',
              )}
            />
            <span className="font-semibold uppercase tracking-wide">
              {mainWindow ? 'MAIN' : 'MAIN chưa chọn'}
            </span>
          </div>
          {mainWindow && (
            <div className="mt-0.5 truncate text-amber-100/80">
              {mainWindow.fileName}
            </div>
          )}
        </div>
      </div>

      {/* Active tool hint (spec §10/§11/§19/§13/§18/§15/§16) */}
      <div className="px-3 pt-2">
        <div
          className={cn(
            'rounded-md border px-2.5 py-1.5 text-[11px] transition-colors',
            tool === 'view'
              ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
              : tool === 'transform'
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                : tool === 'draw'
                  ? 'border-rose-400/40 bg-rose-400/10 text-rose-200'
                  : tool === 'text'
                    ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
                    : tool === 'crop'
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                      : tool === 'delete'
                        ? 'border-rose-400/40 bg-rose-400/10 text-rose-200'
                        : 'border-white/10 bg-white/[0.03] text-white/55',
          )}
        >
          <div className="flex items-center gap-1.5">
            {tool === 'view' ? (
              <Eye className="h-3 w-3 text-sky-300" />
            ) : tool === 'transform' ? (
              <PencilLine className="h-3 w-3 text-amber-300" />
            ) : tool === 'draw' ? (
              <Brush className="h-3 w-3 text-rose-300" />
            ) : tool === 'text' ? (
              <Type className="h-3 w-3 text-sky-300" />
            ) : tool === 'crop' ? (
              <Scissors className="h-3 w-3 text-emerald-300" />
            ) : tool === 'delete' ? (
              <Trash2 className="h-3 w-3 text-rose-300" />
            ) : (
              <Move className="h-3 w-3 text-white/55" />
            )}
            <span className="font-semibold uppercase tracking-wide">
              {tool === 'view'
                ? 'Chế độ Xem'
                : tool === 'transform'
                  ? 'Biến đổi'
                  : tool === 'draw'
                    ? 'Vẽ'
                    : tool === 'text'
                      ? 'Text'
                      : tool === 'crop'
                        ? 'Cắt ảnh'
                        : tool === 'delete'
                          ? 'Xóa'
                          : 'Di chuyển'}
            </span>
          </div>
          <div className="mt-0.5 leading-relaxed text-white/50">
            {tool === 'view'
              ? 'Chỉ xem — kéo để pan, cuộn để zoom.'
              : tool === 'transform'
                ? 'Sửa layer đã chọn. MAIN → Áp dụng batch.'
                : tool === 'draw'
                  ? 'Kéo trên ảnh để vẽ nét. Local — không batch.'
                  : tool === 'text'
                    ? 'Chỉnh text layer. Vị trí/rotate qua Biến đổi.'
                    : tool === 'crop'
                      ? 'Kéo trên ảnh để chọn vùng cắt.'
                      : tool === 'delete'
                        ? 'Xóa layer đang chọn. MAIN → batch xóa.'
                        : 'Kéo title bar để di chuyển window.'}
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
          <NavItem
            icon={<Move className="h-4 w-4" />}
            label="Di chuyển"
            active={tool === 'move'}
            onClick={() => setTool('move')}
          />
          <NavItem
            icon={<Eye className="h-4 w-4" />}
            label="Xem"
            active={tool === 'view'}
            onClick={() => setTool('view')}
          />
          <NavItem
            icon={<PencilLine className="h-4 w-4" />}
            label="Sửa"
            active={tool === 'transform'}
            onClick={() => setTool('transform')}
          />
          <NavItem
            icon={<Type className="h-4 w-4" />}
            label="Text"
            active={tool === 'text'}
            onClick={() => setTool('text')}
          />
        </NavGroup>

        {/* M4: Biến đổi panel — only shown when the Sửa tool is active */}
        {tool === 'transform' && <TransformPanel />}

        {/* M7: Text panel — only shown when the Text tool is active */}
        {tool === 'text' && <TextPanel />}

        <Divider />
        <NavGroup>
          <NavItem
            icon={<Brush className="h-4 w-4" />}
            label="Vẽ"
            active={tool === 'draw'}
            onClick={() => setTool('draw')}
          />
          <NavItem
            icon={<Trash2 className="h-4 w-4" />}
            label="Xóa"
            active={tool === 'delete'}
            onClick={() => setTool('delete')}
          />
          <NavItem
            icon={<Scissors className="h-4 w-4" />}
            label="Cắt ảnh"
            active={tool === 'crop'}
            onClick={() => setTool('crop')}
          />
          <NavItem
            icon={<Layers className="h-4 w-4" />}
            label="Xem lớp"
            active={layersOpen}
            onClick={() => setLayersOpen((v) => !v)}
          />
          <NavItem icon={<Pipette className="h-4 w-4" />} label="Color Picker" soon />
        </NavGroup>

        {/* M6: Vẽ panel — only shown when the Vẽ tool is active */}
        {tool === 'draw' && <DrawPanel />}

        {/* M8: Delete + Crop panels */}
        {tool === 'delete' && <DeletePanel />}
        {tool === 'crop' && <CropPanel />}

        {/* M5: Layers panel — toggle via the Xem lớp nav item */}
        {layersOpen && <LayerPanel />}
        <Divider />
        <NavGroup>
          <NavItem
            icon={<Sparkles className="h-4 w-4" />}
            label="Ngắm waifu"
            emoji="🫠"
            soon
          />
          <NavItem
            icon={<Crown className="h-4 w-4" />}
            label="Chọn MAIN"
            active={mainActionActive}
            onClick={hasWindows ? handleChooseMain : undefined}
          />
          <NavItem icon={<Download className="h-4 w-4" />} label="Tải về" soon />
          <NavItem
            icon={<FolderOpen className="h-4 w-4" />}
            label="Xem file đã upload"
            soon
          />
        </NavGroup>
      </nav>

      {/* Footer: Undo / Redo (M9) */}
      <div className="border-t border-white/10 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => redo()}
            title="Redo (Ctrl+Shift+Z)"
            className={cn(
              'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
              canRedo
                ? 'text-white/85 hover:bg-white/10 hover:text-white'
                : 'cursor-not-allowed text-white/30',
            )}
          >
            <Redo2 className="h-3.5 w-3.5" />
            Redo
          </button>
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => undo()}
            title="Undo (Ctrl+Z)"
            className={cn(
              'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
              canUndo
                ? 'text-white/85 hover:bg-white/10 hover:text-white'
                : 'cursor-not-allowed text-white/30',
            )}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-[10px] uppercase tracking-[0.18em] text-white/30">
          <span>v0.1 · Milestone 9</span>
        </div>
        <div className="mt-0.5 text-center text-[9px] text-white/20">
          phím tắt: M · B · V · D · E · T · P · C · X · L · 0 1 + - · G · F · R · [ ] · Del · Ctrl+Z/Y · Esc
        </div>
      </div>
    </aside>
  )
}
