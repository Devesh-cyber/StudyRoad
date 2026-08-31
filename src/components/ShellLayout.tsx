import { useAuth } from '@/lib/authContext'
import { LogOut, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import React from 'react'

interface ShellLayoutProps {
  children: React.ReactNode
}

export const ShellLayout = ({ children }: ShellLayoutProps) => {
  const { user, isLoading, signIn, signOut } = useAuth()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      {user ? (
        <>
          <nav className="bg-zinc-950/50 border-b border-zinc-800 backdrop-blur-sm flex items-center justify-between px-6 py-4">
            <h1 className="text-xl font-semibold">StudyRoad</h1>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </div>
          </nav>
          <main className="p-6">{children}</main>
        </>
      ) : (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="bg-zinc-900/50 rounded-lg p-8 border border-zinc-800 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">StudyRoad</h2>
            <p className="text-zinc-400 mb-6">Your personal learning tracker</p>
            <Button onClick={signIn} className="w-full">
              <LogIn className="mr-2 h-4 w-4" /> Sign in with Google
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const handleSignOut = async () => {
  await signOut()
}
