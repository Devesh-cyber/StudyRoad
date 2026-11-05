// Shapes that mirror supabase/schema.sql (v2).

export type RoadmapKind = 'tree' | 'challenge'

export interface RoadmapRow {
  id: string
  user_id: string
  title: string
  description: string | null
  notes: string
  kind: RoadmapKind
  focus_node_id: string | null
  challenge_start_date: string | null
  challenge_days: number | null
  sort_order: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface NodeRow {
  id: string
  roadmap_id: string
  parent_id: string | null
  position: number
  title: string
  description: string | null
  notes: string | null
  is_done: boolean
  done_at: string | null
  due_date: string | null
  tags: string[]
  day_number: number | null
}

export interface RoadmapSummary {
  id: string
  title: string
  description: string | null
  kind: RoadmapKind
  sort_order: number
  archived_at: string | null
  challenge_start_date: string | null
  challenge_days: number | null
  created_at: string
  updated_at: string
  total_items: number
  done_items: number
  percent: number
  last_done_at: string | null
  focus_node_id: string | null
  focus_title: string | null
}

// ---- Drafts: a roadmap being built in the preview, before it's saved ----

export interface DraftItem {
  id: string // client-only id for React keys / editing
  title: string
  description?: string
  is_done?: boolean
  children: DraftItem[]
}

export interface DraftSuggestion {
  id: string
  title: string
  description?: string
  parent_title: string | null
  reason?: string
}

export interface Draft {
  title: string
  items: DraftItem[]
  suggestions: DraftSuggestion[]
  source: 'local' | 'ai'
  notice?: string // e.g. "AI unavailable, used the simple parser"
}

// Payload accepted by the create_roadmap_from_tree RPC.
export interface TreePayloadItem {
  title: string
  description?: string
  is_done?: boolean
  children: TreePayloadItem[]
}
