'use client'

import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { withAppBasePath } from '@/lib/base-path'

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
  className?: string
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

export function ProductSetupParametersPanel({
  title,
  description,
  parameters,
  className,
}: ProductSetupParametersPanelProps) {
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
      const response = await fetch(withAppBasePath('/api/v1/x-plan/business-parameters'), {
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

  const parameterCards = useMemo(() => {
    return items.map((item) => {
      const isError = item.status === 'error'
      const isSaving = item.status === 'saving'
      const isDirty = item.status === 'dirty'
      const statusLabel = isSaving ? 'Saving…' : isError ? 'Save failed' : isDirty ? 'Pending save' : 'Saved'

      const statusTone = clsx(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]',
        isSaving
          ? 'border-amber-500 bg-amber-100 text-amber-800'
          : isError
          ? 'border-rose-500 bg-rose-100 text-rose-800'
          : isDirty
          ? 'border-cyan-500 bg-cyan-100 text-cyan-800'
          : 'border-emerald-500 bg-emerald-100 text-emerald-800'
      )

      return (
        <div
          key={item.id}
          className={clsx(
            'group relative flex flex-col gap-3 rounded-2xl border border-slate-300 bg-slate-50]/85 p-4 text-slate-900 shadow-md)] transition',
            'ring-1 ring-transparent hover:ring-cyan-400/40'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-snug text-slate-900">{item.label}</p>
              <span className="inline-flex rounded-full border border-cyan-600/30 bg-cyan-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.34em] text-cyan-800">
                {item.type === 'numeric' ? 'Numeric' : 'Text'}
              </span>
            </div>
            <span className={statusTone}>{statusLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                value={item.value}
                onChange={(event) => handleValueChange(item.id, event.target.value)}
                onBlur={handleBlur}
                inputMode={item.type === 'numeric' ? 'decimal' : 'text'}
                aria-invalid={isError}
                aria-describedby={isError ? `${item.id}-error` : undefined}
                disabled={isSaving}
                className={clsx(
                  'w-full rounded-xl border px-3 py-2.5 text-base font-semibold tracking-wide transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70',
                  isError
                    ? 'border-rose-400/60 bg-rose-500/10 text-rose-50 focus:border-rose-300 focus:ring-rose-300/60'
                    : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:ring-cyan-500/60]/80'
                )}
              />
              {isError ? (
                <p id={`${item.id}-error`} className="mt-1 text-xs font-medium text-rose-200">
                  Check the value and try saving again.
                </p>
              ) : null}
            </div>
            {isSaving ? (
              <svg
                className="h-5 w-5 animate-spin text-cyan-700"
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
      )
    })
  }, [handleBlur, handleValueChange, items])

  return (
    <section
      className={clsx(
        'relative space-y-4 rounded-3xl border border-slate-200] bg-white] p-6 text-slate-900 shadow-lg)] ring-1 ring-slate-200]/60',
        'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_10%_18%,rgba(0,194,185,0.16),transparent_60%),radial-gradient(circle_at_90%_25%,rgba(0,194,185,0.1),transparent_65%)] before:opacity-90 before:mix-blend-screen before:content-[""]',
        'backdrop-blur-xl',
        className
      )}
    >
      <div className="relative space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">{title}</p>
        <p className="max-w-xl text-sm leading-relaxed text-slate-700">{description}</p>
      </div>
      <div className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-3">{parameterCards}</div>
    </section>
  )
}
