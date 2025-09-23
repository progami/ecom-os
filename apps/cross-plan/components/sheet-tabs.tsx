'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import type { SheetConfig } from '@/lib/sheets'

interface SheetTabsProps {
  sheets: SheetConfig[]
  activeSlug: string
  suffix?: React.ReactNode
}

export function SheetTabs({ sheets, activeSlug, suffix }: SheetTabsProps) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1">
          {sheets.map((sheet) => {
            const href = `/sheet/${sheet.slug}`
            const isActive = activeSlug === sheet.slug || pathname === href
            return (
              <Link
                key={sheet.slug}
                href={href}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50'
                    : 'bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-slate-200'
                )}
              >
                {sheet.label}
              </Link>
            )
          })}
        </nav>
        {suffix}
      </div>
    </div>
  )
}
