import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Plus, ExternalLink, Trash2, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const ResourcesTab = ({ roadmapId }: { roadmapId: string }) => {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    fetchResources();
  }, [roadmapId]);

  const fetchResources = async () => {
    const { data } = await supabase
      .from('resources')
      .select('*')
      .eq('roadmap_id', roadmapId)
      .order('created_at', { ascending: false });

    if (data) setResources(data);
    setLoading(false);
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const { data, error } = await supabase
      .from('resources')
      .insert({ roadmap_id: roadmapId, title: title.trim(), url: formattedUrl })
      .select();

    if (!error && data) {
      setResources([data[0], ...resources]);
      setTitle('');
      setUrl('');
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('resources').delete().eq('id', id);
    setResources(resources.filter(r => r.id !== id));
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-zinc-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
        <div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center">
            <LinkIcon className="h-5 w-5 mr-2 text-amber-400" /> Learning Resources
          </h3>
          <p className="text-sm text-zinc-400">Save useful YouTube tutorials, blogs, and documentation links here.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Resource
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddResource} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 shadow-xl">
          <h4 className="font-semibold text-zinc-200">New Resource Link</h4>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resource name..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">URL</label>
            <input 
              type="text" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 text-sm focus:outline-none"
            />
          </div>
          <div className="flex space-x-2 pt-2">
            <Button size="sm" type="submit">Save Link</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setIsAdding(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((res) => (
          <div key={res.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between group hover:border-zinc-700 transition-colors shadow-md">
            <div className="flex items-center space-x-3 overflow-hidden mr-3">
              <div className="p-2.5 bg-zinc-800 rounded-lg text-zinc-300 flex-shrink-0">
                <ExternalLink className="h-4 w-4" />
              </div>
              <div className="overflow-hidden">
                <h5 className="font-semibold text-zinc-200 truncate text-sm">{res.title}</h5>
                <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:underline truncate block">
                  {res.url}
                </a>
              </div>
            </div>
            <button onClick={() => handleDelete(res.id)} className="text-zinc-600 hover:text-red-400 p-2 cursor-pointer flex-shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {resources.length === 0 && !isAdding && (
        <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-500">
          No resources added yet. Click "Add Resource" to save your learning links!
        </div>
      )}
    </div>
  );
};