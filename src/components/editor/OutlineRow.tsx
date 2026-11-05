import { memo, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  CornerDownRight,
  FileText,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  PanelRight,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import type { NodeRow } from '@/lib/types'
import type { DropZone, Progress } from '@/lib/editorOps'
import { cn } from '@/lib/utils'
import { ItemMenu } from './ItemMenu'

export interface RowActions {
  commitTitle: (id: string, title: string) => void
  toggleDone: (id: string) => void
  toggleCollapse: (id: string) => void
  enter: (id: string, title: string) => void
  indent: (id: string, title: string) => void
  outdent: (id: string, title: string) => void
  moveUp: (id: string) => void
  moveDown: (id: string) => void
  backspaceEmpty: (id: string) => void
  focusPrev: (id: string) => void
  focusNext: (id: string) => void
  addChild: (id: string) => void
  remove: (id: string) => void
  setFocus: (id: string) => void
  openDetails: (id: string) => void
  smartAdd: (parentId: string) => void
  registerInput: (id: string, el: HTMLInputElement | null) => void
  // drag & drop
  dragStart: (id: string) => void
  dragOver: (id: string, zone: DropZone) => void
  drop: (id: string, zone: DropZone) => void
  dragEnd: () => void
}

interface Props {
  node: NodeRow
  depth: number
  hasChildren: boolean
  collapsed: boolean
  progress: Progress
  isFocus: boolean
  dropZone: DropZone | null // highlight when something is dragged over this row
  dragging: boolean
  flash: boolean
  canOutdent: boolean
  actions: RowActions
}

const todayStr = () => new Date().toLocaleDateString('en-CA')

function DueChip({ due, done }: { due: string; done: boolean }) {
  const today = todayStr()
  const label = new Date(due + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return (
    <span
      title={`Due ${due}`}
      className={cn(
        'text-[11px] px-1.5 py-0.5 rounded border tabular-nums flex-shrink-0',
        done
          ? 'border-zinc-800 text-zinc-600'
          : due < today
            ? 'border-red-900 text-red-400'
            : due === today
              ? 'border-amber-700 text-amber-300'
              : 'border-zinc-700 text-zinc-400',
      )}
    >
      {label}
    </span>
  )
}

export const OutlineRow = memo(function OutlineRow({
  node,
  depth,
  hasChildren,
  collapsed,
  progress,
  isFocus,
  dropZone,
  dragging,
  flash,
  canOutdent,
  actions,
}: Props) {
  const [value, setValue] = useState(node.title)
  const editing = useRef(false)
  const rowRef = useRef<HTMLDivElement>(null)

  // Keep in sync with the server/cache unless the user is typing.
  useEffect(() => {
    if (!editing.current) setValue(node.title)
  }, [node.title])

  const done = hasChildren ? progress.total > 0 && progress.done === progress.total : node.is_done
  const partial = hasChildren && progress.done > 0 && !done

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const k = e.key
    if (k === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      actions.enter(node.id, value)
    } else if (k === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) actions.outdent(node.id, value)
      else actions.indent(node.id, value)
    } else if (k === 'Backspace' && value === '' && !hasChildren) {
      e.preventDefault()
      actions.backspaceEmpty(node.id)
    } else if (e.altKey && k === 'ArrowUp') {
      e.preventDefault()
      actions.commitTitle(node.id, value)
      actions.moveUp(node.id)
    } else if (e.altKey && k === 'ArrowDown') {
      e.preventDefault()
      actions.commitTitle(node.id, value)
      actions.moveDown(node.id)
    } else if (k === 'ArrowUp') {
      e.preventDefault()
      actions.focusPrev(node.id)
    } else if (k === 'ArrowDown') {
      e.preventDefault()
      actions.focusNext(node.id)
    } else if (k === 'Escape') {
      ;(e.target as HTMLInputElement).blur()
    }
  }

  const zoneFromEvent = (e: React.DragEvent): DropZone => {
    const r = rowRef.current!.getBoundingClientRect()
    const y = (e.clientY - r.top) / r.height
    return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside'
  }

  return (
    <div
      id={`row-${node.id}`}
      ref={rowRef}
      onDragOver={(e) => {
        e.preventDefault()
        actions.dragOver(node.id, zoneFromEvent(e))
      }}
      onDrop={(e) => {
        e.preventDefault()
        actions.drop(node.id, zoneFromEvent(e))
      }}
      className={cn(
        'group relative flex items-start gap-1.5 py-1 pr-1 rounded-md transition-colors',
        'hover:bg-zinc-800/30 focus-within:bg-zinc-800/40',
        dropZone === 'inside' && 'bg-amber-300/10 ring-1 ring-amber-300/50',
        dragging && 'opacity-40',
        flash && 'bg-amber-300/15',
        isFocus && 'bg-amber-300/[0.06]',
      )}
      style={{ paddingLeft: `${Math.min(depth, 8) * 22 + 2}px` }}
    >
      {dropZone === 'before' && <div className="absolute -top-px left-0 right-0 h-0.5 bg-amber-300 rounded" style={{ marginLeft: `${Math.min(depth, 8) * 22}px` }} />}
      {dropZone === 'after' && <div className="absolute -bottom-px left-0 right-0 h-0.5 bg-amber-300 rounded" style={{ marginLeft: `${Math.min(depth, 8) * 22}px` }} />}

      {/* drag handle */}
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', node.id)
          e.dataTransfer.effectAllowed = 'move'
          if (rowRef.current) e.dataTransfer.setDragImage(rowRef.current, 16, 12)
          actions.dragStart(node.id)
        }}
        onDragEnd={actions.dragEnd}
        title="Drag to move"
        className="mt-1 text-zinc-700 hover:text-zinc-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 hidden sm:block"
      >
        <GripVertical className="h-4 w-4" />
      </span>

      <button
        onClick={() => actions.toggleCollapse(node.id)}
        aria-label={collapsed ? 'Expand' : 'Collapse'}
        className={cn('mt-1 text-zinc-600 hover:text-zinc-300 cursor-pointer', !hasChildren && 'invisible')}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      <button
        onClick={() => actions.toggleDone(node.id)}
        aria-label={done ? 'Mark not done' : hasChildren ? 'Mark all done' : 'Mark done'}
        title={hasChildren ? (done ? 'Untick everything inside' : 'Tick everything inside') : undefined}
        className="mt-0.5 flex-shrink-0 cursor-pointer"
      >
        {done ? (
          <CheckCircle2 className="h-[18px] w-[18px] text-green-500" />
        ) : partial ? (
          <CircleDot className="h-[18px] w-[18px] text-amber-300" />
        ) : (
          <Circle className="h-[18px] w-[18px] text-zinc-600 hover:text-zinc-400" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <input
          ref={(el) => actions.registerInput(node.id, el)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => (editing.current = true)}
          onBlur={() => {
            editing.current = false
            actions.commitTitle(node.id, value)
          }}
          onKeyDown={onKeyDown}
          placeholder="Type something…"
          aria-label="Item title"
          className={cn(
            'w-full bg-transparent focus:outline-none px-1 rounded placeholder:text-zinc-700',
            hasChildren ? 'font-semibold text-zinc-100' : 'text-zinc-200',
            done && !hasChildren && 'text-zinc-500 line-through decoration-zinc-600',
          )}
        />
        {node.description && <p className="text-xs text-zinc-500 px-1 leading-snug">{node.description}</p>}
      </div>

      <div className="flex items-center gap-1.5 mt-0.5">
        {isFocus && <Star className="h-3.5 w-3.5 text-amber-200 fill-amber-200 flex-shrink-0" aria-label="Focus" />}
        {node.due_date && <DueChip due={node.due_date} done={done} />}
        {node.notes && (
          <button onClick={() => actions.openDetails(node.id)} title="Has notes" className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
            <FileText className="h-3.5 w-3.5" />
          </button>
        )}
        {hasChildren && (
          <span className="text-xs text-zinc-500 tabular-nums w-10 text-right">
            {progress.done}/{progress.total}
          </span>
        )}
        <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <ItemMenu
            items={[
              { label: 'Add sub-item', icon: CornerDownRight, onClick: () => actions.addChild(node.id) },
              { label: 'Smart add inside…', icon: Sparkles, onClick: () => actions.smartAdd(node.id) },
              { label: 'Details & notes', icon: PanelRight, onClick: () => actions.openDetails(node.id) },
              { label: isFocus ? 'Remove focus' : 'Set as focus', icon: Star, onClick: () => actions.setFocus(node.id) },
              { label: 'Move up', icon: ArrowUp, onClick: () => actions.moveUp(node.id), divider: true },
              { label: 'Move down', icon: ArrowDown, onClick: () => actions.moveDown(node.id) },
              { label: 'Indent', icon: IndentIncrease, onClick: () => actions.indent(node.id, value) },
              { label: 'Outdent', icon: IndentDecrease, onClick: () => actions.outdent(node.id, value), disabled: !canOutdent },
              { label: 'Delete', icon: Trash2, onClick: () => actions.remove(node.id), danger: true, divider: true },
            ]}
          />
        </div>
      </div>
    </div>
  )
})
