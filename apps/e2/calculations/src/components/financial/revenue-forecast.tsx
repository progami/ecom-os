'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { SalesForecastInput } from '@/types/v4/financial'

interface RevenueForecastProps {
  salesForecast: SalesForecastInput[]
  onChange: (forecast: SalesForecastInput[]) => void
}

export function RevenueForecast({ salesForecast, onChange }: RevenueForecastProps) {
  const addSKU = () => {
    const newSKU = `SKU-${Date.now()}`
    const emptyMonths = Array.from({ length: 60 }, (_, i) => ({
      month: i + 1,
      unitsSold: 0,
      ppcSpend: 0,
      retailPrice: 0
    }))
    
    onChange([...salesForecast, { sku: newSKU, monthlySales: emptyMonths }])
  }

  const removeSKU = (sku: string) => {
    onChange(salesForecast.filter(f => f.sku !== sku))
  }

  const updateCellValue = (
    sku: string,
    month: number,
    field: 'unitsSold' | 'ppcSpend' | 'retailPrice',
    value: string
  ) => {
    const numValue = parseFloat(value) || 0
    
    const updated = salesForecast.map(skuForecast => {
      if (skuForecast.sku !== sku) return skuForecast
      
      const updatedMonths = skuForecast.monthlySales.map(m => {
        if (m.month !== month) return m
        return { ...m, [field]: numValue }
      })
      
      return { ...skuForecast, monthlySales: updatedMonths }
    })
    
    onChange(updated)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Revenue Forecast</CardTitle>
            <CardDescription>
              Configure unit sales, pricing, and advertising spend by SKU
            </CardDescription>
          </div>
          <Button onClick={addSKU} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add SKU
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="sticky left-0 bg-background px-4 py-3 text-left text-sm font-medium">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Actions
                </th>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date()
                  date.setMonth(date.getMonth() + i)
                  return (
                    <th key={i} className="px-4 py-3 text-center text-sm font-medium" colSpan={3}>
                      {date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                    </th>
                  )
                })}
              </tr>
              <tr>
                <th className="sticky left-0 bg-background" />
                <th />
                {Array.from({ length: 12 }, (_, i) => (
                  <React.Fragment key={i}>
                    <th className="px-2 py-2 text-xs text-muted-foreground">Units</th>
                    <th className="px-2 py-2 text-xs text-muted-foreground">PPC</th>
                    <th className="px-2 py-2 text-xs text-muted-foreground">Price</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {salesForecast.map((skuForecast) => (
                <tr key={skuForecast.sku}>
                  <td className="sticky left-0 bg-background px-4 py-4">
                    <input
                      type="text"
                      value={skuForecast.sku}
                      onChange={(e) => {
                        const updated = salesForecast.map(f => 
                          f.sku === skuForecast.sku ? { ...f, sku: e.target.value } : f
                        )
                        onChange(updated)
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSKU(skuForecast.sku)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                  {skuForecast.monthlySales.slice(0, 12).map((monthData) => (
                    <React.Fragment key={monthData.month}>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={monthData.unitsSold || ''}
                          onChange={(e) => updateCellValue(
                            skuForecast.sku,
                            monthData.month,
                            'unitsSold',
                            e.target.value
                          )}
                          className="w-20 rounded border border-input bg-background px-2 py-1 text-sm"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={monthData.ppcSpend || ''}
                          onChange={(e) => updateCellValue(
                            skuForecast.sku,
                            monthData.month,
                            'ppcSpend',
                            e.target.value
                          )}
                          className="w-20 rounded border border-input bg-background px-2 py-1 text-sm"
                          placeholder="0"
                          step="0.01"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          value={monthData.retailPrice || ''}
                          onChange={(e) => updateCellValue(
                            skuForecast.sku,
                            monthData.month,
                            'retailPrice',
                            e.target.value
                          )}
                          className="w-20 rounded border border-input bg-background px-2 py-1 text-sm"
                          placeholder="0"
                          step="0.01"
                        />
                      </td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}