import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, CornerDownRight, Lightbulb, Plus, Sparkles, Trash2, X } from 'lucide-react'
import type { Draft, DraftItem, DraftSuggestion } from '@/lib/types'
import { countItems, insertUnderTitle, newId, removeItem, updateItem } from '@/lib/tree'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  draft: Draft
  onChange: (d: Draft) => void
  onBack: () => void
  onCreate: () => void
  creating: boolean
  error?: string | null
}

export function DraftPreview({ draft, onChange, onBack, onCreate, creating, error }: Props) {
  const setItems = (items: DraftItem[]) => onChange({ ...draft, items })

  const acceptSuggestion = (s: DraftSuggestion) => {
    const child: DraftItem = { id: newId(), title: s.title, description: s.description, children: [] }
    onChange({
      ...draft,
      items: insertUnderTitle(draft.items, s.parent_title, child),
      suggestions: draft.suggestions.filter((x) => x.id !== s.id),
    })
  }
  const dismissSuggestion = (s: DraftSuggestion) =>
    onChange({ ...draft, suggestions: draft.suggestions.filter((x) => x.id !== s.id) })

  const total = countItems(draft.items)
  const canCreate = draft.title.trim().length > 0 && !creating

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-4">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer">
          ← Back to input
        </button>
        <span className="text-xs text-zinc-500 flex items-center gap-1.5">
          {draft.source === 'ai' ? (
            <><Sparkles className="h-3.5 w-3.5 text-amber-300" /> Structured by AI</>
          ) : (
            'Parsed locally'
          )}
        </span>
      </div>

      {draft.notice && (
        <div className="p-3 rounded-lg border border-amber-900/60 bg-amber-950/30 text-amber-200 text-sm">
          {draft.notice}
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">Roadmap title</label>
          <input
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            placeholder="e.g. ML / DL — my way"
            className="w-full bg-transparent text-2xl font-bold text-zinc-100 focus:outline-none placeholder:text-zinc-700"
          />
        </div>

        <p className="text-xs text-zinc-500">
          {total} items · click any text to rename · this is a preview, nothing is saved until you click Create
        </p>

        <div className="space-y-0.5">
          {draft.items.map((item) => (
            <DraftRow key={item.id} item={item} depth={0} items={draft.items} setItems={setItems} />
          ))}
        </div>

        <button
          onClick={() => setItems([...draft.items, { id: newId(), title: '', children: [] }])}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer pt-1"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      </div>

      {draft.suggestions.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-300" /> Suggestions ({draft.suggestions.length})
            </h3>
            <button
              onClick={() => onChange(acceptAll(draft))}
              className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Accept all
            </button>
          </div>
          <p className="text-xs text-zinc-500">Not added unless you accept them.</p>
          {draft.suggestions.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <div className="min-w-0">
                <p className="text-sm text-zinc-200">{s.title}</p>
                <p className="text-xs text-zinc-500">
                  {s.parent_title ? <>under <span className="text-zinc-400">{s.parent_title}</span></> : 'top level'}
                  {s.reason && <> · {s.reason}</>}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => acceptSuggestion(s)} title="Accept" className="p-1.5 rounded hover:bg-zinc-800 text-green-400 cursor-pointer">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => dismissSuggestion(s)} title="Dismiss" className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg border border-red-900 bg-red-950/40 text-red-300 text-sm">{error}</div>
      )}

      <div className="flex justify-end">
        <Button onClick={onCreate} disabled={!canCreate} variant="primary">
          {creating ? 'Creating…' : `Create roadmap (${total} items)`}
        </Button>
      </div>
    </div>
  )
}

function acceptAll(draft: Draft): Draft {
  let items = draft.items
  for (const s of draft.suggestions) {
    items = insertUnderTitle(items, s.parent_title, { id: newId(), title: s.title, description: s.description, children: [] })
  }
  return { ...draft, items, suggestions: [] }
}

function DraftRow({
  item,
  depth,
  items,
  setItems,
}: {
  item: DraftItem
  depth: number
  items: DraftItem[]
  setItems: (i: DraftItem[]) => void
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = item.children.length > 0
  const patch = (p: Partial<DraftItem>) => setItems(updateItem(items, item.id, p))

  return (
    <div>
      <div
        className="group flex items-start gap-2 py-1 rounded hover:bg-zinc-800/40 pr-1"
        style={{ paddingLeft: `${Math.min(depth, 6) * 20}px` }}
      >
        <button
          onClick={() => setOpen(!open)}
          className={cn('mt-1 text-zinc-600 hover:text-zinc-300 cursor-pointer', !hasChildren && 'invisible')}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {!hasChildren && (
          <input
            type="checkbox"
            checked={!!item.is_done}
            onChange={(e) => patch({ is_done: e.target.checked })}
            className="mt-1.5 accent-amber-400 cursor-pointer"
            title="Already done"
          />
        )}

        <div className="flex-1 min-w-0">
          <input
            value={item.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Untitled item"
            autoFocus={item.title === ''}
            className={cn(
              'w-full bg-transparent focus:outline-none focus:bg-zinc-800/60 rounded px-1 placeholder:text-zinc-700',
              hasChildren ? 'font-semibold text-zinc-100' : 'text-zinc-200',
              item.is_done && !hasChildren && 'text-zinc-500 line-through',
            )}
          />
          {item.description !== undefined && (
            <input
              value={item.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Description"
              className="w-full bg-transparent text-xs text-zinc-500 focus:outline-none focus:bg-zinc-800/60 rounded px-1"
            />
          )}
        </div>

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => {
              patch({ children: [...item.children, { id: newId(), title: '', children: [] }] })
              setOpen(true)
            }}
            title="Add sub-item"
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
          >
            <CornerDownRight className="h-3.5 w-3.5" />
          </button>
          {item.description === undefined && (
            <button
              onClick={() => patch({ description: '' })}
              title="Add description"
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer text-[11px] font-mono"
            >
              ¶
            </button>
          )}
          <button
            onClick={() => setItems(removeItem(items, item.id))}
            title={hasChildren ? 'Delete item and its sub-items' : 'Delete item'}
            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open &&
        item.children.map((c) => (
          <DraftRow key={c.id} item={c} depth={depth + 1} items={items} setItems={setItems} />
        ))}
    </div>
  )
}
