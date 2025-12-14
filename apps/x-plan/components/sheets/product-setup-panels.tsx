'use client'

import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { OPS_STAGE_DEFAULT_LABELS } from '@/lib/business-parameter-labels'
import { withAppBasePath } from '@/lib/base-path'

interface BusinessParameter {
  id: string
  label: string
  value: string
  type: 'numeric' | 'text'
}

type BusinessParameterUpdate = { id: string; valueNumeric?: string; valueText?: string }

const OPS_DEFAULTS = [
  { label: OPS_STAGE_DEFAULT_LABELS.production, defaultValue: '1' },
  { label: OPS_STAGE_DEFAULT_LABELS.source, defaultValue: '1' },
  { label: OPS_STAGE_DEFAULT_LABELS.ocean, defaultValue: '1' },
  { label: OPS_STAGE_DEFAULT_LABELS.final, defaultValue: '1' },
]

const SALES_DEFAULTS = [
  { label: 'Stockout Warning (weeks)', defaultValue: '2' },
]

const FINANCE_DEFAULTS = [
  { label: 'Starting Cash', defaultValue: '0' },
  { label: 'Amazon Payout Delay (weeks)', defaultValue: '2' },
  { label: 'Weekly Fixed Costs', defaultValue: '0' },
  { label: 'Supplier Payment Split 1 (%)', defaultValue: '50' },
  { label: 'Supplier Payment Split 2 (%)', defaultValue: '30' },
  { label: 'Supplier Payment Split 3 (%)', defaultValue: '20' },
]

function getDefaults(type: 'ops' | 'sales' | 'finance') {
  if (type === 'ops') return OPS_DEFAULTS
  if (type === 'sales') return SALES_DEFAULTS
  return FINANCE_DEFAULTS
}

export interface ProductSetupParametersPanelProps {
  title: string
  description?: string
  parameterType: 'ops' | 'sales' | 'finance'
  parameters: BusinessParameter[]
  className?: string
}

type ParameterStatus = 'idle' | 'dirty' | 'saving' | 'error'

interface ParameterRecord extends BusinessParameter {
  status: ParameterStatus
}

function initializeRecords(parameters: BusinessParameter[], type: 'ops' | 'sales' | 'finance'): ParameterRecord[] {
  const defaults = getDefaults(type)
  return defaults.map((def) => {
    const existing = parameters.find((p) => p.label.toLowerCase() === def.label.toLowerCase())
    if (existing) {
      return { ...existing, status: 'idle' as ParameterStatus }
    }
    return {
      id: '',
      label: def.label,
      value: def.defaultValue,
      type: 'numeric' as const,
      status: 'idle' as ParameterStatus,
    }
  })
}

export function ProductSetupParametersPanel({
  title,
  description,
  parameterType,
  parameters,
  className,
}: ProductSetupParametersPanelProps) {
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isFlushingRef = useRef(false)
  const pendingFlushRef = useRef(false)
  const [items, setItems] = useState<ParameterRecord[]>(() => initializeRecords(parameters, parameterType))
  const itemsRef = useRef(items)

  useEffect(() => {
    const nextRecords = initializeRecords(parameters, parameterType)
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = null
    }
    setItems(nextRecords)
    itemsRef.current = nextRecords
  }, [parameters, parameterType])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const flushUpdates = useCallback(async () => {
    const currentItems = itemsRef.current
    const dirtyItems = currentItems.filter((item) => item.status === 'dirty')
    if (dirtyItems.length === 0) {
      flushTimeoutRef.current = null
      return
    }

    if (isFlushingRef.current) {
      pendingFlushRef.current = true
      return
    }

    isFlushingRef.current = true

    const sanitizedValues = new Map<string, string>()
    const validItems: ParameterRecord[] = []
    const invalidKeys = new Set<string>()

    dirtyItems.forEach((item) => {
      const key = item.id || item.label
      const trimmed = item.value.trim()
      const cleaned = trimmed.replace(/,/g, '')
      if (cleaned !== '' && Number.isNaN(Number(cleaned))) {
        invalidKeys.add(key)
        return
      }
      sanitizedValues.set(key, cleaned)
      validItems.push(item)
    })

    if (invalidKeys.size > 0) {
      setItems((previous) =>
        previous.map((item) => (invalidKeys.has(item.id || item.label) ? { ...item, status: 'error' } : item))
      )
      toast.error('Enter valid numbers')
      flushTimeoutRef.current = null
      isFlushingRef.current = false
      return
    }

    if (validItems.length === 0) {
      flushTimeoutRef.current = null
      isFlushingRef.current = false
      return
    }

    const dirtyKeys = new Set(validItems.map((item) => item.id || item.label))

    setItems((previous) =>
      previous.map((item) => (dirtyKeys.has(item.id || item.label) ? { ...item, status: 'saving' } : item))
    )

    try {
      const toCreate = validItems.filter((item) => !item.id)
      const toUpdate = validItems.filter((item) => item.id)

      for (const item of toCreate) {
        const key = item.label
        const value = sanitizedValues.get(key) ?? ''
        const response = await fetch(withAppBasePath('/api/v1/x-plan/business-parameters'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: item.label,
            valueNumeric: value ? Number(value) : 0,
          }),
        })
        if (!response.ok) throw new Error('Failed to create parameter')
      }

      if (toUpdate.length > 0) {
        const updates: BusinessParameterUpdate[] = toUpdate.map((item) => ({
          id: item.id,
          valueNumeric: sanitizedValues.get(item.id) ?? '',
        }))

        const response = await fetch(withAppBasePath('/api/v1/x-plan/business-parameters'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        })
        if (!response.ok) throw new Error('Failed to update parameters')
      }

      setItems((previous) =>
        previous.map((item) => {
          const key = item.id || item.label
          if (!dirtyKeys.has(key)) return item
          const sanitized = sanitizedValues.get(key) ?? ''
          return {
            ...item,
            value: sanitized,
            status: 'idle',
          }
        })
      )

      toast.success('Saved')
    } catch (error) {
      console.error(error)
      setItems((previous) =>
        previous.map((item) => (dirtyKeys.has(item.id || item.label) ? { ...item, status: 'error' } : item))
      )
      toast.error('Unable to save')
    } finally {
      flushTimeoutRef.current = null
      isFlushingRef.current = false
      if (pendingFlushRef.current) {
        pendingFlushRef.current = false
        void flushUpdates()
      }
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(() => {
      void flushUpdates()
    }, 500)
  }, [flushUpdates])

  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current)
        flushTimeoutRef.current = null
      }
      void flushUpdates()
    }
  }, [flushUpdates])

  const handleValueChange = useCallback(
    (key: string, value: string) => {
      setItems((previous) =>
        previous.map((item) => ((item.id || item.label) === key ? { ...item, value, status: 'dirty' } : item))
      )
      scheduleFlush()
    },
    [scheduleFlush]
  )

  const handleBlur = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = null
    }
    void flushUpdates()
  }, [flushUpdates])

  return (
    <div className={clsx('space-y-4', className)}>
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Parameter
              </th>
              <th className="w-36 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((item) => {
              const isError = item.status === 'error'
              const isSaving = item.status === 'saving'
              const isDirty = item.status === 'dirty'
              const key = item.id || item.label

              return (
                <tr key={key} className="bg-white dark:bg-transparent">
                  <td className="px-4 py-3">
                    <label htmlFor={`param-${key}`} className="text-sm text-slate-700 dark:text-slate-200">
                      {item.label}
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <input
                        id={`param-${key}`}
                        value={item.value}
                        onChange={(event) => handleValueChange(key, event.target.value)}
                        onBlur={handleBlur}
                        inputMode="decimal"
                        aria-invalid={isError}
                        disabled={isSaving}
                        className={clsx(
                          'w-full rounded-lg border px-3 py-2 text-right text-sm font-medium tabular-nums transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70',
                          isError
                            ? 'border-rose-300 bg-rose-50 text-rose-900 focus:border-rose-400 focus:ring-rose-200 dark:border-rose-500/50 dark:bg-rose-900/20 dark:text-rose-100'
                            : isDirty
                              ? 'border-amber-300 bg-amber-50 text-slate-900 focus:border-amber-400 focus:ring-amber-200 dark:border-amber-500/50 dark:bg-amber-900/20 dark:text-slate-100'
                              : 'border-slate-200 bg-white text-slate-900 focus:border-cyan-400 focus:ring-cyan-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/20'
                        )}
                      />
                      {isSaving && (
                        <div className="absolute inset-y-0 right-3 flex items-center">
                          <svg className="h-4 w-4 animate-spin text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
