import { WorkbookSidebar } from '@/components/workbook-sidebar'
import { SheetHeader } from '@/components/sheet-header'
import { getWorkbookStatus } from '@/lib/workbook'

export default async function HomePage() {
  const status = await getWorkbookStatus()

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 lg:flex-row">
        <WorkbookSidebar
          items={status.sheets}
          activeSlug="1-product-setup"
          completionRatio={{ completed: status.completedCount, total: status.totalCount }}
        />

        <div className="flex w-full flex-1 flex-col gap-6">
          <SheetHeader
            title="Cross Plan Workbook"
            description="Collaborative demand, supply, and finance planning—aligned to the legacy Excel workbook but with web-first guidance."
            recordCount={status.sheets.reduce((sum, item) => sum + item.recordCount, 0)}
            controls={
              <a
                href="/import"
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Import / Export
              </a>
            }
          />

          <div className="flex justify-end">
            <a
              href="/sheet/1-product-setup"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Start planning
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
