// All reads + writes for one roadmap page.
//
// Every write is OPTIMISTIC: the React Query cache is updated first, the UI
// re-renders instantly, then Supabase is called. On failure the cache rolls
// back to the snapshot and an error toast is shown.
//
// Ordering guarantees:
//  * A new item's INSERT may still be in flight when you start typing in it,
//    so updates / deletes / child inserts wait for that INSERT first.
//  * Deletes are delayed 5s for Undo, and flushed immediately if you leave the page.

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteNodes,
  extendChallenge,
  fetchRoadmap,
  insertNodes,
  updateNodes,
  updateRoadmap,
  type NodeInsert,
  type NodePatch,
  type RoadmapPatch,
} from '@/lib/api'
import { descendantIds, hasChildren, leafIds } from '@/lib/editorOps'
import type { NodeRow, RoadmapRow, TreePayloadItem } from '@/lib/types'
import { useToast } from '@/lib/toast'

type Data = { roadmap: RoadmapRow; nodes: NodeRow[] }

const UNDO_MS = 5000

export function newNodeRow(roadmapId: string, parentId: string | null, position: number, title = ''): NodeRow {
  return {
    id: crypto.randomUUID(),
    roadmap_id: roadmapId,
    parent_id: parentId,
    position,
    title,
    description: null,
    notes: null,
    is_done: false,
    done_at: null,
    due_date: null,
    tags: [],
    day_number: null,
  }
}

export function useRoadmapEditor(roadmapId: string) {
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['roadmap', roadmapId]

  const query = useQuery({ queryKey: key, queryFn: () => fetchRoadmap(roadmapId) })

  // id -> promise of its INSERT (so later writes can wait for it)
  const pendingInserts = useRef(new Map<string, Promise<void>>())
  // id -> scheduled delete
  const pendingDeletes = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>())

  const get = () => qc.getQueryData<Data>(key)
  const setNodes = (fn: (n: NodeRow[]) => NodeRow[]) =>
    qc.setQueryData<Data>(key, (old) => (old ? { ...old, nodes: fn(old.nodes) } : old))
  const setRoadmap = (fn: (r: RoadmapRow) => RoadmapRow) =>
    qc.setQueryData<Data>(key, (old) => (old ? { ...old, roadmap: fn(old.roadmap) } : old))

  const waitFor = async (ids: (string | null | undefined)[]) => {
    const ps = ids.map((id) => (id ? pendingInserts.current.get(id) : undefined)).filter(Boolean)
    if (ps.length) await Promise.allSettled(ps as Promise<void>[])
  }

  /** optimistic -> remote -> rollback on error */
  const run = async (optimistic: () => void, remote: () => Promise<void>, failMsg: string) => {
    const snapshot = get()
    optimistic()
    try {
      await remote()
      qc.invalidateQueries({ queryKey: ['summaries'] })
    } catch (e) {
      if (snapshot) qc.setQueryData(key, snapshot)
      toast.error(`${failMsg}: ${(e as Error).message}`)
      throw e
    }
  }
  const safe = (p: Promise<unknown>) => p.catch(() => {}) // errors already toasted

  // -------------------------------------------------------------------
  // Nodes
  // -------------------------------------------------------------------

  const updateNode = (id: string, patch: NodePatch) =>
    safe(
      run(
        () => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n))),
        async () => {
          await waitFor([id])
          await updateNodes([id], patch)
        },
        "Couldn't save",
      ),
    )

  /** Create one empty (or titled) item. Returns its id immediately. */
  const createNode = (parentId: string | null, position: number, title = ''): string => {
    const row = newNodeRow(roadmapId, parentId, position, title)
    const p = run(
      () => setNodes((ns) => [...ns, row]),
      async () => {
        await waitFor([parentId])
        await insertNodes([{ id: row.id, roadmap_id: roadmapId, parent_id: parentId, position, title }])
      },
      "Couldn't add item",
    ).finally(() => pendingInserts.current.delete(row.id))
    pendingInserts.current.set(row.id, p.catch(() => {}))
    return row.id
  }

  /** Insert a whole subtree (Smart add). One atomic insert. */
  const insertTree = (parentId: string | null, startPosition: number, items: TreePayloadItem[]) => {
    const rows: NodeRow[] = []
    const walk = (list: TreePayloadItem[], parent: string | null, base: number, step: number) => {
      list.forEach((it, i) => {
        const r = newNodeRow(roadmapId, parent, base + i * step, it.title)
        r.description = it.description ?? null
        r.is_done = !!it.is_done
        rows.push(r)
        walk(it.children ?? [], r.id, 1, 1)
      })
    }
    // Smart add always appends, so new top items go at startPosition, +1, +2...
    walk(items, parentId, startPosition, 1)
    const inserts: NodeInsert[] = rows.map((r) => ({
      id: r.id,
      roadmap_id: r.roadmap_id,
      parent_id: r.parent_id,
      position: r.position,
      title: r.title,
      description: r.description,
      is_done: r.is_done,
    }))
    return safe(
      run(
        () => setNodes((ns) => [...ns, ...rows]),
        async () => {
          await waitFor([parentId])
          await insertNodes(inserts)
        },
        "Couldn't add items",
      ),
    ).then(() => rows.length)
  }

  /** Leaf: toggle. Parent: tick all leaves, or untick all if all are done. */
  const toggleDone = (id: string) => {
    const data = get()
    if (!data) return
    const node = data.nodes.find((n) => n.id === id)
    if (!node) return
    const ids = hasChildren(data.nodes, id) ? leafIds(data.nodes, id) : [id]
    const allDone = ids.every((x) => data.nodes.find((n) => n.id === x)?.is_done)
    const value = !allDone
    const now = new Date().toISOString()
    return safe(
      run(
        () =>
          setNodes((ns) =>
            ns.map((n) => (ids.includes(n.id) ? { ...n, is_done: value, done_at: value ? now : null } : n)),
          ),
        async () => {
          await waitFor(ids)
          await updateNodes(ids, { is_done: value })
        },
        "Couldn't update",
      ),
    )
  }

  /**
   * Remove from the UI now; really delete after 5s unless Undo is clicked.
   * `withUndo: false` deletes immediately (used for empty rows via Backspace).
   */
  const deleteNode = (id: string, { withUndo = true } = {}) => {
    const data = get()
    if (!data) return
    const node = data.nodes.find((n) => n.id === id)
    if (!node) return
    const subtree = new Set([id, ...descendantIds(data.nodes, id)])
    const removed = data.nodes.filter((n) => subtree.has(n.id))
    const focusWasRemoved = data.roadmap.focus_node_id && subtree.has(data.roadmap.focus_node_id)
    const prevFocus = data.roadmap.focus_node_id

    setNodes((ns) => ns.filter((n) => !subtree.has(n.id)))
    if (focusWasRemoved) setRoadmap((r) => ({ ...r, focus_node_id: null }))

    const restore = () => {
      setNodes((ns) => [...ns, ...removed.filter((r) => !ns.some((n) => n.id === r.id))])
      if (focusWasRemoved) setRoadmap((r) => ({ ...r, focus_node_id: prevFocus }))
    }

    const reallyDelete = async () => {
      pendingDeletes.current.delete(id)
      try {
        await waitFor([...subtree])
        await deleteNodes([id]) // cascades to the subtree
        qc.invalidateQueries({ queryKey: ['summaries'] })
      } catch (e) {
        restore()
        toast.error(`Couldn't delete: ${(e as Error).message}`)
      }
    }

    if (!withUndo) {
      void reallyDelete()
      return
    }

    const timer = setTimeout(reallyDelete, UNDO_MS)
    pendingDeletes.current.set(id, { timer, run: reallyDelete })
    const extra = removed.length - 1
    toast.show(
      `Deleted "${node.title || 'Untitled'}"${extra > 0 ? ` and ${extra} sub-item${extra > 1 ? 's' : ''}` : ''}`,
      {
        duration: UNDO_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            clearTimeout(timer)
            pendingDeletes.current.delete(id)
            restore()
          },
        },
      },
    )
  }

  // Leaving the page: run scheduled deletes now instead of dropping them.
  useEffect(() => {
    const flush = () => {
      pendingDeletes.current.forEach(({ timer, run }) => {
        clearTimeout(timer)
        void run()
      })
      pendingDeletes.current.clear()
    }
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [])

  // -------------------------------------------------------------------
  // Roadmap
  // -------------------------------------------------------------------

  const patchRoadmap = (patch: RoadmapPatch) =>
    safe(
      run(
        () => setRoadmap((r) => ({ ...r, ...patch })),
        async () => {
          if (patch.focus_node_id) await waitFor([patch.focus_node_id])
          await updateRoadmap(roadmapId, patch)
        },
        "Couldn't save",
      ),
    )

  const setFocus = (id: string | null) => {
    const current = get()?.roadmap.focus_node_id
    return patchRoadmap({ focus_node_id: current === id ? null : id })
  }

  const extend = async (newDays: number) => {
    try {
      await extendChallenge(roadmapId, newDays)
      await qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['summaries'] })
    } catch (e) {
      toast.error(`Couldn't extend: ${(e as Error).message}`)
    }
  }

  return {
    query,
    data: query.data,
    getNodes: () => get()?.nodes ?? [], // latest nodes inside event handlers
    updateNode,
    createNode,
    insertTree,
    toggleDone,
    deleteNode,
    patchRoadmap,
    setFocus,
    extend,
  }
}

export type RoadmapEditor = ReturnType<typeof useRoadmapEditor>
