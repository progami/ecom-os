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

export type OpsTimelineRow = {
  id: string
  orderCode: string
  productId: string
  productName: string
  quantity: string
  productionWeeks: string
  sourcePrepWeeks: string
  oceanWeeks: string
  finalMileWeeks: string
  productionStart: string
  productionComplete: string
  sourceDeparture: string
  transportReference: string
  portEta: string
  inboundEta: string
  availableDate: string
  totalLeadDays: string
  status: string
  weeksUntilArrival: string
  statusIcon: string
  notes: string
}

type OpsGridProps = {
  purchaseOrders: OpsTimelineRow[]
  activeOrderId?: string | null
  onSelectOrder?: (orderId: string) => void
}

const columnSettings: Handsontable.ColumnSettings[] = [
  { data: 'orderCode', className: 'cell-editable' },
  { data: 'productName', readOnly: true, className: 'cell-readonly' },
  { data: 'quantity', type: 'numeric', numericFormat: { pattern: '0,0.00' }, className: 'cell-editable' },
  { data: 'productionWeeks', type: 'numeric', numericFormat: { pattern: '0.00' }, className: 'cell-editable' },
  { data: 'sourcePrepWeeks', type: 'numeric', numericFormat: { pattern: '0.00' }, className: 'cell-editable' },
  { data: 'oceanWeeks', type: 'numeric', numericFormat: { pattern: '0.00' }, className: 'cell-editable' },
  { data: 'finalMileWeeks', type: 'numeric', numericFormat: { pattern: '0.00' }, className: 'cell-editable' },
  { data: 'productionStart', type: 'date', dateFormat: 'MMM D YYYY', correctFormat: true, className: 'cell-editable' },
  { data: 'productionComplete', type: 'date', dateFormat: 'MMM D YYYY', correctFormat: true, className: 'cell-editable' },
  { data: 'sourceDeparture', type: 'date', dateFormat: 'MMM D YYYY', correctFormat: true, className: 'cell-editable' },
  { data: 'transportReference', className: 'cell-editable' },
  { data: 'portEta', type: 'date', dateFormat: 'MMM D YYYY', correctFormat: true, className: 'cell-editable' },
  { data: 'inboundEta', type: 'date', dateFormat: 'MMM D YYYY', correctFormat: true, className: 'cell-editable' },
  { data: 'availableDate', type: 'date', dateFormat: 'MMM D YYYY', correctFormat: true, className: 'cell-editable' },
  { data: 'totalLeadDays', readOnly: true, className: 'cell-readonly' },
  {
    data: 'status',
    type: 'dropdown',
    source: ['PLANNED', 'PRODUCTION', 'IN_TRANSIT', 'ARRIVED', 'CLOSED', 'CANCELLED'],
    className: 'cell-editable',
  },
  { data: 'weeksUntilArrival', readOnly: true, className: 'cell-readonly' },
  { data: 'statusIcon', readOnly: true, className: 'cell-readonly' },
  { data: 'notes', readOnly: true, className: 'cell-readonly' },
]

const COLUMN_HEADERS = [
  'Shipping Mark',
  'Product',
  'Quantity',
  'Production',
  'Source Prep',
  'Ocean',
  'Final Mile',
  'Pay 1 Date',
  'Pay 1 %',
  'Pay 1 Amount',
  'Pay 2 Date',
  'Pay 2 %',
  'Pay 2 Amount',
  'Pay 3 Date',
  'Pay 3 %',
  'Pay 3 Amount',
  'Production Start',
  'Production Complete',
  'Source Departure',
  'Transport Reference',
  'Port ETA',
  'Inbound ETA',
  'Available Date',
  'Lead Days',
  'Status',
  'Weeks Until Arrival',
  'Status Icon',
  'Movement Proof',
]

type PurchaseOrderUpdate = {
  id: string
  values: Partial<Record<keyof OpsTimelineRow, string>>
}

const NUMERIC_FIELDS: Array<keyof OpsTimelineRow> = [
  'quantity',
  'productionWeeks',
  'sourcePrepWeeks',
  'oceanWeeks',
  'finalMileWeeks',
]

const MOVEMENT_STATUSES = new Set(['IN_TRANSIT', 'ARRIVED', 'CLOSED'])

function normalizeNumeric(value: unknown) {
  if (value === '' || value === null || value === undefined) return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value ?? '')
  return numeric.toFixed(2)
}

export function OpsPlanningGrid({ purchaseOrders, activeOrderId, onSelectOrder }: OpsGridProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, PurchaseOrderUpdate>>(new Map())
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [statusFilter, setStatusFilter] = useState<'ALL' | OpsTimelineRow['status']>('ALL')

  const statusCounts = useMemo(() => {
    return purchaseOrders.reduce<Record<string, number>>((acc, po) => {
      acc[po.status] = (acc[po.status] ?? 0) + 1
      return acc
    }, {})
  }, [purchaseOrders])

  const data = useMemo(() => {
    if (statusFilter === 'ALL') return purchaseOrders
    return purchaseOrders.filter((po) => po.status === statusFilter)
  }, [purchaseOrders, statusFilter])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
  }, [data])

  const flush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(async () => {
      const payload = Array.from(pendingRef.current.values())
      if (payload.length === 0) return
      pendingRef.current.clear()
      try {
        const response = await fetch('/api/v1/cross-plan/purchase-orders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update purchase orders')
        toast.success('Ops planning updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to save ops planning changes')
      }
    }, 600)
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          2. Ops Planning
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <label className="flex items-center gap-2">
            <span>Status view</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All</option>
              <option value="PLANNED">Planned</option>
              <option value="PRODUCTION">Production</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="ARRIVED">Arrived</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {['PLANNED', 'PRODUCTION', 'IN_TRANSIT', 'ARRIVED'].map((status) => (
              <span key={status} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                {status.replace('_', ' ')} • {statusCounts[status] ?? 0}
              </span>
            ))}
          </div>
        </div>
      </div>
      <GridLegend hint="Filters only adjust visibility—edits still sync against full dataset." />
      <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        columns={columnSettings}
        colHeaders={COLUMN_HEADERS}
        stretchH="all"
        className="cross-plan-hot"
        rowHeaders={false}
        height="auto"
        dropdownMenu
        filters
        cells={(row) => {
          const props: Handsontable.CellProperties = {}
          const record = data[row]
          if (record && activeOrderId && record.id === activeOrderId) {
            props.className = props.className ? `${props.className} row-active` : 'row-active'
          }
          return props
        }}
        afterSelectionEnd={(row) => {
          if (!onSelectOrder) return
          const record = data[row]
          if (record) onSelectOrder(record.id)
        }}
        afterChange={(changes, source) => {
          if (!changes || source === 'loadData' || source === 'movement-proof-revert' || source === 'movement-proof-note') return
          const hot = hotRef.current
          if (!hot) return
          for (const change of changes) {
            const [rowIndex, prop, oldValue, newValue] = change as [number, keyof OpsTimelineRow, any, any]
            const record = hot.getSourceDataAtRow(rowIndex) as OpsTimelineRow | null
            if (!record) continue
            if (prop === 'status') {
              if (newValue === oldValue) continue
              if (MOVEMENT_STATUSES.has(String(newValue))) {
                const existingNote = record.notes ?? ''
                const note = window.prompt('Provide movement proof (required before updating status).', existingNote)
                if (!note || !note.trim()) {
                  hot.setDataAtRowProp(rowIndex, prop, oldValue, 'movement-proof-revert')
                  continue
                }
                hot.setDataAtRowProp(rowIndex, 'notes', note.trim(), 'movement-proof-note')
              }
            }
            if (!pendingRef.current.has(record.id)) {
              pendingRef.current.set(record.id, { id: record.id, values: {} })
            }
            const entry = pendingRef.current.get(record.id)
            if (!entry) continue
            if (prop === 'notes') {
              entry.values[prop] = String(newValue ?? '')
              continue
            }
            entry.values[prop] = NUMERIC_FIELDS.includes(prop) ? normalizeNumeric(newValue) : String(newValue ?? '')
          }
          flush()
        }}
      />
    </div>
  )
}
