import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import type { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 1. Grab the session on load
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error("Error getting session:", error)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // 2. Listen for auth changes (like returning from Google)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event Triggered:", event)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'google',
      options: {
        // Force Google to return exactly to the root URL
        redirectTo: window.location.origin 
      }
    })
    if (error) console.error("Sign-in Error:", error)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}