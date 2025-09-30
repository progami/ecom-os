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
      <div className={`${SHEET_TOOLBAR_GROUP} gap-1`}>
        <span className={SHEET_TOOLBAR_LABEL}>Year</span>
        <button
          type="button"
          onClick={() => goToAdjacentYear(-1)}
          className={SHEET_TOOLBAR_ICON_BUTTON}
          aria-label="Previous year"
          disabled={!previous || isPending}
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1">
          {sortedYears.map((segment) => {
            const isActiveYear = resolvedYear === segment.year
            return (
              <button
                key={segment.year}
                type="button"
                onClick={() => handleYearSelect(segment.year)}
                className={clsx(
                  SHEET_TOOLBAR_BUTTON,
                  'rounded-full px-2.5 py-1',
                  isActiveYear
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-50 dark:text-slate-900'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100'
                )}
                aria-pressed={isActiveYear}
                disabled={isPending && isActiveYear}
              >
                <span>{segment.year}</span>
                <span className="ml-1 text-[10px] font-normal text-slate-400 dark:text-slate-500">{segment.weekCount}w</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => goToAdjacentYear(1)}
          className={SHEET_TOOLBAR_ICON_BUTTON}
          aria-label="Next year"
          disabled={!next || isPending}
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    )
  }, [activeYearIndex, goToAdjacentYear, handleYearSelect, isPending, isYearAwareSheet, resolvedYear, sortedYears])

  const headerSuffix = useMemo(() => {
    if (!yearSwitcher && !headerControls) return undefined
    return <div className={SHEET_TOOLBAR_CONTAINER}>{headerControls}{yearSwitcher}</div>
  }, [headerControls, yearSwitcher])

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
    <div className="flex min-h-screen flex-col bg-slate-100/60">
      <main className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-[0.25em] text-slate-400">X-Plan</span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{activeSheet?.label ?? 'Workbook'}</h1>
                    {metaSummary && (
                      <span
                        className="text-xs font-medium text-slate-400 dark:text-slate-500"
                        title={metaSummary.tooltip}
                      >
                        {metaSummary.display}
                      </span>
                    )}
                  </div>
                  <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{activeSheet?.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isPending && <span className="text-xs text-slate-400">Loading…</span>}
                  {ribbon}
                </div>
              </div>
              <div className="mt-3 hidden items-center gap-2 text-xs text-slate-500 dark:text-slate-400 lg:flex">
                <SheetTabs
                  sheets={sheetTabs}
                  activeSlug={activeSlug}
                  variant="scroll"
                  onSheetSelect={goToSheet}
                  suffix={headerSuffix}
                />
              </div>
            </header>
            <div className="px-4 py-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
          {hasContextPane && (
            <div
              className="relative hidden h-full shrink-0 border-l border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 lg:block"
              style={{ width: contextWidth }}
            >
              <div
                role="separator"
                aria-orientation="vertical"
                className="absolute left-0 top-0 h-full w-1 cursor-ew-resize bg-transparent"
                onMouseDown={() => setIsResizing(true)}
              />
              <div className="h-full overflow-auto px-4 py-4">
                {contextPane}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/90 px-2 py-2 shadow-inner backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 lg:hidden">
        <SheetTabs
          sheets={sheetTabs}
          activeSlug={activeSlug}
          variant="scroll"
          onSheetSelect={goToSheet}
          suffix={headerSuffix}
        />
      </footer>
    </div>
  )
}
