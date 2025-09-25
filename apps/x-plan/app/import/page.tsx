import { WorkbookControls } from '@/components/workbook-controls'
import { WorkbookLayout } from '@/components/workbook-layout'
import { SheetTabs } from '@/components/sheet-tabs'
import { getWorkbookStatus } from '@/lib/workbook'

export const metadata = {
  title: 'Import & Export • X-Plan',
}

export default async function ImportPage() {
  const status = await getWorkbookStatus()
  const rows = status.sheets.reduce((sum, item) => sum + item.recordCount, 0)
  const latestUpdated = status.sheets.reduce<string | undefined>((latest, sheet) => {
    if (!sheet.lastUpdated) return latest
    if (!latest) return sheet.lastUpdated
    return new Date(sheet.lastUpdated) > new Date(latest) ? sheet.lastUpdated : latest
  }, undefined)

  return (
    <WorkbookLayout
      sheets={status.sheets}
      activeSlug="1-product-setup"
      meta={{ rows, updated: latestUpdated }}
    >
      <div className="space-y-4">
        <SheetTabs sheets={status.sheets} activeSlug="1-product-setup" variant="scroll" />
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import & Export (Paused)</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Workbook import/export is temporarily offline while we finalize the new X-Plan dataset template.
          </p>
          <div className="mt-4">
            <WorkbookControls />
          </div>
        </section>
      </div>
    </WorkbookLayout>
  )
}
