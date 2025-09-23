'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { GridLegend } from '@/components/grid-legend'

registerAllModules()

type WeeklyRow = {
  weekNumber: string
  weekDate: string
  units: string
  revenue: string
  cogs: string
  grossProfit: string
  grossMargin: string
  amazonFees: string
  ppcSpend: string
  fixedCosts: string
  totalOpex: string
  netProfit: string
}

type SummaryRow = {
  periodLabel: string
  revenue?: string
  cogs?: string
  grossProfit?: string
  amazonFees?: string
  ppcSpend?: string
  fixedCosts?: string
  totalOpex?: string
  netProfit?: string
  amazonPayout?: string
  inventorySpend?: string
  netCash?: string
  closingCash?: string
}

type UpdatePayload = {
  weekNumber: number
  values: Partial<Record<keyof WeeklyRow, string>>
}

interface ProfitAndLossGridProps {
  weekly: WeeklyRow[]
  monthlySummary: SummaryRow[]
  quarterlySummary: SummaryRow[]
}

const editableFields: (keyof WeeklyRow)[] = ['units', 'revenue', 'cogs', 'amazonFees', 'ppcSpend', 'fixedCosts']

function normalizeEditable(value: unknown) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value ?? '')
  return numeric.toFixed(2)
}

export function ProfitAndLossGrid({ weekly, monthlySummary, quarterlySummary }: ProfitAndLossGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<number, UpdatePayload>>(new Map())
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showSummary, setShowSummary] = useState(true)

  const data = useMemo(() => weekly, [weekly])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

  const columns: Handsontable.ColumnSettings[] = useMemo(
    () => [
      { data: 'weekNumber', readOnly: true, className: 'cell-readonly' },
      { data: 'weekDate', readOnly: true, className: 'cell-readonly' },
      {
        data: 'units',
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: !editableFields.includes('units'),
        className: editableFields.includes('units') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'revenue',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('revenue'),
        className: editableFields.includes('revenue') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'cogs',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('cogs'),
        className: editableFields.includes('cogs') ? 'cell-editable' : 'cell-readonly',
      },
      { data: 'grossProfit', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly' },
      { data: 'grossMargin', type: 'numeric', numericFormat: { pattern: '0.00%' }, readOnly: true, className: 'cell-readonly' },
      {
        data: 'amazonFees',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('amazonFees'),
        className: editableFields.includes('amazonFees') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'ppcSpend',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('ppcSpend'),
        className: editableFields.includes('ppcSpend') ? 'cell-editable' : 'cell-readonly',
      },
      {
        data: 'fixedCosts',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('fixedCosts'),
        className: editableFields.includes('fixedCosts') ? 'cell-editable' : 'cell-readonly',
      },
      { data: 'totalOpex', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly' },
      { data: 'netProfit', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly' },
    ],
    []
  )

  const flush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingRef.current.values())
      if (payload.length === 0) return
      pendingRef.current.clear()
      try {
        const res = await fetch('/api/v1/cross-plan/profit-and-loss', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!res.ok) throw new Error('Failed to update P&L')
        toast.success('P&L updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to save P&L changes')
      }
    }, 600)
  }

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              4. Fin Planning P&amp;L
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only edit blue driver cells—grey results roll up automatically from calculations.
            </p>
          </div>
          <button
            onClick={() => setShowSummary((prev) => !prev)}
            className="self-start rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {showSummary ? 'Hide rollups' : 'Show rollups'}
          </button>
        </div>
        <GridLegend hint="Weekly edits trigger recalculation of summary tables." />
        <HotTable
          ref={(instance) => {
            hotRef.current = instance?.hotInstance ?? null
          }}
          data={data}
          licenseKey="non-commercial-and-evaluation"
          columns={columns}
          colHeaders={['Week', 'Date', 'Units', 'Revenue', 'COGS', 'Gross Profit', 'GP%', 'Amazon Fees', 'PPC', 'Fixed Costs', 'Total OpEx', 'Net Profit']}
          rowHeaders={false}
          stretchH="all"
          className="cross-plan-hot"
          height="auto"
          dropdownMenu
          filters
          afterChange={(changes, source) => {
            if (!changes || source === 'loadData') return
            const hot = hotRef.current
            if (!hot) return
            for (const change of changes) {
              const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof WeeklyRow, any, any]
              if (!editableFields.includes(prop)) continue
              const record = hot.getSourceDataAtRow(rowIndex) as WeeklyRow | null
              if (!record) continue
              const weekNumber = Number(record.weekNumber)
              if (!pendingRef.current.has(weekNumber)) {
                pendingRef.current.set(weekNumber, { weekNumber, values: {} })
              }
            const entry = pendingRef.current.get(weekNumber)
            if (!entry) continue
            entry.values[prop] = normalizeEditable(newValue)
          }
          flush()
        }}
      />
      </div>

      {showSummary && (
        <div className="grid gap-4 md:grid-cols-2">
          <SummaryTable title="Monthly P&L Summary" rows={monthlySummary} />
          <SummaryTable title="Quarterly P&L Summary" rows={quarterlySummary} />
        </div>
      )}
    </div>
  )
}

function SummaryTable({ title, rows }: { title: string; rows: SummaryRow[] }) {
  const headers = ['Period', 'Revenue', 'COGS', 'Gross Profit', 'Amazon Fees', 'PPC', 'Fixed Costs', 'Total OpEx', 'Net Profit']

  const formatValue = (value?: string) => {
    if (!value) return ''
    const numeric = Number(value)
    if (Number.isNaN(numeric)) return value
    return numeric.toFixed(2)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-xs uppercase dark:bg-slate-800">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.periodLabel} className="text-slate-700 dark:text-slate-200">
                <td className="px-3 py-2 font-medium">{row.periodLabel}</td>
                <td className="px-3 py-2">{formatValue(row.revenue ?? row.amazonPayout)}</td>
                <td className="px-3 py-2">{formatValue(row.cogs ?? row.inventorySpend)}</td>
                <td className="px-3 py-2">{formatValue(row.grossProfit)}</td>
                <td className="px-3 py-2">{formatValue(row.amazonFees)}</td>
                <td className="px-3 py-2">{formatValue(row.ppcSpend)}</td>
                <td className="px-3 py-2">{formatValue(row.fixedCosts)}</td>
                <td className="px-3 py-2">{formatValue(row.totalOpex ?? row.netCash)}</td>
                <td className="px-3 py-2">{formatValue(row.netProfit ?? row.closingCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
