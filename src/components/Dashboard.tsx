import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/authContext';
import { Book, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Dashboard = ({ onImportNew, onOpenRoadmap }: { onImportNew: () => void, onOpenRoadmap: (id: string) => void }) => {
  const { user } = useAuth();
  const [roadmaps, setRoadmaps] = useState<any[]>([]);

  useEffect(() => {
    const fetchRoadmapsWithProgress = async () => {
      if (!user) return;

      // Fetch roadmaps along with their topics and nested subtopics
      const { data, error } = await supabase
        .from('roadmaps')
        .select(`
          id, title, created_at,
          topics (
            id,
            subtopics ( id, status )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching dashboard roadmaps:', error);
      } else if (data) {
        // Calculate progress metrics for each roadmap card
        const processed = data.map(map => {
          let total = 0;
          let completed = 0;

          map.topics?.forEach((topic: any) => {
            if (topic.subtopics) {
              total += topic.subtopics.length;
              completed += topic.subtopics.filter((sub: any) => sub.status === 'COMPLETED').length;
            }
          });

          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          return { ...map, total, completed, percentage };
        });

        setRoadmaps(processed);
      }
    };

    fetchRoadmapsWithProgress();
  }, [user]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-100">My Roadmaps</h2>
        <Button onClick={onImportNew}>
          <Plus className="h-4 w-4 mr-2" /> New Roadmap
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roadmaps.map((map) => (
          <div 
            key={map.id} 
            onClick={() => onOpenRoadmap(map.id)}
            className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 cursor-pointer transition-all shadow-lg flex flex-col justify-between space-y-4 group"
          >
            <div>
              <h3 className="text-lg font-semibold text-amber-200 mb-1 flex items-center group-hover:text-amber-100 transition-colors">
                <Book className="h-5 w-5 mr-2 flex-shrink-0" /> {map.title}
              </h3>
              <p className="text-xs text-zinc-500">
                Created {new Date(map.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Progress Section */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <div className="flex justify-between text-xs text-zinc-400 font-medium">
                <span>Progress</span>
                <span className="text-zinc-200">{map.percentage}%</span>
              </div>
              <div className="w-full bg-zinc-950 rounded-full h-2 border border-zinc-800 overflow-hidden">
                <div 
                  className="bg-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${map.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-500 pt-1">
                <span>{map.completed} of {map.total} completed</span>
                <span>{map.total - map.completed} remaining</span>
              </div>
            </div>
          </div>
        ))}

        {roadmaps.length === 0 && (
          <div className="col-span-full p-12 text-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-500">
            No roadmaps yet. Import one to get started!
          </div>
        )}
      </div>
    </div>
  );
};