'use client'

import clsx from 'clsx'

export type OpsTimelineRow = {
  id: string
  orderCode: string
  productName: string
  landedUnitCost: string
  poValue: string
  paidAmount: string
  paidPercent: string
  productionStart: string
  productionComplete: string
  sourceDeparture: string
  portEta: string
  inboundEta: string
  availableDate: string
  totalLeadDays: string
  weeksUntilArrival: string
}

interface OpsPlanningTimelineTableProps {
  rows: OpsTimelineRow[]
  activeOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
}
const HEADERS = [
  'PO Code',
  'Product',
  'Unit Cost',
  'PO Value',
  'Paid to Date',
  'Paid %',
  'Production Start',
  'Production Complete',
  'Source Departure',
  'Port ETA',
  'Inbound ETA',
  'Available Date',
  'Lead Days',
  'Weeks Until Arrival',
]

export function OpsPlanningTimelineTable({ rows, activeOrderId, onSelectOrder }: OpsPlanningTimelineTableProps) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Timeline & Cost Summary
        </h2>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-600 dark:divide-slate-800 dark:text-slate-200">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <tr>
              {HEADERS.map((header) => (
                <th key={header} className="px-3 py-2 text-left font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => {
              const isActive = activeOrderId === row.id
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectOrder?.(row.id)}
                  className={clsx(
                    'cursor-pointer bg-white transition hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800',
                    isActive && 'bg-indigo-50/80 dark:bg-indigo-500/10'
                  )}
                >
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-100">{row.orderCode}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-200">{row.productName || '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{row.landedUnitCost || '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{row.poValue || '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{row.paidAmount || '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{row.paidPercent || '—'}</td>
                  <td className="px-3 py-2">{row.productionStart || '—'}</td>
                  <td className="px-3 py-2">{row.productionComplete || '—'}</td>
                  <td className="px-3 py-2">{row.sourceDeparture || '—'}</td>
                  <td className="px-3 py-2">{row.portEta || '—'}</td>
                  <td className="px-3 py-2">{row.inboundEta || '—'}</td>
                  <td className="px-3 py-2">{row.availableDate || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.totalLeadDays || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.weeksUntilArrival || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
