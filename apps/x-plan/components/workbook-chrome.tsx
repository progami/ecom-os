interface WorkbookChromeProps {
  workbookTitle: string
  sheetTitle: string
  sheetDescription: string
  meta?: {
    rows?: number
    updated?: string
  }
  actions?: React.ReactNode
  tabs: React.ReactNode
  children: React.ReactNode
}

export function WorkbookChrome({ workbookTitle, sheetTitle, sheetDescription, meta, actions, tabs, children }: WorkbookChromeProps) {
  const metaItems: string[] = []
  if (typeof meta?.rows === 'number') metaItems.push(`${meta.rows} rows`)
  if (meta?.updated) metaItems.push(`Updated ${meta.updated}`)

  return (
    <div className="flex min-h-screen flex-col bg-slate-100/60">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{workbookTitle}</span>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{sheetTitle}</h1>
              <p className="max-w-3xl text-xs text-slate-500 dark:text-slate-400">{sheetDescription}</p>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
          {metaItems.length > 0 && <p className="text-xs text-slate-400 dark:text-slate-500">{metaItems.join(' • ')}</p>}
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1600px] px-2 py-4 sm:px-4 lg:px-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center px-2 sm:px-4 lg:px-6">
          {tabs}
        </div>
      </footer>
    </div>
  )
}

