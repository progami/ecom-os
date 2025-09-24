'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-theme.css'
import { toast } from 'sonner'

registerAllModules()

interface BusinessParameter {
  id: string
  label: string
  value: string
  type: 'numeric' | 'text'
}

type BusinessParameterUpdate = { id: string; valueNumeric?: string; valueText?: string }

export interface ProductSetupParametersPanelProps {
  title: string
  description: string
  parameters: BusinessParameter[]
}

function toCellValue(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function ProductSetupParametersPanel({ title, description, parameters }: ProductSetupParametersPanelProps) {
  const hotRef = useRef<Handsontable | null>(null)
  const pendingRef = useRef<Map<string, string>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isClient, setIsClient] = useState(false)

  const data = useMemo<BusinessParameter[]>(() => parameters.map((parameter) => ({ ...parameter })), [parameters])

  useEffect(() => {
    if (hotRef.current) {
      hotRef.current.loadData(data)
    }
    pendingRef.current.clear()
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = null
    }
  }, [data])

  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setIsClient(true)
  }, [])

  const queueFlush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(async () => {
      const hot = hotRef.current
      const rows = hot?.getSourceData() as BusinessParameter[] | undefined
      const payload: BusinessParameterUpdate[] = []

      for (const [id, value] of pendingRef.current.entries()) {
        const row = rows?.find((item) => item.id === id)
        if (!row) continue
        if (row.type === 'numeric') {
          payload.push({ id, valueNumeric: value })
        } else {
          payload.push({ id, valueText: value })
        }
      }

      if (payload.length === 0) {
        pendingRef.current.clear()
        flushTimeoutRef.current = null
        return
      }

      pendingRef.current.clear()

      try {
        const response = await fetch('/api/v1/x-plan/business-parameters', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update parameters')

        if (hot && rows) {
          payload.forEach((update) => {
            if (!('valueNumeric' in update)) return
            const rowIndex = rows.findIndex((row) => row.id === update.id)
            if (rowIndex === -1) return
            const numericValue = Number(update.valueNumeric)
            if (Number.isNaN(numericValue)) return
            const formatted = numericValue.toFixed(2)
            rows[rowIndex].value = formatted
            hot.setDataAtRowProp(rowIndex, 'value', formatted, 'normalize-update')
          })
        }

        toast.success('Parameters updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to update parameters')
      } finally {
        flushTimeoutRef.current = null
      }
    }, 400)
  }

  if (!isClient || parameters.length === 0) return null

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <HotTable
        ref={(instance) => {
          hotRef.current = instance?.hotInstance ?? null
        }}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        colHeaders={['Parameter', 'Value']}
        columns={[
          { data: 'label', readOnly: true, className: 'cell-readonly htLeft' },
          { data: 'value', className: 'cell-editable' },
        ]}
        rowHeaders={false}
        height="auto"
        stretchH="all"
        className="x-plan-hot"
        dropdownMenu
        filters
        afterGetColHeader={(col, TH) => {
          if (col === 0) TH.classList.add('htLeft')
        }}
        cells={(row, col) => {
          const cellProperties = {} as Handsontable.CellProperties
          if (col === 1) {
            const record = data[row]
            if (record?.type === 'numeric') {
              cellProperties.type = 'numeric'
              cellProperties.numericFormat = { pattern: '0,0.00' }
              cellProperties.className = 'cell-editable htRight'
            } else {
              cellProperties.className = 'cell-editable htLeft'
            }
          } else {
            cellProperties.className = 'cell-readonly htLeft'
          }
          return cellProperties
        }}
        afterChange={(changes, source) => {
          const changeSource = String(source)
          if (!changes || changeSource === 'loadData' || changeSource === 'normalize-update') return
          const hot = hotRef.current
          if (!hot) return
          const rows = hot.getSourceData() as BusinessParameter[]
          for (const change of changes) {
            const [rowIndex, prop, _oldValue, newValue] = change as [number, keyof BusinessParameter, any, any]
            if (prop !== 'value') continue
            const row = rows[rowIndex]
            if (!row) continue
            const value = toCellValue(newValue)
            row.value = value
            pendingRef.current.set(row.id, value)
          }
          queueFlush()
        }}
      />
    </div>
  )
}
