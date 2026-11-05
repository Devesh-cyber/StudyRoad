import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Plus, Sparkles, Star } from 'lucide-react'
import type { RoadmapEditor } from '@/hooks/useRoadmapEditor'
import {
  ancestorIds,
  dropPatch,
  indentPatch,
  moveDownPatch,
  moveUpPatch,
  outdentPatch,
  positionAfter,
  positionLastChild,
  progressMap,
  visibleRows,
  type DropZone,
} from '@/lib/editorOps'
import { OutlineRow, type RowActions } from './OutlineRow'

interface Props {
  editor: RoadmapEditor
  onOpenDetails: (id: string) => void
  onSmartAdd: (parentId: string | null) => void
}

const loadCollapsed = (roadmapId: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(`sr:collapsed:${roadmapId}`) ?? '[]'))
  } catch {
    return new Set()
  }
}

export function OutlineEditor({ editor, onOpenDetails, onSmartAdd }: Props) {
  const { roadmap, nodes } = editor.data!
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed(roadmap.id))
  const [drag, setDrag] = useState<{ id: string; over: { id: string; zone: DropZone } | null } | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(`sr:collapsed:${roadmap.id}`, JSON.stringify([...collapsed]))
    } catch {
      /* storage unavailable: collapse state just won't persist */
    }
  }, [collapsed, roadmap.id])

  const rows = useMemo(() => visibleRows(nodes, collapsed), [nodes, collapsed])
  const progress = useMemo(() => progressMap(nodes), [nodes])
  const focusNode = roadmap.focus_node_id ? nodes.find((n) => n.id === roadmap.focus_node_id) : undefined

  // ---- keyboard focus management --------------------------------------
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const [focusReq, setFocusReq] = useState<{ id: string; atEnd: boolean; n: number } | null>(null)
  const requestFocus = (id: string, atEnd = true) => setFocusReq({ id, atEnd, n: Date.now() })

  useLayoutEffect(() => {
    if (!focusReq) return
    const el = inputs.current.get(focusReq.id)
    if (el) {
      el.focus()
      const p = focusReq.atEnd ? el.value.length : 0
      el.setSelectionRange(p, p)
      setFocusReq(null)
    }
  }, [focusReq, rows])

  const expand = (ids: string[]) =>
    setCollapsed((c) => {
      if (!ids.some((id) => c.has(id))) return c
      const next = new Set(c)
      ids.forEach((id) => next.delete(id))
      return next
    })

  const jumpTo = (id: string) => {
    expand(ancestorIds(editor.getNodes(), id))
    requestAnimationFrame(() => {
      document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setFlashId(id)
      setTimeout(() => setFlashId(null), 1200)
    })
  }

  // ---- actions (stable object, always calls the latest closures) -------
  const latest = useRef<RowActions>(null!)
  latest.current = {
    commitTitle: (id, title) => {
      const n = editor.getNodes().find((x) => x.id === id)
      if (n && n.title !== title) editor.updateNode(id, { title })
    },
    toggleDone: (id) => editor.toggleDone(id),
    toggleCollapse: (id) =>
      setCollapsed((c) => {
        const next = new Set(c)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    enter: (id, title) => {
      latest.current.commitTitle(id, title)
      const p = positionAfter(editor.getNodes(), id)
      if (!p) return
      requestFocus(editor.createNode(p.parent_id, p.position))
    },
    indent: (id, title) => {
      latest.current.commitTitle(id, title)
      const p = indentPatch(editor.getNodes(), id)
      if (!p) return
      expand([p.parent_id!])
      editor.updateNode(id, p)
      requestFocus(id)
    },
    outdent: (id, title) => {
      latest.current.commitTitle(id, title)
      const p = outdentPatch(editor.getNodes(), id)
      if (!p) return
      editor.updateNode(id, p)
      requestFocus(id)
    },
    moveUp: (id) => {
      const p = moveUpPatch(editor.getNodes(), id)
      if (p) {
        editor.updateNode(id, p)
        requestFocus(id)
      }
    },
    moveDown: (id) => {
      const p = moveDownPatch(editor.getNodes(), id)
      if (p) {
        editor.updateNode(id, p)
        requestFocus(id)
      }
    },
    backspaceEmpty: (id) => {
      const i = rows.findIndex((r) => r.node.id === id)
      const prev = rows[i - 1]?.node.id ?? rows[i + 1]?.node.id
      editor.deleteNode(id, { withUndo: false })
      if (prev) requestFocus(prev)
    },
    focusPrev: (id) => {
      const i = rows.findIndex((r) => r.node.id === id)
      if (i > 0) requestFocus(rows[i - 1].node.id)
    },
    focusNext: (id) => {
      const i = rows.findIndex((r) => r.node.id === id)
      if (i >= 0 && i < rows.length - 1) requestFocus(rows[i + 1].node.id)
    },
    addChild: (id) => {
      expand([id])
      requestFocus(editor.createNode(id, positionLastChild(editor.getNodes(), id)))
    },
    remove: (id) => editor.deleteNode(id),
    setFocus: (id) => editor.setFocus(id),
    openDetails: (id) => onOpenDetails(id),
    smartAdd: (id) => onSmartAdd(id),
    registerInput: (id, el) => {
      if (el) inputs.current.set(id, el)
      else inputs.current.delete(id)
    },
    dragStart: (id) => setDrag({ id, over: null }),
    dragOver: (id, zone) =>
      setDrag((d) => (d && (d.over?.id !== id || d.over.zone !== zone) ? { ...d, over: { id, zone } } : d)),
    drop: (id, zone) => {
      const d = drag
      setDrag(null)
      if (!d) return
      const p = dropPatch(editor.getNodes(), d.id, id, zone)
      if (!p) return
      if (zone === 'inside') expand([id])
      editor.updateNode(d.id, p)
    },
    dragEnd: () => setDrag(null),
  }
  const actions = useMemo<RowActions>(
    () =>
      new Proxy({} as RowActions, {
        get: (_t, prop: keyof RowActions) => (...args: unknown[]) =>
          (latest.current[prop] as (...a: unknown[]) => unknown)(...args),
      }),
    [],
  )

  const addTopLevel = () => requestFocus(editor.createNode(null, positionLastChild(editor.getNodes(), null)))

  return (
    <div className="space-y-3">
      {focusNode && (
        <button
          onClick={() => jumpTo(focusNode.id)}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300/30 bg-amber-300/5 text-left cursor-pointer hover:bg-amber-300/10 transition-colors"
        >
          <Star className="h-4 w-4 text-amber-200 fill-amber-200 flex-shrink-0" />
          <span className="text-xs uppercase tracking-wider text-amber-300/80">Focus</span>
          <span className="text-sm text-zinc-100 truncate">{focusNode.title || 'Untitled'}</span>
          <span className="ml-auto text-xs text-zinc-500 flex-shrink-0">jump →</span>
        </button>
      )}

      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 sm:p-3"
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag((d) => (d ? { ...d, over: null } : d))
        }}
      >
        {rows.length === 0 ? (
          <div className="py-10 text-center space-y-4">
            <p className="text-zinc-500">Nothing here yet.</p>
            <div className="flex justify-center gap-2">
              <button onClick={addTopLevel} className="px-3 py-1.5 rounded-md bg-zinc-800 text-sm text-zinc-200 hover:bg-zinc-700 cursor-pointer">
                Add first item
              </button>
              <button onClick={() => onSmartAdd(null)} className="px-3 py-1.5 rounded-md border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 cursor-pointer flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Smart add
              </button>
            </div>
          </div>
        ) : (
          rows.map((r) => (
            <OutlineRow
              key={r.node.id}
              node={r.node}
              depth={r.depth}
              hasChildren={r.hasChildren}
              collapsed={collapsed.has(r.node.id)}
              progress={progress.get(r.node.id) ?? { done: 0, total: 0 }}
              isFocus={roadmap.focus_node_id === r.node.id}
              dropZone={drag?.over?.id === r.node.id && drag.id !== r.node.id ? drag.over.zone : null}
              dragging={drag?.id === r.node.id}
              flash={flashId === r.node.id}
              actions={actions}
            />
          ))
        )}

        {rows.length > 0 && (
          <div className="flex items-center gap-4 pt-2 pl-2">
            <button onClick={addTopLevel} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer">
              <Plus className="h-4 w-4" /> Add item
            </button>
            <button onClick={() => onSmartAdd(null)} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer">
              <Sparkles className="h-3.5 w-3.5" /> Smart add
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-600 hidden sm:block">
        Enter new item · Tab / Shift+Tab indent · Alt+↑↓ move · ↑↓ navigate · Backspace on empty deletes · drag ⠿ to move
      </p>
    </div>
  )
}
