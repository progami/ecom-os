'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import type { SheetConfig, SheetSlug } from '@/lib/sheets'

type SheetTab = SheetConfig & { href?: string }

interface SheetTabsProps {
  sheets: SheetTab[]
  activeSlug: SheetSlug
  suffix?: React.ReactNode
  variant?: 'scroll' | 'stack'
  onSheetSelect?: (slug: SheetSlug) => void
}

export function SheetTabs({ sheets, activeSlug, suffix, variant = 'scroll', onSheetSelect }: SheetTabsProps) {
  const pathname = usePathname()
  const isStack = variant === 'stack'
  const navClassName = clsx(
    'flex gap-1',
    isStack ? 'flex-col' : 'items-center overflow-x-auto'
  )
  const linkBase =
    'relative min-w-[140px] overflow-hidden rounded-xl px-4 py-2.5 text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal-400'

  const handleClick = (slug: SheetSlug, event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onSheetSelect) return
    event.preventDefault()
    onSheetSelect(slug)
  }

  return (
    <div className={clsx('flex w-full', isStack ? 'flex-col gap-3' : 'items-center justify-between gap-3 py-2')}>
      <nav className={navClassName}>
        {sheets.map((sheet) => {
          const href = sheet.href ?? `/sheet/${sheet.slug}`
          const isActive = activeSlug === sheet.slug || pathname === href
          return (
            <Link
              key={sheet.slug}
              href={href}
              onClick={onSheetSelect ? (event) => handleClick(sheet.slug, event) : undefined}
              className={clsx(
                linkBase,
                isActive
                  ? 'bg-gradient-to-br from-brand-teal-500 to-brand-teal-700 text-white shadow-soft-lg ring-2 ring-brand-teal-300/50 dark:ring-brand-teal-600/50'
                  : 'bg-white text-zinc-700 shadow-soft hover:bg-gradient-to-br hover:from-brand-teal-50 hover:to-brand-teal-100 hover:text-brand-teal-700 hover:shadow-soft-lg dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-gradient-to-br dark:hover:from-brand-navy-900/50 dark:hover:to-brand-navy-950/30 dark:hover:text-brand-teal-300'
              )}
            >
              <span className="relative z-10">{sheet.label}</span>
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
              )}
            </Link>
          )
        })}
      </nav>
      {suffix && <div className="shrink-0">{suffix}</div>}
    </div>
  )
}
