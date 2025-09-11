'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Settings } from 'lucide-react'
import SharedFinancialDataService from '@/lib/services/SharedFinancialDataService'
import { SpreadsheetTable, Column } from '@/components/SpreadsheetTable'

interface ProductCosts {
  name: string
  price: number
  manufacturingCost: number
  freightCost: number
  warehouseCost: number
  fulfillmentFee: number
}

interface ProductMarginTableProps {
  productData: Record<string, ProductCosts>
  setProductData: (data: Record<string, ProductCosts>) => void
}

export function ProductMarginTable({ productData, setProductData }: ProductMarginTableProps) {
  const sharedDataService = SharedFinancialDataService.getInstance()
  
  // Get settings from config - will be loaded from API
  const [tariffRate, setTariffRate] = useState(35) // Default 35%
  const [amazonReferralRate, setAmazonReferralRate] = useState(15) // Default 15%
  const [returnAllowanceRate, setReturnAllowanceRate] = useState(1) // Default 1%
  
  useEffect(() => {
    // Load rates from API
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config')
        if (response.ok) {
          const config = await response.json()
          if (config.businessRules) {
            setTariffRate((config.businessRules.tariffRate || 0.35) * 100)
            setAmazonReferralRate((config.businessRules.amazonReferralRate || 0.15) * 100)
            setReturnAllowanceRate((config.businessRules.amazonReturnAllowance || 0.01) * 100)
          }
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    }
    loadConfig()
  }, [])

  const calculateTariff = (manufacturingCost: number) => {
    return manufacturingCost * (tariffRate / 100)
  }

  const calculateAmazonReferralFee = (price: number) => {
    return price * (amazonReferralRate / 100)
  }

  const calculateReturnAllowance = (price: number) => {
    return price * (returnAllowanceRate / 100)
  }

  const calculateLandedCost = (data: ProductCosts) => {
    return data.manufacturingCost + data.freightCost + calculateTariff(data.manufacturingCost)
  }

  const calculateTotalCOGS = (data: ProductCosts) => {
    const landedCost = calculateLandedCost(data)
    const amazonReferralFee = calculateAmazonReferralFee(data.price)
    const returnAllowance = calculateReturnAllowance(data.price)
    return landedCost + data.warehouseCost + amazonReferralFee + data.fulfillmentFee + returnAllowance
  }

  const calculateGrossProfit = (data: ProductCosts) => {
    return data.price - calculateTotalCOGS(data)
  }

  const calculateMarginPercent = (data: ProductCosts) => {
    return (calculateGrossProfit(data) / data.price) * 100
  }

  const calculateROI = (data: ProductCosts) => {
    const landedCost = calculateLandedCost(data)
    return (calculateGrossProfit(data) / landedCost) * 100
  }

  // Prepare columns for SpreadsheetTable - SKUs as columns
  const columns = useMemo(() => {
    const cols: Column[] = [
      { 
        key: 'component', 
        header: 'Component', 
        type: 'text' as const, 
        editable: false,
        width: 180
      }
    ]
    
    Object.entries(productData).forEach(([sku, data]) => {
      cols.push({
        key: sku,
        header: sku,
        type: 'currency' as const,
        editable: true,
        width: 100,
        onChange: (rowKey: string, value: any) => {
          // Only allow editing certain rows
          const editableRows = ['price', 'manufacturingCost', 'freightCost', 'warehouseCost', 'fulfillmentFee']
          return editableRows.includes(rowKey)
        }
      })
    })
    
    return cols
  }, [productData])

  // Prepare rows for SpreadsheetTable
  const rows = useMemo(() => [
    { key: 'price', label: 'Retail Price', subLabel: '' },
    { key: 'manufacturingHeader', label: 'Manufacturing & Logistics', subLabel: '' },
    { key: 'manufacturingCost', label: 'Manufacturing Cost', subLabel: '' },
    { key: 'freightCost', label: 'Freight Cost', subLabel: '' },
    { key: 'tariff', label: `Tariff (${tariffRate}%)`, subLabel: 'Auto-calculated' },
    { key: 'landedCost', label: 'Total Landed Cost', subLabel: '' },
    { key: 'fulfillmentHeader', label: 'Fulfillment & Fees', subLabel: '' },
    { key: 'warehouseCost', label: '3PL/Storage', subLabel: '' },
    { key: 'amazonReferralFee', label: `Amazon Expenses (${amazonReferralRate}%)`, subLabel: 'Auto-calculated' },
    { key: 'fulfillmentFee', label: 'FBA Fee', subLabel: '' },
    { key: 'returnAllowance', label: `Returns (${returnAllowanceRate}%)`, subLabel: 'Auto-calculated' },
    { key: 'totalCOGS', label: 'Total COGS', subLabel: '' },
    { key: 'grossProfit', label: 'Gross Profit', subLabel: '' },
    { key: 'marginPercent', label: 'Margin %', subLabel: '' },
    { key: 'roiPercent', label: 'ROI %', subLabel: '' }
  ], [tariffRate, amazonReferralRate, returnAllowanceRate])

  // Calculate data for SpreadsheetTable - convert to array format
  const tableData = useMemo(() => {
    return rows.map(row => {
      const rowData: any = { 
        key: row.key,
        component: row.label 
      }
      
      Object.entries(productData).forEach(([sku, product]) => {
        switch (row.key) {
          case 'price':
            rowData[sku] = product.price
            break
          case 'manufacturingCost':
            rowData[sku] = product.manufacturingCost
            break
          case 'freightCost':
            rowData[sku] = product.freightCost
            break
          case 'tariff':
            rowData[sku] = calculateTariff(product.manufacturingCost)
            break
          case 'landedCost':
            rowData[sku] = calculateLandedCost(product)
            break
          case 'warehouseCost':
            rowData[sku] = product.warehouseCost
            break
          case 'amazonReferralFee':
            rowData[sku] = calculateAmazonReferralFee(product.price)
            break
          case 'fulfillmentFee':
            rowData[sku] = product.fulfillmentFee
            break
          case 'returnAllowance':
            rowData[sku] = calculateReturnAllowance(product.price)
            break
          case 'totalCOGS':
            rowData[sku] = calculateTotalCOGS(product)
            break
          case 'grossProfit':
            rowData[sku] = calculateGrossProfit(product)
            break
          case 'marginPercent':
            rowData[sku] = calculateMarginPercent(product)
            break
          case 'roiPercent':
            rowData[sku] = calculateROI(product)
            break
          default:
            rowData[sku] = 0
        }
      })
      
      return rowData
    })
  }, [productData, rows])


  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Product Margins & Cost Breakdown</CardTitle>
              <CardDescription>
                Detailed cost analysis with automatic tariff calculation ({tariffRate}% rate). Click cells to edit.
              </CardDescription>
            </div>
            <div className="text-sm text-gray-500">
              <Settings className="h-4 w-4 inline mr-1" />
              Tariff: {tariffRate}% | Amazon Expenses: {amazonReferralRate}% | Returns: {returnAllowanceRate}%
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <SpreadsheetTable
            columns={columns}
            data={tableData}
            onDataChange={(newData) => {
              // Handle data changes
              const updates = { ...productData }
              let hasChanges = false
              
              newData.forEach((row: any) => {
                const rowKey = row.key
                
                Object.entries(productData).forEach(([sku]) => {
                  if (row[sku] !== undefined) {
                    const oldValue = tableData.find(r => r.key === rowKey)?.[sku]
                    const newValue = row[sku]
                    
                    if (oldValue !== newValue && updates[sku]) {
                      hasChanges = true
                      const numValue = typeof newValue === 'string' ? parseFloat(newValue) || 0 : newValue
                      
                      switch (rowKey) {
                        case 'price':
                          updates[sku] = { ...updates[sku], price: numValue }
                          break
                        case 'manufacturingCost':
                          updates[sku] = { ...updates[sku], manufacturingCost: numValue }
                          break
                        case 'freightCost':
                          updates[sku] = { ...updates[sku], freightCost: numValue }
                          break
                        case 'warehouseCost':
                          updates[sku] = { ...updates[sku], warehouseCost: numValue }
                          break
                        case 'fulfillmentFee':
                          updates[sku] = { ...updates[sku], fulfillmentFee: numValue }
                          break
                      }
                    }
                  }
                })
              })
              
              if (hasChanges) {
                setProductData(updates)
              }
            }}
          />
        </CardContent>
      </Card>
    </>
  )
}