"use client"

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'

type SheetViewMode = 'tabular' | 'visual'

const options: Array<{ value: SheetViewMode; label: string; helper: string }> = [
  { value: 'tabular', label: 'Tabular', helper: 'View spreadsheet layout' },
  { value: 'visual', label: 'Visual', helper: 'Explore charts and timelines' },
]

interface SheetViewToggleProps {
  value: SheetViewMode
}

export function SheetViewToggle({ value }: SheetViewToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleSelect = (mode: SheetViewMode) => {
    if (mode === value) return
    startTransition(() => {
      const params = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams()
      if (mode === 'tabular') {
        params.delete('view')
      } else {
        params.set('view', mode)
      }
      const query = params.toString()
      router.push(`${pathname}${query ? `?${query}` : ''}`)
    })
  }

  return (
    <div className="flex flex-col items-end gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="font-medium uppercase tracking-wide">View</span>
      <div
        role="group"
        aria-label="Select sheet view"
        className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 text-sm font-medium dark:border-slate-700 dark:bg-slate-800/60"
      >
        {options.map((option) => {
          const isActive = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              className={clsx(
                'relative rounded-full px-4 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:focus-visible:outline-slate-600',
                isActive
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
              onClick={() => handleSelect(option.value)}
              aria-pressed={isActive}
              disabled={isPending && isActive}
              title={option.helper}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type { SheetViewMode }
