// TEMPORARY read-only view — replaced by the full outline editor in the next step.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Loader2, Star, Trash2 } from 'lucide-react'
import { deleteRoadmap, fetchRoadmap } from '@/lib/api'
import { buildTree, isDone, percent, progressOf, progressOfList, type TreeNode } from '@/lib/tree'
import { ProgressBar } from '@/components/ProgressBar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function RoadmapPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['roadmap', id], queryFn: () => fetchRoadmap(id) })

  const del = useMutation({
    mutationFn: () => deleteRoadmap(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summaries'] })
      qc.removeQueries({ queryKey: ['roadmap', id] })
      navigate('/')
    },
  })

  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin h-6 w-6 text-zinc-500" />
      </div>
    )
  if (error || !data)
    return (
      <div className="space-y-4">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-200">← Dashboard</Link>
        <div className="p-4 rounded-lg border border-red-900 bg-red-950/40 text-red-300 text-sm">
          Couldn't load this roadmap{error ? `: ${(error as Error).message}` : ''}
        </div>
      </div>
    )

  const { roadmap, nodes } = data
  const tree = buildTree(nodes)
  const overall = progressOfList(tree)

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-200">← Dashboard</Link>
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-500 hover:text-red-400"
          disabled={del.isPending}
          onClick={() => {
            if (confirm(`Delete "${roadmap.title}" and all its progress?`)) del.mutate()
          }}
        >
          <Trash2 className="h-4 w-4 mr-1.5" /> Delete
        </Button>
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-bold text-zinc-100">{roadmap.title}</h2>
        {roadmap.description && <p className="text-zinc-400">{roadmap.description}</p>}
        <div className="flex items-center gap-3">
          <div className="flex-1"><ProgressBar value={percent(overall)} /></div>
          <span className="text-sm text-zinc-300 tabular-nums">
            {overall.done}/{overall.total} · {percent(overall)}%
          </span>
        </div>
      </div>

      <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-500">
        Read-only preview. Editing, ticking and ★ focus arrive with the outline editor (next step).
      </div>

      {roadmap.kind === 'challenge' ? (
        <ChallengeGrid nodes={nodes} start={roadmap.challenge_start_date} />
      ) : tree.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-500">
          Empty roadmap. Items will be addable in the editor.
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-0.5">
          {tree.map((n) => (
            <NodeRowView key={n.id} node={n} depth={0} focusId={roadmap.focus_node_id} />
          ))}
        </div>
      )}
    </div>
  )
}

function NodeRowView({ node, depth, focusId }: { node: TreeNode; depth: number; focusId: string | null }) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0
  const done = isDone(node)
  const p = progressOf(node)

  return (
    <div>
      <div className="flex items-start gap-2 py-1" style={{ paddingLeft: `${Math.min(depth, 6) * 20}px` }}>
        <button
          onClick={() => setOpen(!open)}
          className={cn('mt-0.5 text-zinc-600 hover:text-zinc-300 cursor-pointer', !hasChildren && 'invisible')}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {done ? (
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
        ) : (
          <Circle className={cn('h-4 w-4 mt-0.5 flex-shrink-0', p.done > 0 ? 'text-amber-300' : 'text-zinc-600')} />
        )}
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              hasChildren ? 'font-semibold text-zinc-100' : 'text-zinc-200',
              done && !hasChildren && 'text-zinc-500 line-through',
            )}
          >
            {node.title || <span className="text-zinc-600 italic">Untitled</span>}
          </span>
          {node.id === focusId && <Star className="inline h-3.5 w-3.5 ml-2 text-amber-200 fill-amber-200" />}
          {node.description && <p className="text-xs text-zinc-500">{node.description}</p>}
        </div>
        {hasChildren && <span className="text-xs text-zinc-500 tabular-nums">{p.done}/{p.total}</span>}
      </div>
      {open && node.children.map((c) => <NodeRowView key={c.id} node={c} depth={depth + 1} focusId={focusId} />)}
    </div>
  )
}

function ChallengeGrid({ nodes, start }: { nodes: { id: string; day_number: number | null; is_done: boolean }[]; start: string | null }) {
  const days = nodes.filter((n) => n.day_number !== null).sort((a, b) => a.day_number! - b.day_number!)
  const todayIdx = start
    ? Math.floor((Date.now() - new Date(start + 'T00:00:00').getTime()) / 86_400_000) + 1
    : null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      {todayIdx !== null && todayIdx >= 1 && todayIdx <= days.length && (
        <p className="text-sm text-zinc-400 mb-3">Today is day {todayIdx}</p>
      )}
      <div className="grid grid-cols-10 gap-1.5">
        {days.map((d) => (
          <div
            key={d.id}
            title={`Day ${d.day_number}`}
            className={cn(
              'aspect-square rounded-md flex items-center justify-center text-[11px] tabular-nums border',
              d.is_done
                ? 'bg-green-600/30 border-green-700 text-green-200'
                : d.day_number === todayIdx
                  ? 'border-amber-300 text-amber-200'
                  : 'border-zinc-800 text-zinc-600',
            )}
          >
            {d.day_number}
          </div>
        ))}
      </div>
    </div>
  )
}
