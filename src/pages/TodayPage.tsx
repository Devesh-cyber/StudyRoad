import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Flame, Loader2, Plus, Star } from 'lucide-react'
import { fetchAllNodes, fetchSummaries, updateNodes } from '@/lib/api'
import { ancestorIds, leafIds, overallProgress, progressMap, visibleRows } from '@/lib/editorOps'
import { challengeDays, computeStreaks } from '@/lib/challenge'
import type { NodeRow, RoadmapSummary } from '@/lib/types'
import { useToast } from '@/lib/toast'
import { ProgressBar } from '@/components/ProgressBar'
import { RoadmapGlyph } from '@/components/ShellLayout'
import { cn } from '@/lib/utils'

const todayStr = () => new Date().toLocaleDateString('en-CA')
const shortDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export function TodayPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const summaries = useQuery({ queryKey: ['summaries'], queryFn: fetchSummaries })
  const nodesQ = useQuery({ queryKey: ['all-nodes'], queryFn: fetchAllNodes })
  // Items ticked on this page stay in "Up next" (struck through) so the list doesn't jump.
  const [kept, setKept] = useState<Set<string>>(new Set())

  /** Optimistic tick/untick of several nodes in one roadmap. */
  const setDone = async (roadmapId: string, ids: string[], value: boolean) => {
    const snapshot = qc.getQueryData<NodeRow[]>(['all-nodes'])
    const now = new Date().toISOString()
    qc.setQueryData<NodeRow[]>(['all-nodes'], (ns) =>
      ns?.map((n) => (ids.includes(n.id) ? { ...n, is_done: value, done_at: value ? now : null } : n)),
    )
    try {
      await updateNodes(ids, { is_done: value })
    } catch (e) {
      qc.setQueryData(['all-nodes'], snapshot)
      toast.error(`Couldn't update: ${(e as Error).message}`)
    } finally {
      qc.invalidateQueries({ queryKey: ['summaries'] })
      qc.invalidateQueries({ queryKey: ['roadmap', roadmapId] })
    }
  }

  const view = useMemo(() => {
    const all = nodesQ.data ?? []
    const list = summaries.data ?? []
    const byRoadmap = new Map<string, NodeRow[]>()
    for (const n of all) {
      if (!byRoadmap.has(n.roadmap_id)) byRoadmap.set(n.roadmap_id, [])
      byRoadmap.get(n.roadmap_id)!.push(n)
    }
    const trees = list.filter((r) => r.kind === 'tree')
    const today = todayStr()

    const focus = trees.map((r) => {
      const nodes = byRoadmap.get(r.id) ?? []
      const node = r.focus_node_id ? nodes.find((n) => n.id === r.focus_node_id) : undefined
      if (!node) return { r, node: undefined }
      const titles = new Map(nodes.map((n) => [n.id, n.title]))
      const path = ancestorIds(nodes, node.id).reverse().map((id) => titles.get(id) || 'Untitled').join(' / ')
      const leaves = leafIds(nodes, node.id)
      const p = progressMap(nodes).get(node.id) ?? { done: 0, total: 0 }
      const done = p.total > 0 && p.done === p.total
      return { r, node, path, leaves, done, roadmapPct: r.percent }
    })

    // Up next: dated items first (overdue -> soonest), then the next unticked leaves of each roadmap in outline order.
    const next: { node: NodeRow; r: RoadmapSummary; overdue: boolean }[] = []
    const seen = new Set<string>()
    const focusIds = new Set(trees.map((r) => r.focus_node_id).filter(Boolean))
    const dated = trees
      .flatMap((r) => (byRoadmap.get(r.id) ?? []).filter((n) => n.due_date && (!n.is_done || kept.has(n.id))).map((node) => ({ node, r })))
      .filter(({ node }) => !(byRoadmap.get(node.roadmap_id) ?? []).some((c) => c.parent_id === node.id))
      .sort((a, b) => a.node.due_date!.localeCompare(b.node.due_date!))
    for (const d of dated) {
      if (next.length >= 3) break
      next.push({ ...d, overdue: d.node.due_date! < today })
      seen.add(d.node.id)
    }
    const perRoadmap = trees.map((r) =>
      visibleRows(byRoadmap.get(r.id) ?? [], new Set())
        .filter((row) => !row.hasChildren && (!row.node.is_done || kept.has(row.node.id)) && !seen.has(row.node.id) && !focusIds.has(row.node.id))
        .slice(0, 3)
        .map((row) => ({ node: row.node, r, overdue: false })),
    )
    for (let i = 0; i < 3 && next.length < 8; i++) {
      for (const lane of perRoadmap) if (lane[i] && next.length < 8) next.push(lane[i])
    }

    const challenges = list
      .filter((r) => r.kind === 'challenge' && r.challenge_start_date)
      .map((r) => {
        const days = challengeDays(byRoadmap.get(r.id) ?? [])
        const s = computeStreaks(days, r.challenge_start_date!)
        const todayNode = days.find((d) => d.day_number === s.todayIdx)
        return { r, days, ...s, todayNode, doneCount: overallProgress(days).done }
      })

    return { focus, next, challenges, list }
  }, [nodesQ.data, summaries.data, kept])

  const loading = summaries.isLoading || nodesQ.isLoading
  const error = summaries.error || nodesQ.error
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500 mb-1">{dateLabel}</p>
          <h1 className="text-4xl font-bold">Today</h1>
        </div>
        <Link to="/new" className="h-10 px-4 inline-flex items-center gap-2 rounded-xl bg-amber-300 text-zinc-950 font-semibold text-sm hover:bg-amber-200 transition-colors">
          <Plus className="h-4 w-4" /> New roadmap
        </Link>
      </header>

      {loading && (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin h-6 w-6 text-zinc-500" /></div>
      )}
      {error && (
        <div className="p-4 rounded-xl border border-red-900 bg-red-950/40 text-red-300 text-sm">
          Couldn't load your roadmaps: {(error as Error).message}
        </div>
      )}

      {!loading && !error && view.list.length === 0 && (
        <div className="py-16 text-center space-y-4 border-2 border-dashed border-zinc-800 rounded-2xl">
          <p className="font-display text-2xl font-semibold">No roads yet</p>
          <p className="text-zinc-400">Paste a plan from ChatGPT, describe one, or start a 100-day challenge.</p>
          <Link to="/new" className="inline-flex h-11 px-5 items-center gap-2 rounded-xl bg-amber-300 text-zinc-950 font-semibold hover:bg-amber-200">
            <Plus className="h-4 w-4" /> Create your first roadmap
          </Link>
        </div>
      )}

      {view.focus.length > 0 && (
        <section aria-labelledby="focus-h" className="space-y-3">
          <SectionTitle id="focus-h">In focus</SectionTitle>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {view.focus.map((f) =>
              f.node ? (
                <article key={f.r.id} className={cn('flex flex-col gap-4 p-5 rounded-2xl border', f.done ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-900 border-zinc-800')}>
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/r/${f.r.id}`} className="text-xs text-zinc-400 hover:text-zinc-200 truncate">{f.r.title}</Link>
                    <Star className="h-4 w-4 text-amber-300 fill-amber-300 flex-shrink-0" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('font-display text-lg font-semibold leading-snug', f.done && 'text-zinc-500 line-through decoration-zinc-600')}>{f.node.title || 'Untitled'}</p>
                    {f.path && <p className="text-xs text-zinc-500 mt-1 truncate">{f.path}</p>}
                  </div>
                  <ProgressBar value={f.roadmapPct ?? 0} />
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => setDone(f.r.id, f.leaves!, !f.done)}
                      className={cn(
                        'flex-1 h-10 rounded-xl text-sm font-semibold cursor-pointer transition-colors',
                        f.done ? 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'bg-amber-300 text-zinc-950 hover:bg-amber-200',
                      )}
                    >
                      {f.done ? 'Done · undo' : 'Mark done'}
                    </button>
                    <Link to={`/r/${f.r.id}`} className="h-10 px-4 inline-flex items-center rounded-xl border border-zinc-800 text-sm text-zinc-300 hover:bg-zinc-800">
                      Open
                    </Link>
                  </div>
                </article>
              ) : (
                <Link key={f.r.id} to={`/r/${f.r.id}`} className="flex flex-col justify-between gap-6 p-5 rounded-2xl border border-dashed border-zinc-800 hover:border-zinc-700 transition-colors">
                  <span className="text-xs text-zinc-400">{f.r.title}</span>
                  <span className="text-sm text-zinc-500">No focus yet. Open it and ★ the thing you're on.</span>
                  <span className="text-sm text-amber-300 inline-flex items-center gap-1">Set focus <ArrowRight className="h-4 w-4" /></span>
                </Link>
              ),
            )}
          </div>
        </section>
      )}

      {(view.next.length > 0 || view.challenges.length > 0) && (
        <div className="flex flex-wrap gap-6 items-start">
          {view.next.length > 0 && (
            <section aria-labelledby="next-h" className="flex-[999_1_380px] min-w-0 space-y-2">
              <SectionTitle id="next-h">Up next</SectionTitle>
              <ul className="divide-y divide-zinc-900">
                {view.next.map(({ node, r, overdue }) => (
                  <li key={node.id}>
                    <label className="flex items-center gap-3 py-3 px-1 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={node.is_done}
                        onChange={(e) => {
                          setKept((k) => new Set(k).add(node.id))
                          setDone(r.id, [node.id], e.target.checked)
                        }}
                        className="h-[18px] w-[18px] accent-amber-300 cursor-pointer flex-shrink-0"
                      />
                      <span className={cn('flex-1 min-w-0 truncate', node.is_done && 'text-zinc-500 line-through')}>{node.title || 'Untitled'}</span>
                      <Link to={`/r/${r.id}`} className="text-xs text-zinc-500 hover:text-zinc-300 truncate max-w-[30%]">{r.title}</Link>
                      {node.due_date && (
                        <span className={cn('text-[11px] px-1.5 py-0.5 rounded-md border tabular-nums flex-shrink-0', overdue ? 'border-red-900 text-red-400' : 'border-amber-900 text-amber-300')}>
                          {overdue ? 'overdue · ' : ''}{shortDate(node.due_date)}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {view.challenges.length > 0 && (
            <div className="flex-[1_1_300px] space-y-3">
              {view.challenges.map((c) => {
                const active = c.todayIdx >= 1 && c.todayIdx <= c.days.length
                return (
                  <section key={c.r.id} aria-label={c.r.title} className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link to={`/r/${c.r.id}`} className="font-display font-semibold hover:text-amber-200 truncate">{c.r.title}</Link>
                      <span className="text-xs text-zinc-500 tabular-nums flex-shrink-0">
                        {active ? `day ${c.todayIdx}` : c.todayIdx < 1 ? 'not started' : 'finished'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <Flame className={cn('h-5 w-5 self-center', c.current > 0 ? 'text-amber-300' : 'text-zinc-600')} aria-hidden="true" />
                      <span className="font-display text-4xl font-bold text-amber-300 tabular-nums">{c.current}</span>
                      <span className="text-sm text-zinc-400">day streak · {c.doneCount}/{c.days.length} done</span>
                    </div>
                    <div role="img" aria-label={`${c.doneCount} of ${c.days.length} days done`} className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]">
                      {c.days.slice(0, 100).map((d) => (
                        <span
                          key={d.id}
                          className={cn(
                            'aspect-square rounded-[2px]',
                            d.is_done ? 'bg-amber-300' : d.day_number === c.todayIdx ? 'ring-1 ring-inset ring-amber-300' : 'bg-zinc-800',
                          )}
                        />
                      ))}
                    </div>
                    {active && c.todayNode && (
                      <button
                        onClick={() => setDone(c.r.id, [c.todayNode!.id], !c.todayNode!.is_done)}
                        className={cn(
                          'w-full h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors',
                          c.todayNode.is_done ? 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'bg-amber-950 border border-amber-900 text-amber-300 hover:bg-amber-900/60',
                        )}
                      >
                        {c.todayNode.is_done ? <><Check className="h-4 w-4 text-green-400" /> Today is done · undo</> : 'Tick today'}
                      </button>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}

      {view.list.length > 0 && (
        <section aria-labelledby="all-h" className="space-y-3">
          <SectionTitle id="all-h">All roadmaps</SectionTitle>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
            {view.list.map((r) => (
              <Link key={r.id} to={`/r/${r.id}`} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-colors space-y-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <RoadmapGlyph r={r} size={16} />
                  <span className="font-display font-semibold truncate">{r.title}</span>
                </div>
                <div className="space-y-1.5">
                  <ProgressBar value={r.percent} />
                  <p className="text-xs text-zinc-500 tabular-nums">
                    {r.done_items}/{r.total_items} {r.kind === 'challenge' ? 'days' : 'done'} · {r.percent}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xs font-sans font-semibold uppercase tracking-[0.1em] text-zinc-500" style={{ letterSpacing: '0.1em' }}>
      {children}
    </h2>
  )
}
