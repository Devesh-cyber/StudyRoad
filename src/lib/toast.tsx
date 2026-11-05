import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from './utils'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: number
  message: string
  kind: 'info' | 'error'
  action?: ToastAction
}

interface ToastApi {
  show: (message: string, opts?: { action?: ToastAction; duration?: number }) => number
  error: (message: string) => number
  dismiss: (id: number) => void
}

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (message: string, kind: Toast['kind'], action?: ToastAction, duration = 5000) => {
      const id = nextId.current++
      setToasts((t) => [...t.slice(-3), { id, message, kind, action }])
      setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const api: ToastApi = {
    show: (m, o) => push(m, 'info', o?.action, o?.duration),
    error: (m) => push(m, 'error', undefined, 7000),
    dismiss,
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 inset-x-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-xl max-w-md w-full sm:w-auto',
              t.kind === 'error' ? 'bg-red-950 border-red-900 text-red-200' : 'bg-zinc-900 border-zinc-700 text-zinc-200',
            )}
          >
            <span className="flex-1 min-w-0">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
                className="font-semibold text-amber-300 hover:text-amber-200 cursor-pointer"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="text-zinc-500 hover:text-zinc-300 cursor-pointer" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast must be used inside ToastProvider')
  return v
}
