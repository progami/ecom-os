'use client'

import { useState, ReactNode } from 'react'
import { ChevronUp, ChevronDown, ArrowUpDown } from '@/lib/lucide-icons'

export interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (value: unknown, row: T) => ReactNode
  className?: string
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  emptyMessage?: string
  rowKey?: keyof T | ((row: T) => string)
  onRowClick?: (row: T) => void
  expandable?: {
    isExpanded: (row: T) => boolean
    onToggle: (row: T) => void
    renderExpanded: (row: T) => ReactNode
  }
  className?: string
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  rowKey,
  onRowClick,
  expandable,
  className = ''
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return

    const key = column.key as string
    if (sortColumn === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(key)
      setSortDirection('asc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0

    const aValue = getNestedValue(a, sortColumn)
    const bValue = getNestedValue(b, sortColumn)

    if (aValue === bValue) return 0
    
    const comparison = aValue > bValue ? 1 : -1
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const getRowKey = (row: T, index: number): string => {
    if (rowKey) {
      if (typeof rowKey === 'function') {
        return rowKey(row)
      }
      return String(row[rowKey])
    }
    return String(index)
  }

  const getNestedValue = (obj: unknown, path: string): unknown => {
    return path.split('.').reduce((current, key) => (current as Record<string, unknown>)?.[key], obj)
  }

  const getCellValue = (row: T, column: Column<T>): ReactNode => {
    const value = getNestedValue(row, column.key as string)
    
    if (column.render) {
      return column.render(value, row)
    }
    
    return (value ?? '-') as ReactNode
  }

  const SortIcon = ({ column }: { column: Column<T> }) => {
    if (!column.sortable) return null

    const key = column.key as string
    if (sortColumn !== key) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }

    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 text-blue-500" />
    ) : (
      <ChevronDown className="h-4 w-4 text-blue-500" />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key as string}
                onClick={() => handleSort(column)}
                className={`
                  px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
                  ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}
                  ${column.className || ''}
                `}
              >
                <div className="flex items-center gap-2">
                  {column.label}
                  <SortIcon column={column} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.map((row, rowIndex) => {
            const key = getRowKey(row, rowIndex)
            const isExpanded = expandable?.isExpanded(row) || false

            return (
              <>
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={`
                    ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                    ${isExpanded ? 'bg-gray-50' : ''}
                  `}
                >
                  {columns.map((column) => (
                    <td
                      key={`${key}-${column.key as string}`}
                      className={`px-6 py-4 whitespace-nowrap text-sm ${column.className || ''}`}
                    >
                      {getCellValue(row, column)}
                    </td>
                  ))}
                </tr>
                {isExpanded && expandable && (
                  <tr key={`${key}-expanded`}>
                    <td colSpan={columns.length} className="px-6 py-4 bg-gray-50">
                      {expandable.renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
