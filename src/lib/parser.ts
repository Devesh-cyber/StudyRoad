// Local markdown -> roadmap tree parser (no AI, instant, free).
//
// Used as:
//   1. the fast path when pasted text is already clean markdown
//   2. the fallback when the AI function fails
//
// Supports:
//   # / ## / ### ... headings at any level
//   **Bold line** section labels (sit between headings and lists)
//   nested lists with -, *, +, 1. or 1)  (any indentation depth)
//   checkboxes: - [x] done   - [ ] not done
//   ```markdown fences (ignored)
// The first heading becomes the roadmap title when it's the only H1.

export interface ParsedItem {
  title: string
  description?: string
  is_done?: boolean
  children: ParsedItem[]
}

export interface ParsedRoadmap {
  title: string | null
  items: ParsedItem[]
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const LIST = /^(\s*)(?:[-*+•]|\d+[.)])\s+(.*)$/
const CHECKBOX = /^\[( |x|X)\]\s*(.*)$/
const BOLD_LINE = /^\*\*(.+?)\*\*:?\s*$/
const FENCE = /^\s*(```|~~~)/

// Levels: headings 1-6, bold labels 7, lists 100 + indent
const BOLD_LEVEL = 7
const LIST_BASE = 100

function cleanTitle(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [text](url) -> text
    .replace(/(\*\*|__)(.+?)\1/g, '$2') // **bold**
    .replace(/(^|\s)[*_](\S.*?\S|\S)[*_](?=\s|$)/g, '$1$2') // *italic*
    .replace(/`([^`]+)`/g, '$1')
    .replace(/:\s*$/, '')
    .trim()
}

function indentOf(ws: string): number {
  return ws.replace(/\t/g, '    ').length
}

export function parseMarkdown(text: string): ParsedRoadmap {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  // Use the first heading as title only if it's an H1 and the only H1.
  const h1s = lines.filter((l) => /^#\s+/.test(l.trim()))
  const firstHeading = lines.find((l) => HEADING.test(l.trim()))
  const titleFromH1 = h1s.length === 1 && firstHeading?.trim().startsWith('# ')

  let title: string | null = null
  const root: ParsedItem = { title: '', children: [] }
  const stack: { level: number; item: ParsedItem }[] = [{ level: 0, item: root }]
  let lastItem: ParsedItem | null = null
  let lastIndent = -1

  const push = (level: number, item: ParsedItem) => {
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop()
    stack[stack.length - 1].item.children.push(item)
    stack.push({ level, item })
    lastItem = item
  }

  for (const rawLine of lines) {
    if (FENCE.test(rawLine)) continue
    const line = rawLine.trimEnd()
    if (!line.trim()) continue
    const trimmed = line.trim()

    const h = HEADING.exec(trimmed)
    if (h) {
      const level = h[1].length
      const t = cleanTitle(h[2])
      if (!t) continue
      if (level === 1 && titleFromH1 && title === null) {
        title = t
        continue
      }
      push(level, { title: t, children: [] })
      lastIndent = -1
      continue
    }

    const l = LIST.exec(line)
    if (l) {
      const indent = indentOf(l[1])
      let body = l[2]
      let done: boolean | undefined
      const cb = CHECKBOX.exec(body)
      if (cb) {
        done = cb[1].toLowerCase() === 'x'
        body = cb[2]
      }
      const t = cleanTitle(body)
      if (!t) continue
      const item: ParsedItem = { title: t, children: [] }
      if (done) item.is_done = true
      push(LIST_BASE + indent, item)
      lastIndent = indent
      continue
    }

    const b = BOLD_LINE.exec(trimmed)
    if (b) {
      const t = cleanTitle(b[1])
      if (t) push(BOLD_LEVEL, { title: t, children: [] })
      lastIndent = -1
      continue
    }

    // Indented plain text right under a list item = continuation -> description.
    if (lastItem && lastIndent >= 0 && indentOf(line.match(/^\s*/)![0]) > lastIndent) {
      const extra = cleanTitle(trimmed)
      const li = lastItem as ParsedItem
      li.description = li.description ? `${li.description} ${extra}` : extra
    }
    // Any other plain text (chatter, intros) is ignored.
  }

  return { title, items: root.children }
}

/**
 * Is this text already clean markdown? If so we can skip the AI.
 * Rule: at least 2 structural lines, and >= 85% of non-empty lines are
 * headings / list items / bold labels / fences.
 */
export function isCleanMarkdown(text: string): boolean {
  const all = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() && !FENCE.test(l))
  const isStructural = (l: string) => {
    const t = l.trim()
    return HEADING.test(t) || LIST.test(l) || BOLD_LINE.test(t)
  }
  // Ignore chatter before the first / after the last structural line
  // ("Sure! Here's your roadmap:", "Good luck!").
  const first = all.findIndex(isStructural)
  if (first < 0) return false
  let last = all.length - 1
  while (!isStructural(all[last])) last--
  const body = all.slice(first, last + 1)
  const structural = body.filter(isStructural).length
  return structural >= 2 && structural / body.length >= 0.85
}

/** Last-resort parse: every non-empty line becomes a top-level item. */
export function parseLines(text: string): ParsedRoadmap {
  const items = text
    .split('\n')
    .map((l) => cleanTitle(l.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '')))
    .filter(Boolean)
    .map((title) => ({ title, children: [] }))
  return { title: null, items }
}
