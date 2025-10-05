'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'
import { formatNumericInput, numericValidator } from '@/components/sheets/validators'
import { useMutationQueue } from '@/hooks/useMutationQueue'

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

const WEEK_COLUMN_WIDTH = 92
const DATE_COLUMN_WIDTH = 136

function normalizeEditable(value: unknown) {
  return formatNumericInput(value, 2)
}

export function ProfitAndLossGrid({ weekly, monthlySummary, quarterlySummary }: ProfitAndLossGridProps) {
  const hotRef = useRef<Handsontable | null>(null)

  const data = useMemo(() => weekly, [weekly])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

  const columns: Handsontable.ColumnSettings[] = useMemo(
    () => [
      { data: 'weekNumber', readOnly: true, className: 'cell-readonly', width: WEEK_COLUMN_WIDTH },
      { data: 'weekDate', readOnly: true, className: 'cell-readonly', width: DATE_COLUMN_WIDTH },
      {
        data: 'units',
        type: 'numeric',
        numericFormat: { pattern: '0,0.00' },
        readOnly: !editableFields.includes('units'),
        className: editableFields.includes('units') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('units') ? numericValidator : undefined,
        allowInvalid: false,
      },
      {
        data: 'revenue',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('revenue'),
        className: editableFields.includes('revenue') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('revenue') ? numericValidator : undefined,
        allowInvalid: false,
      },
      {
        data: 'cogs',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('cogs'),
        className: editableFields.includes('cogs') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('cogs') ? numericValidator : undefined,
        allowInvalid: false,
      },
      {
        data: 'amazonFees',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('amazonFees'),
        className: editableFields.includes('amazonFees') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('amazonFees') ? numericValidator : undefined,
        allowInvalid: false,
      },
      { data: 'grossProfit', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly' },
      { data: 'grossMargin', type: 'numeric', numericFormat: { pattern: '0.00%' }, readOnly: true, className: 'cell-readonly' },
      {
        data: 'ppcSpend',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('ppcSpend'),
        className: editableFields.includes('ppcSpend') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('ppcSpend') ? numericValidator : undefined,
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
      { data: 'totalOpex', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly' },
      { data: 'netProfit', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly' },
    ],
    []
  )

  const handleFlush = useCallback(async (payload: UpdatePayload[]) => {
    if (payload.length === 0) return
    try {
      const res = await fetch('/api/v1/x-plan/profit-and-loss', {
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
  }, [])

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<number, UpdatePayload>({
    debounceMs: 600,
    onFlush: handleFlush,
  })

  useEffect(() => {
    return () => {
      flushNow().catch(() => {
        // errors already surfaced in handleFlush
      })
    }
  }, [flushNow])

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <HotTable
          ref={(instance) => {
            hotRef.current = instance?.hotInstance ?? null
          }}
          data={data}
          licenseKey="non-commercial-and-evaluation"
          columns={columns}
          colHeaders={['Week', 'Date', 'Units', 'Revenue', 'COGS', 'Amazon Fees', 'Gross Profit', 'GP%', 'PPC', 'Fixed Costs', 'Total OpEx', 'Net Profit']}
          rowHeaders={false}
          undo
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
          scheduleFlush()
        }}
      />
      </div>
    </div>
  )
}
