import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCopy, ListTree, Loader2, NotebookPen, Route, Trash2 } from 'lucide-react'
import { useRoadmapEditor, type RoadmapEditor } from '@/hooks/useRoadmapEditor'
import { deleteRoadmap } from '@/lib/api'
import { overallProgress, toMarkdown } from '@/lib/editorOps'
import { useToast } from '@/lib/toast'
import { ProgressBar } from '@/components/ProgressBar'
import { OutlineEditor } from '@/components/editor/OutlineEditor'
import { NodeDrawer } from '@/components/editor/NodeDrawer'
import { SmartAddDialog } from '@/components/editor/SmartAddDialog'
import { ItemMenu } from '@/components/editor/ItemMenu'
import { ChallengeView } from '@/components/challenge/ChallengeView'
import { RoadView } from '@/components/road/RoadView'
import { cn } from '@/lib/utils'

export function RoadmapPage() {
  const { id = '' } = useParams()
  // key by id so all editor state resets when switching roadmaps
  return <RoadmapScreen key={id} id={id} />
}

function RoadmapScreen({ id }: { id: string }) {
  const editor = useRoadmapEditor(id)
  const { data, query } = { data: editor.data, query: editor.query }

  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [smartAddParent, setSmartAddParent] = useState<string | null | undefined>(undefined) // undefined = closed
  const closeDetails = useCallback(() => setDetailsId(null), [])
  const [view, setViewState] = useState<'road' | 'outline'>(() => {
    try {
      return localStorage.getItem(`sr:view:${id}`) === 'outline' ? 'outline' : 'road'
    } catch {
      return 'road'
    }
  })
  const setView = (v: 'road' | 'outline') => {
    setViewState(v)
    try {
      localStorage.setItem(`sr:view:${id}`, v)
    } catch {
      /* not persisted */
    }
  }

  if (query.isLoading)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin h-6 w-6 text-zinc-500" />
      </div>
    )
  if (query.error || !data)
    return (
      <div className="space-y-4">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-200">← Today</Link>
        <div className="p-4 rounded-lg border border-red-900 bg-red-950/40 text-red-300 text-sm">
          Couldn't load this roadmap{query.error ? `: ${(query.error as Error).message}` : ''}
        </div>
      </div>
    )

  return (
    <div className={cn('mx-auto space-y-6 pb-24', data.roadmap.kind === 'tree' && view === 'road' ? 'max-w-6xl' : 'max-w-3xl')}>
      <Header editor={editor} view={data.roadmap.kind === 'tree' ? view : null} onViewChange={setView} />

      {data.roadmap.kind === 'challenge' ? (
        <ChallengeView editor={editor} />
      ) : view === 'road' ? (
        <RoadView editor={editor} onOpenDetails={setDetailsId} onSmartAdd={(p) => setSmartAddParent(p)} />
      ) : (
        <OutlineEditor editor={editor} onOpenDetails={setDetailsId} onSmartAdd={(p) => setSmartAddParent(p)} />
      )}

      {detailsId && <NodeDrawer editor={editor} nodeId={detailsId} onClose={closeDetails} />}
      {smartAddParent !== undefined && (
        <SmartAddDialog
          editor={editor}
          parentId={smartAddParent}
          onClose={() => setSmartAddParent(undefined)}
          onAdded={() => {}}
        />
      )}
    </div>
  )
}

function Header({ editor, view, onViewChange }: { editor: RoadmapEditor; view: 'road' | 'outline' | null; onViewChange: (v: 'road' | 'outline') => void }) {
  const { roadmap, nodes } = editor.data!
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()

  const [title, setTitle] = useState(roadmap.title)
  const [description, setDescription] = useState(roadmap.description ?? '')
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState(roadmap.notes)
  useEffect(() => setTitle(roadmap.title), [roadmap.title])
  useEffect(() => setDescription(roadmap.description ?? ''), [roadmap.description])
  useEffect(() => setNotes(roadmap.notes), [roadmap.notes])

  const progress = overallProgress(roadmap.kind === 'challenge' ? nodes.filter((n) => n.day_number !== null) : nodes)
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  const del = useMutation({
    mutationFn: () => deleteRoadmap(roadmap.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summaries'] })
      qc.removeQueries({ queryKey: ['roadmap', roadmap.id] })
      navigate('/')
    },
    onError: (e) => toast.error(`Couldn't delete: ${(e as Error).message}`),
  })

  const exportMd = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(roadmap.title, nodes))
      toast.show('Copied as markdown. Paste it into ChatGPT, or back into StudyRoad.')
    } catch {
      toast.error("Couldn't copy to clipboard")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-200">← Today</Link>
        <div className="flex items-center gap-1">
          {view && (
            <div role="group" aria-label="View" className="flex p-0.5 mr-1 rounded-lg bg-zinc-900 border border-zinc-800">
              {(['road', 'outline'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => onViewChange(v)}
                  aria-pressed={view === v}
                  className={cn(
                    'h-8 px-2.5 rounded-md text-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors',
                    view === v ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {v === 'road' ? <Route className="h-4 w-4" /> : <ListTree className="h-4 w-4" />}
                  <span className="hidden sm:inline">{v === 'road' ? 'Road' : 'Outline'}</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 cursor-pointer"
          >
            <NotebookPen className="h-4 w-4" /> Notes
          </button>
          <ItemMenu
            label="Roadmap actions"
            items={[
              ...(roadmap.kind === 'tree' ? [{ label: 'Copy as markdown', icon: ClipboardCopy, onClick: exportMd }] : []),
              {
                label: 'Delete roadmap',
                icon: Trash2,
                danger: true,
                divider: roadmap.kind === 'tree',
                onClick: () => {
                  if (confirm(`Delete "${roadmap.title}" and all its progress? This can't be undone.`)) del.mutate()
                },
              },
            ]}
          />
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const t = title.trim()
          if (!t) setTitle(roadmap.title)
          else if (t !== roadmap.title) editor.patchRoadmap({ title: t })
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Roadmap title"
        className="w-full bg-transparent font-display text-4xl font-bold tracking-tight text-zinc-100 focus:outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => (description.trim() || null) !== roadmap.description && editor.patchRoadmap({ description: description.trim() || null })}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="Add a description…"
        aria-label="Roadmap description"
        className="w-full bg-transparent text-zinc-400 focus:outline-none placeholder:text-zinc-700"
      />

      <div className="flex items-center gap-3">
        <div className="flex-1"><ProgressBar value={pct} /></div>
        <span className="text-sm text-zinc-300 tabular-nums">
          {progress.done}/{progress.total} · {pct}%
        </span>
      </div>

      {notesOpen && (
        <div className="space-y-1">
          <textarea
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== roadmap.notes && editor.patchRoadmap({ notes })}
            placeholder="Roadmap notes: goals, plan, reminders…"
            className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 font-mono focus:outline-none focus:border-zinc-600 resize-y"
          />
          <p className="text-[11px] text-zinc-600">Saves when you click outside the box.</p>
        </div>
      )}
    </div>
  )
}
