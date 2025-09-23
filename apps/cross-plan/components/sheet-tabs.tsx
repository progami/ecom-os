'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import type { SheetConfig } from '@/lib/sheets'

interface SheetTabsProps {
  sheets: SheetConfig[]
  activeSlug: string
  suffix?: React.ReactNode
  variant?: 'scroll' | 'stack'
  onSheetSelect?: (slug: string) => void
}

export function SheetTabs({ sheets, activeSlug, suffix, variant = 'scroll', onSheetSelect }: SheetTabsProps) {
  const pathname = usePathname()
  const isStack = variant === 'stack'
  const navClassName = clsx(
    'flex gap-1',
    isStack ? 'flex-col' : 'items-center overflow-x-auto'
  )
  const linkBase =
    'min-w-[140px] rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300'

  const handleClick = (slug: string, event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onSheetSelect) return
    event.preventDefault()
    onSheetSelect(slug)
  }

  return (
    <div className={clsx('flex w-full', isStack ? 'flex-col gap-3' : 'items-center justify-between gap-3 py-2')}> 
      <nav className={navClassName}>
        {sheets.map((sheet) => {
          const href = `/sheet/${sheet.slug}`
          const isActive = activeSlug === sheet.slug || pathname === href
          return (
            <Link
              key={sheet.slug}
              href={href}
              onClick={onSheetSelect ? (event) => handleClick(sheet.slug, event) : undefined}
              className={clsx(
                linkBase,
                isActive
                  ? 'bg-slate-900 text-slate-50 shadow-sm dark:bg-slate-50 dark:text-slate-900'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              )}
            >
              {sheet.label}
            </Link>
          )
        })}
      </nav>
      {suffix && <div className="shrink-0">{suffix}</div>}
    </div>
  )
}
