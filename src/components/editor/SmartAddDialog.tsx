import { useEffect, useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import type { RoadmapEditor } from '@/hooks/useRoadmapEditor'
import { structureWithAI } from '@/lib/api'
import { isCleanMarkdown, parseLines, parseMarkdown } from '@/lib/parser'
import { positionLastChild } from '@/lib/editorOps'
import { toPayload, withIds } from '@/lib/tree'
import type { TreePayloadItem } from '@/lib/types'
import { useToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'

interface Props {
  editor: RoadmapEditor
  parentId: string | null // null = top level
  onClose: () => void
  onAdded: (parentId: string | null) => void
}

/** Type or paste anything -> structured items -> appended under `parentId`. */
export function SmartAddDialog({ editor, parentId, onClose, onAdded }: Props) {
  const toast = useToast()
  const parent = parentId ? editor.data?.nodes.find((n) => n.id === parentId) : null
  const [text, setText] = useState('')
  const [descriptions, setDescriptions] = useState(false)
  const [working, setWorking] = useState(false)
  const [items, setItems] = useState<TreePayloadItem[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const structure = async () => {
    const t = text.trim()
    if (!t) return
    setNotice(null)
    if (isCleanMarkdown(t) && !descriptions) {
      const p = parseMarkdown(t)
      setItems(toPayload(withIds(p.items)))
      return
    }
    setWorking(true)
    try {
      const res = await structureWithAI('structure', t, { descriptions, suggestions: false, wording: 'keep' })
      setItems(res.items)
    } catch (e) {
      const p = parseMarkdown(t)
      setItems(toPayload(withIds((p.items.length ? p : parseLines(t)).items)))
      setNotice(`AI failed (${(e as Error).message}), used the simple parser.`)
    } finally {
      setWorking(false)
    }
  }

  const add = async () => {
    if (!items?.length) return
    const n = await editor.insertTree(parentId, positionLastChild(editor.getNodes(), parentId), items)
    toast.show(`Added ${n} item${n === 1 ? '' : 's'}`)
    onAdded(parentId)
    onClose()
  }

  const count = (list: TreePayloadItem[]): number => list.reduce((s, i) => s + 1 + count(i.children), 0)

  return (
    <div className="fixed inset-0 z-40 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-label="Smart add" className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-300" /> Smart add
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              into <span className="text-zinc-300">{parent ? parent.title || 'Untitled' : 'the top level'}</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!items ? (
          <>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) structure()
              }}
              placeholder={'e.g. attention, BERT (tokenizers, fine-tuning), GPT basics\n\nor paste a markdown list'}
              className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 resize-y"
            />
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={descriptions} onChange={(e) => setDescriptions(e.target.checked)} className="accent-amber-400" />
                Add short descriptions
              </label>
              <Button onClick={structure} disabled={!text.trim() || working}>
                {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {working ? 'Structuring…' : 'Structure'}
              </Button>
            </div>
          </>
        ) : (
          <>
            {notice && <p className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900/60 rounded-lg p-2">{notice}</p>}
            <div className="max-h-72 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <PreviewList items={items} depth={0} />
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setItems(null)}>← Edit text</Button>
              <Button variant="primary" onClick={add} disabled={items.length === 0}>
                Add {count(items)} item{count(items) === 1 ? '' : 's'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PreviewList({ items, depth }: { items: TreePayloadItem[]; depth: number }) {
  return (
    <ul className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i}>
          <div className="text-sm" style={{ paddingLeft: depth * 16 }}>
            <span className={it.children.length ? 'font-semibold text-zinc-100' : 'text-zinc-300'}>• {it.title}</span>
            {it.description && <span className="text-xs text-zinc-500"> · {it.description}</span>}
          </div>
          {it.children.length > 0 && <PreviewList items={it.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}
