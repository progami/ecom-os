import { getWorkbookStatus } from '@/lib/workbook'
import { loadSalesCalendar } from '@/lib/workbook/year-navigation'
import { WorkbookLayout } from '@/components/workbook-layout'
import { SheetTabs } from '@/components/sheet-tabs'

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function parseYearParam(value: string | string[] | undefined): number | null {
  if (Array.isArray(value)) {
    return parseYearParam(value[0])
  }
  if (!value) return null
  const numeric = Number.parseInt(value, 10)
  return Number.isFinite(numeric) ? numeric : null
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearch = searchParams ? await searchParams : {}
  const status = await getWorkbookStatus()
  const { yearSegments } = await loadSalesCalendar()
  const requestedYear = parseYearParam(resolvedSearch?.year)
  const activeSegment =
    yearSegments.find((segment) => segment.year === requestedYear) ?? yearSegments[0] ?? undefined
  const activeYear = activeSegment?.year
  const yearOptions = yearSegments.map((segment) => ({ year: segment.year, weekCount: segment.weekCount }))
  const sheetSearchParams = activeYear ? { year: String(activeYear) } : undefined
  const openProductHref = `/sheet/1-product-setup${activeYear ? `?year=${activeYear}` : ''}`

  const rows = status.sheets.reduce((sum, item) => sum + item.recordCount, 0)
  const latestUpdated = status.sheets.reduce<string | undefined>((latest, sheet) => {
    if (!sheet.lastUpdated) return latest
    if (!latest) return sheet.lastUpdated
    return new Date(sheet.lastUpdated) > new Date(latest) ? sheet.lastUpdated : latest
  }, undefined)

  const meta = {
    rows,
    updated: latestUpdated,
  }

  return (
    <WorkbookLayout
      sheets={status.sheets}
      activeSlug="1-product-setup"
      meta={meta}
      activeYear={activeYear ?? undefined}
      yearOptions={yearOptions}
      ribbon={
        <a
          href="/import"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Import / Export
        </a>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
        <p>X-Plan centralizes Sales, Operations, and Finance planning in a single grid-first workspace.</p>
        <SheetTabs
          sheets={status.sheets}
          activeSlug="1-product-setup"
          variant="scroll"
          searchParams={sheetSearchParams}
        />
        <a
          href={openProductHref}
          className="inline-flex w-max items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Open Product Setup
        </a>
      </div>
    </WorkbookLayout>
  )
}
