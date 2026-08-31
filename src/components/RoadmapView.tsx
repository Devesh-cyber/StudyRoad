import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { appCache } from '@/lib/cache';
import { Loader2, CheckCircle, Circle, Trash2, Edit2, Check, X, Plus, Settings2, FileText, Save, BookOpen, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnalyticsBar } from '@/components/AnalyticsBar';
import { ResourcesTab } from '@/components/ResourcesTab';

export const RoadmapView = ({ roadmapId, onBack, onDelete }: { roadmapId: string, onBack: () => void, onDelete: () => void }) => {
  const [activeTab, setActiveTab] = useState<'roadmap' | 'notes' | 'resources'>('roadmap');
  const [roadmapTitle, setRoadmapTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicEditText, setTopicEditText] = useState('');
  const [editingSubtopicId, setEditingSubtopicId] = useState<string | null>(null);
  const [subtopicEditText, setSubtopicEditText] = useState('');

  const [newSubtopicText, setNewSubtopicText] = useState<{ [key: string]: string }>({});
  const [addingSubtopicToTopic, setAddingSubtopicToTopic] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [isAddingTopic, setIsAddingTopic] = useState(false);

  const [openNotesTopicId, setOpenNotesTopicId] = useState<string | null>(null);
  const [topicNotes, setTopicNotes] = useState<{ [key: string]: string }>({});
  const [savingTopicId, setSavingTopicId] = useState<string | null>(null);

  const [globalNoteContent, setGlobalNoteContent] = useState('');
  const [savingGlobalNote, setSavingGlobalNote] = useState(false);

  const cacheKey = `roadmap_full_${roadmapId}`;

  useEffect(() => {
    const fetchRoadmapData = async () => {
      // Check cache first for zero-delay loading
      const cached = appCache.get(cacheKey);
      if (cached) {
        setRoadmapTitle(cached.title);
        setNewTitle(cached.title);
        setTopics(cached.topics);
        setTopicNotes(cached.topicNotes);
        setGlobalNoteContent(cached.globalNoteContent);
        setLoading(false);
        return;
      }

      const { data: roadmapData } = await supabase
        .from('roadmaps')
        .select('title')
        .eq('id', roadmapId)
        .single();
      
      if (roadmapData) {
        setRoadmapTitle(roadmapData.title);
        setNewTitle(roadmapData.title);
      }

      const { data, error } = await supabase
        .from('topics')
        .select(`
          id, title, sort_order,
          subtopics ( id, title, sort_order, status ),
          notes ( content )
        `)
        .eq('roadmap_id', roadmapId)
        .order('sort_order', { ascending: true });

      let loadedTopics: any[] = [];
      if (error) console.error("Error fetching roadmap:", error);
      
      if (data) {
        data.forEach(topic => {
          topic.subtopics.sort((a: any, b: any) => a.sort_order - b.sort_order);
        });
        loadedTopics = data;
        setTopics(data);

        const notesMap: { [key: string]: string } = {};
        data.forEach(t => {
          notesMap[t.id] = t.notes?.[0]?.content || '';
        });
        setTopicNotes(notesMap);
      }

      const { data: globalData } = await supabase
        .from('global_notes')
        .select('content')
        .eq('roadmap_id', roadmapId)
        .single();

      let loadedGlobalNotes = '';
      if (globalData) {
        loadedGlobalNotes = globalData.content || '';
        setGlobalNoteContent(loadedGlobalNotes);
      }

      // Save to cache
      appCache.set(cacheKey, {
        title: roadmapData?.title || '',
        topics: loadedTopics,
        topicNotes: topics,
        globalNoteContent: loadedGlobalNotes
      });

      setLoading(false);
    };

    fetchRoadmapData();
  }, [roadmapId]);

  const updateCache = (newTopics: any[], newNotes = topicNotes, newGlobal = globalNoteContent, newTitleText = roadmapTitle) => {
    appCache.set(cacheKey, {
      title: newTitleText,
      topics: newTopics,
      topicNotes: newNotes,
      globalNoteContent: newGlobal
    });
    appCache.invalidate('dashboard_roadmaps'); // Invalidate dashboard list cache to reflect progress changes
  };

  const handleUpdateRoadmapTitle = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from('roadmaps').update({ title: newTitle }).eq('id', roadmapId);
    if (!error) {
      setRoadmapTitle(newTitle);
      setIsEditingTitle(false);
      updateCache(topics, topicNotes, globalNoteContent, newTitle);
    }
  };

  const handleDeleteRoadmap = async () => {
    if (!confirm('Are you sure you want to delete this roadmap and all its progress?')) return;
    const { error } = await supabase.from('roadmaps').delete().eq('id', roadmapId);
    if (!error) {
      appCache.invalidate(cacheKey);
      appCache.invalidate('dashboard_roadmaps');
      onDelete();
    }
  };

  const handleSaveTopicNote = async (topicId: string) => {
    setSavingTopicId(topicId);
    const content = topicNotes[topicId] || '';
    const { data: existing } = await supabase.from('notes').select('id').eq('topic_id', topicId).single();

    if (existing) {
      await supabase.from('notes').update({ content, updated_at: new Date().toISOString() }).eq('topic_id', topicId);
    } else {
      await supabase.from('notes').insert({ topic_id: topicId, content });
    }
    setSavingTopicId(null);
    updateCache(topics, topicNotes, globalNoteContent);
  };

  const handleSaveGlobalNote = async () => {
    setSavingGlobalNote(true);
    const { data: existing } = await supabase.from('global_notes').select('id').eq('roadmap_id', roadmapId).single();

    if (existing) {
      await supabase.from('global_notes').update({ content: globalNoteContent, updated_at: new Date().toISOString() }).eq('roadmap_id', roadmapId);
    } else {
      await supabase.from('global_notes').insert({ roadmap_id: roadmapId, content: globalNoteContent });
    }
    setSavingGlobalNote(false);
    updateCache(topics, topicNotes, globalNoteContent);
  };

  const handleAddTopic = async () => {
    if (!newTopicTitle.trim()) return;
    const nextOrder = topics.length > 0 ? Math.max(...topics.map(t => t.sort_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('topics')
      .insert({ roadmap_id: roadmapId, title: newTopicTitle.trim(), sort_order: nextOrder })
      .select();

    if (!error && data) {
      const updated = [...topics, { ...data[0], subtopics: [], notes: [] }];
      setTopics(updated);
      setNewTopicTitle('');
      setIsAddingTopic(false);
      updateCache(updated);
    }
  };

  const handleUpdateTopic = async (topicId: string) => {
    if (!topicEditText.trim()) return;
    await supabase.from('topics').update({ title: topicEditText }).eq('id', topicId);
    const updated = topics.map(t => t.id === topicId ? { ...t, title: topicEditText } : t);
    setTopics(updated);
    setEditingTopicId(null);
    updateCache(updated);
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Delete this topic and all its subtopics?')) return;
    await supabase.from('topics').delete().eq('id', topicId);
    const updated = topics.filter(t => t.id !== topicId);
    setTopics(updated);
    updateCache(updated);
  };

  const handleAddSubtopic = async (topicId: string) => {
    const text = newSubtopicText[topicId];
    if (!text || !text.trim()) return;

    const topic = topics.find(t => t.id === topicId);
    const nextOrder = topic && topic.subtopics.length > 0 ? Math.max(...topic.subtopics.map((s: any) => s.sort_order)) + 1 : 1;

    const { data, error } = await supabase
      .from('subtopics')
      .insert({ topic_id: topicId, title: text.trim(), sort_order: nextOrder, status: 'NOT_STARTED' })
      .select();

    if (!error && data) {
      const updated = topics.map(t => {
        if (t.id === topicId) {
          return { ...t, subtopics: [...t.subtopics, data[0]] };
        }
        return t;
      });
      setTopics(updated);
      setNewSubtopicText({ ...newSubtopicText, [topicId]: '' });
      setAddingSubtopicToTopic(null);
      updateCache(updated);
    }
  };

  const handleUpdateSubtopic = async (subtopicId: string, topicId: string) => {
    if (!subtopicEditText.trim()) return;
    await supabase.from('subtopics').update({ title: subtopicEditText }).eq('id', subtopicId);
    const updated = topics.map(t => {
      if (t.id === topicId) {
        return {
          ...t,
          subtopics: t.subtopics.map((s: any) => s.id === subtopicId ? { ...s, title: subtopicEditText } : s)
        };
      }
      return t;
    });
    setTopics(updated);
    setEditingSubtopicId(null);
    updateCache(updated);
  };

  const handleDeleteSubtopic = async (subtopicId: string, topicId: string) => {
    await supabase.from('subtopics').delete().eq('id', subtopicId);
    const updated = topics.map(t => {
      if (t.id === topicId) {
        return {
          ...t,
          subtopics: t.subtopics.filter((s: any) => s.id !== subtopicId)
        };
      }
      return t;
    });
    setTopics(updated);
    updateCache(updated);
  };

  const toggleSubtopic = async (subtopicId: string, topicId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED';
    const updated = topics.map(t => {
      if (t.id === topicId) {
        return {
          ...t,
          subtopics: t.subtopics.map((s: any) => s.id === subtopicId ? { ...s, status: newStatus } : s)
        };
      }
      return t;
    });
    setTopics(updated);
    updateCache(updated);
    await supabase.from('subtopics').update({ status: newStatus }).eq('id', subtopicId);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-zinc-500" /></div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-zinc-200 cursor-pointer">
          ← Back to Dashboard
        </button>
        <div className="flex items-center space-x-2">
          <Button 
            variant={editMode ? "default" : "outline"} 
            size="sm" 
            onClick={() => setEditMode(!editMode)}
            className={editMode ? "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700" : "border-zinc-700 text-zinc-300"}
          >
            <Settings2 className="h-4 w-4 mr-1.5" /> {editMode ? "Done Editing" : "Edit Roadmap"}
          </Button>
          {editMode && (
            <Button variant="outline" size="sm" onClick={handleDeleteRoadmap} className="text-red-400 hover:text-red-300 border-red-900/50 hover:bg-red-950/30">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl gap-4">
        {isEditingTitle ? (
          <div className="flex items-center space-x-2 w-full mr-4">
            <input 
              type="text" 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-zinc-100 w-full focus:outline-none"
            />
            <Button size="sm" onClick={handleUpdateRoadmapTitle}><Check className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditingTitle(false)}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-zinc-100">{roadmapTitle}</h2>
            {editMode && (
              <button onClick={() => setIsEditingTitle(true)} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 self-start md:self-auto flex-wrap">
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${activeTab === 'roadmap' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <BookOpen className="h-4 w-4 mr-1.5" /> Roadmap
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${activeTab === 'notes' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <FileText className="h-4 w-4 mr-1.5" /> Global Notes
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${activeTab === 'resources' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <LinkIcon className="h-4 w-4 mr-1.5" /> Resources
          </button>
        </div>
      </div>

      {activeTab === 'resources' ? (
        <ResourcesTab roadmapId={roadmapId} />
      ) : activeTab === 'notes' ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Global Roadmap Notes</h3>
              <p className="text-xs text-zinc-400">Jot down overall thoughts, cheat sheets, or summaries for this roadmap.</p>
            </div>
            <button 
              onClick={handleSaveGlobalNote}
              className="flex items-center text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" /> {savingGlobalNote ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
          <textarea
            value={globalNoteContent}
            onChange={(e) => setGlobalNoteContent(e.target.value)}
            placeholder="Write markdown notes here..."
            className="w-full flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-200 font-mono text-sm resize-none focus:outline-none focus:border-zinc-700 leading-relaxed"
          />
        </div>
      ) : (
        <>
          <AnalyticsBar topics={topics} />

          {topics.map(topic => (
            <div key={topic.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                {editingTopicId === topic.id ? (
                  <div className="flex items-center space-x-2 w-full mr-2">
                    <input 
                      type="text" 
                      value={topicEditText} 
                      onChange={(e) => setTopicEditText(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 w-full focus:outline-none"
                    />
                    <Button size="sm" onClick={() => handleUpdateTopic(topic.id)}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTopicId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-bold text-zinc-100">{topic.title}</h3>
                    {editMode && (
                      <button onClick={() => { setEditingTopicId(topic.id); setTopicEditText(topic.title); }} className="text-zinc-500 hover:text-zinc-300">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setOpenNotesTopicId(openNotesTopicId === topic.id ? null : topic.id)}
                    className={`flex items-center text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${openNotesTopicId === topic.id ? 'bg-zinc-800 text-amber-200 border-zinc-700' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'}`}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" /> Notes
                  </button>
                  {editMode && (
                    <button onClick={() => handleDeleteTopic(topic.id)} className="text-zinc-600 hover:text-red-400 cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {openNotesTopicId === topic.id && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Notes for {topic.title}</span>
                    <button 
                      onClick={() => handleSaveTopicNote(topic.id)}
                      className="flex items-center text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded transition-colors cursor-pointer"
                    >
                      <Save className="h-3 w-3 mr-1" /> {savingTopicId === topic.id ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                  <textarea
                    value={topicNotes[topic.id] || ''}
                    onChange={(e) => setTopicNotes({ ...topicNotes, [topic.id]: e.target.value })}
                    placeholder="Write specific markdown notes or thoughts for this topic..."
                    className="w-full h-36 bg-zinc-900 border border-zinc-800 rounded p-3 text-zinc-200 font-mono text-sm resize-none focus:outline-none focus:border-zinc-700 leading-relaxed"
                  />
                </div>
              )}

              <div className="space-y-3 pt-2">
                {topic.subtopics.map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-transparent hover:border-zinc-700 group">
                    <div className="flex items-center flex-1 cursor-pointer mr-2" onClick={() => toggleSubtopic(sub.id, topic.id, sub.status)}>
                      {sub.status === 'COMPLETED' ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-zinc-500 mr-3 flex-shrink-0" />
                      )}
                      {editingSubtopicId === sub.id ? (
                        <div className="flex items-center space-x-2 w-full" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="text" 
                            value={subtopicEditText} 
                            onChange={(e) => setSubtopicEditText(e.target.value)}
                            className="bg-zinc-700 border border-zinc-600 rounded px-2 py-0.5 text-zinc-100 w-full focus:outline-none text-sm"
                          />
                          <Button size="sm" onClick={() => handleUpdateSubtopic(sub.id, topic.id)}><Check className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingSubtopicId(null)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <span className={sub.status === 'COMPLETED' ? 'text-zinc-500 line-through text-sm' : 'text-zinc-200 text-sm'}>
                          {sub.title}
                        </span>
                      )}
                    </div>

                    {editMode && editingSubtopicId !== sub.id && (
                      <div className="flex items-center space-x-1">
                        <button onClick={() => { setEditingSubtopicId(sub.id); setSubtopicEditText(sub.title); }} className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDeleteSubtopic(sub.id, topic.id)} className="p-1 text-zinc-400 hover:text-red-400 cursor-pointer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {editMode && (
                  <>
                    {addingSubtopicToTopic === topic.id ? (
                      <div className="flex items-center space-x-2 mt-3 pt-2">
                        <input 
                          type="text" 
                          placeholder="New subtopic title..." 
                          value={newSubtopicText[topic.id] || ''}
                          onChange={(e) => setNewSubtopicText({ ...newSubtopicText, [topic.id]: e.target.value })}
                          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-100 w-full focus:outline-none"
                        />
                        <Button size="sm" onClick={() => handleAddSubtopic(topic.id)}>Add</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAddingSubtopicToTopic(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setAddingSubtopicToTopic(topic.id)} 
                        className="mt-2 text-xs text-zinc-400 hover:text-amber-200 flex items-center cursor-pointer pt-1"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add subtopic
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {editMode && (
            <>
              {isAddingTopic ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
                  <h4 className="font-semibold text-zinc-200">Add New Topic</h4>
                  <input 
                    type="text" 
                    placeholder="Topic title..." 
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 w-full focus:outline-none"
                  />
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={handleAddTopic}>Save Topic</Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsAddingTopic(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setIsAddingTopic(true)} className="w-full py-6 border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200">
                  <Plus className="h-4 w-4 mr-2" /> Add New Topic
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};