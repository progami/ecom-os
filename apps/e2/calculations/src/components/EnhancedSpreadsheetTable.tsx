import React, { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { tableStyles } from '@/styles/table-styles'

export interface Column {
  key: string
  header: string
  type?: 'text' | 'currency' | 'percent' | 'number'
  editable?: boolean
  width?: number
  className?: string | ((value: any) => string)
  align?: 'left' | 'center' | 'right'
  frozen?: boolean
}

export interface EnhancedSpreadsheetTableProps {
  columns: Column[]
  data: any[]
  className?: string
  onCellChange?: (rowIndex: number, columnKey: string, value: any) => void
  onDataChange?: (newData: any[]) => void
  rows?: Array<{
    key: string
    label: string
    subLabel?: string
    className?: string
  }>
  validateCell?: (rowKey: string, columnKey: string, value: any) => boolean | string
  getCellClassName?: (rowKey: string, columnKey: string) => string
  enableKeyboardNavigation?: boolean
  enableCopyPaste?: boolean
  showRowNumbers?: boolean
  highlightSelectedCell?: boolean
}

// Format value based on type
const formatValue = (value: any, type?: string): string => {
  if (value === null || value === undefined || value === '') return ''
  
  switch (type) {
    case 'currency':
      return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
  // For empty values, return appropriate type
  if (!value || value === '') {
    switch (type) {
      case 'currency':
      case 'percent':
      case 'number':
        return 0 // Return 0 for numeric types
      default:
        return '' // Return empty string for text
    }
  }
  
  switch (type) {
    case 'currency':
      const currencyVal = parseFloat(value.replace(/[$,]/g, ''))
      return isNaN(currencyVal) ? 0 : currencyVal
    case 'percent':
      const percentVal = parseFloat(value.replace(/%/g, ''))
      return isNaN(percentVal) ? 0 : percentVal
    case 'number':
      const numberVal = parseFloat(value.replace(/,/g, ''))
      return isNaN(numberVal) ? 0 : numberVal
    default:
      return value
  }
}

export const EnhancedSpreadsheetTable: React.FC<EnhancedSpreadsheetTableProps> = ({
  columns,
  data,
  className,
  onCellChange,
  onDataChange,
  rows,
  validateCell,
  getCellClassName,
  enableKeyboardNavigation = true,
  enableCopyPaste = true,
  showRowNumbers = false,
  highlightSelectedCell = true
}) => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  console.log('EnhancedSpreadsheetTable rendering, data length:', data.length, 'editingCell:', editingCell)
  const [tempValue, setTempValue] = useState('')
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: number } | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isStoppingEditRef = useRef(false)

  // Get the actual column index for navigation (skipping non-editable columns)
  const getEditableColumnIndices = useCallback(() => {
    return columns
      .map((col, idx) => ({ col, idx }))
      .filter(({ col }) => col.editable !== false)
      .map(({ idx }) => idx)
  }, [columns])

  // Navigate to a cell
  const navigateToCell = useCallback((row: number, col: number) => {
    const maxRow = data.length - 1
    const maxCol = columns.length - 1
    
    // Clamp values
    const newRow = Math.max(0, Math.min(row, maxRow))
    const newCol = Math.max(0, Math.min(col, maxCol))
    
    setSelectedCell({ row: newRow, col: newCol })
    
    // Focus the cell
    const cellElement = tableRef.current?.querySelector(
      `[data-row="${newRow}"][data-col="${newCol}"]`
    ) as HTMLElement
    cellElement?.focus()
  }, [data.length, columns.length])

  // Start editing a cell
  const startEditing = useCallback((row: number, col: number) => {
    console.log('startEditing called:', { row, col, caller: new Error().stack?.split('\n')[2] })
    const column = columns[col]
    if (!column?.editable) {
      console.log('Column not editable')
      return
    }
    
    const rowData = data[row]
    const rowKey = rows?.[row]?.key || String(row)
    
    // Validate if cell can be edited
    if (validateCell) {
      const validation = validateCell(rowKey, column.key, rowData[column.key])
      if (validation !== true) {
        console.log('Validation failed')
        return
      }
    }
    
    const value = rowData[column.key]
    console.log('Setting editing cell with value:', value)
    setEditingCell({ row, col })
    setTempValue(value?.toString() || '')
    
    // Focus input after render
    setTimeout(() => {
      console.log('Attempting to focus input, exists:', !!inputRef.current);
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0)
  }, [columns, data, rows, validateCell])

  // Stop editing and save
  const stopEditing = useCallback((save: boolean = true) => {
    console.log('stopEditing called, save:', save, 'editingCell:', editingCell)
    if (!editingCell || isStoppingEditRef.current) return
    
    isStoppingEditRef.current = true
    
    if (save) {
      const column = columns[editingCell.col]
      const currentValue = data[editingCell.row][column.key]
      const parsedValue = parseValue(tempValue, column.type)
      
      console.log('stopEditing - column:', column.key, 'currentValue:', currentValue, 'tempValue:', tempValue, 'parsedValue:', parsedValue, 'tempValue type:', typeof tempValue)
      
      // Only proceed if value actually changed
      if (parsedValue !== currentValue && !(parsedValue === '' && (currentValue === 0 || currentValue === null || currentValue === undefined))) {
        console.log('Value changed, calling onCellChange')
        const rowKey = rows?.[editingCell.row]?.key || String(editingCell.row)
        
        // Validate new value
        if (validateCell) {
          const validation = validateCell(rowKey, column.key, parsedValue)
          if (validation !== true) {
            console.log('Validation failed')
            setEditingCell(null)
            setTempValue('')
            return
          }
        }
        
        // Update data
        if (onCellChange) {
          console.log('Calling onCellChange from stopEditing with:', editingCell.row, column.key, parsedValue)
          onCellChange(editingCell.row, column.key, parsedValue)
        } else if (onDataChange) {
          const newData = [...data]
          newData[editingCell.row] = {
            ...newData[editingCell.row],
            [column.key]: parsedValue
          }
          onDataChange(newData)
        }
      } else {
        console.log('Value unchanged, not calling onCellChange')
      }
    }
    
    setEditingCell(null)
    setTempValue('')
    
    // Reset the flag after a short delay
    setTimeout(() => {
      isStoppingEditRef.current = false
    }, 100)
  }, [editingCell, tempValue, columns, data, rows, validateCell, onCellChange, onDataChange])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (!enableKeyboardNavigation || !selectedCell) return
    
    const { row, col } = selectedCell
    const isEditing = editingCell !== null
    
    // If editing, only handle Enter, Escape, and Tab
    if (isEditing) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          stopEditing(true)
          navigateToCell(row + 1, col)
          break
        case 'Escape':
          e.preventDefault()
          stopEditing(false)
          break
        case 'Tab':
          e.preventDefault()
          stopEditing(true)
          if (e.shiftKey) {
            navigateToCell(row, col - 1)
          } else {
            navigateToCell(row, col + 1)
          }
          break
      }
      return
    }
    
    // Not editing - handle navigation
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        navigateToCell(row - 1, col)
        break
      case 'ArrowDown':
        e.preventDefault()
        navigateToCell(row + 1, col)
        break
      case 'ArrowLeft':
        e.preventDefault()
        navigateToCell(row, col - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        navigateToCell(row, col + 1)
        break
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          navigateToCell(row, col - 1)
        } else {
          navigateToCell(row, col + 1)
        }
        break
      case 'Enter':
      case 'F2':
        e.preventDefault()
        startEditing(row, col)
        break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        const column = columns[col]
        if (column?.editable) {
          startEditing(row, col)
          setTempValue('')
        }
        break
      case 'Home':
        e.preventDefault()
        if (e.ctrlKey) {
          navigateToCell(0, 0)
        } else {
          navigateToCell(row, 0)
        }
        break
      case 'End':
        e.preventDefault()
        if (e.ctrlKey) {
          navigateToCell(data.length - 1, columns.length - 1)
        } else {
          navigateToCell(row, columns.length - 1)
        }
        break
      case 'PageUp':
        e.preventDefault()
        navigateToCell(Math.max(0, row - 10), col)
        break
      case 'PageDown':
        e.preventDefault()
        navigateToCell(Math.min(data.length - 1, row + 10), col)
        break
      default:
        // Start typing in cell
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const column = columns[col]
          if (column?.editable) {
            startEditing(row, col)
            setTempValue(e.key)
          }
        }
    }
  }, [selectedCell, editingCell, enableKeyboardNavigation, navigateToCell, startEditing, stopEditing, columns, data.length])

  // Handle copy/paste
  const handleCopy = useCallback((e: ClipboardEvent) => {
    if (!enableCopyPaste || !selectedCell) return
    
    const { row, col } = selectedCell
    const column = columns[col]
    const value = data[row][column.key]
    const formattedValue = formatValue(value, column.type)
    
    e.clipboardData?.setData('text/plain', formattedValue)
    e.preventDefault()
  }, [enableCopyPaste, selectedCell, columns, data])

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!enableCopyPaste || !selectedCell) return
    
    const { row, col } = selectedCell
    const column = columns[col]
    if (!column?.editable) return
    
    const pastedValue = e.clipboardData?.getData('text/plain') || ''
    const parsedValue = parseValue(pastedValue, column.type)
    
    if (onCellChange) {
      onCellChange(row, column.key, parsedValue)
    }
    
    e.preventDefault()
  }, [enableCopyPaste, selectedCell, columns, onCellChange])

  // Add event listeners
  useEffect(() => {
    const table = tableRef.current
    if (!table) return
    
    const handleTableKeyDown = (e: any) => handleKeyDown(e)
    table.addEventListener('keydown', handleTableKeyDown)
    
    if (enableCopyPaste) {
      document.addEventListener('copy', handleCopy)
      document.addEventListener('paste', handlePaste)
    }
    
    return () => {
      table.removeEventListener('keydown', handleTableKeyDown)
      if (enableCopyPaste) {
        document.removeEventListener('copy', handleCopy)
        document.removeEventListener('paste', handlePaste)
      }
    }
  }, [handleKeyDown, handleCopy, handlePaste, enableCopyPaste])

  // Click handler for cells
  const handleCellClick = useCallback((row: number, col: number) => {
    console.log('handleCellClick:', { row, col, isEditable: columns[col]?.editable })
    setSelectedCell({ row, col })
    if (columns[col]?.editable) {
      startEditing(row, col)
    }
  }, [columns, startEditing])

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No columns provided</div>
  }
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No data to display</div>
  }

  return (
    <div className={cn(tableStyles.wrapper, className)}>
      <table ref={tableRef} className={tableStyles.table} tabIndex={editingCell ? -1 : 0}>
        <thead>
          <tr className={tableStyles.headerRow}>
            {showRowNumbers && (
              <th className={cn(tableStyles.headerCell, "sticky left-0 z-20 text-center")}>
                #
              </th>
            )}
            {rows && (
              <th className={cn(tableStyles.headerCell, "sticky left-0 z-20")}>
                Week
              </th>
            )}
            {columns.map((column, colIndex) => (
              <th
                key={column.key}
                className={cn(
                  tableStyles.headerCell,
                  column.frozen && "sticky left-0 z-10",
                  column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left',
                  column.className
                )}
                style={{ width: column.width ? `${column.width}px` : 'auto' }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const rowInfo = rows?.[rowIndex]
            const rowKey = rowInfo?.key || String(rowIndex)
            
            return (
              <tr key={rowKey} className={cn(tableStyles.bodyRow, rowInfo?.className)}>
                {showRowNumbers && (
                  <td className={cn(tableStyles.bodyCell, tableStyles.cellTypes.calculated, "sticky left-0 z-10 text-center")}>
                    {rowIndex + 1}
                  </td>
                )}
                {rowInfo && (
                  <td className={cn(tableStyles.bodyCell, tableStyles.cellTypes.calculated, "sticky left-0 z-10")}>
                    <div className="font-medium">{rowInfo.label}</div>
                    {rowInfo.subLabel && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{rowInfo.subLabel}</div>
                    )}
                  </td>
                )}
                {columns.map((column, colIndex) => {
                  const value = row[column.key]
                  const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex
                  const cellClassName = getCellClassName ? getCellClassName(rowKey, column.key) : ''
                  
                  return (
                    <td
                      key={column.key}
                      data-row={rowIndex}
                      data-col={colIndex}
                      tabIndex={-1}
                      className={cn(
                        tableStyles.bodyCell,
                        "focus:outline-none transition-colors",
                        column.editable !== false && tableStyles.cellTypes.editable,
                        isSelected && "ring-2 ring-blue-500 ring-inset",
                        isEditing && tableStyles.cellTypes.editableActive,
                        column.frozen && "sticky left-0",
                        column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left',
                        typeof column.className === 'function' ? column.className(value) : column.className,
                        cellClassName,
                        rowInfo?.className?.includes('total') && tableStyles.cellTypes.summary,
                        (column.key === 'totalUnits' || column.key === 'revenue') && tableStyles.cellTypes.summary
                      )}
                      onClick={() => {
                        if (!isEditing) {
                          handleCellClick(rowIndex, colIndex)
                        }
                      }}
                    >
                      {isEditing ? (
                        <Input
                          ref={inputRef}
                          value={tempValue}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            console.log('Input onChange fired, new value:', e.target.value);
                            setTempValue(e.target.value);
                          }}
                          onBlur={(e) => {
                            console.log('Input blur event triggered, activeElement:', document.activeElement?.tagName)
                            // Don't trigger blur if we're already stopping edit
                            if (!isStoppingEditRef.current) {
                              // Add a small delay to see what's stealing focus
                              setTimeout(() => {
                                console.log('After blur, new activeElement:', document.activeElement?.tagName)
                                stopEditing(true)
                              }, 100)
                            }
                          }}
                          onKeyDown={(e) => {
                            console.log('Input onKeyDown:', e.key);
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              e.stopPropagation()
                              handleKeyDown(e as any)
                            }
                          }}
                          className={tableStyles.input}
                        />
                      ) : (
                        <div className="truncate">
                          {formatValue(value, column.type)}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}