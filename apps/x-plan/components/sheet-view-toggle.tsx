"use client"

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import {
  SHEET_TOOLBAR_BUTTON,
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SEGMENTED,
} from '@/components/sheet-toolbar'

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
    <div className={SHEET_TOOLBAR_GROUP}>
      <span className={SHEET_TOOLBAR_LABEL}>View</span>
      <div role="group" aria-label="Select sheet view" className={SHEET_TOOLBAR_SEGMENTED}>
        {options.map((option) => {
          const isActive = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              className={clsx(
                SHEET_TOOLBAR_BUTTON,
                'rounded-none first:rounded-l-full last:rounded-r-full',
                isActive
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-50 dark:text-slate-900'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100'
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
