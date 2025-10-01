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
    'relative min-w-[160px] overflow-hidden rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2B9] touch-manipulation'

  const handleClick = (slug: SheetSlug, event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onSheetSelect) return
    event.preventDefault()
    onSheetSelect(slug)
  }

  return (
    <div className={clsx('flex w-full', isStack ? 'flex-col gap-3' : 'items-center justify-between gap-2 py-2')}>
      <nav className={navClassName}>
        {sheets.map((sheet) => {
          const Icon = sheet.icon
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
                  ? 'border-[#00C2B9] bg-[#00C2B9]/30 text-white shadow-[0_18px_40px_rgba(0,194,185,0.3)]'
                  : 'border-[#6F7B8B]/50 bg-[#002C51]/70 text-[#6F7B8B] hover:border-[#00C2B9]/70 hover:bg-[#002C51] hover:text-white'
              )}
            >
              <span className="relative z-10 flex items-center gap-2 text-slate-200/95">
                {Icon ? <Icon className="h-4 w-4 text-slate-200/80" aria-hidden /> : null}
                <span>{sheet.label}</span>
              </span>
            </Link>
          )
        })}
      </nav>
      {suffix && <div className="shrink-0">{suffix}</div>}
    </div>
  )
}
