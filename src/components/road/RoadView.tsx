import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, PanelRight, Plus, Sparkles, Star, Trash2 } from 'lucide-react'
import type { RoadmapEditor } from '@/hooks/useRoadmapEditor'
import {
  ancestorIds,
  childrenOf,
  moveDownPatch,
  moveUpPatch,
  positionLastChild,
  progressMap,
  type Progress,
} from '@/lib/editorOps'
import type { NodeRow } from '@/lib/types'
import { OutlineEditor } from '@/components/editor/OutlineEditor'
import { ItemMenu } from '@/components/editor/ItemMenu'
import { ProgressBar } from '@/components/ProgressBar'
import { cn } from '@/lib/utils'

type StopStatus = 'passed' | 'here' | 'progress' | 'ahead'

interface Stop {
  node: NodeRow
  p: Progress
  status: StopStatus
  hasItems: boolean
}

const STATUS_LABEL: Record<StopStatus, string> = {
  passed: 'Passed',
  here: 'You are here',
  progress: 'In progress',
  ahead: 'Ahead',
}

interface Props {
  editor: RoadmapEditor
  onOpenDetails: (id: string) => void
  onSmartAdd: (parentId: string | null) => void
}

/**
 * Top-level items are stops on a road. "You are here" = the stop holding the
 * ★ focus, else the first stop that isn't finished. The selected stop's items
 * are edited in the side panel with the normal outline editor.
 */
export function RoadView({ editor, onOpenDetails, onSmartAdd }: Props) {
  const { roadmap, nodes } = editor.data!
  const pm = useMemo(() => progressMap(nodes), [nodes])

  const stops: Stop[] = useMemo(() => {
    const top = childrenOf(nodes, null)
    const focusTop = roadmap.focus_node_id
      ? ([roadmap.focus_node_id, ...ancestorIds(nodes, roadmap.focus_node_id)].slice(-1)[0] ?? null)
      : null
    const isPassed = (n: NodeRow) => {
      const p = pm.get(n.id)!
      return p.total > 0 && p.done === p.total
    }
    const hereId =
      (focusTop && top.some((t) => t.id === focusTop) ? focusTop : null) ?? top.find((t) => !isPassed(t))?.id ?? null
    return top.map((node) => {
      const p = pm.get(node.id) ?? { done: 0, total: 0 }
      const status: StopStatus = node.id === hereId ? 'here' : isPassed(node) ? 'passed' : p.done > 0 ? 'progress' : 'ahead'
      return { node, p, status, hasItems: nodes.some((n) => n.parent_id === node.id) }
    })
  }, [nodes, pm, roadmap.focus_node_id])

  const hereIndex = stops.findIndex((s) => s.status === 'here')
  const [selectedId, setSelectedId] = useState<string | null>(() => stops[hereIndex]?.node.id ?? stops[0]?.node.id ?? null)
  const [titleFocusId, setTitleFocusId] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  // Keep a valid selection when stops are added / removed.
  useEffect(() => {
    if (!selectedId || !stops.some((s) => s.node.id === selectedId)) {
      setSelectedId(stops[hereIndex]?.node.id ?? stops[0]?.node.id ?? null)
    }
  }, [stops, selectedId, hereIndex])

  const select = (id: string) => {
    setSelectedId(id)
    if (window.innerWidth < 1024) requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const addStop = () => {
    const id = editor.createNode(null, positionLastChild(editor.getNodes(), null), '')
    setSelectedId(id)
    setTitleFocusId(id)
  }

  const selected = stops.find((s) => s.node.id === selectedId)
  const passedCount = stops.filter((s) => s.status === 'passed').length

  if (stops.length === 0) {
    return (
      <div className="py-14 text-center space-y-4 border-2 border-dashed border-zinc-800 rounded-2xl">
        <p className="font-display text-2xl font-semibold">Your road is empty</p>
        <p className="text-zinc-400 text-sm">Each top-level item becomes a stop on the road.</p>
        <div className="flex justify-center gap-2">
          <button onClick={addStop} className="h-11 px-4 rounded-xl bg-amber-300 text-zinc-950 font-semibold text-sm hover:bg-amber-200 cursor-pointer inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add first stop
          </button>
          <button onClick={() => onSmartAdd(null)} className="h-11 px-4 rounded-xl border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Smart add
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
        {hereIndex >= 0 ? (
          <span>
            <strong className="font-display text-lg text-amber-300">Stop {hereIndex + 1}</strong> of {stops.length}
          </span>
        ) : (
          <span className="font-display text-lg text-passed">Road complete</span>
        )}
        <span>{passedCount} passed</span>
      </p>

      <div className="flex flex-wrap gap-8 items-start">
        <ol aria-label="Stops on this road" className="flex-[999_1_380px] min-w-0 list-none m-0 p-0">
          {stops.map((s, i) => (
            <StopRow key={s.node.id} stop={s} first={i === 0} selected={s.node.id === selectedId} onSelect={() => select(s.node.id)} isFocus={roadmap.focus_node_id === s.node.id} />
          ))}
          <li className="flex gap-5 items-stretch">
            <div aria-hidden="true" className="relative w-16 flex-shrink-0 min-h-[64px]">
              <div className="absolute left-3 w-10 top-0 h-7 bg-road" />
              <div className="absolute left-[18px] top-[14px] w-7 h-7 rounded-full border-[3px] border-dashed border-zinc-700 bg-zinc-950" />
            </div>
            <button
              onClick={addStop}
              className="self-start mt-2.5 h-11 px-4 rounded-xl border border-dashed border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add stop
            </button>
          </li>
        </ol>

        {selected && (
          <aside
            ref={panelRef}
            aria-label={`Stop: ${selected.node.title || 'Untitled'}`}
            className="flex-[1_1_380px] min-w-0 lg:sticky lg:top-6 p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 scroll-mt-20"
          >
            <StopPanelHeader
              key={selected.node.id}
              stop={selected}
              autoFocusTitle={titleFocusId === selected.node.id}
              isFocus={roadmap.focus_node_id === selected.node.id}
              editor={editor}
              onOpenDetails={onOpenDetails}
              onDeleted={() => setSelectedId(null)}
            />
            <OutlineEditor
              key={`panel-${selected.node.id}`}
              editor={editor}
              rootId={selected.node.id}
              showFocusBanner={false}
              onOpenDetails={onOpenDetails}
              onSmartAdd={onSmartAdd}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

function StopRow({ stop, first, selected, onSelect, isFocus }: { stop: Stop; first: boolean; selected: boolean; onSelect: () => void; isFocus: boolean }) {
  const { node, p, status } = stop
  const passed = status === 'passed'
  const here = status === 'here'
  const lane = passed || here || status === 'progress'
  return (
    <li className="flex gap-5 items-stretch">
      <div aria-hidden="true" className="relative w-16 flex-shrink-0 min-h-[104px]">
        <div
          className={cn('absolute left-3 w-10 bottom-0', first ? 'top-7' : 'top-0', passed ? 'bg-[#25262B]' : 'bg-road')}
          style={{
            backgroundImage: `repeating-linear-gradient(to bottom, ${lane ? '#F5C542' : '#3A3B42'} 0 14px, transparent 14px 28px)`,
            backgroundSize: '2px 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
          }}
        />
        <div
          className={cn(
            'absolute rounded-full box-border',
            here
              ? 'left-3.5 top-3 w-9 h-9 bg-zinc-950 border-4 border-amber-300 shadow-[0_0_0_6px_rgba(245,197,66,0.15)]'
              : 'left-5 top-[18px] w-6 h-6',
            passed && 'bg-amber-300',
            status === 'progress' && 'bg-zinc-950 border-[3px] border-amber-300',
            status === 'ahead' && 'bg-zinc-950 border-[3px] border-zinc-700',
          )}
        />
      </div>
      <button
        onClick={onSelect}
        aria-current={selected ? 'step' : undefined}
        className={cn(
          'flex-1 min-w-0 mb-4 px-4 py-3.5 rounded-2xl border text-left transition-colors cursor-pointer',
          here ? 'bg-amber-950 border-amber-900' : 'bg-transparent border-zinc-900 hover:border-zinc-700',
          status === 'ahead' && !selected && 'opacity-80',
          selected && 'ring-2 ring-amber-300/70 border-transparent',
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <span className={cn('text-[11px] uppercase tracking-[0.1em]', here ? 'text-amber-300' : passed ? 'text-passed' : 'text-zinc-500')}>
            {STATUS_LABEL[status]}
          </span>
          <span className="font-display text-sm text-zinc-400 tabular-nums">
            {stop.hasItems ? `${p.done} / ${p.total}` : ''}
          </span>
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="font-display text-xl font-semibold tracking-tight truncate">{node.title || 'Untitled stop'}</span>
          {isFocus && <Star className="h-4 w-4 text-amber-300 fill-amber-300 flex-shrink-0" aria-label="Focus" />}
        </span>
        {node.description && <span className="block mt-1 text-sm text-zinc-400 truncate">{node.description}</span>}
      </button>
    </li>
  )
}

function StopPanelHeader({
  stop,
  autoFocusTitle,
  isFocus,
  editor,
  onOpenDetails,
  onDeleted,
}: {
  stop: Stop
  autoFocusTitle: boolean
  isFocus: boolean
  editor: RoadmapEditor
  onOpenDetails: (id: string) => void
  onDeleted: () => void
}) {
  const { node, p, status } = stop
  const [title, setTitle] = useState(node.title)
  useEffect(() => setTitle(node.title), [node.title])
  const hasItems = stop.hasItems
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0

  const commit = () => {
    if (title !== node.title) editor.updateNode(node.id, { title })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className={cn('text-[11px] uppercase tracking-[0.1em]', status === 'here' ? 'text-amber-300' : status === 'passed' ? 'text-passed' : 'text-zinc-500')}>
            {STATUS_LABEL[status]}
          </span>
          <input
            value={title}
            autoFocus={autoFocusTitle}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Name this stop"
            aria-label="Stop name"
            className="block w-full mt-1 bg-transparent font-display text-2xl font-bold tracking-tight focus:outline-none placeholder:text-zinc-600"
          />
        </div>
        <ItemMenu
          label="Stop actions"
          items={[
            { label: isFocus ? 'Remove focus' : 'Set stop as focus', icon: Star, onClick: () => editor.setFocus(node.id) },
            { label: 'Details & notes', icon: PanelRight, onClick: () => onOpenDetails(node.id) },
            { label: 'Move stop up', icon: ArrowUp, divider: true, onClick: () => { const m = moveUpPatch(editor.getNodes(), node.id); if (m) editor.updateNode(node.id, m) } },
            { label: 'Move stop down', icon: ArrowDown, onClick: () => { const m = moveDownPatch(editor.getNodes(), node.id); if (m) editor.updateNode(node.id, m) } },
            { label: 'Delete stop', icon: Trash2, danger: true, divider: true, onClick: () => { editor.deleteNode(node.id); onDeleted() } },
          ]}
        />
      </div>
      {hasItems ? (
        <div className="flex items-center gap-3">
          <div className="flex-1"><ProgressBar value={pct} /></div>
          <span className="text-sm text-zinc-400 tabular-nums">{p.done}/{p.total}</span>
        </div>
      ) : (
        <label className="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer w-fit">
          <input type="checkbox" checked={node.is_done} onChange={() => editor.toggleDone(node.id)} className="h-[18px] w-[18px] accent-amber-300" />
          This stop is done
        </label>
      )}
      {node.description && <p className="text-sm text-zinc-400">{node.description}</p>}
    </div>
  )
}
