import React, { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, LogIn, LogOut, Menu, Plus, Sun, X } from 'lucide-react'
import { useAuth } from '@/lib/authContext'
import { fetchSummaries } from '@/lib/api'
import type { RoadmapSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

/** The yellow road mark used as the logo. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-md bg-amber-300 flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="block rounded-full"
        style={{
          width: 3,
          height: size * 0.62,
          background: 'repeating-linear-gradient(to bottom, #0F1012 0 4px, transparent 4px 7px)',
        }}
      />
    </span>
  )
}

export const ShellLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, signIn, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMenuOpen(false), [location.pathname])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Logo size={32} />
      </div>
    )
  }

  if (!user) return <SignIn onSignIn={signIn} />

  return (
    <div className="min-h-screen lg:flex">
      {/* Phone / tablet top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-zinc-900 bg-zinc-950/95 backdrop-blur">
        <Link to="/" className="flex items-center gap-2.5 font-display font-bold text-lg">
          <Logo /> StudyRoad
        </Link>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="h-11 w-11 -mr-2 flex items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-900 cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Sidebar: fixed column on desktop, drawer on smaller screens */}
      {menuOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMenuOpen(false)} />}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-72 lg:w-64 flex-shrink-0',
          'bg-zinc-950 border-r border-zinc-900 transition-transform lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar email={user.email ?? ''} onSignOut={signOut} onClose={() => setMenuOpen(false)} />
      </aside>

      <main className="flex-1 min-w-0 px-4 sm:px-8 lg:px-12 py-6 lg:py-10">{children}</main>
    </div>
  )
}

function Sidebar({ email, onSignOut, onClose }: { email: string; onSignOut: () => void; onClose: () => void }) {
  const { data: roadmaps = [] } = useQuery({ queryKey: ['summaries'], queryFn: fetchSummaries })

  const navItem = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm transition-colors',
      isActive ? 'bg-zinc-900 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60',
    )

  return (
    <nav aria-label="Main" className="h-full flex flex-col gap-7 px-3 py-6 overflow-y-auto">
      <div className="flex items-center justify-between px-2">
        <Link to="/" className="flex items-center gap-2.5 font-display font-bold text-lg tracking-tight">
          <Logo /> StudyRoad
        </Link>
        <button onClick={onClose} aria-label="Close menu" className="lg:hidden h-10 w-10 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-900 cursor-pointer">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <NavLink to="/" end className={navItem}>
          <Sun className="h-4 w-4" /> Today
        </NavLink>
      </div>

      <div className="flex flex-col gap-0.5 min-h-0">
        <span className="px-3 pb-2 text-[11px] uppercase tracking-[0.1em] text-zinc-500">Roadmaps</span>
        {roadmaps.map((r) => (
          <NavLink key={r.id} to={`/r/${r.id}`} className={navItem}>
            <RoadmapGlyph r={r} />
            <span className="flex-1 min-w-0 truncate">{r.title}</span>
            <span className="font-display text-[11px] text-zinc-500 tabular-nums">{r.percent}%</span>
          </NavLink>
        ))}
        <NavLink to="/new" className={navItem}>
          <Plus className="h-4 w-4" /> New roadmap
        </NavLink>
      </div>

      <div className="mt-auto pt-4 border-t border-zinc-900 flex items-center gap-2 px-2">
        <span className="flex-1 min-w-0 truncate text-xs text-zinc-500" title={email}>{email}</span>
        <button onClick={onSignOut} aria-label="Sign out" title="Sign out" className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 cursor-pointer">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}

/** Progress ring for trees, calendar icon for challenges. */
export function RoadmapGlyph({ r, size = 14 }: { r: RoadmapSummary; size?: number }) {
  if (r.kind === 'challenge') return <CalendarDays className="text-amber-300 flex-shrink-0" style={{ width: size + 2, height: size + 2 }} aria-hidden="true" />
  return (
    <span
      aria-hidden="true"
      className="rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: `conic-gradient(#F5C542 ${r.percent}%, #3A3B42 0)` }}
    />
  )
}

function SignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-8">
        <div className="flex flex-col items-center gap-5">
          <Logo size={48} />
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">StudyRoad</h1>
            <p className="text-zinc-400">Your roadmaps, your way. Tick, tick, see how far you've come.</p>
          </div>
        </div>
        <button
          onClick={onSignIn}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-amber-300 text-zinc-950 font-semibold hover:bg-amber-200 transition-colors cursor-pointer"
        >
          <LogIn className="h-5 w-5" /> Sign in with Google
        </button>
      </div>
    </div>
  )
}
