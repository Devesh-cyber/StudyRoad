export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-zinc-950 rounded-full h-2 border border-zinc-800 overflow-hidden">
      <div
        className="bg-amber-400 h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
