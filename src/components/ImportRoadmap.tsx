import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { parseMarkdownTree, type ParsedRoadmap } from '@/lib/parser';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/authContext';
import { Upload, FileText, Loader2, CheckCircle } from 'lucide-react';

export const ImportRoadmap = () => {
  const { user } = useAuth();
  const [parsedData, setParsedData] = useState<ParsedRoadmap | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setParsedData(parseMarkdownTree(text));
      setSuccess(false);
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!parsedData || !user) return;
    setIsUploading(true);
    
    const { error } = await supabase.rpc('import_roadmap_tree', {
      p_user_id: user.id,
      p_title: parsedData.title,
      p_topics: parsedData.topics
    });

    setIsUploading(false);
    if (error) {
      console.error('Failed to save roadmap:', error);
      alert('Error saving roadmap: ' + error.message);
    } else {
      setSuccess(true);
      setParsedData(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="border-2 border-dashed border-zinc-700 rounded-xl p-10 text-center bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors relative">
        <input
          type="file"
          accept=".md"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Upload className="mx-auto h-12 w-12 text-zinc-500 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-200">Upload Roadmap Markdown</h3>
        <p className="text-zinc-400 mt-2 text-sm">Drag and drop your .md file here, or click to select</p>
      </div>

      {parsedData && (
        <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
          <h3 className="text-xl font-bold text-amber-200 mb-4 flex items-center">
            <FileText className="mr-2 h-5 w-5" /> {parsedData.title}
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2 mb-6">
            {parsedData.topics.map((topic, i) => (
              <div key={i} className="border-l-2 border-zinc-700 pl-4">
                <h4 className="font-semibold text-zinc-200">{topic.title}</h4>
                <ul className="mt-2 space-y-1">
                  {topic.subtopics?.map((sub, j) => (
                    <li key={j} className="text-sm text-zinc-400 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 mr-2" />
                      {sub.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Button onClick={handleSave} disabled={isUploading} className="w-full">
            {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Save to Supabase'}
          </Button>
        </div>
      )}

      {success && (
        <div className="mt-6 p-4 bg-green-900/20 border border-green-900/50 rounded-lg flex items-center text-green-400">
          <CheckCircle className="mr-3 h-5 w-5" />
          Roadmap successfully imported!
        </div>
      )}
    </div>
  );
};