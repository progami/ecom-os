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
import { withAppBasePath } from '@/lib/base-path'

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

type UpdatePayload = {
  weekNumber: number
  values: Partial<Record<keyof WeeklyRow, string>>
}

interface CashFlowGridProps {
  weekly: WeeklyRow[]
}

const editableFields: (keyof WeeklyRow)[] = ['amazonPayout', 'inventorySpend', 'fixedCosts']

const WEEK_COLUMN_WIDTH = 92
const DATE_COLUMN_WIDTH = 136
const COLUMN_WIDTHS: Record<keyof WeeklyRow, number> = {
  weekNumber: WEEK_COLUMN_WIDTH,
  weekDate: DATE_COLUMN_WIDTH,
  amazonPayout: 140,
  inventorySpend: 140,
  fixedCosts: 140,
  netCash: 160,
  cashBalance: 160,
}

function normalizeEditable(value: unknown) {
  return formatNumericInput(value, 2)
}

export function CashFlowGrid({ weekly }: CashFlowGridProps) {
  const hotRef = useRef<Handsontable | null>(null)

  const data = useMemo(() => weekly, [weekly])

  const inboundSpendWeeks = useMemo(() => {
    const flags = new Set<number>()
    weekly.forEach((row) => {
      const spend = Number(row.inventorySpend?.replace(/[^0-9.-]/g, ''))
      if (Number.isFinite(spend) && Math.abs(spend) > 0) {
        const week = Number(row.weekNumber)
        if (Number.isFinite(week)) flags.add(week)
      }
    })
    return flags
  }, [weekly])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

  const columns: Handsontable.ColumnSettings[] = useMemo(
    () => [
      { data: 'weekNumber', readOnly: true, className: 'cell-readonly', width: COLUMN_WIDTHS.weekNumber },
      { data: 'weekDate', readOnly: true, className: 'cell-readonly', width: COLUMN_WIDTHS.weekDate },
      {
        data: 'amazonPayout',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('amazonPayout'),
        className: editableFields.includes('amazonPayout') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('amazonPayout') ? numericValidator : undefined,
        allowInvalid: false,
        width: COLUMN_WIDTHS.amazonPayout,
      },
      {
        data: 'inventorySpend',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('inventorySpend'),
        className: editableFields.includes('inventorySpend') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('inventorySpend') ? numericValidator : undefined,
        allowInvalid: false,
        width: COLUMN_WIDTHS.inventorySpend,
      },
      {
        data: 'fixedCosts',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        readOnly: !editableFields.includes('fixedCosts'),
        className: editableFields.includes('fixedCosts') ? 'cell-editable' : 'cell-readonly',
        validator: editableFields.includes('fixedCosts') ? numericValidator : undefined,
        allowInvalid: false,
        width: COLUMN_WIDTHS.fixedCosts,
      },
      { data: 'netCash', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly', width: COLUMN_WIDTHS.netCash },
      { data: 'cashBalance', type: 'numeric', numericFormat: { pattern: '$0,0.00' }, readOnly: true, className: 'cell-readonly', width: COLUMN_WIDTHS.cashBalance },
    ],
    []
  )

  const columnWidths = useMemo<number[]>(
    () =>
      columns.map((column) =>
        typeof column.width === 'number' ? column.width : COLUMN_WIDTHS.cashBalance
      ),
    [columns],
  )

  const clampStretchWidth = useCallback((width: number, column: number) => {
    if (column === 0) return COLUMN_WIDTHS.weekNumber
    if (column === 1) return COLUMN_WIDTHS.weekDate
    return width
  }, [])

  const handleFlush = useCallback(async (payload: UpdatePayload[]) => {
    if (payload.length === 0) return
    try {
      const res = await fetch(withAppBasePath('/api/v1/x-plan/cash-flow'), {
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
  }, [])

  const { pendingRef, scheduleFlush, flushNow } = useMutationQueue<number, UpdatePayload>({
    debounceMs: 600,
    onFlush: handleFlush,
  })

  useEffect(() => {
    return () => {
      flushNow().catch(() => {
        // errors handled within handleFlush
      })
    }
  }, [flushNow])

  return (
    <div className="p-4">
      <div
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60"
        style={{ height: 'calc(100vh - 260px)', minHeight: '420px' }}
      >
        <HotTable
          ref={(instance) => {
            hotRef.current = instance?.hotInstance ?? null
          }}
          data={data}
          licenseKey="non-commercial-and-evaluation"
          width="100%"
          columns={columns}
          colHeaders={['Week', 'Date', 'Amazon Payout', 'Inventory Purchase', 'Fixed Costs', 'Net Cash', 'Cash Balance']}
          rowHeaders={false}
          undo
          stretchH="all"
          className="x-plan-hot h-full"
          height="100%"
          dropdownMenu
          filters
          autoColumnSize={false}
          colWidths={columnWidths}
          beforeStretchingColumnWidth={clampStretchWidth}
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
          cells={(row, col) => {
            const cell: Handsontable.CellMeta = {}
            const week = Number(data[row]?.weekNumber)
            if (Number.isFinite(week) && inboundSpendWeeks.has(week)) {
              cell.className = `${cell.className ?? ''} row-inbound-cash`.trim()
            }
            return cell
          }}
        />
      </div>
    </div>
  )
}
