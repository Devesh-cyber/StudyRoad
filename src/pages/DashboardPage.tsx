import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, GitBranch, Loader2, Plus, Star } from 'lucide-react'
import { fetchSummaries } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ProgressBar'

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['summaries'], queryFn: fetchSummaries })

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-100">My Roadmaps</h2>
        <Link to="/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" /> New roadmap
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin h-6 w-6 text-zinc-500" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg border border-red-900 bg-red-950/40 text-red-300 text-sm">
          Couldn't load roadmaps: {(error as Error).message}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="p-12 text-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-500">
          No roadmaps yet. Create your first one.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.map((r) => (
          <Link
            key={r.id}
            to={`/r/${r.id}`}
            className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors flex flex-col gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                {r.kind === 'challenge' ? (
                  <><CalendarDays className="h-3.5 w-3.5" /> Challenge</>
                ) : (
                  <><GitBranch className="h-3.5 w-3.5" /> Roadmap</>
                )}
              </div>
              <h3 className="text-lg font-semibold text-zinc-100">{r.title}</h3>
              {r.focus_title && (
                <p className="text-xs text-amber-200 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-200" /> {r.focus_title}
                </p>
              )}
            </div>
            <div className="space-y-1.5 mt-auto">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>
                  {r.done_items} / {r.total_items} {r.kind === 'challenge' ? 'days' : 'done'}
                </span>
                <span className="text-zinc-200">{r.percent}%</span>
              </div>
              <ProgressBar value={r.percent} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
