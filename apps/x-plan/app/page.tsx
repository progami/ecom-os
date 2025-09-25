import { getWorkbookStatus } from '@/lib/workbook'
import { WorkbookLayout } from '@/components/workbook-layout'
import { SheetTabs } from '@/components/sheet-tabs'

export default async function HomePage() {
  const status = await getWorkbookStatus()
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
        <SheetTabs sheets={status.sheets} activeSlug="1-product-setup" variant="scroll" />
        <a
          href="/sheet/1-product-setup"
          className="inline-flex w-max items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Open Product Setup
        </a>
      </div>
    </WorkbookLayout>
  )
}
