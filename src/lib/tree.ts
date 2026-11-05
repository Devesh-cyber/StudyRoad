import type { DraftItem, NodeRow, TreePayloadItem } from './types'

// ---------------------------------------------------------------------
// Saved roadmaps: flat rows from Supabase -> nested tree
// ---------------------------------------------------------------------

export interface TreeNode extends NodeRow {
  children: TreeNode[]
}

export function buildTree(rows: NodeRow[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  for (const r of rows) byId.set(r.id, { ...r, children: [] })

  const roots: TreeNode[] = []
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.position - b.position)
    list.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

export interface Progress {
  done: number
  total: number
}

/** Counts LEAF items only, matching the roadmap_summaries view. */
export function progressOf(node: { is_done?: boolean; children: { children: unknown[] }[] }): Progress {
  const walk = (n: any): Progress => {
    if (!n.children || n.children.length === 0) return { done: n.is_done ? 1 : 0, total: 1 }
    return n.children.reduce(
      (acc: Progress, c: any) => {
        const p = walk(c)
        return { done: acc.done + p.done, total: acc.total + p.total }
      },
      { done: 0, total: 0 },
    )
  }
  return walk(node)
}

export function progressOfList(nodes: { is_done?: boolean; children: any[] }[]): Progress {
  return progressOf({ children: nodes })
}

export const percent = (p: Progress) => (p.total === 0 ? 0 : Math.round((p.done / p.total) * 100))

/** A parent counts as done when all its leaves are done. */
export const isDone = (node: { is_done?: boolean; children: any[] }) => {
  if (node.children.length === 0) return !!node.is_done
  const p = progressOf(node)
  return p.total > 0 && p.done === p.total
}

// ---------------------------------------------------------------------
// Drafts (preview before saving)
// ---------------------------------------------------------------------

let counter = 0
export const newId = () => `d${Date.now().toString(36)}${(counter++).toString(36)}`

/** Give every item a client id (input may come from the parser or the AI). */
export function withIds(items: Omit<DraftItem, 'id'>[] | TreePayloadItem[]): DraftItem[] {
  return items.map((i) => ({
    id: newId(),
    title: i.title,
    description: i.description,
    is_done: i.is_done,
    children: withIds(i.children ?? []),
  }))
}

/** Strip client ids and empty titles -> RPC payload. */
export function toPayload(items: DraftItem[]): TreePayloadItem[] {
  return items
    .filter((i) => i.title.trim().length > 0)
    .map((i) => {
      const out: TreePayloadItem = { title: i.title.trim(), children: toPayload(i.children) }
      if (i.description?.trim()) out.description = i.description.trim()
      if (i.is_done) out.is_done = true
      return out
    })
}

export function countItems(items: DraftItem[]): number {
  return items.reduce((n, i) => n + 1 + countItems(i.children), 0)
}

/** Immutable update of one item anywhere in the tree. */
export function updateItem(items: DraftItem[], id: string, patch: Partial<DraftItem>): DraftItem[] {
  return items.map((i) =>
    i.id === id ? { ...i, ...patch } : { ...i, children: updateItem(i.children, id, patch) },
  )
}

/** Immutable removal of one item (and its subtree). */
export function removeItem(items: DraftItem[], id: string): DraftItem[] {
  return items
    .filter((i) => i.id !== id)
    .map((i) => ({ ...i, children: removeItem(i.children, id) }))
}

/** Append `child` under the first item whose title matches; top level if not found. */
export function insertUnderTitle(items: DraftItem[], parentTitle: string | null, child: DraftItem): DraftItem[] {
  if (parentTitle) {
    let inserted = false
    const rec = (list: DraftItem[]): DraftItem[] =>
      list.map((i) => {
        if (inserted) return i
        if (i.title === parentTitle) {
          inserted = true
          return { ...i, children: [...i.children, child] }
        }
        return { ...i, children: rec(i.children) }
      })
    const next = rec(items)
    if (inserted) return next
  }
  return [...items, child]
}
