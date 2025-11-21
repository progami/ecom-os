"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { SheetTabs } from '@/components/sheet-tabs'
import { getSheetConfig } from '@/lib/sheets'
import type { YearSegment } from '@/lib/calculations/calendar'
import type { WorkbookSheetStatus } from '@/lib/workbook'
import { usePersistentScroll } from '@/hooks/usePersistentScroll'
import { clsx } from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import {
  SHEET_TOOLBAR_BUTTON,
  SHEET_TOOLBAR_CONTAINER,
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_ICON_BUTTON,
  SHEET_TOOLBAR_LABEL,
} from '@/components/sheet-toolbar'
import { ThemeToggle } from '@/components/theme-toggle'

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

  usePersistentScroll(`sheet:${activeSlug}`, true)

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
    (slug: SheetSlug, yearOverride?: number | null) => {
      const base = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams()
      const targetYear = yearOverride ?? resolvedYear
      if (targetYear != null) {
        base.set('year', String(targetYear))
      } else {
        base.delete('year')
      }
      const query = base.toString()
      return `/sheet/${slug}${query ? `?${query}` : ''}`
    },
    [resolvedYear, searchParams]
  )

  const goToSheet = useCallback(
    (slug: SheetSlug, yearOverride?: number | null) => {
      if (!slug) return
      const targetHref = buildSheetHref(slug, yearOverride)
      const nextYear = yearOverride ?? resolvedYear
      if (slug === activeSlug && nextYear === resolvedYear) return
      startTransition(() => {
        router.push(targetHref)
      })
    },
    [activeSlug, buildSheetHref, resolvedYear, router]
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
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700 dark:text-cyan-300/90">Year</span>
        <button
          type="button"
          onClick={() => goToAdjacentYear(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#00C2B9]/50 dark:hover:text-cyan-100 dark:focus-visible:outline-[#00C2B9]"
          aria-label="Previous year"
          disabled={!previous || isPending}
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
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
                    ? 'border border-cyan-600 bg-cyan-600/20 text-slate-900 shadow-md dark:border-[#00C2B9] dark:bg-[#00C2B9]/30 dark:text-white dark:shadow-[0_18px_40px_rgba(0,194,185,0.3)]'
                    : 'border border-slate-300 bg-white text-slate-600 hover:border-cyan-500 hover:bg-slate-50 hover:text-slate-900 dark:border-[#6F7B8B]/50 dark:bg-[#002C51]/70 dark:text-[#6F7B8B] dark:hover:border-[#00C2B9]/70 dark:hover:bg-[#002C51] dark:hover:text-white'
                )}
                aria-pressed={isActiveYear}
                disabled={isPending && isActiveYear}
              >
                <span>{segment.year}</span>
                <span className={clsx(
                  "ml-2 text-xs font-semibold",
                  isActiveYear ? "text-cyan-700 dark:text-[#00C2B9]/90" : "text-slate-500 dark:text-[#6F7B8B]/70"
                )}>{segment.weekCount}w</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => goToAdjacentYear(1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 disabled:opacity-40 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-[#00C2B9]/50 dark:hover:text-cyan-100 dark:focus-visible:outline-[#00C2B9]"
          aria-label="Next year"
          disabled={!next || isPending}
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    )
  }, [activeYearIndex, goToAdjacentYear, handleYearSelect, isPending, isYearAwareSheet, resolvedYear, sortedYears])

  const hasControls = Boolean(yearSwitcher || headerControls)

  const yearTraversal = useMemo(() => {
    if (!sortedYears.length) return [] as Array<{ slug: SheetSlug; year: number }>
    const sequence = ['3-sales-planning', '4-fin-planning-pl', '5-fin-planning-cash-flow'] as const
    const result: Array<{ slug: SheetSlug; year: number }> = []
    for (const segment of sortedYears) {
      for (const slug of sequence) {
        if (YEAR_AWARE_SHEETS.has(slug)) {
          result.push({ slug, year: segment.year })
        }
      }
    }
    return result
  }, [sortedYears])

  const traversalIndex = useMemo(() => {
    if (resolvedYear == null) return -1
    return yearTraversal.findIndex((entry) => entry.slug === activeSlug && entry.year === resolvedYear)
  }, [activeSlug, resolvedYear, yearTraversal])

  const traversalIndexRef = useRef(traversalIndex)

  useEffect(() => {
    traversalIndexRef.current = traversalIndex
  }, [traversalIndex])

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
      const target = event.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return
        if (target.isContentEditable) return
        if (target.closest('.handsontableInput')) return
      }

      // Ctrl + PageUp/PageDown to navigate sheets
      if (event.ctrlKey && !event.altKey && !event.metaKey) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          const currentIndex = traversalIndexRef.current
          if (currentIndex === -1) return
          const nextIndex = event.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1
          if (nextIndex < 0 || nextIndex >= yearTraversal.length) return
          const target = yearTraversal[nextIndex]
          event.preventDefault()
          traversalIndexRef.current = nextIndex
          goToSheet(target.slug, target.year)
          return
        }

        if (event.key === 'PageUp' || event.key === 'PageDown') {
          event.preventDefault()
          const index = sheets.findIndex((sheet) => sheet.slug === activeSlug)
          if (index === -1) return
          const nextIndex = event.key === 'PageUp' ? (index - 1 + sheets.length) % sheets.length : (index + 1) % sheets.length
          goToSheet(sheets[nextIndex].slug)
          return
        }

        // Ctrl + 1-5 to jump to specific sheets
        const num = parseInt(event.key, 10)
        if (num >= 1 && num <= sheets.length) {
          event.preventDefault()
          goToSheet(sheets[num - 1].slug)
          return
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeSlug, goToSheet, sheets, traversalIndex, yearTraversal])

  const activeSheet = useMemo(() => sheets.find((sheet) => sheet.slug === activeSlug), [sheets, activeSlug])

  const sheetTabs = useMemo(() => {
    return sheets.map((sheet) => {
      const config = getSheetConfig(sheet.slug)
      return {
        ...config,
        ...sheet,
        icon: config?.icon ?? FileText,
        href: buildSheetHref(sheet.slug),
      }
    })
  }, [buildSheetHref, sheets])

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
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-[#041324]">
      <main className="flex flex-1 overflow-hidden" role="main" aria-label="Main content">
        <section className="flex flex-1 overflow-hidden">
          <div className={clsx("flex-1 min-h-0 overflow-hidden", YEAR_AWARE_SHEETS.has(activeSlug) ? "overflow-hidden" : "overflow-auto")}>
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-lg backdrop-blur-xl dark:border-[#0b3a52] dark:bg-[#041324]/95 dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)] sm:px-6 lg:px-8" role="banner">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 shadow-md dark:bg-[#00c2b9] dark:shadow-[0_12px_24px_rgba(0,194,185,0.25)]">
                      <span className="text-lg font-bold text-white dark:text-[#002430]">X</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-700/70 dark:text-cyan-300/60">X-Plan</span>
                      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{activeSheet?.label ?? 'Workbook'}</h1>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {isPending && (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-[#00C2B9]" />
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700 dark:text-cyan-200/90">Loading…</span>
                      </div>
                    )}
                    <ThemeToggle />
                    {ribbon}
                  </div>
                </div>

                <div className="hidden lg:block">
                  <SheetTabs
                    sheets={sheetTabs}
                    activeSlug={activeSlug}
                    variant="scroll"
                    onSheetSelect={goToSheet}
                  />
                </div>

                {hasControls && (
                  <div className="hidden lg:flex items-center justify-end gap-4 border-t border-slate-200 pt-4 dark:border-[#0b3a52]">
                    {headerControls}
                    {yearSwitcher}
                  </div>
                )}
              </div>
            </header>
            <div className={clsx("flex h-full min-h-0 flex-col overflow-hidden px-4 py-6 sm:px-6 lg:px-8")}>
              {children}
            </div>
          </div>
          {hasContextPane && (
            <div
              className="relative hidden h-full shrink-0 border-l border-slate-200 bg-white/90 backdrop-blur-sm dark:border-[#0b3a52] dark:bg-[#06182b]/85 lg:block"
              style={{ width: contextWidth }}
            >
              <div
                role="separator"
                aria-orientation="vertical"
                className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-cyan-600/30 transition-colors hover:bg-cyan-600/50 dark:bg-[#00c2b9]/30 dark:hover:bg-[#00c2b9]/50"
                onMouseDown={() => setIsResizing(true)}
              />
              <div className="h-full overflow-auto px-5 py-6">
                {contextPane}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="space-y-3 border-t border-slate-200 bg-white/95 px-2 py-3 shadow-lg backdrop-blur-xl dark:border-[#0b3a52] dark:bg-[#041324]/95 dark:shadow-[0_26px_55px_rgba(1,12,24,0.55)] lg:hidden" role="navigation" aria-label="Sheet navigation">
        <SheetTabs
          sheets={sheetTabs}
          activeSlug={activeSlug}
          variant="scroll"
          onSheetSelect={goToSheet}
        />
        {hasControls && (
          <div className="flex items-center justify-end gap-4 border-t border-slate-200 pt-3 dark:border-[#0b3a52]">
            {headerControls}
            {yearSwitcher}
          </div>
        )}
      </footer>
    </div>
  )
}
