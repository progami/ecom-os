"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { SheetTabs } from '@/components/sheet-tabs'
import type { WorkbookSheetStatus } from '@/lib/workbook'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'

type SheetSlug = WorkbookSheetStatus['slug']

interface WorkbookLayoutProps {
  sheets: WorkbookSheetStatus[]
  activeSlug: SheetSlug
  meta?: {
    rows?: number
    updated?: string
  }
  ribbon?: React.ReactNode
  contextPane?: React.ReactNode
  activeYear?: number
  yearOptions?: Array<{ year: number; weekCount: number }>
  children: React.ReactNode
}

const MIN_CONTEXT_WIDTH = 320
const MAX_CONTEXT_WIDTH = 560

export function WorkbookLayout({
  sheets,
  activeSlug,
  meta,
  ribbon,
  contextPane,
  activeYear,
  yearOptions,
  children,
}: WorkbookLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [contextWidth, setContextWidth] = useState(360)
  const [isResizing, setIsResizing] = useState(false)
  const hasContextPane = Boolean(contextPane)
  const [isPending, startTransition] = useTransition()

  const yearSearchParams = useMemo(() => {
    if (activeYear == null) return undefined
    return { year: String(activeYear) }
  }, [activeYear])

  const sheetQuery = useMemo(() => {
    return activeYear != null ? `?year=${activeYear}` : ''
  }, [activeYear])

  const goToYear = useCallback(
    (year: number) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('year', String(year))
      const query = params.toString()
      router.push(`${pathname}${query ? `?${query}` : ''}`)
    },
    [pathname, router, searchParams]
  )

  const goToSheet = useCallback(
    (slug: SheetSlug) => {
      if (!slug || slug === activeSlug) return
      startTransition(() => {
        router.push(`/sheet/${slug}${sheetQuery}`)
      })
    },
    [activeSlug, router, sheetQuery]
  )

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isResizing) return
    const newWidth = window.innerWidth - event.clientX - 16
    setContextWidth(Math.min(Math.max(newWidth, MIN_CONTEXT_WIDTH), MAX_CONTEXT_WIDTH))
  }, [isResizing])

  const stopResizing = useCallback(() => setIsResizing(false), [])

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
      if (!event.ctrlKey) return
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault()
        const index = sheets.findIndex((sheet) => sheet.slug === activeSlug)
        if (index === -1) return
        const nextIndex = event.key === 'PageUp' ? (index - 1 + sheets.length) % sheets.length : (index + 1) % sheets.length
        goToSheet(sheets[nextIndex].slug)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeSlug, goToSheet, sheets])

  const activeSheet = useMemo(() => sheets.find((sheet) => sheet.slug === activeSlug), [sheets, activeSlug])

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
                <div className="flex flex-1 items-center justify-between gap-3">
                  <SheetTabs
                    sheets={sheets}
                    activeSlug={activeSlug}
                    variant="scroll"
                    onSheetSelect={goToSheet}
                    searchParams={yearSearchParams}
                  />
                  {yearOptions && yearOptions.length > 0 && (
                    <YearSwitcher
                      activeYear={activeYear}
                      options={yearOptions}
                      onSelectYear={goToYear}
                    />
                  )}
                </div>
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
        <div className="flex flex-col gap-2">
          {yearOptions && yearOptions.length > 0 && (
            <YearSwitcher
              activeYear={activeYear}
              options={yearOptions}
              onSelectYear={goToYear}
              size="compact"
            />
          )}
          <SheetTabs
            sheets={sheets}
            activeSlug={activeSlug}
            variant="scroll"
            onSheetSelect={goToSheet}
            searchParams={yearSearchParams}
          />
        </div>
      </footer>
    </div>
  )
}

interface YearSwitcherProps {
  activeYear?: number
  options: Array<{ year: number; weekCount: number }>
  onSelectYear: (year: number) => void
  size?: 'default' | 'compact'
}

function YearSwitcher({ activeYear, options, onSelectYear, size = 'default' }: YearSwitcherProps) {
  if (options.length === 0) return null

  const baseClass =
    'rounded-md border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300'

  return (
    <div className={clsx('flex items-center gap-1', size === 'compact' && 'overflow-x-auto')}>
      {options.map((option) => {
        const isActive = option.year === activeYear
        const label = `${option.year} · ${option.weekCount} wk${option.weekCount === 1 ? '' : 's'}`
        return (
          <button
            key={option.year}
            type="button"
            onClick={() => onSelectYear(option.year)}
            className={clsx(
              baseClass,
              isActive
                ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-50 dark:bg-slate-50 dark:text-slate-900'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
