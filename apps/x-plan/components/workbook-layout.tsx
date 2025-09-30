"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { SheetTabs } from '@/components/sheet-tabs'
import type { YearSegment } from '@/lib/calculations/calendar'
import type { WorkbookSheetStatus } from '@/lib/workbook'
import { clsx } from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  SHEET_TOOLBAR_BUTTON,
  SHEET_TOOLBAR_CONTAINER,
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_ICON_BUTTON,
  SHEET_TOOLBAR_LABEL,
} from '@/components/sheet-toolbar'

type SheetSlug = WorkbookSheetStatus['slug']

interface WorkbookLayoutProps {
  sheets: WorkbookSheetStatus[]
  activeSlug: SheetSlug
  planningYears?: YearSegment[]
  activeYear?: number | null
  meta?: {
    rows?: number
    updated?: string
  }
  ribbon?: React.ReactNode
  contextPane?: React.ReactNode
  headerControls?: React.ReactNode
  children: React.ReactNode
}

const MIN_CONTEXT_WIDTH = 320
const MAX_CONTEXT_WIDTH = 560
const YEAR_AWARE_SHEETS: ReadonlySet<SheetSlug> = new Set([
  '3-sales-planning',
  '4-fin-planning-pl',
  '5-fin-planning-cash-flow',
])

export function WorkbookLayout({ sheets, activeSlug, planningYears, activeYear, meta, ribbon, contextPane, headerControls, children }: WorkbookLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [contextWidth, setContextWidth] = useState(360)
  const [isResizing, setIsResizing] = useState(false)
  const hasContextPane = Boolean(contextPane)
  const [isPending, startTransition] = useTransition()

  const sortedYears = useMemo(() => {
    if (!planningYears) return [] as YearSegment[]
    return [...planningYears].sort((a, b) => a.year - b.year)
  }, [planningYears])

  const resolvedYear = useMemo(() => {
    if (!sortedYears.length) return null
    if (activeYear != null && sortedYears.some((segment) => segment.year === activeYear)) {
      return activeYear
    }
    return sortedYears[0]?.year ?? null
  }, [activeYear, sortedYears])

  const buildSheetHref = useCallback(
    (slug: SheetSlug) => {
      const base = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams()
      if (resolvedYear != null) {
        base.set('year', String(resolvedYear))
      } else {
        base.delete('year')
      }
      const query = base.toString()
      return `/sheet/${slug}${query ? `?${query}` : ''}`
    },
    [resolvedYear, searchParams]
  )

  const goToSheet = useCallback(
    (slug: SheetSlug) => {
      if (!slug || slug === activeSlug) return
      startTransition(() => {
        router.push(buildSheetHref(slug))
      })
    },
    [activeSlug, buildSheetHref, router]
  )

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isResizing) return
    const newWidth = window.innerWidth - event.clientX - 16
    setContextWidth(Math.min(Math.max(newWidth, MIN_CONTEXT_WIDTH), MAX_CONTEXT_WIDTH))
  }, [isResizing])

  const stopResizing = useCallback(() => setIsResizing(false), [])

  const handleYearSelect = useCallback(
    (year: number) => {
      if (resolvedYear === year) return
      startTransition(() => {
        const params = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams()
        params.set('year', String(year))
        const query = params.toString()
        router.push(`${pathname}${query ? `?${query}` : ''}`)
      })
    },
    [pathname, resolvedYear, router, searchParams, startTransition],
  )

  const activeYearIndex = useMemo(() => {
    if (resolvedYear == null) return -1
    return sortedYears.findIndex((segment) => segment.year === resolvedYear)
  }, [resolvedYear, sortedYears])

  const goToAdjacentYear = useCallback(
    (offset: -1 | 1) => {
      if (!sortedYears.length) return
      const fallbackIndex = resolvedYear == null ? 0 : activeYearIndex
      const currentIndex = fallbackIndex >= 0 ? fallbackIndex : 0
      const target = sortedYears[currentIndex + offset]
      if (!target) return
      handleYearSelect(target.year)
    },
    [activeYearIndex, handleYearSelect, resolvedYear, sortedYears],
  )

  const isYearAwareSheet = YEAR_AWARE_SHEETS.has(activeSlug)

  const yearSwitcher = useMemo(() => {
    if (!sortedYears.length || !isYearAwareSheet) return null
    const previous = activeYearIndex > 0 ? sortedYears[activeYearIndex - 1] : null
    const next =
      activeYearIndex >= 0 && activeYearIndex < sortedYears.length - 1 ? sortedYears[activeYearIndex + 1] : null

    return (
      <div className={`${SHEET_TOOLBAR_GROUP} gap-2`}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">Year</span>
        <button
          type="button"
          onClick={() => goToAdjacentYear(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-100 disabled:opacity-40"
          aria-label="Previous year"
          disabled={!previous || isPending}
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5">
          {sortedYears.map((segment) => {
            const isActiveYear = resolvedYear === segment.year
            return (
              <button
                key={segment.year}
                type="button"
                onClick={() => handleYearSelect(segment.year)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                  isActiveYear
                    ? 'border border-[#00c2b9] bg-[#00c2b9]/15 text-cyan-100 shadow-[0_18px_40px_rgba(0,194,185,0.2)]'
                    : 'border border-white/12 bg-white/5 text-slate-200 hover:border-cyan-300/50 hover:text-cyan-100'
                )}
                aria-pressed={isActiveYear}
                disabled={isPending && isActiveYear}
              >
                <span>{segment.year}</span>
                <span className={clsx(
                  "ml-1.5 text-[10px] font-semibold",
                  isActiveYear ? "text-cyan-200/80" : "text-slate-400"
                )}>{segment.weekCount}w</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => goToAdjacentYear(1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-100 disabled:opacity-40"
          aria-label="Next year"
          disabled={!next || isPending}
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    )
  }, [activeYearIndex, goToAdjacentYear, handleYearSelect, isPending, isYearAwareSheet, resolvedYear, sortedYears])

  const hasControls = Boolean(yearSwitcher || headerControls)

  useEffect(() => {
    if (!isResizing) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [handleMouseMove, isResizing, stopResizing])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return
      if (event.key !== 'PageUp' && event.key !== 'PageDown') return
      event.preventDefault()
      const index = sheets.findIndex((sheet) => sheet.slug === activeSlug)
      if (index === -1) return
      const nextIndex = event.key === 'PageUp' ? (index - 1 + sheets.length) % sheets.length : (index + 1) % sheets.length
      goToSheet(sheets[nextIndex].slug)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeSlug, goToSheet, sheets])

  const activeSheet = useMemo(() => sheets.find((sheet) => sheet.slug === activeSlug), [sheets, activeSlug])

  const sheetTabs = useMemo(
    () => sheets.map((sheet) => ({ ...sheet, href: buildSheetHref(sheet.slug) })),
    [buildSheetHref, sheets]
  )

  const metaSummary = useMemo(() => {
    if (!meta) return undefined
    if (!meta.updated) {
      return {
        display: 'Updated —',
        tooltip: 'No updates recorded yet',
      }
    }

    const parsed = new Date(meta.updated)
    if (Number.isNaN(parsed.getTime())) {
      return {
        display: `Updated ${meta.updated}`,
        tooltip: `Updated ${meta.updated}`,
      }
    }

    const display = `Updated ${new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
      .format(parsed)
      .replace(',', '')}`

    const tooltip = `Updated ${new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(parsed)}`

    return { display, tooltip }
  }, [meta])


  return (
    <div className="flex min-h-screen flex-col bg-[#041324]">
      <main className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto">
            <header className="sticky top-0 z-10 border-b border-[#0b3a52] bg-[#041324]/95 px-4 py-4 shadow-[0_26px_55px_rgba(1,12,24,0.55)] backdrop-blur-xl sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00c2b9] shadow-[0_12px_24px_rgba(0,194,185,0.25)]">
                      <span className="text-lg font-bold text-[#002430]">X</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-300/80">X-Plan</span>
                      <h1 className="text-xl font-semibold text-white">{activeSheet?.label ?? 'Workbook'}</h1>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {isPending && <span className="animate-pulse text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Loading…</span>}
                    {ribbon}
                  </div>
                </div>

                {(activeSheet?.description || metaSummary) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {activeSheet?.description && (
                      <p className="text-sm leading-relaxed text-slate-200/80">{activeSheet.description}</p>
                    )}
                    {metaSummary && (
                      <span
                        className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80"
                        title={metaSummary.tooltip}
                      >
                        {metaSummary.display}
                      </span>
                    )}
                  </div>
                )}

                <div className="hidden lg:block">
                  <SheetTabs
                    sheets={sheetTabs}
                    activeSlug={activeSlug}
                    variant="scroll"
                    onSheetSelect={goToSheet}
                  />
                </div>

                {hasControls && (
                  <div className="hidden lg:flex items-center justify-end gap-4 border-t border-[#0b3a52] pt-3">
                    {headerControls}
                    {yearSwitcher}
                  </div>
                )}
              </div>
            </header>
            <div className="px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
          {hasContextPane && (
            <div
              className="relative hidden h-full shrink-0 border-l border-[#0b3a52] bg-[#06182b]/85 backdrop-blur-sm lg:block"
              style={{ width: contextWidth }}
            >
              <div
                role="separator"
                aria-orientation="vertical"
                className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-[#00c2b9]/30 transition-colors hover:bg-[#00c2b9]/50"
                onMouseDown={() => setIsResizing(true)}
              />
              <div className="h-full overflow-auto px-5 py-6">
                {contextPane}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="space-y-3 border-t border-[#0b3a52] bg-[#041324]/95 px-2 py-3 shadow-[0_26px_55px_rgba(1,12,24,0.55)] backdrop-blur-xl lg:hidden">
        <SheetTabs
          sheets={sheetTabs}
          activeSlug={activeSlug}
          variant="scroll"
          onSheetSelect={goToSheet}
        />
        {hasControls && (
          <div className="flex items-center justify-end gap-4 border-t border-[#0b3a52] pt-3">
            {headerControls}
            {yearSwitcher}
          </div>
        )}
      </footer>
    </div>
  )
}
