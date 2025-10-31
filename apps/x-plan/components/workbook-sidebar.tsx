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
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <header className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Workbook Progress</span>
          <span>{percentage}%</span>
        </header>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.max(percentage, completionRatio.completed > 0 ? 8 : 0)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {completionRatio.completed} of {completionRatio.total} sheets populated
        </p>
      </section>

      <nav className="flex flex-col gap-2">
        {items.map((item) => {
          const isActive = item.slug === activeSlug
          const statusTone = item.status === 'complete' ? 'text-emerald-600' : 'text-slate-400'
          const dotTone = item.status === 'complete' ? 'bg-emerald-500' : 'bg-slate-300'

          return (
            <Link
              key={item.slug}
              href={`/sheet/${item.slug}`}
              className={clsx(
                'group rounded-xl border border-transparent p-4 transition hover:border-slate-200 hover:bg-white hover:shadow-sm',
                isActive && 'border-slate-200 bg-white shadow-sm',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={clsx('h-2 w-2 rounded-full transition', dotTone)} />
                <p className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-900">
                  {item.label}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
              <footer className="mt-3 flex items-center justify-between text-xs text-slate-400">
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
