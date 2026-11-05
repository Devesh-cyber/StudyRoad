import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ClipboardPaste, Copy, Check, FilePlus2, Loader2, Sparkles, Upload } from 'lucide-react'
import { createRoadmap, structureWithAI, type CreatePayload, type StructureOptions } from '@/lib/api'
import { isCleanMarkdown, parseLines, parseMarkdown } from '@/lib/parser'
import { newId, toPayload, withIds } from '@/lib/tree'
import { ROADMAP_PROMPT } from '@/lib/roadmapPrompt'
import type { Draft } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { DraftPreview } from '@/components/DraftPreview'
import { cn } from '@/lib/utils'

type Tab = 'paste' | 'blank' | 'challenge'

const todayLocal = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

export function NewRoadmapPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [tab, setTab] = useState<Tab>('paste')
  const [draft, setDraft] = useState<Draft | null>(null)

  // paste
  const [pasteText, setPasteText] = useState('')
  const [options, setOptions] = useState<StructureOptions>({ descriptions: false, suggestions: false, wording: 'keep' })
  // blank
  const [blankTitle, setBlankTitle] = useState('')
  const [describeText, setDescribeText] = useState('')
  // challenge
  const [chTitle, setChTitle] = useState('100 Days of ')
  const [chDays, setChDays] = useState(100)
  const [chStart, setChStart] = useState(todayLocal())
  const [chDescription, setChDescription] = useState('')

  const [working, setWorking] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (payload: CreatePayload) => createRoadmap(payload),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['summaries'] })
      navigate(`/r/${id}`)
    },
  })

  // ------------------------------------------------------------------
  // Paste -> draft
  // ------------------------------------------------------------------
  const handleStructure = async () => {
    const text = pasteText.trim()
    if (!text) return
    setInputError(null)

    const wantsAI = options.descriptions || options.suggestions || options.wording === 'clean'

    // Fast path: already clean markdown and no AI extras -> parse locally, instantly.
    if (isCleanMarkdown(text) && !wantsAI) {
      const parsed = parseMarkdown(text)
      if (parsed.items.length > 0) {
        setDraft({ title: parsed.title ?? '', items: withIds(parsed.items), suggestions: [], source: 'local' })
        return
      }
    }

    setWorking(true)
    try {
      const res = await structureWithAI('structure', text, options)
      setDraft({
        title: res.title,
        items: withIds(res.items),
        suggestions: res.suggestions.map((s) => ({ ...s, id: newId() })),
        source: 'ai',
      })
    } catch (e) {
      // Fallback: never leave the user stuck.
      const parsed = parseMarkdown(text)
      const fallback = parsed.items.length > 0 ? parsed : parseLines(text)
      setDraft({
        title: fallback.title ?? '',
        items: withIds(fallback.items),
        suggestions: [],
        source: 'local',
        notice: `AI structuring failed (${(e as Error).message}). Used the simple parser instead. Fix things up below, or go back and try again.`,
      })
    } finally {
      setWorking(false)
    }
  }

  // ------------------------------------------------------------------
  // Blank: describe -> draft, or create empty
  // ------------------------------------------------------------------
  const handleGenerate = async () => {
    const text = describeText.trim()
    if (!text) return
    setInputError(null)
    setWorking(true)
    try {
      const res = await structureWithAI('describe', text, {
        descriptions: options.descriptions,
        suggestions: options.suggestions,
        wording: 'keep',
      })
      setDraft({
        title: blankTitle.trim() || res.title,
        items: withIds(res.items),
        suggestions: res.suggestions.map((s) => ({ ...s, id: newId() })),
        source: 'ai',
      })
    } catch (e) {
      setInputError(`Couldn't generate a draft: ${(e as Error).message}`)
    } finally {
      setWorking(false)
    }
  }

  const handleCreateEmpty = () => {
    if (!blankTitle.trim()) return
    create.mutate({ kind: 'tree', title: blankTitle.trim(), items: [] })
  }

  const handleCreateChallenge = () => {
    if (!chTitle.trim() || chDays < 1) return
    create.mutate({
      kind: 'challenge',
      title: chTitle.trim(),
      description: chDescription.trim() || undefined,
      challenge_days: chDays,
      challenge_start_date: chStart,
    })
  }

  const handleCreateFromDraft = () => {
    if (!draft) return
    create.mutate({ kind: 'tree', title: draft.title.trim(), items: toPayload(draft.items) })
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (draft) {
    return (
      <div className="max-w-3xl mx-auto">
        <DraftPreview
          draft={draft}
          onChange={setDraft}
          onBack={() => {
            setDraft(null)
            create.reset()
          }}
          onCreate={handleCreateFromDraft}
          creating={create.isPending}
          error={create.error ? `Couldn't save: ${(create.error as Error).message}` : null}
        />
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof ClipboardPaste; hint: string }[] = [
    { id: 'paste', label: 'Paste', icon: ClipboardPaste, hint: 'From ChatGPT, notes, anything' },
    { id: 'blank', label: 'Blank', icon: FilePlus2, hint: 'Start empty or describe it' },
    { id: 'challenge', label: 'Challenge', icon: CalendarDays, hint: '100 days, daily ticks' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Dashboard
        </Link>
      </div>
      <h2 className="text-2xl font-bold text-zinc-100">New roadmap</h2>

      <div className="grid grid-cols-3 gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id)
              setInputError(null)
            }}
            className={cn(
              'p-3 min-w-0 rounded-xl border text-left transition-colors cursor-pointer',
              tab === t.id ? 'border-amber-300/60 bg-amber-300/5' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700',
            )}
          >
            <div className={cn('flex items-center gap-2 font-medium text-sm sm:text-base', tab === t.id ? 'text-amber-200' : 'text-zinc-200')}>
              <t.icon className="h-4 w-4 flex-shrink-0 hidden sm:block" /> <span className="truncate">{t.label}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 hidden sm:block">{t.hint}</p>
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        {tab === 'paste' && (
          <>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm text-zinc-300">Paste your roadmap, in any format</label>
              <div className="flex gap-1">
                <CopyPromptButton />
                <UploadMdButton onText={setPasteText} />
              </div>
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'# ML / DL — my way\n## Math\n- Linear algebra\n- [x] Probability\n\n…or messy notes like:\nDL - nn from scratch, then pytorch, cnn (lenet, resnet)'}
              className="w-full h-72 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 resize-y"
            />
            <AIOptions options={options} setOptions={setOptions} showWording />
            <div className="flex justify-between items-center gap-3">
              <p className="text-xs text-zinc-500">
                Clean markdown is parsed instantly. Anything else, or any option above, goes through AI.
              </p>
              <Button onClick={handleStructure} disabled={!pasteText.trim() || working} className="flex-shrink-0">
                {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {working ? 'Structuring…' : 'Structure it'}
              </Button>
            </div>
          </>
        )}

        {tab === 'blank' && (
          <>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Title</label>
              <input
                value={blankTitle}
                onChange={(e) => setBlankTitle(e.target.value)}
                placeholder="e.g. Internship prep"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleCreateEmpty} disabled={!blankTitle.trim() || create.isPending}>
                Create empty roadmap
              </Button>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <div className="h-px bg-zinc-800 flex-1" /> or let AI draft it <div className="h-px bg-zinc-800 flex-1" />
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-1">Describe what you want</label>
              <textarea
                value={describeText}
                onChange={(e) => setDescribeText(e.target.value)}
                placeholder="e.g. Deep learning by January, my way: NN from scratch in NumPy first, then PyTorch, CNNs with 2 projects, skip heavy math proofs. I already know classic ML."
                className="w-full h-36 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 resize-y"
              />
            </div>
            <AIOptions options={options} setOptions={setOptions} />
            <div className="flex justify-end">
              <Button onClick={handleGenerate} disabled={!describeText.trim() || working}>
                {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {working ? 'Generating…' : 'Generate draft'}
              </Button>
            </div>
          </>
        )}

        {tab === 'challenge' && (
          <>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Name</label>
              <input
                value={chTitle}
                onChange={(e) => setChTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-300 mb-1">Days</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={chDays}
                  onChange={(e) => setChDays(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300 mb-1">Start date</label>
                <input
                  type="date"
                  value={chStart}
                  onChange={(e) => setChStart(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600 [color-scheme:dark]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">What's the challenge? (optional)</label>
              <input
                value={chDescription}
                onChange={(e) => setChDescription(e.target.value)}
                placeholder="e.g. 1 hour of ML + a commit every day"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleCreateChallenge}
                disabled={!chTitle.trim() || chDays < 1 || chDays > 1000 || create.isPending}
                variant="primary"
              >
                {create.isPending ? 'Creating…' : `Create ${chDays}-day challenge`}
              </Button>
            </div>
          </>
        )}

        {(inputError || (create.error && !draft)) && (
          <div className="p-3 rounded-lg border border-red-900 bg-red-950/40 text-red-300 text-sm">
            {inputError ?? `Couldn't save: ${(create.error as Error).message}`}
          </div>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------

function AIOptions({
  options,
  setOptions,
  showWording,
}: {
  options: StructureOptions
  setOptions: (o: StructureOptions) => void
  showWording?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={options.descriptions}
          onChange={(e) => setOptions({ ...options, descriptions: e.target.checked })}
          className="accent-amber-400"
        />
        Add short descriptions
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={options.suggestions}
          onChange={(e) => setOptions({ ...options, suggestions: e.target.checked })}
          className="accent-amber-400"
        />
        Suggest missing items
      </label>
      {showWording && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.wording === 'clean'}
            onChange={(e) => setOptions({ ...options, wording: e.target.checked ? 'clean' : 'keep' })}
            className="accent-amber-400"
          />
          Clean up my wording
        </label>
      )}
    </div>
  )
}

function CopyPromptButton() {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost"
      size="sm"
      title="Copy a prompt to use in ChatGPT / Claude"
      onClick={() => {
        navigator.clipboard.writeText(ROADMAP_PROMPT)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="text-xs text-zinc-400"
    >
      {copied ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
      {copied ? 'Copied' : 'ChatGPT prompt'}
    </Button>
  )
}

function UploadMdButton({ onText }: { onText: (t: string) => void }) {
  return (
    <label className="inline-flex items-center rounded-md py-1.5 px-3 text-xs text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 cursor-pointer">
      <Upload className="h-3.5 w-3.5 mr-1.5" /> .md file
      <input
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) onText(await f.text())
          e.target.value = ''
        }}
      />
    </label>
  )
}
