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
  const isFlushingRef = useRef(false)
  const pendingFlushRef = useRef(false)
  const [items, setItems] = useState<ParameterRecord[]>(() => initializeRecords(parameters))
  const itemsRef = useRef(items)

  useEffect(() => {
    const nextRecords = initializeRecords(parameters)
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
      flushTimeoutRef.current = null
    }
    setItems(nextRecords)
    itemsRef.current = nextRecords
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

    if (isFlushingRef.current) {
      pendingFlushRef.current = true
      return
    }

    isFlushingRef.current = true

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
      isFlushingRef.current = false
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
        const statusLabel = isSaving ? 'Saving…' : isError ? 'Save failed' : isDirty ? 'Pending save' : 'Saved'
        const statusTone = isSaving
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
          : isError
          ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200'
          : isDirty
          ? 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-200'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
        const helperId = `${item.id}-helper`

        return (
          <div
            key={item.id}
            className="border-t border-slate-200 first:border-t-0 dark:border-slate-800"
          >
            <div className="flex flex-col gap-3 px-4 py-3 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)] md:items-center md:gap-6">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 font-medium uppercase tracking-wide dark:border-slate-700">
                    {item.type === 'numeric' ? 'Numeric' : 'Text'}
                  </span>
                  <span id={helperId} className="hidden md:inline">
                    {item.type === 'numeric'
                      ? 'Auto-formats to two decimal places after saving.'
                      : 'Saved exactly as typed.'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <input
                  value={item.value}
                  onChange={(event) => handleValueChange(item.id, event.target.value)}
                  onBlur={handleBlur}
                  inputMode={item.type === 'numeric' ? 'decimal' : 'text'}
                  aria-describedby={helperId}
                  aria-invalid={isError}
                  disabled={isSaving}
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70 ${
                    isError
                      ? 'border-rose-300 text-rose-900 focus:ring-rose-500 dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-100 dark:focus:ring-rose-400'
                      : 'border-slate-200 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-400'
                  }`}
                />
                {isError ? (
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-300">Check the value and try saving again.</p>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusTone}`}>
                  {statusLabel}
                </span>
                {isSaving ? (
                  <svg
                    className="h-4 w-4 animate-spin text-amber-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      d="M4 12a8 8 0 018-8"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : null}
              </div>
            </div>
          </div>
        )
      }),
    [handleBlur, handleValueChange, items]
  )

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-300">{title}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </header>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="hidden border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
          <span>Parameter</span>
          <span>Value</span>
          <span>Status</span>
        </div>
        <div>{sections}</div>
      </div>
    </section>
  )
}
