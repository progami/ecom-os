'use client'

import { useState } from 'react'
import { Search, Filter, Calendar, X } from 'lucide-react'
import { ImportHistoryFilterProps, ImportFilters, REPORT_TYPE_LABELS } from './types'
import { cn } from '@/lib/utils'

export function ImportHistoryFilter({
  onFilterChange,
  reportTypes,
  className
}: ImportHistoryFilterProps) {
  const [filters, setFilters] = useState<ImportFilters>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const handleFilterChange = (newFilters: Partial<ImportFilters>) => {
    const updated = { ...filters, ...newFilters }
    setFilters(updated)
    onFilterChange(updated)
  }
  
  const clearFilters = () => {
    setFilters({})
    onFilterChange({})
  }
  
  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== '')
  
  return (
    <div className={cn("space-y-3", className)}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => handleFilterChange({ search: e.target.value })}
          placeholder="Search by file name or user..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors"
        />
      </div>
      
      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
            showAdvanced ? "bg-brand-blue/20 text-brand-blue" : "text-gray-400 hover:text-gray-300"
          )}
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 bg-brand-blue rounded-full text-xs text-white">
              {Object.values(filters).filter(v => v !== undefined && v !== '').length}
            </span>
          )}
        </button>
        
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
            Clear filters
          </button>
        )}
      </div>
      
      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          {/* Report Type */}
          {reportTypes && reportTypes.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Report Type
              </label>
              <select
                value={filters.reportType || ''}
                onChange={(e) => handleFilterChange({ reportType: e.target.value as any || undefined })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-brand-blue transition-colors"
              >
                <option value="">All types</option>
                {reportTypes.map(type => (
                  <option key={type} value={type}>
                    {REPORT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Status
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange({ status: e.target.value as any || undefined })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-brand-blue transition-colors"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          
          {/* Source */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Source
            </label>
            <select
              value={filters.source || ''}
              onChange={(e) => handleFilterChange({ source: e.target.value as any || undefined })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-brand-blue transition-colors"
            >
              <option value="">All sources</option>
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="json">JSON</option>
              <option value="xero">Xero</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          
          {/* Date Range */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Imported Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
                onChange={(e) => handleFilterChange({ 
                  dateFrom: e.target.value ? new Date(e.target.value) : undefined 
                })}
                className="w-full min-w-[140px] px-3 py-2 pr-10 bg-slate-800 border border-slate-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent hover:bg-slate-700 hover:border-slate-500 transition-colors"
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}