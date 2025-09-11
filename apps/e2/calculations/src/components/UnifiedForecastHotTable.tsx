import React, { useRef, useCallback, useState, useEffect } from 'react'
import { HotTable } from '@handsontable/react'
import { registerAllModules } from 'handsontable/registry'
// Handsontable base styles
import 'handsontable/dist/handsontable.full.min.css'
// Better styling without breaking functionality
import '../styles/handsontable-better.css'

// Register all modules including sorting
registerAllModules()

interface UnifiedForecastHotTableProps {
  weeks: Array<{
    weekNum: number
    weekLabel: string
    dateRange: string
    isCurrentWeek: boolean
    isPastWeek: boolean
  }>
  rows: Array<{
    id: string
    name: string
    subtext?: string // For price in sales or account code in expenses
  }>
  dataByWeek: Record<string, Record<string, number>> // weekNum -> rowId -> value
  onBatchSave?: (changes: Array<{ week: number; rowId: string; value: number }>) => Promise<void>
  onCellChange?: (changes: Array<{ week: number; rowId: string; value: number }>) => void // For batch mode
  reconciliationDate?: Date | null
  className?: string
  type: 'sales' | 'expense' | 'revenue' | 'stock'
  rowTotals?: Record<string, { units?: number; revenue?: number }> // For sales
  readOnly?: boolean // Make entire table read-only
  immediateMode?: boolean // If true, calls onBatchSave immediately (default: true for backward compatibility)
  editableRows?: string[] // Array of row IDs that should be editable even when readOnly is false
}

export function UnifiedForecastHotTable({
  weeks,
  rows,
  dataByWeek,
  onBatchSave,
  onCellChange,
  reconciliationDate,
  className,
  type,
  rowTotals = {},
  readOnly = false,
  immediateMode = true, // Default to immediate mode for backward compatibility
  editableRows = []
}: UnifiedForecastHotTableProps) {
  const hotTableRef = useRef<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [tableData, setTableData] = useState<any[]>([])
  const initialDataLoaded = useRef(false)

  // Load data when props change - transposed structure
  useEffect(() => {
    // Always reload data when props change
    
    // Create rows for each item
    const dataRows = rows.map(row => {
      const rowData: any = {
        rowName: row.name,
        rowId: row.id,
        subtext: row.subtext
      }
      
      // Add data for each week
      let totalValue = 0
      let totalRevenue = 0
      weeks.forEach(week => {
        const value = dataByWeek[week.weekNum]?.[row.id] || 0
        rowData[`W${week.weekNum}`] = value
        totalValue += value
        
        if ((type === 'sales' || type === 'orders') && row.subtext) {
          // For sales, calculate revenue - remove $ sign if present
          const priceStr = String(row.subtext).replace(/^\$/, '')
          const price = parseFloat(priceStr) || 0
          const revenue = price * value
          totalRevenue += revenue
        }
      })
      
      if (type === 'sales') {
        rowData.totalUnits = totalValue
        rowData.totalRevenue = totalRevenue
      } else if (type === 'orders') {
        rowData.totalUnits = totalValue
        // No revenue for orders
      } else if (type === 'revenue') {
        rowData.totalUnits = totalValue
        rowData.totalRevenue = totalValue // For revenue, the value IS the revenue
      } else if (type === 'stock') {
        // Calculate average weeks of stock
        let validWeeks = 0
        let totalStock = 0
        weeks.forEach(week => {
          const value = dataByWeek[week.weekNum]?.[row.id]
          if (value !== undefined && value > 0) {
            validWeeks++
            totalStock += value
          }
        })
        rowData.average = validWeeks > 0 ? totalStock / validWeeks : 0
      } else {
        rowData.total = totalValue
      }
      
      return rowData
    })
    
    // Create total row first
    const totalRow: any = {
      rowName: 'TOTAL',
      rowId: 'total',
      subtext: ''
    }
    
    let grandTotal = 0
    let grandTotalRevenue = 0
    let grandTotalExpense = 0
    weeks.forEach(week => {
      const weekTotal = rows.reduce((sum, row) => {
        const value = dataByWeek[week.weekNum]?.[row.id] || 0
        return sum + value
      }, 0)
      totalRow[`W${week.weekNum}`] = weekTotal
      grandTotal += weekTotal
      
      if (type === 'sales') {
        // For sales table, calculate revenue from units * price
        const weekRevenue = rows.reduce((sum, row) => {
          const units = dataByWeek[week.weekNum]?.[row.id] || 0
          const priceStr = String(row.subtext || '0').replace(/^\$/, '')
          const price = parseFloat(priceStr) || 0
          const revenue = price * units
          return sum + revenue
        }, 0)
        grandTotalRevenue += weekRevenue
      } else if (type === 'orders') {
        // For orders table, no revenue calculation needed
      } else if (type === 'revenue') {
        // For revenue table, data is already in dollars
        const weekRevenue = rows.reduce((sum, row) => {
          return sum + (dataByWeek[week.weekNum]?.[row.id] || 0)
        }, 0)
        grandTotalRevenue += weekRevenue
      } else {
        // For expenses, sum up the costs
        const weekExpense = rows.reduce((sum, row) => {
          return sum + (dataByWeek[week.weekNum]?.[row.id] || 0)
        }, 0)
        grandTotalExpense += weekExpense
      }
    })
    
    if (type === 'sales' || type === 'revenue' || type === 'orders') {
      totalRow.totalUnits = grandTotal
      if (type !== 'orders') {
        totalRow.totalRevenue = grandTotalRevenue
      }
      totalRow.percentage = 100 // Total is always 100%
    } else if (type === 'stock') {
      // Calculate average for total row
      let totalValidCells = 0
      let totalStockSum = 0
      weeks.forEach(week => {
        rows.forEach(row => {
          const value = dataByWeek[week.weekNum]?.[row.id]
          if (value !== undefined && value > 0) {
            totalValidCells++
            totalStockSum += value
          }
        })
      })
      totalRow.average = totalValidCells > 0 ? totalStockSum / totalValidCells : 0
    } else {
      totalRow.total = grandTotalExpense
      totalRow.percentage = 100 // Total is always 100%
    }
    
    // Calculate percentages for each row
    dataRows.forEach(row => {
      if (type === 'sales') {
        row.percentage = grandTotal > 0 ? (row.totalUnits / grandTotal * 100) : 0
      } else if (type === 'revenue') {
        row.percentage = grandTotalRevenue > 0 ? (row.totalRevenue / grandTotalRevenue * 100) : 0
      } else if (type === 'orders') {
        row.percentage = grandTotal > 0 ? (row.totalUnits / grandTotal * 100) : 0
      } else {
        row.percentage = grandTotalExpense > 0 ? (row.total / grandTotalExpense * 100) : 0
      }
    })
    
    // Add total row at the beginning instead of end
    dataRows.unshift(totalRow)
    setTableData(dataRows)
  }, [rows, dataByWeek, weeks, type]) // Re-run when data changes
  
  // Column configuration
  const columns: any[] = [
    {
      data: 'rowName',
      title: (type === 'sales' || type === 'revenue' || type === 'orders' || type === 'stock') ? 'SKU' : 'Expense Category',
      type: 'text',
      width: (type === 'sales' || type === 'revenue' || type === 'orders') ? 100 : 110, // Compact width for fitting full table
      readOnly: true,
      className: 'htLeft htMiddle font-medium',
      columnSorting: { indicator: false }, // Disable sorting for this column
      renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
        const rowData = instance.getSourceDataAtRow(row)
        if (value === 'TOTAL') {
          td.innerHTML = `<strong>${value}</strong>`
          td.className = 'htLeft htMiddle font-bold bg-gray-100 dark:bg-gray-800'
        } else {
          // Display with subtext if available
          const subtext = rowData?.subtext
          if (subtext) {
            if (type === 'sales' || type === 'revenue' || type === 'stock' || type === 'orders') {
              // Show price for sales, revenue, and stock (weeks of stock)
              // Check if subtext already has $ sign to avoid duplication
              const formattedSubtext = subtext.toString().startsWith('$') ? subtext : `$${subtext}`
              td.innerHTML = `${value}<br/><span style="font-size: 10px; color: #6b7280;">${formattedSubtext}</span>`
            } else {
              // Show account name with code below for expenses (standardized format)
              td.innerHTML = `${value}<br/><span style="font-size: 10px; color: #6b7280;">${subtext}</span>`
            }
          } else {
            td.innerHTML = value
          }
          td.className = 'htLeft htMiddle'
        }
        return td
      }
    },
    ...weeks.map(week => {
      // Check if week is locked by reconciliation
      const isLocked = reconciliationDate && new Date(week.dateRange.split(' - ')[1] + ', ' + new Date().getFullYear()) <= new Date(reconciliationDate)
      
      // Extract just the start date from the date range
      const startDate = week.dateRange.split(' - ')[0]
      
      return {
        data: `W${week.weekNum}`,
        title: `${week.weekLabel}\n${startDate}`,
        type: 'numeric',
        numericFormat: {
          pattern: type === 'stock' ? '0.0' : (type === 'expense' || type === 'revenue') ? '$0,0.00' : '0,0'
        },
        width: (type === 'sales' || type === 'revenue' || type === 'orders') ? 70 : 65, // Compact width for week columns
        className: week.isCurrentWeek 
          ? 'htRight htMiddle bg-blue-50 dark:bg-blue-900/20' 
          : week.isPastWeek 
          ? 'htRight htMiddle text-gray-500' 
          : 'htRight htMiddle bg-green-50 dark:bg-green-900/20',
        readOnly: isLocked,
        columnSorting: { indicator: false }, // Disable sorting for week columns
        renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
          // Check if this is the total row
          const rowData = instance.getSourceDataAtRow(row)
          const isTotalRow = rowData?.rowId === 'total'
          
          // Format the value
          const hasValue = value && value > 0
          let formattedValue = ''
          
          if (type === 'expense' || type === 'revenue') {
            // Format as currency for expenses and revenue
            const formatter = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            })
            formattedValue = hasValue ? formatter.format(value) : ''
          } else if (type === 'stock') {
            // Format weeks of stock with 1 decimal place
            formattedValue = hasValue ? value.toFixed(1) : ''
          } else {
            // Format as number for sales (units)
            formattedValue = hasValue ? value.toLocaleString() : ''
          }
          
          if (isTotalRow) {
            td.innerHTML = `<strong>${formattedValue || ((type === 'expense' || type === 'revenue') ? '$0' : '0')}</strong>`
            td.className = 'htRight htMiddle font-bold bg-gray-100 dark:bg-gray-800'
          } else if (isLocked) {
            // Locked cells (reconciled)
            if (hasValue) {
              td.innerHTML = formattedValue
              td.className = 'htRight htMiddle locked-cell'
            } else {
              td.innerHTML = ''
              td.className = 'htRight htMiddle locked-cell'
            }
          } else if (week.isCurrentWeek) {
            if (hasValue) {
              // Apply color coding for weeks of stock in current week
              if (type === 'stock' && !isTotalRow) {
                const stockValue = parseFloat(value)
                
                td.innerHTML = `<strong>${formattedValue}</strong>`
                
                if (stockValue <= 4) {
                  td.className = 'htRight htMiddle stock-critical'
                } else if (stockValue <= 6) {
                  td.className = 'htRight htMiddle stock-warning'
                } else if (stockValue <= 8) {
                  td.className = 'htRight htMiddle stock-low'
                } else if (stockValue <= 10) {
                  td.className = 'htRight htMiddle stock-moderate'
                } else if (stockValue <= 12) {
                  td.className = 'htRight htMiddle stock-good'
                } else if (stockValue <= 14) {
                  td.className = 'htRight htMiddle stock-healthy'
                } else {
                  td.className = 'htRight htMiddle stock-excellent'
                }
              } else {
                td.innerHTML = `<strong>${formattedValue}</strong>`
                td.className = 'htRight htMiddle current-week-cell'
              }
            } else {
              td.innerHTML = ''
              td.className = 'htRight htMiddle current-week-cell'
            }
          } else if (week.isPastWeek) {
            if (hasValue) {
              // Apply color coding for weeks of stock in past weeks too
              if (type === 'stock' && !isTotalRow) {
                const stockValue = parseFloat(value)
                
                td.innerHTML = formattedValue
                
                if (stockValue <= 4) {
                  td.className = 'htRight htMiddle stock-critical'
                } else if (stockValue <= 6) {
                  td.className = 'htRight htMiddle stock-warning'
                } else if (stockValue <= 8) {
                  td.className = 'htRight htMiddle stock-low'
                } else if (stockValue <= 10) {
                  td.className = 'htRight htMiddle stock-moderate'
                } else if (stockValue <= 12) {
                  td.className = 'htRight htMiddle stock-good'
                } else if (stockValue <= 14) {
                  td.className = 'htRight htMiddle stock-healthy'
                } else {
                  td.className = 'htRight htMiddle stock-excellent'
                }
              } else {
                td.innerHTML = formattedValue
                td.className = 'htRight htMiddle past-week-cell'
              }
            } else {
              td.innerHTML = ''
              td.className = 'htRight htMiddle past-week-cell'
            }
          } else {
            // Future weeks
            if (hasValue) {
              // Special color coding for weeks of stock
              if (type === 'stock' && !isTotalRow) {
                const stockValue = parseFloat(value)
                
                td.innerHTML = formattedValue
                
                if (stockValue <= 4) {
                  td.className = 'htRight htMiddle stock-critical'
                } else if (stockValue <= 6) {
                  td.className = 'htRight htMiddle stock-warning'
                } else if (stockValue <= 8) {
                  td.className = 'htRight htMiddle stock-low'
                } else if (stockValue <= 10) {
                  td.className = 'htRight htMiddle stock-moderate'
                } else if (stockValue <= 12) {
                  td.className = 'htRight htMiddle stock-good'
                } else if (stockValue <= 14) {
                  td.className = 'htRight htMiddle stock-healthy'
                } else {
                  td.className = 'htRight htMiddle stock-excellent'
                }
              } else {
                td.innerHTML = formattedValue
                td.className = 'htRight htMiddle future-week-cell'
              }
            } else {
              td.innerHTML = ''
              td.className = 'htRight htMiddle future-week-cell'
            }
          }
          
          return td
        }
      }
    })
  ]
  
  // Add total columns based on type
  if (type === 'sales') {
    // Sales table shows units and percentage
    columns.push(
      {
        data: 'totalUnits',
        title: 'Total\nUnits',
        type: 'numeric',
        numericFormat: { pattern: '0,0' },
        width: 75,
        readOnly: true,
        className: 'htRight htMiddle bg-gray-50 dark:bg-gray-800',
        columnSorting: { indicator: false }, // Disable sorting for units column
        renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
          const rowData = instance.getSourceDataAtRow(row)
          const isTotalRow = rowData?.rowId === 'total'
          const formattedValue = value ? value.toLocaleString() : '0'
          
          if (isTotalRow) {
            td.innerHTML = `<strong>${formattedValue}</strong>`
            td.className = 'htRight htMiddle font-bold bg-gray-100 dark:bg-gray-800'
          } else {
            td.innerHTML = formattedValue
            td.className = 'htRight htMiddle bg-gray-50 dark:bg-gray-800'
          }
          return td
        }
      },
      {
        data: 'percentage',
        title: '%',
        type: 'numeric',
        numericFormat: { pattern: '0.0%' },
        width: 55,
        readOnly: true,
        className: 'htRight htMiddle bg-blue-50 dark:bg-blue-900',
        columnSorting: { indicator: false },
        renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
          const rowData = instance.getSourceDataAtRow(row)
          const isTotalRow = rowData?.rowId === 'total'
          const formattedValue = value ? `${value.toFixed(1)}%` : '0.0%'
          
          if (isTotalRow) {
            td.innerHTML = `<strong>${formattedValue}</strong>`
            td.className = 'htRight htMiddle font-bold bg-blue-100 dark:bg-blue-800'
          } else {
            td.innerHTML = formattedValue
            td.className = 'htRight htMiddle bg-blue-50 dark:bg-blue-900'
          }
          return td
        }
      }
    )
  } else if (type === 'orders') {
    // Orders table shows total purchase and percentage
    columns.push(
      {
        data: 'totalUnits',
        title: 'Total\nPurchase',
        type: 'numeric',
        numericFormat: { pattern: '0,0' },
        width: 85,
        readOnly: true,
        className: 'htRight htMiddle bg-gray-50 dark:bg-gray-800',
        columnSorting: { indicator: false },
        renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
          const rowData = instance.getSourceDataAtRow(row)
          const isTotalRow = rowData?.rowId === 'total'
          const formattedValue = value ? value.toLocaleString() : '0'
          
          if (isTotalRow) {
            td.innerHTML = `<strong>${formattedValue}</strong>`
            td.className = 'htRight htMiddle font-bold bg-gray-100 dark:bg-gray-800'
          } else {
            td.innerHTML = formattedValue
            td.className = 'htRight htMiddle bg-gray-50 dark:bg-gray-800'
          }
          return td
        }
      },
      {
        data: 'percentage',
        title: '%',
        type: 'numeric',
        numericFormat: { pattern: '0.0%' },
        width: 55,
        readOnly: true,
        className: 'htRight htMiddle bg-blue-50 dark:bg-blue-900',
        columnSorting: { indicator: false },
        renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
          const rowData = instance.getSourceDataAtRow(row)
          const isTotalRow = rowData?.rowId === 'total'
          const formattedValue = value ? `${value.toFixed(1)}%` : '0.0%'
          
          if (isTotalRow) {
            td.innerHTML = `<strong>${formattedValue}</strong>`
            td.className = 'htRight htMiddle font-bold bg-blue-100 dark:bg-blue-800'
          } else {
            td.innerHTML = formattedValue
            td.className = 'htRight htMiddle bg-blue-50 dark:bg-blue-900'
          }
          return td
        }
      }
    )
  } else if (type === 'revenue') {
    // Revenue table shows only revenue (no units)
    columns.push(
      {
        data: 'totalRevenue',
        title: 'Total\nRevenue',
        type: 'numeric',
        numericFormat: { pattern: '$0,0' },
        width: 85,
        readOnly: true,
        className: 'htRight htMiddle bg-gray-50 dark:bg-gray-800',
        // Enable sorting for Total Revenue column
        renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
          const rowData = instance.getSourceDataAtRow(row)
          const isTotalRow = rowData?.rowId === 'total'
          
          const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          })
          
          const formattedValue = value ? formatter.format(value) : '$0'
          
          if (isTotalRow) {
            td.innerHTML = `<strong>${formattedValue}</strong>`
            td.className = 'htRight htMiddle font-bold bg-gray-100 dark:bg-gray-800'
          } else {
            td.innerHTML = formattedValue
            td.className = 'htRight htMiddle bg-gray-50 dark:bg-gray-800'
          }
          return td
        }
      },
      {
        data: 'percentage',
        title: '%',
        type: 'numeric',
        numericFormat: { pattern: '0.0%' },
        width: 55,
        readOnly: true,
        className: 'htRight htMiddle bg-blue-50 dark:bg-blue-900',
        columnSorting: { indicator: false }, // Disable sorting for percentage column
        renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
          const rowData = instance.getSourceDataAtRow(row)
          const isTotalRow = rowData?.rowId === 'total'
          const formattedValue = value ? `${value.toFixed(1)}%` : '0.0%'
          
          if (isTotalRow) {
            td.innerHTML = `<strong>${formattedValue}</strong>`
            td.className = 'htRight htMiddle font-bold bg-blue-100 dark:bg-blue-800'
          } else {
            td.innerHTML = formattedValue
            td.className = 'htRight htMiddle bg-blue-50 dark:bg-blue-900'
          }
          return td
        }
      }
    )
  } else if (type === 'stock') {
    // Show average weeks of stock
    columns.push({
      data: 'average',
      title: 'Average',
      type: 'numeric',
      numericFormat: { pattern: '0.0' },
      width: 75,
      readOnly: true,
      className: 'htRight htMiddle bg-gray-50 dark:bg-gray-800',
      renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
        const rowData = instance.getSourceDataAtRow(row)
        const isTotalRow = rowData?.rowId === 'total'
        const formattedValue = value ? value.toFixed(1) : '0.0'
        
        if (isTotalRow) {
          td.innerHTML = `<strong>${formattedValue}</strong>`
          td.className = 'htRight htMiddle font-bold bg-gray-100 dark:bg-gray-800'
        } else {
          td.innerHTML = formattedValue
          td.className = 'htRight htMiddle bg-gray-50 dark:bg-gray-800'
        }
        return td
      }
    })
  } else {
    columns.push(
      {
        data: 'total',
        title: 'Total\nExpenses',
        type: 'numeric',
        numericFormat: { pattern: '$0,0.00' },
        width: 85,
        readOnly: true,
        className: 'htRight htMiddle bg-gray-50 dark:bg-gray-800',
        // Enable sorting for Total column in expense tables
        renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
          const rowData = instance.getSourceDataAtRow(row)
          const isTotalRow = rowData?.rowId === 'total'
          
          const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          })
          
          const formattedValue = value ? formatter.format(value) : '$0'
          
          if (isTotalRow) {
            td.innerHTML = `<strong>${formattedValue}</strong>`
            td.className = 'htRight htMiddle font-bold bg-gray-100 dark:bg-gray-800'
          } else {
            td.innerHTML = formattedValue
            td.className = 'htRight htMiddle bg-gray-50 dark:bg-gray-800'
          }
          return td
        }
      },
      {
        data: 'percentage',
        title: '%',
        type: 'numeric',
        numericFormat: { pattern: '0.0%' },
        width: 55,
        readOnly: true,
        className: 'htRight htMiddle bg-blue-50 dark:bg-blue-900',
        columnSorting: { indicator: false }, // Disable sorting for percentage column
        renderer: function(instance: any, td: any, row: number, col: number, prop: string, value: any, cellProperties: any) {
          const rowData = instance.getSourceDataAtRow(row)
          const isTotalRow = rowData?.rowId === 'total'
          const formattedValue = value ? `${value.toFixed(1)}%` : '0.0%'
          
          if (isTotalRow) {
            td.innerHTML = `<strong>${formattedValue}</strong>`
            td.className = 'htRight htMiddle font-bold bg-blue-100 dark:bg-blue-800'
          } else {
            td.innerHTML = formattedValue
            td.className = 'htRight htMiddle bg-blue-50 dark:bg-blue-900'
          }
          return td
        }
      }
    )
  }


  // Handle sorting to keep TOTAL row at top
  const handleAfterColumnSort = useCallback((currentSortConfig: any, destinationSortConfigs: any) => {
    const hot = hotTableRef.current?.hotInstance;
    if (!hot) return;
    
    // After any sort, ensure TOTAL row is at index 0
    setTimeout(() => {
      const data = hot.getSourceData();
      const totalRowIndex = data.findIndex((row: any) => row.rowId === 'total');
      
      if (totalRowIndex > 0) {
        // Move TOTAL row to the beginning
        const totalRow = data[totalRowIndex];
        data.splice(totalRowIndex, 1);
        data.unshift(totalRow);
        hot.loadData(data);
      }
    }, 0);
  }, []);

  // Handle changes - save immediately or batch based on mode
  const handleAfterChange = useCallback(async (changes: any, source: string) => {
    if (!changes || source === 'loadData') return
    
    const hot = hotTableRef.current?.hotInstance
    if (!hot) return
    
    const pendingChanges: Array<{ week: number; rowId: string; value: number }> = []
    
    for (const [row, prop, oldValue, newValue] of changes) {
      // Skip total row (first row)
      if (row === 0) continue
      
      // Skip if this is an internal update from our totals calculation
      if (source === 'internal') continue
      
      // Only process week columns
      if (typeof prop === 'string' && prop.startsWith('W')) {
        // Get week number from column name (e.g., 'W27' -> 27)
        const weekNum = parseInt(prop.substring(1))
        
        // Get row ID from row data
        const rowData = hot.getSourceDataAtRow(row)
        const rowId = rowData?.rowId
        if (!rowId || rowId === 'total') continue
        
        // Parse values to compare actual numeric values
        const oldNumeric = type === 'expense' 
          ? (parseFloat(oldValue) || 0) 
          : (parseInt(oldValue) || 0)
        const newNumeric = type === 'expense' 
          ? (parseFloat(newValue) || 0) 
          : (parseInt(newValue) || 0)
        
        // Skip if values are actually the same when converted to numbers
        if (oldNumeric === newNumeric) continue
        
        const value = newNumeric
        
        pendingChanges.push({
          week: weekNum,
          rowId: rowId,
          value
        })
      }
    }
    
    if (pendingChanges.length > 0) {
      if (immediateMode && onBatchSave) {
        // Immediate mode - save right away
        setIsSaving(true)
        try {
          await onBatchSave(pendingChanges)
        } catch (error) {
          console.error('Failed to save changes:', error)
        } finally {
          setIsSaving(false)
        }
      } else if (onCellChange) {
        // Batch mode - just notify parent component
        onCellChange(pendingChanges)
      }
    }
    
    // Batch all totals updates to prevent multiple re-renders
    hot.batch(() => {
      // Track which rows and columns need updating
      const rowsToUpdate = new Set<number>()
      const columnsToUpdate = new Set<string>()
      
      // First pass: identify what needs updating
      for (const [row, prop, oldValue, newValue] of changes) {
        if (row === 0 || source === 'internal') continue
        
        if (typeof prop === 'string' && prop.startsWith('W') && oldValue !== newValue) {
          rowsToUpdate.add(row)
          columnsToUpdate.add(prop)
        }
      }
      
      // Update row totals for affected rows
      rowsToUpdate.forEach(row => {
        const rowData = hot.getSourceDataAtRow(row)
        
        if (type === 'sales' || type === 'revenue' || type === 'orders') {
          let rowTotalUnits = 0
          let rowTotalRevenue = 0
          const price = parseFloat(rowData?.subtext || '0') || 0
          
          weeks.forEach(week => {
            const weekColName = `W${week.weekNum}`
            const weekUnits = hot.getDataAtRowProp(row, weekColName) || 0
            rowTotalUnits += weekUnits
            rowTotalRevenue += weekUnits * price
          })
          hot.setDataAtRowProp(row, 'totalUnits', rowTotalUnits, 'internal')
          if (type !== 'orders') {
            hot.setDataAtRowProp(row, 'totalRevenue', rowTotalRevenue, 'internal')
          }
        } else {
          let rowTotal = 0
          weeks.forEach(week => {
            const weekColName = `W${week.weekNum}`
            const weekAmount = hot.getDataAtRowProp(row, weekColName) || 0
            rowTotal += weekAmount
          })
          hot.setDataAtRowProp(row, 'total', rowTotal, 'internal')
        }
      })
      
      // Update column totals for affected columns
      const totalRowIndex = 0
      columnsToUpdate.forEach(prop => {
        let columnTotal = 0
        // Skip the total row itself when calculating totals
        for (let i = 1; i <= rows.length; i++) {
          columnTotal += hot.getDataAtRowProp(i, prop) || 0
        }
        hot.setDataAtRowProp(totalRowIndex, prop, columnTotal, 'internal')
      })
      
      // Update grand totals once
      if (rowsToUpdate.size > 0 || columnsToUpdate.size > 0) {
        if (type === 'sales' || type === 'revenue' || type === 'orders') {
          let grandTotalUnits = 0
          let grandTotalRevenue = 0
          weeks.forEach(week => {
            const weekColName = `W${week.weekNum}`
            const weekTotal = hot.getDataAtRowProp(totalRowIndex, weekColName) || 0
            grandTotalUnits += weekTotal
            
            // Calculate revenue for this week
            let weekRevenue = 0
            for (let i = 1; i <= rows.length; i++) {
              const units = hot.getDataAtRowProp(i, weekColName) || 0
              const rowData = hot.getSourceDataAtRow(i)
              const price = parseFloat(rowData?.subtext || '0') || 0
              weekRevenue += units * price
            }
            grandTotalRevenue += weekRevenue
          })
          hot.setDataAtRowProp(totalRowIndex, 'totalUnits', grandTotalUnits, 'internal')
          hot.setDataAtRowProp(totalRowIndex, 'totalRevenue', grandTotalRevenue, 'internal')
          
          // Update percentages for all rows
          for (let i = 1; i <= rows.length; i++) {
            const rowRevenue = hot.getDataAtRowProp(i, 'totalRevenue') || 0
            const percentage = grandTotalRevenue > 0 ? (rowRevenue / grandTotalRevenue * 100) : 0
            hot.setDataAtRowProp(i, 'percentage', percentage, 'internal')
          }
          // Total row is always 100%
          hot.setDataAtRowProp(totalRowIndex, 'percentage', 100, 'internal')
        } else {
          let grandTotal = 0
          weeks.forEach(week => {
            const weekColName = `W${week.weekNum}`
            const weekTotal = hot.getDataAtRowProp(totalRowIndex, weekColName) || 0
            grandTotal += weekTotal
          })
          hot.setDataAtRowProp(totalRowIndex, 'total', grandTotal, 'internal')
          
          // Update percentages for all rows
          for (let i = 1; i <= rows.length; i++) {
            const rowTotal = hot.getDataAtRowProp(i, 'total') || 0
            const percentage = grandTotal > 0 ? (rowTotal / grandTotal * 100) : 0
            hot.setDataAtRowProp(i, 'percentage', percentage, 'internal')
          }
          // Total row is always 100%
          hot.setDataAtRowProp(totalRowIndex, 'percentage', 100, 'internal')
        }
      }
    })
  }, [weeks, rows, type, onBatchSave, onCellChange, immediateMode])

  return (
    <div className="relative">
      {isSaving && (
        <div className="absolute top-2 right-2 z-10">
          <span className="text-sm text-blue-600 dark:text-blue-400">Saving...</span>
        </div>
      )}
      
      {readOnly && (
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md dark:bg-gray-800 dark:text-gray-400">
            Read-Only
          </span>
        </div>
      )}
      
      <HotTable
        ref={hotTableRef}
        data={tableData}
        columns={columns}
        stretchH="all"
        height="auto"
        rowHeights={28}  // Compact for screen fit
        autoWrapRow={true}
        autoWrapCol={false}
        licenseKey="non-commercial-and-evaluation"
        
        // Override cell properties for editable rows
        cells={function(row, col, prop) {
          const rowData = this.instance.getSourceDataAtRow(row)
          if (rowData && editableRows.includes(rowData.rowId)) {
            // Make this row editable regardless of readOnly setting
            return {
              readOnly: false
            }
          }
          // For all other cells, use the column's readOnly setting
          return {}
        }}
        
        // Compact column sizing to fit screen
        autoColumnSize={false}  // Disable auto-size for consistent widths
        colWidths={70}  // Compact width for screen fit
        
        // Performance optimization
        renderAllRows={false}
        viewportRowRenderingOffset={20}
        viewportColumnRenderingOffset={10}
        
        // Excel-like features
        contextMenu={true}
        copyPaste={true}
        fillHandle={false}  // Disabled for cleaner look
        undo={true}
        manualColumnResize={true}
        columnSorting={true}
        
        // Navigation
        enterMoves={{ row: 1, col: 0 }}
        tabMoves={{ row: 0, col: 1 }}
        navigableHeaders={true}
        
        // Selection
        selectionMode='multiple'
        outsideClickDeselects={false}
        
        // Appearance
        className={`${className || ''} ${readOnly ? 'read-only-table' : ''}`}
        rowHeaders={false}
        colHeaders={true}
        columnHeaderHeight={45}  // Reduced height with two-line text
        afterGetColHeader={function(col, TH) {
          // Format headers with two lines for week columns
          const weekIndex = col - 1;
          if (weekIndex >= 0 && weekIndex < weeks.length) {
            const week = weeks[weekIndex];
            
            // Format header as two lines: W40 \n 5 Oct
            const startDate = week.dateRange.split(' - ')[0];
            if (!TH.innerHTML.includes('<br>')) {
              TH.innerHTML = `${week.weekLabel}<br><span style="font-size: 11px; font-weight: normal;">${startDate}</span>`;
            }
            
            // Add CSS classes for week status
            if (week.isCurrentWeek) {
              TH.classList.add('current-week');
            } else if (!week.isPastWeek && !week.isCurrentWeek) {
              TH.classList.add('future-week');
            } else {
              TH.classList.add('past-week');
            }
          }
          
          // Center align and allow line breaks
          TH.style.textAlign = 'center';
          TH.style.lineHeight = '1.2';
          TH.style.whiteSpace = 'normal';
        }}
        
        // Events
        afterChange={handleAfterChange}
        afterColumnSort={handleAfterColumnSort}
        
        // Cell properties
        cells={function(row, col) {
          const cellProperties: any = {}
          
          // If entire table is read-only (but still allow sorting)
          if (readOnly) {
            cellProperties.readOnly = true
            // Don't return early - continue to set other properties
          }
          
          // Check if this is the total row (first row)
          if (row === 0) {
            cellProperties.readOnly = true
            cellProperties.className = 'htDimmed font-bold bg-gray-100'
            return cellProperties
          }
          
          // First column is always read-only
          if (col === 0) {
            cellProperties.readOnly = true
          }
          
          // Total columns are read-only
          if (type === 'sales' && (col === weeks.length + 1 || col === weeks.length + 2)) {
            // Total Units and % columns for sales
            cellProperties.readOnly = true
            cellProperties.className = 'htRight bg-gray-50'
          } else if (type === 'orders' && (col === weeks.length + 1 || col === weeks.length + 2)) {
            // Total Purchase and % columns for orders
            cellProperties.readOnly = true
            cellProperties.className = 'htRight bg-gray-50'
          } else if (type === 'revenue' && (col === weeks.length + 1 || col === weeks.length + 2)) {
            // Total Revenue and % columns for revenue
            cellProperties.readOnly = true
            cellProperties.className = 'htRight bg-gray-50'
          } else if (type === 'expense' && (col === weeks.length + 1 || col === weeks.length + 2)) {
            cellProperties.readOnly = true
            cellProperties.className = 'htRight bg-gray-50'
          }
          
          return cellProperties
        }}
      />
    </div>
  )
}