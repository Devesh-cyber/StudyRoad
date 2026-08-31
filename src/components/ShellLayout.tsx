import React from 'react'
import { useAuth } from '@/lib/authContext'
import { Button } from '@/components/ui/button'
import { LogIn, LogOut } from 'lucide-react'

export const ShellLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading, signIn, signOut } = useAuth()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-zinc-900/60 rounded-xl p-8 border border-zinc-800 max-w-md w-full text-center shadow-xl">
          <h2 className="text-3xl font-bold mb-2">StudyRoad</h2>
          <p className="text-zinc-400 mb-8">Your personal learning tracker</p>
          <Button onClick={signIn} className="w-full text-base py-3">
            <LogIn className="mr-2 h-5 w-5" /> Sign in with Google
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-zinc-900/80 border-b border-zinc-800 backdrop-blur-sm flex items-center justify-between px-6 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight">StudyRoad</h1>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </nav>
      <main className="flex-1 max-w-5xl w-full mx-auto p-6">
        {children}
      </main>
    </div>
  )
}