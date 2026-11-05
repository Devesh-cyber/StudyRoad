// Pure tree operations on the flat `nodes` array. No React, no Supabase.
// Every move returns a {parent_id, position} patch for ONE node, thanks to
// fractional positions (new position = midpoint of the neighbours).

import type { NodeRow } from './types'

export interface MovePatch {
  parent_id: string | null
  position: number
}

const byPos = (a: NodeRow, b: NodeRow) => a.position - b.position

export function childrenOf(nodes: NodeRow[], parentId: string | null): NodeRow[] {
  return nodes.filter((n) => n.parent_id === parentId).sort(byPos)
}

/** A position strictly between a and b (either may be missing). */
export function between(a?: number, b?: number): number {
  if (a === undefined && b === undefined) return 1
  if (a === undefined) return b! - 1
  if (b === undefined) return a + 1
  return (a + b) / 2
}

export function descendantIds(nodes: NodeRow[], id: string): string[] {
  const out: string[] = []
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const n of nodes) {
      if (n.parent_id === cur) {
        out.push(n.id)
        stack.push(n.id)
      }
    }
  }
  return out
}

export function ancestorIds(nodes: NodeRow[], id: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: string[] = []
  let cur = byId.get(id)?.parent_id ?? null
  while (cur) {
    out.push(cur)
    cur = byId.get(cur)?.parent_id ?? null
  }
  return out
}

export function hasChildren(nodes: NodeRow[], id: string): boolean {
  return nodes.some((n) => n.parent_id === id)
}

/** Leaf ids under (and including, if it is a leaf) a node. */
export function leafIds(nodes: NodeRow[], id: string): string[] {
  const all = [id, ...descendantIds(nodes, id)]
  const parents = new Set(nodes.map((n) => n.parent_id).filter(Boolean) as string[])
  return all.filter((x) => !parents.has(x))
}

export interface VisibleRow {
  node: NodeRow
  depth: number
  hasChildren: boolean
}

/** Depth-first order of rows that are not hidden inside a collapsed parent. */
export function visibleRows(nodes: NodeRow[], collapsed: Set<string>, rootId: string | null = null): VisibleRow[] {
  const kids = new Map<string | null, NodeRow[]>()
  for (const n of nodes) {
    const k = n.parent_id
    if (!kids.has(k)) kids.set(k, [])
    kids.get(k)!.push(n)
  }
  kids.forEach((list) => list.sort(byPos))

  const out: VisibleRow[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const n of kids.get(parent) ?? []) {
      const hc = (kids.get(n.id)?.length ?? 0) > 0
      out.push({ node: n, depth, hasChildren: hc })
      if (hc && !collapsed.has(n.id)) walk(n.id, depth + 1)
    }
  }
  walk(rootId, 0)
  return out
}

export interface Progress {
  done: number
  total: number
}

/** {done,total} of LEAVES for every node, computed in one pass. */
export function progressMap(nodes: NodeRow[]): Map<string, Progress> {
  const kids = new Map<string, NodeRow[]>()
  for (const n of nodes) {
    if (n.parent_id) {
      if (!kids.has(n.parent_id)) kids.set(n.parent_id, [])
      kids.get(n.parent_id)!.push(n)
    }
  }
  const memo = new Map<string, Progress>()
  const calc = (n: NodeRow): Progress => {
    const cached = memo.get(n.id)
    if (cached) return cached
    const c = kids.get(n.id)
    const p: Progress = c
      ? c.reduce((acc, k) => {
          const kp = calc(k)
          return { done: acc.done + kp.done, total: acc.total + kp.total }
        }, { done: 0, total: 0 })
      : { done: n.is_done ? 1 : 0, total: 1 }
    memo.set(n.id, p)
    return p
  }
  nodes.forEach(calc)
  return memo
}

export function overallProgress(nodes: NodeRow[]): Progress {
  const parents = new Set(nodes.map((n) => n.parent_id).filter(Boolean))
  const leaves = nodes.filter((n) => !parents.has(n.id))
  return { done: leaves.filter((n) => n.is_done).length, total: leaves.length }
}

// ---------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------

function find(nodes: NodeRow[], id: string) {
  const node = nodes.find((n) => n.id === id)
  if (!node) return null
  const sibs = childrenOf(nodes, node.parent_id)
  return { node, sibs, idx: sibs.findIndex((s) => s.id === id) }
}

/** Tab: become the last child of the previous sibling. */
export function indentPatch(nodes: NodeRow[], id: string): MovePatch | null {
  const f = find(nodes, id)
  if (!f || f.idx === 0) return null
  const newParent = f.sibs[f.idx - 1]
  const kids = childrenOf(nodes, newParent.id)
  return { parent_id: newParent.id, position: between(kids.slice(-1)[0]?.position, undefined) }
}

/** Shift+Tab: become the next sibling of the current parent. */
export function outdentPatch(nodes: NodeRow[], id: string): MovePatch | null {
  const f = find(nodes, id)
  if (!f || !f.node.parent_id) return null
  const parent = find(nodes, f.node.parent_id)
  if (!parent) return null
  return {
    parent_id: parent.node.parent_id,
    position: between(parent.node.position, parent.sibs[parent.idx + 1]?.position),
  }
}

export function moveUpPatch(nodes: NodeRow[], id: string): MovePatch | null {
  const f = find(nodes, id)
  if (!f || f.idx === 0) return null
  return { parent_id: f.node.parent_id, position: between(f.sibs[f.idx - 2]?.position, f.sibs[f.idx - 1].position) }
}

export function moveDownPatch(nodes: NodeRow[], id: string): MovePatch | null {
  const f = find(nodes, id)
  if (!f || f.idx === f.sibs.length - 1) return null
  return { parent_id: f.node.parent_id, position: between(f.sibs[f.idx + 1].position, f.sibs[f.idx + 2]?.position) }
}

export type DropZone = 'before' | 'inside' | 'after'

/** Drag `dragId` onto `targetId`. Returns null for illegal drops (onto itself / own subtree). */
export function dropPatch(nodes: NodeRow[], dragId: string, targetId: string, zone: DropZone): MovePatch | null {
  if (dragId === targetId) return null
  if (descendantIds(nodes, dragId).includes(targetId)) return null
  const target = nodes.find((n) => n.id === targetId)
  if (!target) return null
  const others = nodes.filter((n) => n.id !== dragId)

  if (zone === 'inside') {
    const kids = childrenOf(others, target.id)
    return { parent_id: target.id, position: between(kids.slice(-1)[0]?.position, undefined) }
  }
  const sibs = childrenOf(others, target.parent_id)
  const i = sibs.findIndex((s) => s.id === targetId)
  return zone === 'before'
    ? { parent_id: target.parent_id, position: between(sibs[i - 1]?.position, target.position) }
    : { parent_id: target.parent_id, position: between(target.position, sibs[i + 1]?.position) }
}

/** Position for a new sibling right after `id`. */
export function positionAfter(nodes: NodeRow[], id: string): MovePatch | null {
  const f = find(nodes, id)
  if (!f) return null
  return { parent_id: f.node.parent_id, position: between(f.node.position, f.sibs[f.idx + 1]?.position) }
}

/** Position for a new last child of `parentId` (null = top level). */
export function positionLastChild(nodes: NodeRow[], parentId: string | null): number {
  return between(childrenOf(nodes, parentId).slice(-1)[0]?.position, undefined)
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

/** Markdown that re-imports cleanly via the Paste tab (checkboxes kept). */
export function toMarkdown(title: string, nodes: NodeRow[]): string {
  const lines = [`# ${title}`, '']
  const walk = (parent: string | null, depth: number) => {
    for (const n of childrenOf(nodes, parent)) {
      const leaf = !hasChildren(nodes, n.id)
      const box = leaf ? (n.is_done ? '[x] ' : '[ ] ') : ''
      lines.push(`${'  '.repeat(depth)}- ${box}${n.title || 'Untitled'}`)
      walk(n.id, depth + 1)
    }
  }
  walk(null, 0)
  return lines.join('\n') + '\n'
}
