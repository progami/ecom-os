interface SheetHeaderProps {
  title: string
  description: string
  lastUpdated?: string
  recordCount?: number
  controls?: React.ReactNode
}

export function SheetHeader({ title, description, lastUpdated, recordCount, controls }: SheetHeaderProps) {
  const metaItems: string[] = []
  if (typeof recordCount === 'number') {
    metaItems.push(`${recordCount} data rows`)
  }
  if (lastUpdated) {
    const formatted = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
      .format(new Date(lastUpdated))
      .replace(',', '')
    metaItems.push(`Last updated ${formatted}`)
  }

  return (
    <header className="border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
          {metaItems.length > 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">{metaItems.join(' • ')}</p>
          )}
        </div>
        {controls && <div className="flex shrink-0 items-center gap-2">{controls}</div>}
      </div>
    </header>
  )
}
