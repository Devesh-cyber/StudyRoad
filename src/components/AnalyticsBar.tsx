import React from 'react';
import { Trophy, CheckCircle2, Target } from 'lucide-react';

export const AnalyticsBar = ({ topics }: { topics: any[] }) => {
  let totalSubtopics = 0;
  let completedSubtopics = 0;

  topics.forEach(topic => {
    if (topic.subtopics) {
      totalSubtopics += topic.subtopics.length;
      completedSubtopics += topic.subtopics.filter((s: any) => s.status === 'COMPLETED').length;
    }
  });

  const percentage = totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center space-x-3 w-full md:w-auto">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
          <Trophy className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-zinc-400">Roadmap Progress</h4>
          <p className="text-xl font-bold text-zinc-100">{percentage}% Completed</p>
        </div>
      </div>

      <div className="w-full md:w-64 bg-zinc-950 rounded-full h-3 border border-zinc-800 overflow-hidden">
        <div 
          className="bg-amber-400 h-full transition-all duration-300 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center space-x-6 text-sm text-zinc-400 w-full md:w-auto justify-end">
        <div className="flex items-center">
          <CheckCircle2 className="h-4 w-4 text-green-500 mr-1.5" />
          <span>{completedSubtopics} Completed</span>
        </div>
        <div className="flex items-center">
          <Target className="h-4 w-4 text-zinc-500 mr-1.5" />
          <span>{totalSubtopics - completedSubtopics} Remaining</span>
        </div>
      </div>
    </div>
  );
};