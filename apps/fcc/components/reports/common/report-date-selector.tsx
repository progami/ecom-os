'use client'

import { useState, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { format, startOfYear, endOfMonth, subMonths } from 'date-fns'

export type ReportDateType = 'point-in-time' | 'date-range' | 'ytd'

export interface ReportDateSelectorProps {
  reportType: string
  dateType: ReportDateType
  value: {
    startDate?: string
    endDate: string
  }
  onChange: (dates: { startDate?: string; endDate: string }) => void
  disabled?: boolean
  className?: string
}

interface DatePreset {
  label: string
  getValue: () => { startDate?: string; endDate: string }
}

// Helper to get current year
const getCurrentYear = () => new Date().getFullYear()

// Helper to get last financial year end
const getLastFinancialYearEnd = () => {
  const today = new Date()
  const currentYear = today.getFullYear()
  const lastYear = currentYear - 1
  return new Date(lastYear, 11, 31) // December 31 of last year
}

// Helper to get end of last month
const getEndOfLastMonth = () => {
  const today = new Date()
  const lastMonth = subMonths(today, 1)
  return endOfMonth(lastMonth)
}

export function ReportDateSelector({
  reportType,
  dateType,
  value,
  onChange,
  disabled = false,
  className = ''
}: ReportDateSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const [showCustomInputs, setShowCustomInputs] = useState(false)
  
  // Custom date inputs
  const [customDay, setCustomDay] = useState<string>('')
  const [customMonth, setCustomMonth] = useState<string>('')
  const [customYear, setCustomYear] = useState<string>('')
  const [customEndDay, setCustomEndDay] = useState<string>('')
  const [customEndMonth, setCustomEndMonth] = useState<string>('')
  const [customEndYear, setCustomEndYear] = useState<string>('')

  // Get presets based on date type
  const getPresets = (): DatePreset[] => {
    switch (dateType) {
      case 'ytd':
        return [
          {
            label: 'As of Today',
            getValue: () => ({
              startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
              endDate: format(new Date(), 'yyyy-MM-dd')
            })
          },
          {
            label: 'End of Last Month',
            getValue: () => ({
              startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
              endDate: format(getEndOfLastMonth(), 'yyyy-MM-dd')
            })
          },
          {
            label: 'End of Last Financial Year',
            getValue: () => ({
              startDate: format(startOfYear(getLastFinancialYearEnd()), 'yyyy-MM-dd'),
              endDate: format(getLastFinancialYearEnd(), 'yyyy-MM-dd')
            })
          }
        ]
      
      case 'point-in-time':
        return [
          {
            label: 'Today',
            getValue: () => ({ endDate: format(new Date(), 'yyyy-MM-dd') })
          },
          {
            label: 'End of Last Month',
            getValue: () => ({ endDate: format(getEndOfLastMonth(), 'yyyy-MM-dd') })
          },
          {
            label: 'End of Last Financial Year',
            getValue: () => ({ endDate: format(getLastFinancialYearEnd(), 'yyyy-MM-dd') })
          }
        ]
      
      case 'date-range':
        return [
          {
            label: 'Current Month',
            getValue: () => ({
              startDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
              endDate: format(new Date(), 'yyyy-MM-dd')
            })
          },
          {
            label: 'Last Month',
            getValue: () => {
              const lastMonth = subMonths(new Date(), 1)
              return {
                startDate: format(new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1), 'yyyy-MM-dd'),
                endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
              }
            }
          },
          {
            label: 'Last Financial Year',
            getValue: () => ({
              startDate: format(new Date(getCurrentYear() - 1, 0, 1), 'yyyy-MM-dd'),
              endDate: format(getLastFinancialYearEnd(), 'yyyy-MM-dd')
            })
          }
        ]
    }
  }

  // Initialize custom inputs from value
  useEffect(() => {
    if (value.endDate) {
      const endDate = new Date(value.endDate)
      setCustomEndDay(endDate.getDate().toString())
      setCustomEndMonth((endDate.getMonth() + 1).toString())
      setCustomEndYear(endDate.getFullYear().toString())
    }
    
    if (value.startDate && dateType === 'date-range') {
      const startDate = new Date(value.startDate)
      setCustomDay(startDate.getDate().toString())
      setCustomMonth((startDate.getMonth() + 1).toString())
      setCustomYear(startDate.getFullYear().toString())
    }
  }, [value, dateType])

  const handlePresetSelect = (preset: DatePreset) => {
    const dates = preset.getValue()
    onChange(dates)
    setSelectedPreset(preset.label)
    setShowCustomInputs(false)
  }

  const handleCustomDateApply = () => {
    let dates: { startDate?: string; endDate: string }
    
    if (dateType === 'date-range') {
      dates = {
        startDate: `${customYear}-${customMonth.padStart(2, '0')}-${customDay.padStart(2, '0')}`,
        endDate: `${customEndYear}-${customEndMonth.padStart(2, '0')}-${customEndDay.padStart(2, '0')}`
      }
    } else if (dateType === 'ytd') {
      dates = {
        startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
        endDate: `${customEndYear}-${customEndMonth.padStart(2, '0')}-${customEndDay.padStart(2, '0')}`
      }
    } else {
      dates = {
        endDate: `${customEndYear}-${customEndMonth.padStart(2, '0')}-${customEndDay.padStart(2, '0')}`
      }
    }
    
    onChange(dates)
    setSelectedPreset('custom')
  }

  const presets = getPresets()
  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ]

  const currentYear = getCurrentYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div className={`space-y-4 ${className}`}>
      {/* For YTD reports, show info message */}
      {dateType === 'ytd' && reportType === 'TRIAL_BALANCE' && (
        <div className="bg-brand-amber/10 border border-brand-amber/30 rounded-lg p-3">
          <p className="text-sm text-brand-amber">
            Trial Balance is Year-To-Date starting from January 1st
          </p>
        </div>
      )}

      {/* Preset buttons */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          {dateType === 'date-range' ? 'Period Selection' : 'Report Date'}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetSelect(preset)}
              disabled={disabled}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                selectedPreset === preset.label
                  ? 'bg-brand-blue text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setShowCustomInputs(!showCustomInputs)
              setSelectedPreset('custom')
            }}
            disabled={disabled}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              selectedPreset === 'custom'
                ? 'bg-brand-blue text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Custom Date
          </button>
        </div>
      </div>

      {/* Custom date inputs */}
      {showCustomInputs && (
        <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          {/* Start date (only for date-range) */}
          {dateType === 'date-range' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Date
              </label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={customDay}
                  onChange={(e) => setCustomDay(e.target.value)}
                  disabled={disabled}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 focus:outline-none focus:border-brand-blue"
                >
                  <option value="">Day</option>
                  {days.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  value={customMonth}
                  onChange={(e) => setCustomMonth(e.target.value)}
                  disabled={disabled}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 focus:outline-none focus:border-brand-blue"
                >
                  <option value="">Month</option>
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <select
                  value={customYear}
                  onChange={(e) => setCustomYear(e.target.value)}
                  disabled={disabled}
                  className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 focus:outline-none focus:border-brand-blue"
                >
                  <option value="">Year</option>
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* YTD start date display */}
          {dateType === 'ytd' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Period Start (YTD)
              </label>
              <div className="px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-gray-400">
                January 1, {getCurrentYear()}
              </div>
            </div>
          )}

          {/* End date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {dateType === 'date-range' ? 'End Date' : dateType === 'ytd' ? 'As of Date' : 'Report Date'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={customEndDay}
                onChange={(e) => setCustomEndDay(e.target.value)}
                disabled={disabled}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 focus:outline-none focus:border-brand-blue"
              >
                <option value="">Day</option>
                {days.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={customEndMonth}
                onChange={(e) => setCustomEndMonth(e.target.value)}
                disabled={disabled}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 focus:outline-none focus:border-brand-blue"
              >
                <option value="">Month</option>
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={customEndYear}
                onChange={(e) => setCustomEndYear(e.target.value)}
                disabled={disabled}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 focus:outline-none focus:border-brand-blue"
              >
                <option value="">Year</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCustomDateApply}
            disabled={disabled || !customEndDay || !customEndMonth || !customEndYear || 
              (dateType === 'date-range' && (!customDay || !customMonth || !customYear))}
            className="w-full px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Apply Custom Date
          </button>
        </div>
      )}

      {/* Current selection display */}
      <div className="text-sm text-gray-400">
        Current selection: {
          dateType === 'ytd' ? 
            `YTD from Jan 1 to ${value.endDate ? format(new Date(value.endDate), 'MMM d, yyyy') : '...'}` :
          dateType === 'date-range' && value.startDate ? 
            `${format(new Date(value.startDate), 'MMM d, yyyy')} - ${format(new Date(value.endDate), 'MMM d, yyyy')}` :
          value.endDate ? 
            `As at ${format(new Date(value.endDate), 'MMM d, yyyy')}` : 
            'No date selected'
        }
      </div>
    </div>
  )
}