'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

interface BusinessParameter {
  id: string
  label: string
  value: string
  type: 'numeric' | 'text'
}

export function BusinessParametersPanel({ parameters }: { parameters: BusinessParameter[] }) {
  const [rows, setRows] = useState(parameters)
  const pendingRef = useRef<Map<string, string>>(new Map())
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setRows(parameters)
  }, [parameters])

  const flush = () => {
    if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current)
    flushTimeoutRef.current = setTimeout(async () => {
      const payload: Array<{ id: string; valueNumeric?: string; valueText?: string }> = []
      for (const [id, value] of pendingRef.current.entries()) {
        const parameter = rows.find((item) => item.id === id)
        if (!parameter) continue
        if (parameter.type === 'numeric') {
          payload.push({ id, valueNumeric: value })
        } else {
          payload.push({ id, valueText: value })
        }
      }

      if (payload.length === 0) return
      pendingRef.current.clear()

      try {
        const response = await fetch('/api/v1/x-plan/business-parameters', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: payload }),
        })
        if (!response.ok) throw new Error('Failed to update parameters')
        setRows((previous) =>
          previous.map((row) => {
            const update = payload.find((item) => item.id === row.id)
            if (!update) return row
            if (row.type === 'numeric') {
              const numericValue = Number(update.valueNumeric ?? row.value)
              if (Number.isNaN(numericValue)) return row
              return { ...row, value: numericValue.toFixed(2) }
            }
            return row
          })
        )
        toast.success('Business parameters updated')
      } catch (error) {
        console.error(error)
        toast.error('Unable to update business parameters')
      }
    }, 400)
  }

  const handleChange = (id: string) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = event.target
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, value } : row)))
    pendingRef.current.set(id, value)
  }

  const handleBlur = () => {
    flush()
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Business Parameters</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Global assumptions that flow into every sheet.</p>
      </header>
      <div className="space-y-2">
        {rows.map((parameter) => (
          <div
            key={parameter.id}
            className="flex flex-col gap-1 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"
          >
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {parameter.label}
            </label>
            <input
              value={parameter.value}
              onChange={handleChange(parameter.id)}
              onBlur={handleBlur}
              type={parameter.type === 'numeric' ? 'number' : 'text'}
              step={parameter.type === 'numeric' ? '0.01' : undefined}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export function ProductSetupFinancePanel({ parameters }: { parameters: BusinessParameter[] }) {
  if (parameters.length === 0) return null

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Finance</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Set the cash assumptions that feed every financial plan.
        </p>
      </header>
      <BusinessParametersPanel parameters={parameters} />
    </section>
  )
}
