'use client'

import { useEffect, useMemo, useRef } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { formatNumericInput, numericValidator } from '@/components/sheets/validators'

registerAllModules()

type WeeklyRow = {
  weekNumber: string
  weekDate: string
  amazonPayout: string
  inventorySpend: string
  fixedCosts: string
  netCash: string
  cashBalance: string
}

type SummaryRow = {
  periodLabel: string
  amazonPayout?: string
  inventorySpend?: string
  fixedCosts?: string
  netCash?: string
  closingCash?: string
}

type UpdatePayload = {
  weekNumber: number
  values: Partial<Record<keyof WeeklyRow, string>>
}

interface CashFlowGridProps {
  weekly: WeeklyRow[]
  monthlySummary: SummaryRow[]
  quarterlySummary: SummaryRow[]
}

const editableFields: (keyof WeeklyRow)[] = ['amazonPayout', 'inventorySpend', 'fixedCosts']

function normalizeEditable(value: unknown) {
  return formatNumericInput(value, 2)
}

export function CashFlowGrid({ weekly }: CashFlowGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<number, UpdatePayload>>(new Map())
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        data: 'amazonPayout',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('amazonPayout'),
        className: editableFields.includes('amazonPayout') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('amazonPayout') ? numericValidator : undefined,
        allowInvalid: false,
      },
      {
        data: 'inventorySpend',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('inventorySpend'),
        className: editableFields.includes('inventorySpend') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('inventorySpend') ? numericValidator : undefined,
        allowInvalid: false,
      },
      {
        data: 'fixedCosts',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('fixedCosts'),
        className: editableFields.includes('fixedCosts') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('fixedCosts') ? numericValidator : undefined,
        allowInvalid: false,
      },
      { data: 'netCash', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly' },
      { data: 'cashBalance', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly' },
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
        const res = await fetch('/api/v1/x-plan/cash-flow', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!res.ok) throw new Error('Failed to update cash flow')
        toast.success('Cash flow updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to save cash flow changes')
      }
    }, 600)
  }

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Financial Planning · Cash Flow
          </h2>
        </div>
        <HotTable
          ref={(instance) => {
            hotRef.current = instance?.hotInstance ?? null
          }}
          data={data}
          licenseKey="non-commercial-and-evaluation"
          columns={columns}
          colHeaders={['Week', 'Date', 'Amazon Payout', 'Inventory Purchase', 'Fixed Costs', 'Net Cash', 'Cash Balance']}
          rowHeaders={false}
          stretchH="all"
          className="x-plan-hot"
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
            const formatted = normalizeEditable(newValue)
            entry.values[prop] = formatted
            record[prop] = formatted
          }
          flush()
        }}
      />
      </div>
    </div>
  )
}
