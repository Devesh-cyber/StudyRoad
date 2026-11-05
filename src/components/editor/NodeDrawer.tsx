import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Link as LinkIcon, Plus, Star, Trash2, X } from 'lucide-react'
import type { RoadmapEditor } from '@/hooks/useRoadmapEditor'
import { addLink, deleteLink, fetchLinks } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  editor: RoadmapEditor
  nodeId: string
  onClose: () => void
}

/** Side panel: description, notes (plain text), due date, links, focus, delete. */
export function NodeDrawer({ editor, nodeId, onClose }: Props) {
  const node = editor.data?.nodes.find((n) => n.id === nodeId)
  const isFocus = editor.data?.roadmap.focus_node_id === nodeId

  const [title, setTitle] = useState(node?.title ?? '')
  const [description, setDescription] = useState(node?.description ?? '')
  const [notes, setNotes] = useState(node?.notes ?? '')

  // Re-sync when switching to another item.
  useEffect(() => {
    setTitle(node?.title ?? '')
    setDescription(node?.description ?? '')
    setNotes(node?.notes ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  // Close if the item disappears (deleted).
  useEffect(() => {
    if (!node) onClose()
  }, [node, onClose])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  if (!node) return null

  const save = (patch: Parameters<RoadmapEditor['updateNode']>[1]) => editor.updateNode(node.id, patch)

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Item details"
        className="relative w-full sm:w-[440px] h-full overflow-y-auto bg-zinc-950 border-l border-zinc-800 p-5 space-y-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== node.title && save({ title })}
            placeholder="Untitled"
            aria-label="Title"
            className="flex-1 bg-transparent text-xl font-semibold text-zinc-100 focus:outline-none"
          />
          <button onClick={onClose} aria-label="Close" className="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Field label="Short description">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => (description || null) !== node.description && save({ description: description.trim() || null })}
            placeholder="One line on what this covers"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date">
            <div className="flex gap-1">
              <input
                type="date"
                value={node.due_date ?? ''}
                onChange={(e) => save({ due_date: e.target.value || null })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 [color-scheme:dark]"
              />
              {node.due_date && (
                <button onClick={() => save({ due_date: null })} title="Clear" className="px-2 text-zinc-500 hover:text-zinc-200 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </Field>
          <Field label="Focus">
            <button
              onClick={() => editor.setFocus(node.id)}
              className={cn(
                'w-full flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm cursor-pointer',
                isFocus ? 'border-amber-300/50 bg-amber-300/10 text-amber-200' : 'border-zinc-800 text-zinc-400 hover:bg-zinc-900',
              )}
            >
              <Star className={cn('h-4 w-4', isFocus && 'fill-amber-200')} />
              {isFocus ? 'Focused' : 'Set as focus'}
            </button>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => (notes || null) !== node.notes && save({ notes: notes || null })}
            placeholder="Anything: what you learned, doubts, code snippets…"
            className="w-full h-56 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 font-mono leading-relaxed focus:outline-none focus:border-zinc-600 resize-y"
          />
          <p className="text-[11px] text-zinc-600 mt-1">Saves when you click outside the box.</p>
        </Field>

        <Links nodeId={node.id} />

        <div className="pt-2 border-t border-zinc-900">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-400 hover:bg-red-950/40"
            onClick={() => {
              editor.deleteNode(node.id)
              onClose()
            }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete item
          </Button>
        </div>
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Links({ nodeId }: { nodeId: string }) {
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['links', nodeId]
  const { data: links = [] } = useQuery({ queryKey: key, queryFn: () => fetchLinks(nodeId) })
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')

  const add = useMutation({
    mutationFn: () => {
      let u = url.trim()
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u
      return addLink(nodeId, title.trim() || u.replace(/^https?:\/\//, ''), u)
    },
    onSuccess: () => {
      setTitle('')
      setUrl('')
      qc.invalidateQueries({ queryKey: key })
    },
    onError: (e) => toast.error(`Couldn't add link: ${(e as Error).message}`),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(`Couldn't remove link: ${(e as Error).message}`),
  })

  return (
    <Field label="Links & resources">
      <div className="space-y-1.5">
        {links.map((l) => (
          <div key={l.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
            <ExternalLink className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-sm text-amber-200 hover:underline truncate">
              {l.title}
            </a>
            <button onClick={() => remove.mutate(l.id)} aria-label="Remove link" className="text-zinc-600 hover:text-red-400 cursor-pointer">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (url.trim()) add.mutate()
          }}
          className="flex gap-1.5"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Link title"
            className="w-1/3 min-w-0 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            aria-label="Link URL"
            className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
          />
          <button type="submit" disabled={!url.trim() || add.isPending} aria-label="Add link" className="px-2.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 cursor-pointer">
            {add.isPending ? '…' : <Plus className="h-4 w-4" />}
          </button>
        </form>
        {links.length === 0 && (
          <p className="text-[11px] text-zinc-600 flex items-center gap-1">
            <LinkIcon className="h-3 w-3" /> YouTube videos, docs, blog posts…
          </p>
        )}
      </div>
    </Field>
  )
}
