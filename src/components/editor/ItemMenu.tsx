import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MenuItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  divider?: boolean // draw a line above this item
}

export function ItemMenu({ items, label = 'More actions' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={label}
        title={label}
        className={cn(
          'p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer',
          open && 'bg-zinc-800 text-zinc-200',
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 w-52 py-1 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl z-30">
          {items.map((it) => (
            <div key={it.label}>
              {it.divider && <div className="my-1 h-px bg-zinc-800" />}
              <button
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onClick()
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left cursor-pointer disabled:opacity-35 disabled:cursor-default',
                  it.danger ? 'text-red-400 hover:bg-red-950/50' : 'text-zinc-300 hover:bg-zinc-800',
                )}
              >
                {it.icon && <it.icon className="h-3.5 w-3.5 flex-shrink-0" />}
                {it.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
