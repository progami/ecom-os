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
    'relative min-w-[160px] overflow-hidden rounded-2xl border px-4 py-3 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60'

  const handleClick = (slug: SheetSlug, event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onSheetSelect) return
    event.preventDefault()
    onSheetSelect(slug)
  }

  return (
    <div className={clsx('flex w-full', isStack ? 'flex-col gap-3' : 'items-center justify-between gap-2 py-2')}>
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
                  ? 'border-[#00c2b9] bg-[#00c2b9]/15 text-cyan-100 shadow-[0_18px_40px_rgba(0,194,185,0.2)]'
                  : 'border-white/12 bg-white/5 text-slate-200 hover:border-cyan-300/50 hover:text-cyan-100'
              )}
            >
              <span className="relative z-10">{sheet.label}</span>
            </Link>
          )
        })}
      </nav>
      {suffix && <div className="shrink-0">{suffix}</div>}
    </div>
  )
}
