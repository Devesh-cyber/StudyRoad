import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/lib/authContext'
import { ShellLayout } from '@/components/ShellLayout'
import './index.css'

// Vite's default React template uses 'root', but vanilla uses 'app'. 
// This safely grabs whichever one your index.html is using.
const rootElement = document.getElementById('root') || document.getElementById('app');

ReactDOM.createRoot(rootElement!).render(
  <React.StrictMode>
    <AuthProvider>
      <ShellLayout>
        <div className="text-center p-8 text-zinc-400">
          Phase 2 Complete. Workspace ready.
        </div>
      </ShellLayout>
    </AuthProvider>
  </React.StrictMode>
)