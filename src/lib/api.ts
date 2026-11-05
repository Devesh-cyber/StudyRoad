import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { NodeLink, NodeRow, RoadmapRow, RoadmapSummary, TreePayloadItem } from './types'

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

export async function fetchSummaries(): Promise<RoadmapSummary[]> {
  const { data, error } = await supabase
    .from('roadmap_summaries')
    .select('*')
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data as RoadmapSummary[]
}

export async function fetchRoadmap(id: string): Promise<{ roadmap: RoadmapRow; nodes: NodeRow[] }> {
  const [r, n] = await Promise.all([
    supabase.from('roadmaps').select('*').eq('id', id).single(),
    supabase.from('nodes').select('*').eq('roadmap_id', id),
  ])
  if (r.error) throw r.error
  if (n.error) throw n.error
  return { roadmap: r.data as RoadmapRow, nodes: n.data as NodeRow[] }
}

// ---------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------

export type CreatePayload =
  | { kind: 'tree'; title: string; description?: string; items: TreePayloadItem[] }
  | {
      kind: 'challenge'
      title: string
      description?: string
      challenge_days: number
      challenge_start_date: string
    }

/** One atomic call: creates the roadmap and its whole tree. Returns the new id. */
export async function createRoadmap(payload: CreatePayload): Promise<string> {
  const { data, error } = await supabase.rpc('create_roadmap_from_tree', { payload })
  if (error) throw error
  return data as string
}

export async function deleteRoadmap(id: string): Promise<void> {
  const { error } = await supabase.from('roadmaps').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------
// AI (Edge Function: structure-roadmap)
// ---------------------------------------------------------------------

export interface StructureOptions {
  descriptions: boolean
  suggestions: boolean
  wording: 'keep' | 'clean'
}

export interface StructureResult {
  title: string
  items: TreePayloadItem[]
  suggestions: {
    title: string
    description?: string
    parent_title: string | null
    reason?: string
  }[]
}

export async function structureWithAI(
  mode: 'structure' | 'describe',
  text: string,
  options: StructureOptions,
): Promise<StructureResult> {
  const { data, error } = await supabase.functions.invoke('structure-roadmap', {
    body: { mode, text, options },
  })
  if (error) {
    // Surface the function's own error message instead of a generic one.
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json()
        throw new Error(body?.error ?? error.message)
      } catch (e) {
        if (e instanceof Error && e.message) throw e
      }
    }
    throw error
  }
  return data as StructureResult
}

// ---------------------------------------------------------------------
// Editor writes
// ---------------------------------------------------------------------

export type NodeInsert = Pick<NodeRow, 'id' | 'roadmap_id' | 'parent_id' | 'position' | 'title'> &
  Partial<Pick<NodeRow, 'description' | 'is_done'>>

/** Rows must be ordered parents-before-children (one atomic statement). */
export async function insertNodes(rows: NodeInsert[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase.from('nodes').insert(rows)
  if (error) throw error
}

export type NodePatch = Partial<
  Pick<NodeRow, 'parent_id' | 'position' | 'title' | 'description' | 'notes' | 'is_done' | 'due_date' | 'tags'>
>

export async function updateNodes(ids: string[], patch: NodePatch): Promise<void> {
  if (ids.length === 0) return
  const q = supabase.from('nodes').update(patch)
  const { error } = ids.length === 1 ? await q.eq('id', ids[0]) : await q.in('id', ids)
  if (error) throw error
}

/** Deleting a node cascades to its whole subtree in the database. */
export async function deleteNodes(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('nodes').delete().in('id', ids)
  if (error) throw error
}

export type RoadmapPatch = Partial<Pick<RoadmapRow, 'title' | 'description' | 'notes' | 'focus_node_id'>>

export async function updateRoadmap(id: string, patch: RoadmapPatch): Promise<void> {
  const { error } = await supabase.from('roadmaps').update(patch).eq('id', id)
  if (error) throw error
}

export async function extendChallenge(id: string, newDays: number): Promise<void> {
  const { error } = await supabase.rpc('extend_challenge', { p_roadmap_id: id, p_new_days: newDays })
  if (error) throw error
}

// ---------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------

export async function fetchLinks(nodeId: string): Promise<NodeLink[]> {
  const { data, error } = await supabase
    .from('node_links')
    .select('*')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as NodeLink[]
}

export async function addLink(nodeId: string, title: string, url: string): Promise<void> {
  const { error } = await supabase.from('node_links').insert({ node_id: nodeId, title, url })
  if (error) throw error
}

export async function deleteLink(id: string): Promise<void> {
  const { error } = await supabase.from('node_links').delete().eq('id', id)
  if (error) throw error
}
