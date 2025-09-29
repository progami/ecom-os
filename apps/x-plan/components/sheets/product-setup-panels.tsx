'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

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

type ParameterStatus = 'idle' | 'dirty' | 'saving' | 'error'

interface ParameterRecord extends BusinessParameter {
  status: ParameterStatus
}

function initializeRecords(parameters: BusinessParameter[]): ParameterRecord[] {
  return parameters.map((parameter) => ({
    ...parameter,
    value: parameter.value ?? '',
    status: 'idle' as ParameterStatus,
  }))
}

function formatNumericForDisplay(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const normalized = Number(trimmed.replace(/,/g, ''))
  if (Number.isNaN(normalized)) return value
  return normalized.toFixed(2)
}

export function ProductSetupParametersPanel({ title, description, parameters }: ProductSetupParametersPanelProps) {
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [items, setItems] = useState<ParameterRecord[]>(() => initializeRecords(parameters))
  const itemsRef = useRef(items)

  useEffect(() => {
    setItems(initializeRecords(parameters))
  }, [parameters])

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

    const sanitizedValues = new Map<string, string>()
    const validItems: ParameterRecord[] = []
    const invalidIds = new Set<string>()

    dirtyItems.forEach((item) => {
      const trimmed = item.value.trim()
      if (item.type === 'numeric') {
        const cleaned = trimmed.replace(/,/g, '')
        if (cleaned !== '' && Number.isNaN(Number(cleaned))) {
          invalidIds.add(item.id)
          return
        }
        sanitizedValues.set(item.id, cleaned)
        validItems.push(item)
      } else {
        sanitizedValues.set(item.id, trimmed)
        validItems.push(item)
      }
    })

    if (invalidIds.size > 0) {
      setItems((previous) =>
        previous.map((item) => (invalidIds.has(item.id) ? { ...item, status: 'error' } : item))
      )
      toast.error('Enter a valid numeric value to continue')
    }

    if (validItems.length === 0) {
      flushTimeoutRef.current = null
      return
    }

    const dirtyIds = new Set(validItems.map((item) => item.id))

    setItems((previous) =>
      previous.map((item) => (dirtyIds.has(item.id) ? { ...item, status: 'saving' } : item))
    )

    const payload: BusinessParameterUpdate[] = validItems.map((item) => {
      const sanitized = sanitizedValues.get(item.id) ?? ''
      if (item.type === 'numeric') {
        return { id: item.id, valueNumeric: sanitized }
      }
      return { id: item.id, valueText: sanitized }
    })

    try {
      const response = await fetch('/api/v1/x-plan/business-parameters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: payload }),
      })
      if (!response.ok) throw new Error('Failed to update parameters')

      setItems((previous) =>
        previous.map((item) => {
          if (!dirtyIds.has(item.id)) return item
          const sanitized = sanitizedValues.get(item.id) ?? ''
          if (item.type === 'numeric') {
            return {
              ...item,
              value: formatNumericForDisplay(sanitized),
              status: 'idle',
            }
          }
          return {
            ...item,
            value: sanitized,
            status: 'idle',
          }
        })
      )

      toast.success('Parameters updated')
    } catch (error) {
      console.error(error)
      setItems((previous) =>
        previous.map((item) => (dirtyIds.has(item.id) ? { ...item, status: 'error' } : item))
      )
      toast.error('Unable to update parameters')
    } finally {
      flushTimeoutRef.current = null
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
    (id: string, value: string) => {
      setItems((previous) =>
        previous.map((item) => (item.id === id ? { ...item, value, status: 'dirty' } : item))
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

  const sections = useMemo(
    () =>
      items.map((item) => {
        const isError = item.status === 'error'
        const isSaving = item.status === 'saving'
        const isDirty = item.status === 'dirty'
        let statusLabel: string | null = null
        let statusClass = ''
        if (isSaving) {
          statusLabel = 'Saving…'
          statusClass = 'text-amber-600 dark:text-amber-400'
        } else if (isDirty) {
          statusLabel = 'Pending save'
          statusClass = 'text-slate-400 dark:text-slate-500'
        } else if (isError) {
          statusLabel = 'Save failed'
          statusClass = 'text-rose-600 dark:text-rose-400'
        }

        const baseInputClasses =
          'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-75'
        const lightThemeBorder = isError ? 'border-rose-300 focus:ring-rose-400' : 'border-slate-300 focus:ring-slate-400'
        const darkThemeBorder = isError
          ? 'dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-100 dark:focus:ring-rose-500'
          : 'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-600'

        return (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          >
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label}</p>
              <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {item.type === 'numeric' ? 'Numeric value (auto-formatted to 2 decimals)' : 'Text value'}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                value={item.value}
                onChange={(event) => handleValueChange(item.id, event.target.value)}
                onBlur={handleBlur}
                inputMode={item.type === 'numeric' ? 'decimal' : 'text'}
                disabled={isSaving}
                className={`${baseInputClasses} ${lightThemeBorder} ${darkThemeBorder}`}
              />
              {statusLabel ? (
                <span className={`text-xs font-medium ${statusClass}`}>{statusLabel}</span>
              ) : null}
            </div>
          </div>
        )
      }),
    [handleBlur, handleValueChange, items]
  )

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-300">{title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">{sections}</div>
    </section>
  )
}
