'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { HotTable } from '@handsontable/react'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import '@/styles/handsontable-modern.css'
import Handsontable from 'handsontable'
import { DimensionModal } from '@/components/modals/DimensionModal'
import { AreaModal } from '@/components/modals/AreaModal'
import { ProductCalculationService } from '@/services/database/ProductCalculationService'
import { getAccount } from '@/lib/chart-of-accounts'

// Register Handsontable modules
registerAllModules()

export type ViewType = 'margins' | 'settings'

interface ProductDataHotTableProps {
  view: ViewType
  data: any[]
  onDataChange: (changes: Array<{ sku: string; field: string; value: any }>) => void
  tariffRate?: number
  amazonReferralRate?: number
  returnAllowanceRate?: number
  className?: string
}

// Define metrics for each view
interface Metric {
  key: string
  label: string
  editable: boolean | string
  format: string
  calculated?: boolean
  section?: string
  summary?: boolean
}

const MARGIN_METRICS: Metric[] = [
  { key: 'name', label: 'Product Name', editable: false, format: 'text' },
  { key: 'price', label: `[4000] ${getAccount('4000')?.name}`, editable: true, format: 'currency' },
  
  // COGS Section
  { key: '_cogs_header', label: 'COST OF GOODS SOLD', editable: false, format: 'text', section: 'header' },
  { key: 'manufacturingCost', label: `[5020] ${getAccount('5020')?.name}`, editable: true, format: 'currency' },
  { key: 'freightCost', label: `[5030] ${getAccount('5030')?.name}`, editable: true, format: 'currency' },
  { key: 'tariff', label: `[5040] ${getAccount('5040')?.name}`, editable: false, format: 'currency', calculated: true },
  { key: 'totalCost', label: 'Total COGS', editable: false, format: 'currency', calculated: true, section: 'subtotal' },
  
  // Amazon Fees Section
  { key: '_amazon_header', label: 'AMAZON FEES', editable: false, format: 'text', section: 'header' },
  { key: 'warehouseCost', label: `[5032] ${getAccount('5032')?.name}`, editable: true, format: 'currency' },
  { key: 'fulfillmentFee', label: `[5051] ${getAccount('5051')?.name}`, editable: false, format: 'currency', calculated: true },
  { key: 'amazonReferralFee', label: `[5050] ${getAccount('5050')?.name}`, editable: false, format: 'currency', calculated: true },
  { key: 'advertisingCost', label: `[5310] ${getAccount('5310')?.name}`, editable: false, format: 'currency', calculated: true },
  { key: 'returnAllowance', label: `[4010] ${getAccount('4010')?.name}`, editable: false, format: 'currency', calculated: true },
  { key: 'amazonFees', label: 'Total Amazon Fees', editable: false, format: 'currency', calculated: true, section: 'subtotal' },
  
  // Summary
  { key: '_summary_header', label: 'SUMMARY', editable: false, format: 'text', section: 'header' },
  { key: 'grossMargin', label: 'Gross Profit ($)', editable: false, format: 'currency', summary: true },
  { key: 'marginPercent', label: 'Gross Margin (%)', editable: false, format: 'percent', summary: true }
]

const SETTINGS_METRICS: Metric[] = [
  { key: 'name', label: 'Product Name', editable: false, format: 'text' },
  { key: 'sourcingCountry', label: 'Sourcing Country', editable: true, format: 'text' },
  { key: 'destinationMarket', label: 'Destination Market', editable: true, format: 'text' },
  { key: 'packSize', label: 'Pack Size', editable: true, format: 'integer' },
  { key: 'micron', label: 'Micron', editable: true, format: 'numeric' },
  { key: 'productArea', label: 'Product Area', editable: 'modal', format: 'area' },
  { key: 'packageDimensions', label: 'Package Dimensions', editable: 'modal', format: 'dimension' },
  { key: 'density', label: 'Density (g/cm³)', editable: true, format: 'numeric' },
  { key: 'weightGrams', label: 'Weight (g)', editable: true, format: 'numeric', calculated: false },
  { key: 'weightOz', label: 'Weight (oz)', editable: true, format: 'numeric', calculated: false },
  { key: 'weightLb', label: 'Weight (lb)', editable: false, format: 'numeric', calculated: true },
  { key: 'cbm', label: 'CBM/Unit', editable: false, format: 'numeric', calculated: true },
  { key: 'sizeTierWithType', label: 'Size Tier', editable: false, format: 'sizeTierWithType', calculated: true },
  { key: 'tacos', label: 'TACoS %', editable: true, format: 'percent' },
  { key: 'tariffRate', label: 'Tariff Rate %', editable: true, format: 'percent' },
  { key: 'refundRate', label: 'Refund %', editable: true, format: 'percent' }
]

export const ProductDataHotTable: React.FC<ProductDataHotTableProps> = ({
  view,
  data,
  onDataChange,
  tariffRate = 0.35,
  amazonReferralRate = 0.15,
  returnAllowanceRate = 0.01,
  className
}) => {
  const hotTableRef = useRef<any>(null)
  const [dimensionModalOpen, setDimensionModalOpen] = useState(false)
  const [areaModalOpen, setAreaModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<{ sku: string; name: string; dimensions?: any; area?: any } | null>(null)
  
  // Select metrics based on view
  const metrics = view === 'margins' ? MARGIN_METRICS : SETTINGS_METRICS
  
  // Transform data to transposed format
  const prepareTransposedData = useCallback(() => {
    if (!data || data.length === 0) return []
    
    // Debug log for settings view to check specific fields
    if (view === 'settings' && data.length > 0) {
      console.log('ProductDataHotTable settings data sample:', {
        sku: data[0].sku,
        packageDimensions: data[0].packageDimensions,
        productArea: data[0].productArea,
        productLength: data[0].productLength,
        productWidth: data[0].productWidth
      })
    }
    
    // Create transposed data
    const transposedData = metrics.map(metric => {
      const row: any = {
        metric: metric.label,
        metricKey: metric.key,
        editable: metric.editable,
        format: metric.format,
        calculated: metric.calculated || false,
        summary: metric.summary || false,
        section: metric.section || null
      }
      
      // Add data for each SKU
      data.forEach(product => {
        // Handle special cases
        if (metric.key === 'sizeTierWithType') {
          // Combine size tier with FBA type indication and weight range
          const sizeTier = product.sizeTier || 'Not calculated'
          const weightRange = product.weightRange || ''
          const feeType = product.feeType || (product.price < 10 ? 'Low-Price FBA' : 'Standard FBA')
          
          // Format more clearly
          if (sizeTier === 'Not calculated') {
            row[product.sku] = 'Size tier not calculated - add dimensions'
          } else {
            const parts = [sizeTier]
            if (weightRange) parts.push(weightRange)
            if (feeType && feeType !== 'Standard FBA') parts.push(`[${feeType}]`)
            row[product.sku] = parts.join(' ')
          }
        } else {
          row[product.sku] = product[metric.key]
        }
      })
      
      return row
    })
    
    return transposedData
  }, [data, metrics, tariffRate, amazonReferralRate, returnAllowanceRate])

  const [tableData, setTableData] = useState(() => prepareTransposedData())

  useEffect(() => {
    const newData = prepareTransposedData()
    console.log('ProductDataHotTable: Updating table data', {
      view,
      dataLength: data.length,
      firstRow: newData[0]
    })
    setTableData(newData)
    
    // Force HotTable to update
    if (hotTableRef.current?.hotInstance) {
      console.log('ProductDataHotTable: Forcing HotTable update')
      hotTableRef.current.hotInstance.loadData(newData)
    }
  }, [prepareTransposedData, view, data.length])

  // Generate columns dynamically based on SKUs
  const columns: any[] = [
    {
      data: 'metric',
      title: 'Metric',
      readOnly: true,
      width: 150,
      className: 'htLeft htMiddle',
      renderer: function(instance: any, td: any, row: number, col: number, prop: any, value: any) {
        const rowData = instance.getSourceDataAtRow(row)
        let fontWeight = '500'
        let fontSize = '0.875rem'
        let backgroundColor = ''
        let color = ''
        
        if (rowData?.section === 'header') {
          // Section headers - subtle gray background
          fontWeight = '600'
          fontSize = '0.825rem'
          backgroundColor = '#e5e7eb'
          color = '#374151'
          td.style.textTransform = 'uppercase'
          td.style.letterSpacing = '0.025em'
        } else if (rowData?.section === 'subtotal') {
          fontWeight = '600'
          backgroundColor = '#f3f4f6'
          color = '#1f2937'
        } else if (rowData?.summary) {
          fontWeight = '700'
          fontSize = '0.925rem'
          backgroundColor = '#e5e7eb'
          color = '#111827'
        }
        
        td.style.fontWeight = fontWeight
        td.style.fontSize = fontSize
        td.style.backgroundColor = backgroundColor
        td.style.color = color
        td.style.paddingLeft = '12px'
        td.innerHTML = value
        
        return td
      }
    }
  ]

  // Add columns for each SKU
  if (data && data.length > 0) {
    data.forEach((product, index) => {
      columns.push({
        data: product.sku,
        title: '', // No header needed since product name is in first row
        width: 120,
        className: 'htCenter htMiddle',
        renderer: function(instance: any, td: any, row: number, col: number, prop: any, value: any) {
          const rowData = instance.getSourceDataAtRow(row)
          const format = rowData?.format
          const isEditable = rowData?.editable
          const isCalculated = rowData?.calculated
          const metricKey = rowData?.metricKey
          
          let fontWeight = '400'
          let backgroundColor = ''
          let color = ''
          let borderLeft = ''
          
          if (rowData?.section === 'header') {
            // Section headers - subtle styling
            backgroundColor = '#e5e7eb'
            td.innerHTML = '' // Empty for header rows in data columns
            return td // Early return for headers
          } else if (rowData?.section === 'subtotal') {
            fontWeight = '600'
            backgroundColor = '#f8f9fa'
            color = '#1f2937'
          } else if (rowData?.summary) {
            fontWeight = '700'
            backgroundColor = '#f1f3f5'
            color = '#111827'
          } else if (isCalculated) {
            // Calculated fields - light gray with subtle border
            backgroundColor = '#f8f9fa'
            color = '#64748b'
            borderLeft = ''
            td.style.fontStyle = 'italic'
          } else if (isEditable === 'modal') {
            // Modal-triggered fields - also editable, just different method
            backgroundColor = '#ffffff'
            color = '#0f172a'
            borderLeft = '3px solid #10b981'
            td.style.fontWeight = '500'
            td.style.textDecoration = 'underline'
            td.style.textDecorationStyle = 'dotted'
            td.style.textDecorationColor = '#94a3b8'
            td.style.cursor = 'pointer'
          } else if (isEditable === true) {
            // Editable fields - white with subtle green left accent
            backgroundColor = '#ffffff'
            color = '#0f172a'
            borderLeft = '3px solid #10b981'
            td.style.fontWeight = '500'
          } else {
            // Read-only fields - gray background
            backgroundColor = '#f1f5f9'
            color = '#64748b'
            borderLeft = ''
          }
          
          // Apply styles to the cell
          td.style.fontWeight = fontWeight
          td.style.backgroundColor = backgroundColor
          td.style.color = color
          td.style.textAlign = 'right'
          td.style.paddingRight = '12px'
          if (borderLeft) {
            td.style.borderLeft = borderLeft
          }
          
          // Format the value based on type
          if (value !== null && value !== undefined) {
            if (format === 'currency') {
              td.innerHTML = `$${parseFloat(value).toFixed(2)}`
            } else if (format === 'percent') {
              td.innerHTML = `${(parseFloat(value) * 100).toFixed(2)}%`
            } else if (format === 'integer') {
              // Force integer display for pack size
              td.innerHTML = Math.round(parseFloat(value)).toString()
            } else if (format === 'numeric') {
              // Special handling for CBM to ensure it displays
              if (metricKey === 'cbm') {
                const cbmValue = parseFloat(value)
                td.innerHTML = cbmValue > 0 ? cbmValue.toFixed(6) : '0.000000'
              } else {
                td.innerHTML = parseFloat(value).toFixed(2)
              }
            } else if (format === 'sizeTierWithType') {
              // Display size tier with FBA type
              td.innerHTML = value || 'Not set'
              td.style.fontSize = '0.85rem'
            } else if (format === 'dimension' && metricKey === 'packageDimensions') {
              // Make dimension cells clickable
              td.style.cursor = 'pointer'
              td.style.textDecoration = 'underline'
              td.style.color = '#2563eb'
              td.innerHTML = value || 'Click to set'
              td.onclick = (e: MouseEvent) => {
                e.stopPropagation()
                e.preventDefault()
                
                // Clear any Handsontable selection
                if (hotTableRef.current?.hotInstance) {
                  hotTableRef.current.hotInstance.deselectCell()
                }
                
                const sku = prop
                const product = data.find(p => p.sku === sku)
                if (product) {
                  setSelectedProduct({
                    sku,
                    name: product.name,
                    dimensions: {
                      length: product.length,
                      width: product.width,
                      height: product.height
                    }
                  })
                  setDimensionModalOpen(true)
                }
              }
            } else if (format === 'area' && metricKey === 'productArea') {
              // Make area cells clickable
              td.style.cursor = 'pointer'
              td.style.textDecoration = 'underline'
              td.style.color = '#2563eb'
              const areaValue = parseFloat(value) || 0
              td.innerHTML = areaValue > 0 ? `${areaValue.toFixed(2)} ft²` : 'Click to set'
              td.onclick = (e: MouseEvent) => {
                e.stopPropagation()
                e.preventDefault()
                
                // Clear any Handsontable selection
                if (hotTableRef.current?.hotInstance) {
                  hotTableRef.current.hotInstance.deselectCell()
                }
                
                const sku = prop
                const product = data.find(p => p.sku === sku)
                if (product) {
                  setSelectedProduct({
                    sku,
                    name: product.name,
                    area: {
                      length: product.productLength,
                      width: product.productWidth
                    }
                  })
                  setAreaModalOpen(true)
                }
              }
            } else {
              td.innerHTML = value
            }
          } else {
            td.innerHTML = ''
          }
          
          return td
        }
      })
    })
  }

  const handleAfterChange = useCallback((changes: any, source: string) => {
    if (source === 'loadData' || !changes) return

    const updates: Array<{ sku: string; field: string; value: any }> = []
    
    changes.forEach((change: [number, string | number, any, any]) => {
      const [row, prop, oldValue, newValue] = change
      
      // Skip if values are the same, but always process if user entered "0" or 0
      const isZeroEntry = newValue === 0 || newValue === '0' || newValue === '0%'
      if (!isZeroEntry && oldValue === newValue) return
      
      const sku = typeof prop === 'string' ? prop : data[prop - 1]?.sku
      const metricKey = tableData[row]?.metricKey
      
      if (sku && metricKey) {
        // Parse value based on format
        const format = tableData[row]?.format
        let parsedValue = newValue
        
        if (format === 'currency' || format === 'numeric') {
          const parsed = parseFloat(String(newValue).replace(/[$,]/g, ''))
          parsedValue = isNaN(parsed) ? 0 : parsed
        } else if (format === 'integer') {
          // Force integer for pack size
          const parsed = parseInt(String(newValue).replace(/[^0-9-]/g, ''))
          parsedValue = isNaN(parsed) ? 1 : Math.max(1, parsed)
        } else if (format === 'percent') {
          // If user enters percentage like "35" treat it as 35%
          const cleaned = String(newValue).replace(/%/g, '')
          const parsed = parseFloat(cleaned) / 100
          parsedValue = isNaN(parsed) ? 0 : parsed
        }
        
        updates.push({
          sku,
          field: metricKey,
          value: parsedValue
        })
        
        // If user changed weight in grams, automatically calculate oz and lb
        if (metricKey === 'weightGrams') {
          const grams = parsedValue
          const oz = grams * 0.035274  // 1g = 0.035274 oz
          const lb = grams * 0.00220462  // 1g = 0.00220462 lb
          
          updates.push({
            sku,
            field: 'weightOz',
            value: Math.round(oz * 100) / 100  // Round to 2 decimals
          })
          updates.push({
            sku,
            field: 'weightLb',
            value: Math.round(lb * 100) / 100  // Round to 2 decimals
          })
        }
        // If user changed weight in oz, automatically calculate grams and lb
        else if (metricKey === 'weightOz') {
          const oz = parsedValue
          const grams = oz / 0.035274  // Convert oz to grams
          const lb = oz / 16  // 16 oz = 1 lb
          
          updates.push({
            sku,
            field: 'weightGrams',
            value: Math.round(grams * 100) / 100  // Round to 2 decimals
          })
          updates.push({
            sku,
            field: 'weightLb',
            value: Math.round(lb * 100) / 100  // Round to 2 decimals
          })
        }
        // If user changed weight in lb, automatically calculate grams and oz
        else if (metricKey === 'weightLb') {
          const lb = parsedValue
          const grams = lb / 0.00220462  // Convert lb to grams
          const oz = lb * 16  // 1 lb = 16 oz
          
          updates.push({
            sku,
            field: 'weightGrams',
            value: Math.round(grams * 100) / 100  // Round to 2 decimals
          })
          updates.push({
            sku,
            field: 'weightOz',
            value: Math.round(oz * 100) / 100  // Round to 2 decimals
          })
        }
      }
    })
    
    if (updates.length > 0) {
      onDataChange(updates)
    }
  }, [data, tableData, onDataChange])

  const handleDimensionSave = useCallback((dimensions: { length: number; width: number; height: number }) => {
    if (selectedProduct) {
      const cbm = ProductCalculationService.calculateCBM(dimensions.length, dimensions.width, dimensions.height)
      const dimensionString = ProductCalculationService.formatDimensions(
        dimensions.length,
        dimensions.width,
        dimensions.height
      )
      
      // Send updates for dimensions and CBM
      // Size tier will be calculated by API when these changes trigger handleSettingsChange
      onDataChange([
        { sku: selectedProduct.sku, field: 'length', value: dimensions.length },
        { sku: selectedProduct.sku, field: 'width', value: dimensions.width },
        { sku: selectedProduct.sku, field: 'height', value: dimensions.height },
        { sku: selectedProduct.sku, field: 'packageDimensions', value: dimensionString },
        { sku: selectedProduct.sku, field: 'cbm', value: cbm }
      ])
    }
    setDimensionModalOpen(false)
    setSelectedProduct(null)
  }, [selectedProduct, onDataChange])

  const handleAreaSave = useCallback((area: { length: number; width: number; area: number }) => {
    if (selectedProduct) {
      // Send updates for product area dimensions
      // Weight will be recalculated automatically when area changes
      onDataChange([
        { sku: selectedProduct.sku, field: 'productLength', value: area.length },
        { sku: selectedProduct.sku, field: 'productWidth', value: area.width },
        { sku: selectedProduct.sku, field: 'productArea', value: area.area }
      ])
    }
    setAreaModalOpen(false)
    setSelectedProduct(null)
  }, [selectedProduct, onDataChange])

  // Define cells function to handle cell-specific settings
  const cells = function(row: number, col: number) {
    const rowData = tableData[row]
    if (col === 0) {
      // First column (metric labels) is always read-only
      return { readOnly: true }
    }
    // For data columns, check if the row is editable
    const isEditable = rowData?.editable
    return {
      readOnly: isEditable !== true // Only editable if explicitly true
    }
  }

  return (
    <div className={className}>
      {dimensionModalOpen && selectedProduct && (
        <DimensionModal
          isOpen={dimensionModalOpen}
          onClose={() => {
            setDimensionModalOpen(false)
            setSelectedProduct(null)
          }}
          onSave={handleDimensionSave}
          initialDimensions={selectedProduct.dimensions}
          productName={selectedProduct.name}
        />
      )}
      {areaModalOpen && selectedProduct && (
        <AreaModal
          isOpen={areaModalOpen}
          onClose={() => {
            setAreaModalOpen(false)
            setSelectedProduct(null)
          }}
          onSave={handleAreaSave}
          currentArea={selectedProduct.area}
          productName={selectedProduct.name}
          productSku={selectedProduct.sku}
        />
      )}
      <HotTable
        ref={hotTableRef}
        data={tableData}
        columns={columns}
        colHeaders={false}
        rowHeaders={false}
        width="100%"
        height="auto"
        stretchH="all"
        autoWrapRow={true}
        autoWrapCol={true}
        licenseKey="non-commercial-and-evaluation"
        afterChange={handleAfterChange}
        className="htCenter htMiddle"
        preventOverflow="horizontal"
        manualColumnResize={true}
        manualRowResize={false}
        columnSorting={false}
        contextMenu={false}
        copyPaste={true}
        fillHandle={false}
        filters={false}
        dropdownMenu={false}
        mergeCells={false}
        readOnly={false}
        comments={false}
        customBorders={false}
        cells={cells}
      />
    </div>
  )
}