'use client'

import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { format, endOfMonth, endOfQuarter, endOfYear, subMonths, subQuarters, subYears, startOfYear } from 'date-fns'
import { cn } from '@/lib/utils'

interface PointInTimeDatePickerProps {
  value: Date
  onChange: (date: Date) => void
  label?: string
  disabled?: boolean
  className?: string
}

const PRESET_OPTIONS = [
  { 
    label: 'Today', 
    getValue: () => new Date()
  },
  { 
    label: 'End of current month', 
    getValue: () => endOfMonth(new Date())
  },
  { 
    label: 'End of current quarter', 
    getValue: () => endOfQuarter(new Date())
  },
  { 
    label: 'End of last month', 
    getValue: () => endOfMonth(subMonths(new Date(), 1))
  },
  { 
    label: 'End of 2 months ago', 
    getValue: () => endOfMonth(subMonths(new Date(), 2))
  },
  { 
    label: 'End of 3 months ago', 
    getValue: () => endOfMonth(subMonths(new Date(), 3))
  },
  { 
    label: 'End of 6 months ago', 
    getValue: () => endOfMonth(subMonths(new Date(), 6))
  },
  { 
    label: 'End of last quarter', 
    getValue: () => endOfQuarter(subQuarters(new Date(), 1))
  },
  { 
    label: 'End of last year', 
    getValue: () => endOfYear(subYears(new Date(), 1))
  },
  {
    label: 'Beginning of current year',
    getValue: () => startOfYear(new Date())
  }
]

export function PointInTimeDatePicker({
  value,
  onChange,
  label = 'As of Date',
  disabled = false,
  className
}: PointInTimeDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customDate, setCustomDate] = useState(format(value, 'yyyy-MM-dd'))

  const handlePresetSelect = (getValue: () => Date) => {
    const date = getValue()
    onChange(date)
    setCustomDate(format(date, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  const handleCustomDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value
    setCustomDate(dateStr)
    if (dateStr) {
      onChange(new Date(dateStr))
    }
  }

  return (
    <div className={cn('relative', className)}>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg',
            'text-gray-200 text-left flex items-center justify-between',
            'focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue',
            'transition-colors hover:bg-slate-700',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>{format(value, 'MMMM d, yyyy')}</span>
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            isOpen && 'transform rotate-180'
          )} />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
            {/* Preset Options */}
            <div className="p-2 border-b border-slate-700">
              <p className="px-2 py-1 text-xs font-medium text-gray-400 uppercase">Quick Options</p>
              <div className="mt-1 max-h-64 overflow-y-auto">
                {PRESET_OPTIONS.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handlePresetSelect(option.getValue)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm rounded',
                      'hover:bg-slate-700 transition-colors',
                      'text-gray-300 hover:text-white'
                    )}
                  >
                    {option.label}
                    <span className="ml-2 text-xs text-gray-500">
                      ({format(option.getValue(), 'MMM d, yyyy')})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Input */}
            <div className="p-4">
              <p className="text-xs font-medium text-gray-400 uppercase mb-2">Custom Date</p>
              <div className="relative">
                <input
                  type="date"
                  value={customDate}
                  onChange={handleCustomDateChange}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-3 py-2 pr-10 bg-slate-700 border border-slate-600 rounded text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent hover:bg-slate-600 hover:border-slate-500 transition-colors"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Close Button */}
            <div className="p-2 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-gray-400">
        Snapshot date for the report
      </p>
    </div>
  )
}