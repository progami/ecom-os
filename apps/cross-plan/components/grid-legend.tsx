export function GridLegend({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm bg-sky-200 dark:bg-sky-400/40" />
        Editable cell
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm bg-slate-200 dark:bg-slate-700" />
        Locked cell
      </span>
      {hint && <span className="text-slate-400 dark:text-slate-500">{hint}</span>}
    </div>
  )
}

