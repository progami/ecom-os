import { SheetHeader } from '@/components/sheet-header'
import { WorkbookControls } from '@/components/workbook-controls'

export const metadata = {
  title: 'Import & Export • Cross Plan',
}

export default function ImportPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <SheetHeader
          title="Import & Export"
          description="Workbook import/export is temporarily offline while we finalize the new dataset template."
        />

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">We’ll restore uploads and exports once the new template is locked.</p>
            <WorkbookControls />
          </div>
        </section>
      </div>
    </main>
  )
}
