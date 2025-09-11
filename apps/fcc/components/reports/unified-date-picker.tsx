'use client'

import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { 
  format, endOfMonth, endOfQuarter, endOfYear, startOfMonth, startOfQuarter, startOfYear,
  subMonths, subQuarters, subYears, addDays 
} from 'date-fns'
import { cn } from '@/lib/utils'

export type DateType = 'point-in-time' | 'date-range' | 'month'

interface DatePreset {
  label: string
  getValue: () => Date | { from: Date; to: Date }
}

interface UnifiedDatePickerProps {
  dateType: DateType
  value: Date | { from: Date; to: Date }
  onChange: (value: Date | { from: Date; to: Date }) => void
  label?: string
  disabled?: boolean
  className?: string
}

// Unified presets for all date types
const getPresets = (dateType: DateType): DatePreset[] => {
  const now = new Date()
  
  switch (dateType) {
    case 'point-in-time':
      return [
        { label: 'Today', getValue: () => now },
        { label: 'End of current month', getValue: () => endOfMonth(now) },
        { label: 'End of current quarter', getValue: () => endOfQuarter(now) },
        { label: 'End of last month', getValue: () => endOfMonth(subMonths(now, 1)) },
        { label: 'End of 2 months ago', getValue: () => endOfMonth(subMonths(now, 2)) },
        { label: 'End of 3 months ago', getValue: () => endOfMonth(subMonths(now, 3)) },
        { label: 'End of 6 months ago', getValue: () => endOfMonth(subMonths(now, 6)) },
        { label: 'End of last quarter', getValue: () => endOfQuarter(subQuarters(now, 1)) },
        { label: 'End of last year', getValue: () => endOfYear(subYears(now, 1)) },
        { label: 'Beginning of current year', getValue: () => startOfYear(now) }
      ]
    
    case 'date-range':
      return [
        { 
          label: 'This month', 
          getValue: () => ({ from: startOfMonth(now), to: endOfMonth(now) })
        },
        { 
          label: 'Last month', 
          getValue: () => ({ 
            from: startOfMonth(subMonths(now, 1)), 
            to: endOfMonth(subMonths(now, 1)) 
          })
        },
        { 
          label: 'Last 3 months', 
          getValue: () => ({ 
            from: startOfMonth(subMonths(now, 2)), 
            to: endOfMonth(now) 
          })
        },
        { 
          label: 'Last 6 months', 
          getValue: () => ({ 
            from: startOfMonth(subMonths(now, 5)), 
            to: endOfMonth(now) 
          })
        },
        { 
          label: 'This quarter', 
          getValue: () => ({ 
            from: startOfQuarter(now), 
            to: endOfQuarter(now) 
          })
        },
        { 
          label: 'Last quarter', 
          getValue: () => ({ 
            from: startOfQuarter(subQuarters(now, 1)), 
            to: endOfQuarter(subQuarters(now, 1)) 
          })
        },
        { 
          label: 'This year', 
          getValue: () => ({ 
            from: startOfYear(now), 
            to: endOfYear(now) 
          })
        },
        { 
          label: 'Last year', 
          getValue: () => ({ 
            from: startOfYear(subYears(now, 1)), 
            to: endOfYear(subYears(now, 1)) 
          })
        },
        { 
          label: 'Last 7 days', 
          getValue: () => ({ 
            from: addDays(now, -6), 
            to: now 
          })
        },
        { 
          label: 'Last 30 days', 
          getValue: () => ({ 
            from: addDays(now, -29), 
            to: now 
          })
        }
      ]
    
    case 'month':
      return [
        { label: 'This month', getValue: () => now },
        { label: 'Last month', getValue: () => subMonths(now, 1) },
        { label: '2 months ago', getValue: () => subMonths(now, 2) },
        { label: '3 months ago', getValue: () => subMonths(now, 3) },
        { label: '6 months ago', getValue: () => subMonths(now, 6) },
        { label: '12 months ago', getValue: () => subMonths(now, 12) },
        { label: 'Beginning of this year', getValue: () => startOfYear(now) },
        { label: 'End of last year', getValue: () => endOfYear(subYears(now, 1)) }
      ]
  }
}

export function UnifiedDatePicker({
  dateType,
  value,
  onChange,
  label,
  disabled = false,
  className
}: UnifiedDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const presets = getPresets(dateType)
  
  // Format display value based on type
  const formatDisplayValue = () => {
    if (dateType === 'date-range' && typeof value === 'object' && 'from' in value) {
      return `${format(value.from, 'MMM d, yyyy')} - ${format(value.to, 'MMM d, yyyy')}`
    } else if (dateType === 'month' && value instanceof Date) {
      return format(value, 'MMMM yyyy')
    } else if (value instanceof Date) {
      return format(value, 'MMMM d, yyyy')
    }
    return ''
  }

  // Get appropriate label
  const getLabel = () => {
    if (label) return label
    switch (dateType) {
      case 'point-in-time': return 'As of Date'
      case 'date-range': return 'Date Range'
      case 'month': return 'Report Month'
    }
  }

  const handlePresetSelect = (getValue: () => Date | { from: Date; to: Date }) => {
    onChange(getValue())
    setIsOpen(false)
  }

  return (
    <div className={cn('relative', className)}>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {getLabel()}
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
            <span>{formatDisplayValue()}</span>
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
                {presets.map((preset, index) => {
                  const presetValue = preset.getValue()
                  const displayDate = dateType === 'date-range' && typeof presetValue === 'object' && 'from' in presetValue
                    ? `${format(presetValue.from, 'MMM d')} - ${format(presetValue.to, 'MMM d, yyyy')}`
                    : dateType === 'month' && presetValue instanceof Date
                    ? format(presetValue, 'MMM yyyy')
                    : presetValue instanceof Date
                    ? format(presetValue, 'MMM d, yyyy')
                    : ''
                    
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handlePresetSelect(preset.getValue)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm rounded',
                        'hover:bg-slate-700 transition-colors',
                        'text-gray-300 hover:text-white'
                      )}
                    >
                      {preset.label}
                      <span className="ml-2 text-xs text-gray-500">
                        ({displayDate})
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom Date Input */}
            <div className="p-4">
              <p className="text-xs font-medium text-gray-400 uppercase mb-2">Custom Date</p>
              {dateType === 'date-range' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="date"
                      value={typeof value === 'object' && 'from' in value ? format(value.from, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        if (e.target.value && typeof value === 'object' && 'from' in value) {
                          onChange({ from: new Date(e.target.value), to: value.to })
                        }
                      }}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="w-full px-3 py-2 pr-10 bg-slate-700 border border-slate-600 rounded text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent hover:bg-slate-600 hover:border-slate-500 transition-colors"
                      placeholder="From date"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <input
                      type="date"
                      value={typeof value === 'object' && 'to' in value ? format(value.to, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        if (e.target.value && typeof value === 'object' && 'from' in value) {
                          onChange({ from: value.from, to: new Date(e.target.value) })
                        }
                      }}
                      min={typeof value === 'object' && 'from' in value ? format(value.from, 'yyyy-MM-dd') : undefined}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="w-full px-3 py-2 pr-10 bg-slate-700 border border-slate-600 rounded text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent hover:bg-slate-600 hover:border-slate-500 transition-colors"
                      placeholder="To date"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              ) : dateType === 'month' ? (
                <div className="relative">
                  <input
                    type="month"
                    value={value instanceof Date ? format(value, 'yyyy-MM') : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [year, month] = e.target.value.split('-')
                        onChange(new Date(parseInt(year), parseInt(month) - 1))
                      }
                    }}
                    max={format(new Date(), 'yyyy-MM')}
                    className="w-full px-3 py-2 pr-10 bg-slate-700 border border-slate-600 rounded text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent hover:bg-slate-600 hover:border-slate-500 transition-colors"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="date"
                    value={value instanceof Date ? format(value, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        onChange(new Date(e.target.value))
                      }
                    }}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full px-3 py-2 pr-10 bg-slate-700 border border-slate-600 rounded text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent hover:bg-slate-600 hover:border-slate-500 transition-colors"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              )}
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
        {dateType === 'point-in-time' && 'Snapshot date for the report'}
        {dateType === 'date-range' && 'Period for the report data'}
        {dateType === 'month' && 'Month to analyze'}
      </p>
    </div>
  )
}