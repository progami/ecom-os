'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import type { WorkbookSheetStatus } from '@/lib/workbook'

interface WorkbookSidebarProps {
  items: WorkbookSheetStatus[]
  activeSlug: string
  completionRatio: { completed: number; total: number }
}

export function WorkbookSidebar({ items, activeSlug, completionRatio }: WorkbookSidebarProps) {
  const percentage = completionRatio.total === 0 ? 0 : Math.round((completionRatio.completed / completionRatio.total) * 100)

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-6 lg:flex">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>Workbook Progress</span>
          <span>{percentage}%</span>
        </header>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.max(percentage, completionRatio.completed > 0 ? 8 : 0)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {completionRatio.completed} of {completionRatio.total} sheets populated
        </p>
      </section>

      <nav className="flex flex-col gap-2">
        {items.map((item) => {
          const isActive = item.slug === activeSlug
          const statusTone = item.status === 'complete' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
          const dotTone = item.status === 'complete' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'

          return (
            <Link
              key={item.slug}
              href={`/${item.slug}`}
              className={clsx(
                'group rounded-xl border border-transparent p-4 transition hover:border-slate-200 hover:bg-white hover:shadow-sm dark:hover:border-slate-700 dark:hover:bg-slate-900',
                isActive && 'border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={clsx('h-2 w-2 rounded-full transition', dotTone)} />
                <p className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-900 dark:text-slate-100">
                  {item.label}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
              <footer className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <span className={statusTone}>{item.status === 'complete' ? 'Data synced' : 'Needs input'}</span>
                {item.relativeUpdatedAt && <span>{item.relativeUpdatedAt}</span>}
              </footer>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
