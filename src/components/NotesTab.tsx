import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Save } from 'lucide-react';

export const NotesTab = ({ roadmapId }: { roadmapId: string }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchNotes = async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('roadmap_id', roadmapId)
        .single();

      if (data) {
        setContent(data.content || '');
      } else {
        // Create initial empty note row if it doesn't exist
        await supabase.from('notes').insert({ roadmap_id: roadmapId, content: '' });
      }
      setLoading(false);
    };

    fetchNotes();
  }, [roadmapId]);

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from('notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('roadmap_id', roadmapId);
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-zinc-500" /></div>;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col h-[600px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-zinc-100">Roadmap Notepad</h3>
        <button 
          onClick={handleSave} 
          className="flex items-center text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" /> {saving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type markdown notes, thoughts, or code snippets here..."
        className="w-full flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-200 font-mono text-sm resize-none focus:outline-none focus:border-zinc-700 leading-relaxed"
      />
    </div>
  );
};