import React, { useState, useCallback, memo } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { tableStyles } from '@/styles/table-styles'

export interface Column {
  key: string
  header: string
  type?: 'text' | 'currency' | 'percent' | 'number'
  editable?: boolean
  width?: number
  className?: string | ((value: any) => string)
  onChange?: (rowKey: string, value: any) => void
}

export interface SpreadsheetTableProps {
  columns: Column[]
  data: any[]
  className?: string
  onDataChange?: (newData: any[]) => void
}

// Format value based on type
const formatValue = (value: any, type?: string): string => {
  if (value === null || value === undefined) return '-'
  
  switch (type) {
    case 'currency':
      return `$${Number(value).toFixed(2)}`
    case 'percent':
      return `${Number(value).toFixed(1)}%`
    case 'number':
      return Number(value).toLocaleString()
    default:
      return String(value)
  }
}

// Parse value based on type
const parseValue = (value: string, type?: string): any => {
  if (!value || value === '-') return 0
  
  switch (type) {
    case 'currency':
      return parseFloat(value.replace(/[$,]/g, '')) || 0
    case 'percent':
      return parseFloat(value.replace(/%/g, '')) || 0
    case 'number':
      return parseFloat(value.replace(/,/g, '')) || 0
    default:
      return value
  }
}

// Memoized cell component
const TableCell = memo<{
  rowData: any
  column: Column
  isEditing: boolean
  tempValue: string
  onEdit: () => void
  onTempValueChange: (value: string) => void
  onUpdate: () => void
  onCancel: () => void
}>(function TableCell({
  rowData,
  column,
  isEditing,
  tempValue,
  onEdit,
  onTempValueChange,
  onUpdate,
  onCancel
}) {
  const value = rowData[column.key]
  const displayValue = formatValue(value, column.type)
  
  const cellClassName = typeof column.className === 'function' 
    ? column.className(value) 
    : column.className

  if (isEditing) {
    return (
      <td className={cn(tableStyles.bodyCell, tableStyles.cellTypes.editableActive, cellClassName)}>
        <Input
          value={tempValue}
          onChange={(e) => onTempValueChange(e.target.value)}
          onBlur={onUpdate}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onUpdate()
            }
            if (e.key === 'Escape') {
              onCancel()
            }
          }}
          className={tableStyles.input}
          autoFocus
        />
      </td>
    )
  }

  return (
    <td 
      className={cn(
        tableStyles.bodyCell,
        column.editable && tableStyles.cellTypes.editable,
        cellClassName
      )}
      onClick={column.editable ? onEdit : undefined}
    >
      <div className={column.type === 'text' ? 'text-left' : 'text-right'}>
        {displayValue}
      </div>
    </td>
  )
})

export const SpreadsheetTable = memo(function SpreadsheetTable({
  columns,
  data,
  className,
  onDataChange
}: SpreadsheetTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const [tempValue, setTempValue] = useState('')

  const handleCellEdit = useCallback((rowIndex: number, colKey: string) => {
    const column = columns.find(c => c.key === colKey)
    if (!column?.editable) return
    
    const value = data[rowIndex][colKey]
    setEditingCell({ row: rowIndex, col: colKey })
    setTempValue(formatValue(value, column.type).replace(/[$,%]/g, ''))
  }, [columns, data])

  const handleCellUpdate = useCallback(() => {
    if (!editingCell) return
    
    const column = columns.find(c => c.key === editingCell.col)
    if (!column) return
    
    const parsedValue = parseValue(tempValue, column.type)
    
    // Create a new copy of the data array
    const newData = [...data]
    newData[editingCell.row] = {
      ...newData[editingCell.row],
      [editingCell.col]: parsedValue
    }
    
    // Call the onDataChange callback if provided
    if (onDataChange) {
      onDataChange(newData)
    } else if (column.onChange) {
      // Fallback to column-specific onChange for backward compatibility
      const rowKey = data[editingCell.row].sku || data[editingCell.row].key || String(editingCell.row)
      column.onChange(rowKey, parsedValue)
    }
    
    setEditingCell(null)
    setTempValue('')
  }, [editingCell, tempValue, columns, data, onDataChange])

  const handleCellCancel = useCallback(() => {
    setEditingCell(null)
    setTempValue('')
  }, [])

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return (
      <div className={tableStyles.emptyState}>
        Error: No columns provided to SpreadsheetTable
      </div>
    )
  }
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className={tableStyles.emptyState}>
        No data to display
      </div>
    )
  }

  return (
    <div className={cn(tableStyles.wrapper, className)}>
      <table className={tableStyles.table}>
        <thead>
          <tr className={tableStyles.headerRow}>
            {columns.map((column) => (
              <th 
                key={column.key}
                className={cn(tableStyles.headerCell, "sticky top-0 z-10")}
                style={{ width: column.width ? `${column.width}px` : 'auto' }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={row.sku || row.key || rowIndex} className={tableStyles.bodyRow}>
              {columns.map((column) => {
                const isEditing = editingCell?.row === rowIndex && editingCell?.col === column.key
                
                return (
                  <TableCell
                    key={column.key}
                    rowData={row}
                    column={column}
                    isEditing={isEditing}
                    tempValue={tempValue}
                    onEdit={() => handleCellEdit(rowIndex, column.key)}
                    onTempValueChange={setTempValue}
                    onUpdate={handleCellUpdate}
                    onCancel={handleCellCancel}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})