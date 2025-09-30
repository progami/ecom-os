'use client'

import clsx from 'clsx'
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

  const parameterCards = useMemo(() => {
    return items.map((item) => {
      const isError = item.status === 'error'
      const isSaving = item.status === 'saving'
      const isDirty = item.status === 'dirty'
      const statusLabel = isSaving ? 'Saving…' : isError ? 'Save failed' : isDirty ? 'Pending save' : 'Saved'

      const statusTone = clsx(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]',
        isSaving
          ? 'border-amber-400/40 bg-amber-300/20 text-amber-100'
          : isError
          ? 'border-rose-400/40 bg-rose-400/15 text-rose-100'
          : isDirty
          ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
          : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100'
      )

      return (
        <div
          key={item.id}
          className={clsx(
            'group relative flex flex-col gap-3 rounded-2xl border border-white/12 bg-[#06182b]/85 p-4 text-slate-100 shadow-[0_16px_40px_rgba(1,12,24,0.45)] transition',
            'ring-1 ring-transparent hover:ring-cyan-400/40'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-snug text-white/90">{item.label}</p>
              <span className="inline-flex rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.34em] text-cyan-200/80">
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
                  'w-full rounded-xl border px-3 py-2 text-sm font-medium tracking-wide transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70',
                  isError
                    ? 'border-rose-400/60 bg-rose-500/10 text-rose-50 focus:border-rose-300 focus:ring-rose-300/60'
                    : 'border-white/15 bg-[#031222]/80 text-slate-100 placeholder-slate-500 focus:border-cyan-300 focus:ring-cyan-300/60'
                )}
              />
              {isError ? (
                <p id={`${item.id}-error`} className="mt-1 text-[11px] font-medium text-rose-200">
                  Check the value and try saving again.
                </p>
              ) : null}
            </div>
            {isSaving ? (
              <svg
                className="h-5 w-5 animate-spin text-cyan-200/80"
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
        'relative space-y-4 rounded-3xl border border-[#0b3a52] bg-[#041324] p-6 text-slate-100 shadow-[0_26px_55px_rgba(1,12,24,0.55)] ring-1 ring-[#0f2e45]/60',
        'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_10%_18%,rgba(0,194,185,0.16),transparent_60%),radial-gradient(circle_at_90%_25%,rgba(0,194,185,0.1),transparent_65%)] before:opacity-90 before:mix-blend-screen before:content-[""]',
        'backdrop-blur-xl',
        className
      )}
    >
      <div className="relative space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">{title}</p>
        <p className="max-w-xl text-sm leading-relaxed text-slate-200/80">{description}</p>
      </div>
      <div className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-3">{parameterCards}</div>
    </section>
  )
}
