'use client'

/**
 * DataTable Component with Bulk Actions
 * A flexible table component with multi-select, sorting, and bulk operations
 */

import { useState, useEffect, ReactNode } from 'react'
import { Check, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { table as tableTypography, badge } from '@/lib/typography'

// Types
export interface Column<T> {
  key: keyof T | string
  header: string
  accessor?: string | ((row: T) => ReactNode)
  cell?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
  align?: 'left' | 'right' | 'center'
}

export interface BulkAction {
  label: string
  icon?: ReactNode
  action: (selectedItems: string[]) => void | Promise<void>
  variant?: 'default' | 'danger'
  confirmMessage?: string
}

interface DataTableProps<T extends Record<string, any>> {
  data: T[]
  columns: Column<T>[]
  bulkActions?: BulkAction[]
  onRowClick?: (row: T) => void
  isLoading?: boolean
  emptyMessage?: string
  keyboardShortcuts?: boolean
  stickyHeader?: boolean
  className?: string
  rowKey?: keyof T | string
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  bulkActions = [],
  onRowClick,
  isLoading = false,
  emptyMessage = 'No data found',
  keyboardShortcuts = true,
  stickyHeader = true,
  className,
  rowKey = 'id'
}: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [showBulkMenu, setShowBulkMenu] = useState(false)

  // Keyboard shortcuts
  useEffect(() => {
    if (!keyboardShortcuts) return

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        if (selectedRows.size === data.length) {
          setSelectedRows(new Set())
        } else {
          setSelectedRows(new Set(data.map(row => (row as any)[rowKey])))
        }
      }
      
      // Escape to clear selection
      if (e.key === 'Escape') {
        setSelectedRows(new Set())
        setShowBulkMenu(false)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [data, selectedRows, keyboardShortcuts, rowKey])

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig) return 0

    const aValue = sortConfig.key.includes('.') 
      ? sortConfig.key.split('.').reduce((obj: any, key: string) => obj?.[key], a)
      : (a as any)[sortConfig.key]
    
    const bValue = sortConfig.key.includes('.')
      ? sortConfig.key.split('.').reduce((obj: any, key: string) => obj?.[key], b)
      : (b as any)[sortConfig.key]

    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  // Handlers
  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' }
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' }
      }
      return null
    })
  }

  const handleSelectAll = () => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(data.map(row => (row as any)[rowKey])))
    }
  }

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRows(newSelected)
  }

  const handleBulkAction = async (action: BulkAction) => {
    if (action.confirmMessage && !confirm(action.confirmMessage)) {
      return
    }

    const selectedIds = Array.from(selectedRows)
    await action.action(selectedIds)
    setSelectedRows(new Set())
    setShowBulkMenu(false)
  }

  const getCellValue = (row: T, column: Column<T>) => {
    // If there's a custom cell renderer, use it
    if (column.cell) {
      return column.cell(row)
    }
    
    // If accessor is a function, use it
    if (column.accessor && typeof column.accessor === 'function') {
      return column.accessor(row)
    }
    
    // Otherwise, get the value from the row using the key
    let value;
    const key = column.accessor || column.key;
    if (typeof key === 'string' && key.includes('.')) {
      value = key.split('.').reduce((obj: any, key) => obj?.[key], row)
    } else {
      value = (row as any)[key]
    }
    
    // Handle object values by converting to string
    if (value && typeof value === 'object') {
      // If it's an array, join the values
      if (Array.isArray(value)) {
        return value.join(', ')
      }
      // If it's an object with a name property, return the name
      if ('name' in value) {
        return value.name
      }
      // Otherwise, stringify it
      return JSON.stringify(value)
    }
    
    return value
  }

  if (isLoading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50">
          <div className="h-12 bg-slate-800/50 rounded-t-xl" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-t border-slate-700/50" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && bulkActions.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white">
              {selectedRows.size} item{selectedRows.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear selection
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {bulkActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleBulkAction(action)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                  action.variant === 'danger'
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30'
                    : 'bg-slate-800/50 text-gray-300 hover:bg-slate-800/70 border border-slate-700'
                )}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-full inline-block align-middle">
            <div className="overflow-hidden">
              <table className="min-w-full">
                <thead className={cn(
                  'bg-slate-800/50 border-b border-slate-700/50',
                  stickyHeader && 'sticky top-0 z-10'
                )}>
                  <tr>
                    {bulkActions.length > 0 && (
                      <th className="sticky left-0 z-20 bg-slate-800/50 w-12 px-2 sm:px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === data.length && data.length > 0}
                          onChange={handleSelectAll}
                          className="w-5 h-5 sm:w-4 sm:h-4 bg-slate-700 border-slate-600 rounded text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = selectedRows.size > 0 && selectedRows.size < data.length
                            }
                          }}
                        />
                      </th>
                    )}
                {columns.map((column) => (
                  <th
                    key={`header-${column.key}`}
                    className={cn(
                      'px-2 sm:px-4 py-3 text-left',
                      tableTypography.header,
                      column.sortable && 'cursor-pointer hover:bg-slate-700/30 transition-colors',
                      column.className,
                      columns.indexOf(column) === 0 && bulkActions.length > 0 && 'pl-0 sm:pl-4',
                      'text-xs sm:text-sm whitespace-nowrap'
                    )}
                    onClick={() => column.sortable && handleSort(column.key as string)}
                  >
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="truncate">{column.header}</span>
                      {column.sortable && sortConfig && sortConfig.key === column.key && (
                        sortConfig.direction === 'asc' 
                          ? <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td 
                    colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0)}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedData.map((row, rowIndex) => (
                  <tr
                    key={(row as any)[rowKey]}
                    className={cn(
                      'border-t border-slate-700/50 transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-slate-800/30',
                      selectedRows.has((row as any)[rowKey]) && 'bg-blue-600/5'
                    )}
                    onClick={(e) => {
                      if (onRowClick && !(e.target as HTMLElement).closest('input')) {
                        onRowClick(row)
                      }
                    }}
                  >
                    {bulkActions.length > 0 && (
                      <td className="sticky left-0 z-10 bg-slate-800/30 w-12 px-2 sm:px-4 py-3 sm:py-4">
                        <input
                          type="checkbox"
                          checked={selectedRows.has((row as any)[rowKey])}
                          onChange={() => handleSelectRow((row as any)[rowKey])}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 sm:w-4 sm:h-4 bg-slate-700 border-slate-600 rounded text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={`cell-${(row as any)[rowKey]}-${column.key}`}
                        className={cn(
                          'px-2 sm:px-4 py-3 sm:py-4',
                          columns.indexOf(column) === 0 ? tableTypography.cellImportant : tableTypography.cell,
                          column.className,
                          columns.indexOf(column) === 0 && bulkActions.length > 0 && 'pl-0 sm:pl-4',
                          'text-xs sm:text-sm',
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center'
                        )}
                      >
                        <div className={cn(
                          "truncate max-w-[150px] sm:max-w-none",
                          column.align === 'right' && 'ml-auto',
                          column.align === 'center' && 'mx-auto'
                        )}>
                          {getCellValue(row, column)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      {keyboardShortcuts && selectedRows.size > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className={badge.small}>⌘A</span>
          <span>Select all</span>
          <span className={badge.small}>ESC</span>
          <span>Clear selection</span>
        </div>
      )}
    </div>
  )
}