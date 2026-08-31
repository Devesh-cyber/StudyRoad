import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/lib/authContext'
import { ShellLayout } from '@/components/ShellLayout'
import { ImportRoadmap } from '@/components/ImportRoadmap'
import { Dashboard } from '@/components/Dashboard'
import { RoadmapView } from '@/components/RoadmapView'
import { parseMarkdownTree, ParsedRoadmap } from '@/lib/parser'
import { supabase } from '@/lib/supabaseClient'
import './index.css'

const App = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'import' | 'preview' | 'view'>('dashboard')
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<ParsedRoadmap | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const openRoadmap = (id: string) => {
    setSelectedRoadmapId(id)
    setCurrentView('view')
  }

  const handleSavePreview = async () => {
    if (!previewData) return;
    setIsSaving(true);
    try {
      // 1. Get current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("User not authenticated");

      // 2. Insert roadmap header into database
      const { data: roadmapData, error: roadmapError } = await supabase
        .from('roadmaps')
        .insert({ 
          title: previewData.title,
          user_id: user.id 
        })
        .select()
        .single();

      if (roadmapError) throw roadmapError;

      // 3. Insert corresponding topics and subtopics
      if (previewData.topics && previewData.topics.length > 0) {
        for (const topic of previewData.topics) {
          const { data: topicData, error: topicError } = await supabase
            .from('topics')
            .insert({
              roadmap_id: roadmapData.id,
              title: topic.title,
              sort_order: topic.sort_order,
            })
            .select()
            .single();

          if (topicError) throw topicError;

          if (topic.subtopics && topic.subtopics.length > 0) {
            const subtopicsToInsert = topic.subtopics.map((sub) => ({
              topic_id: topicData.id,
              title: sub.title,
              sort_order: sub.sort_order,
            }));

            await supabase.from('subtopics').insert(subtopicsToInsert);
          }
        }
      }

      // 4. Navigate directly to view the saved roadmap
      openRoadmap(roadmapData.id);
    } catch (err) {
      console.error("Failed to save roadmap changes:", err);
    } finally {
      setIsSaving(false);
    }
  };

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
          <ImportRoadmap onFileImported={async (file) => {
            try {
              const text = await file.text();
              const parsedRoadmap = parseMarkdownTree(text);
              
              // Set the parsed data and redirect user to preview screen instead of saving automatically
              setPreviewData(parsedRoadmap);
              setCurrentView('preview');
            } catch (err) {
              console.error("Failed to parse markdown file:", err);
            }
          }} />
        </div>
      )}

      {currentView === 'preview' && previewData && (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentView('import')} className="text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer">
              ← Back to Upload
            </button>
            <button 
              onClick={handleSavePreview} 
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-6">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Roadmap Preview</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">{previewData.title}</h1>
            </div>

            <div className="space-y-4">
              {previewData.topics.map((topic, i) => (
                <div key={i} className="p-4 bg-muted/30 border rounded-xl space-y-2">
                  <h3 className="font-semibold text-foreground text-base">
                    {topic.sort_order}. {topic.title}
                  </h3>
                  {topic.subtopics && topic.subtopics.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 pl-2 text-sm text-muted-foreground">
                      {topic.subtopics.map((sub, j) => (
                        <li key={j}>{sub.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
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