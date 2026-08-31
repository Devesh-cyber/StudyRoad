import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/lib/authContext'
import { ShellLayout } from '@/components/ShellLayout'
import { ImportRoadmap } from '@/components/ImportRoadmap'
import { Dashboard } from '@/components/Dashboard'
import { RoadmapView } from '@/components/RoadmapView'
import './index.css'

const App = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'import' | 'view'>('dashboard')
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null)

  const openRoadmap = (id: string) => {
    setSelectedRoadmapId(id)
    setCurrentView('view')
  }

  return (
    <ShellLayout>
      {currentView === 'dashboard' && (
        <Dashboard onImportNew={() => setCurrentView('import')} onOpenRoadmap={openRoadmap} />
      )}
      
      {currentView === 'import' && (
        <div className="space-y-4">
          <button onClick={() => setCurrentView('dashboard')} className="text-sm text-zinc-400 hover:text-zinc-200 mb-4 cursor-pointer">
            ← Back to Dashboard
          </button>
          <ImportRoadmap />
        </div>
      )}

      {currentView === 'view' && selectedRoadmapId && (
        <RoadmapView 
          roadmapId={selectedRoadmapId} 
          onBack={() => setCurrentView('dashboard')} 
          onDelete={() => setCurrentView('dashboard')} 
        />
      )}
    </ShellLayout>
  )
}

const rootElement = document.getElementById('root') || document.getElementById('app')

ReactDOM.createRoot(rootElement!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)