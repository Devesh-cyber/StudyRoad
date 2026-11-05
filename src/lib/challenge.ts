import type { NodeRow } from './types'

export const DAY_MS = 86_400_000

export const parseLocalDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const startOfToday = () => {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

/** Day number for today (1-based). May be < 1 (not started) or > length (finished). */
export const todayIndex = (start: string) =>
  Math.round((startOfToday().getTime() - parseLocalDate(start).getTime()) / DAY_MS) + 1

export const dateOfDay = (start: string, n: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(parseLocalDate(start).getTime() + (n - 1) * DAY_MS).toLocaleDateString(undefined, opts)

export interface Streaks {
  current: number
  longest: number
  todayIdx: number
}

/** Current streak counts back from today (or from yesterday if today isn't ticked yet). */
export function computeStreaks(days: NodeRow[], start: string): Streaks {
  const todayIdx = todayIndex(start)
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

export const challengeDays = (nodes: NodeRow[]) =>
  nodes.filter((n) => n.day_number !== null).sort((a, b) => a.day_number! - b.day_number!)
