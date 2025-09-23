"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SheetTabs } from '@/components/sheet-tabs'
import type { WorkbookSheetStatus } from '@/lib/workbook'
import { useRouter } from 'next/navigation'

type SheetSlug = WorkbookSheetStatus['slug']

interface WorkbookLayoutProps {
  sheets: WorkbookSheetStatus[]
  activeSlug: SheetSlug
  ribbon?: React.ReactNode
  contextPane?: React.ReactNode
  children: React.ReactNode
}

const MIN_CONTEXT_WIDTH = 320
const MAX_CONTEXT_WIDTH = 560

export function WorkbookLayout({ sheets, activeSlug, ribbon, contextPane, children }: WorkbookLayoutProps) {
  const router = useRouter()
  const [contextWidth, setContextWidth] = useState(360)
  const [isResizing, setIsResizing] = useState(false)
  const hasContextPane = Boolean(contextPane)

  const goToSheet = useCallback(
    (slug: SheetSlug) => {
      if (slug && slug !== activeSlug) {
        router.push(`/sheet/${slug}`)
      }
    },
    [activeSlug, router]
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-100/60">
      <header className="border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Cross Plan</span>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{activeSheet?.label ?? 'Workbook'}</h1>
              <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{activeSheet?.description}</p>
            </div>
            {ribbon && <div className="flex shrink-0 items-center gap-2">{ribbon}</div>}
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 flex-shrink-0 border-r border-slate-200 bg-white/90 px-2 py-4 text-sm shadow-inner dark:border-slate-800 dark:bg-slate-950/80 lg:block">
          <SheetTabs sheets={sheets} activeSlug={activeSlug} variant="stack" onSheetSelect={goToSheet} />
        </aside>

        <section className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-shrink-0 items-center border-b border-slate-200 bg-white/90 px-2 py-2 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <span className="mr-2 font-semibold text-slate-600 dark:text-slate-300">Sheets</span>
            <SheetTabs sheets={sheets} activeSlug={activeSlug} variant="scroll" onSheetSelect={goToSheet} />
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto bg-white p-4 dark:bg-slate-900">
              {children}
            </div>
            {hasContextPane && (
              <div className="relative hidden h-full shrink-0 border-l border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 lg:block" style={{ width: contextWidth }}>
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
          </div>
        </section>
      </main>
    </div>
  )
}
