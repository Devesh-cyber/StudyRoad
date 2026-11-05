import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Check, Flame, Trophy } from 'lucide-react'
import type { RoadmapEditor } from '@/hooks/useRoadmapEditor'
import type { NodeRow } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const DAY_MS = 86_400_000

const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const startOfToday = () => {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

export interface Streaks {
  current: number
  longest: number
  todayIdx: number // 1-based day number for today (may be <1 or > length)
}

/** Current streak counts back from today (or yesterday, if today isn't ticked yet). */
export function computeStreaks(days: NodeRow[], start: string): Streaks {
  const todayIdx = Math.round((startOfToday().getTime() - parseLocalDate(start).getTime()) / DAY_MS) + 1
  const done = new Set(days.filter((d) => d.is_done).map((d) => d.day_number!))

  let longest = 0
  let run = 0
  for (let i = 1; i <= Math.min(todayIdx, days.length); i++) {
    run = done.has(i) ? run + 1 : 0
    longest = Math.max(longest, run)
  }

  let current = 0
  let i = done.has(todayIdx) ? todayIdx : todayIdx - 1
  while (i >= 1 && done.has(i)) {
    current++
    i--
  }
  return { current, longest, todayIdx }
}

export function ChallengeView({ editor }: { editor: RoadmapEditor }) {
  const { roadmap, nodes } = editor.data!
  const start = roadmap.challenge_start_date!
  const days = useMemo(
    () => nodes.filter((n) => n.day_number !== null).sort((a, b) => a.day_number! - b.day_number!),
    [nodes],
  )
  const { current, longest, todayIdx } = computeStreaks(days, start)
  const [selected, setSelected] = useState(() => Math.min(Math.max(todayIdx, 1), days.length))
  const day = days.find((d) => d.day_number === selected)
  const doneCount = days.filter((d) => d.is_done).length

  const [extending, setExtending] = useState(false)
  const [extendTo, setExtendTo] = useState((roadmap.challenge_days ?? days.length) + 50)

  const dateOf = (n: number) =>
    new Date(parseLocalDate(start).getTime() + (n - 1) * DAY_MS).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Flame} label="Current streak" value={`${current} day${current === 1 ? '' : 's'}`} accent={current > 0} />
        <Stat icon={Trophy} label="Longest streak" value={`${longest}`} />
        <Stat icon={Check} label="Days done" value={`${doneCount} / ${days.length}`} />
      </div>

      {todayIdx < 1 && <p className="text-sm text-zinc-400">Starts {dateOf(1)}, in {1 - todayIdx} day{1 - todayIdx === 1 ? '' : 's'}.</p>}
      {todayIdx > days.length && <p className="text-sm text-zinc-400">Challenge finished. Extend it to keep going.</p>}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
        <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
          {days.map((d) => {
            const n = d.day_number!
            const future = n > todayIdx
            const missed = !d.is_done && n < todayIdx
            return (
              <button
                key={d.id}
                onClick={() => setSelected(n)}
                title={`Day ${n} · ${dateOf(n)}${d.notes ? ' · has log' : ''}`}
                aria-label={`Day ${n}${d.is_done ? ', done' : ''}`}
                className={cn(
                  'relative aspect-square rounded-md flex items-center justify-center text-[11px] tabular-nums border cursor-pointer transition-colors',
                  d.is_done
                    ? 'bg-green-600/30 border-green-700 text-green-100 hover:bg-green-600/40'
                    : n === todayIdx
                      ? 'border-amber-300 text-amber-200 hover:bg-amber-300/10'
                      : missed
                        ? 'border-red-950 text-zinc-500 hover:bg-zinc-800'
                        : 'border-zinc-800 text-zinc-600 hover:bg-zinc-800/60',
                  future && 'opacity-60',
                  selected === n && 'ring-2 ring-zinc-300 ring-offset-1 ring-offset-zinc-900',
                )}
              >
                {n}
                {d.notes && <span className="absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full bg-zinc-300" />}
              </button>
            )
          })}
        </div>
      </div>

      {day && <DayPanel key={day.id} day={day} label={`Day ${selected} · ${dateOf(selected)}`} future={selected > todayIdx} editor={editor} />}

      <div className="flex justify-end">
        {!extending ? (
          <Button variant="ghost" size="sm" onClick={() => setExtending(true)} className="text-zinc-400">
            <CalendarPlus className="h-4 w-4 mr-1.5" /> Extend challenge
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Extend to</span>
            <input
              type="number"
              min={days.length + 1}
              max={1000}
              value={extendTo}
              onChange={(e) => setExtendTo(Number(e.target.value))}
              className="w-20 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1 text-zinc-100 focus:outline-none"
            />
            <span className="text-zinc-400">days</span>
            <Button
              size="sm"
              variant="primary"
              disabled={extendTo <= days.length || extendTo > 1000}
              onClick={async () => {
                await editor.extend(extendTo)
                setExtending(false)
              }}
            >
              Extend
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExtending(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Flame; label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className={cn('h-3.5 w-3.5', accent && 'text-amber-300')} /> <span className="truncate">{label}</span>
      </div>
      <p className={cn('text-lg font-semibold tabular-nums mt-0.5', accent ? 'text-amber-200' : 'text-zinc-100')}>{value}</p>
    </div>
  )
}

function DayPanel({ day, label, future, editor }: { day: NodeRow; label: string; future: boolean; editor: RoadmapEditor }) {
  const [log, setLog] = useState(day.notes ?? '')
  useEffect(() => setLog(day.notes ?? ''), [day.notes])

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-zinc-100">{label}</h3>
        <Button
          size="sm"
          variant={day.is_done ? 'outline' : 'primary'}
          disabled={future && !day.is_done}
          title={future ? "Future days can't be ticked yet" : undefined}
          onClick={() => editor.toggleDone(day.id)}
        >
          {day.is_done ? <><Check className="h-4 w-4 mr-1.5 text-green-400" /> Done · undo</> : 'Mark done'}
        </Button>
      </div>
      <textarea
        value={log}
        onChange={(e) => setLog(e.target.value)}
        onBlur={() => (log || null) !== day.notes && editor.updateNode(day.id, { notes: log || null })}
        placeholder={future ? 'Plan for this day…' : 'What did you do today? e.g. CNN lab, 1.5h'}
        className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 resize-y"
      />
    </div>
  )
}
