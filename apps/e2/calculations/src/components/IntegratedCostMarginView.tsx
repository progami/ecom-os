'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, TrendingDown, DollarSign, Package, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { CostTimeline } from './CostTimeline'

interface BatchCostPeriod {
  id: string
  sku: string
  startDate: string
  endDate: string | null
  manufacturingCost: number
  freightCost: number
  tariffCost: number
  otherCost: number
  unitLandedCost: number
  notes: string | null
  source: string | null
  isActive: boolean
}

interface Product {
  name: string
  price: number
  warehouseCost: number
  fulfillmentFee: number
  manufacturingCost?: number
}

interface IntegratedCostMarginViewProps {
  productData: Record<string, Product>
}

export function IntegratedCostMarginView({ productData }: IntegratedCostMarginViewProps) {
  const [selectedSku, setSelectedSku] = useState<string>('TS-007')
  const [periods, setPeriods] = useState<BatchCostPeriod[]>([])
  const [marginComparison, setMarginComparison] = useState<any[]>([])
  const [products, setProducts] = useState<Record<string, any>>({})

  useEffect(() => {
    // Load products from API
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products?format=dashboard')
        if (!response.ok) {
          throw new Error('Failed to fetch products')
        }
        const productsData = await response.json()
        setProducts(productsData)
        loadAllData(productsData)
      } catch (error) {
        console.error('Failed to load products:', error)
      }
    }
    loadProducts()
  }, [])

  const loadAllData = async (productsData: Record<string, any>) => {
    try {
      // Load periods for all SKUs
      const allPeriods: BatchCostPeriod[] = []
      for (const sku of Object.keys(productsData)) {
        const response = await fetch(`/api/batch-cost-periods?sku=${sku}`)
        const data = await response.json()
        allPeriods.push(...data)
      }
      setPeriods(allPeriods)
      
      // Calculate margin comparison
      calculateMarginComparison(allPeriods)
    } catch (err) {
      console.error('Error loading data:', err)
    }
  }

  const calculateMarginComparison = (allPeriods: BatchCostPeriod[]) => {
    const comparison: any[] = []
    
    for (const [sku, product] of Object.entries(productData)) {
      const skuPeriods = allPeriods.filter(p => p.sku === sku).sort((a, b) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      )
      
      if (skuPeriods.length === 0) continue
      
      // Current period (most recent active)
      const currentPeriod = skuPeriods.find(p => {
        const now = new Date()
        const start = new Date(p.startDate)
        const end = p.endDate ? new Date(p.endDate) : new Date('2099-12-31')
        return now >= start && now <= end
      }) || skuPeriods[0]
      
      // Calculate margins for current period
      const currentTotalCost = currentPeriod.unitLandedCost + product.warehouseCost + 
                              product.fulfillmentFee + (product.price * 0.16) // Amazon fees
      const currentMargin = ((product.price - currentTotalCost) / product.price) * 100
      const currentProfit = product.price - currentTotalCost
      
      // Find next period if exists
      const nextPeriod = skuPeriods.find(p => new Date(p.startDate) > new Date())
      let nextMargin = null
      let marginChange = null
      
      if (nextPeriod) {
        const nextTotalCost = nextPeriod.unitLandedCost + product.warehouseCost + 
                             product.fulfillmentFee + (product.price * 0.16)
        nextMargin = ((product.price - nextTotalCost) / product.price) * 100
        marginChange = nextMargin - currentMargin
      }
      
      comparison.push({
        sku,
        productName: product.name,
        price: product.price,
        currentPeriod: {
          landedCost: currentPeriod.unitLandedCost,
          margin: currentMargin,
          profit: currentProfit,
          source: currentPeriod.source || 'Standard'
        },
        nextPeriod: nextPeriod ? {
          date: new Date(nextPeriod.startDate),
          landedCost: nextPeriod.unitLandedCost,
          margin: nextMargin,
          marginChange,
          source: nextPeriod.source
        } : null,
        periodsCount: skuPeriods.length
      })
    }
    
    setMarginComparison(comparison)
  }

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Margin Overview</TabsTrigger>
        <TabsTrigger value="timeline">Cost Timeline</TabsTrigger>
      </TabsList>

      {/* Margin Overview Tab */}
      <TabsContent value="overview" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Product Margins by Cost Period</CardTitle>
            <CardDescription>
              Current margins and upcoming changes based on cost periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Current Cost</TableHead>
                  <TableHead>Current Margin</TableHead>
                  <TableHead>Next Change</TableHead>
                  <TableHead>Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marginComparison.map((item) => (
                  <TableRow 
                    key={item.sku} 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedSku(item.sku)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.sku}</div>
                        <div className="text-sm text-muted-foreground">{item.productName}</div>
                      </div>
                    </TableCell>
                    <TableCell>${item.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <div>
                        <div>${item.currentPeriod.landedCost.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{item.currentPeriod.source}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          item.currentPeriod.margin > 30 ? 'default' : 
                          item.currentPeriod.margin > 20 ? 'secondary' : 
                          'destructive'
                        }>
                          {item.currentPeriod.margin.toFixed(1)}%
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          ${item.currentPeriod.profit.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.nextPeriod ? (
                        <div>
                          <div className="text-sm">
                            {format(item.nextPeriod.date, 'MMM dd')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ${item.nextPeriod.landedCost.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No changes</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.nextPeriod && (
                        <div className="flex items-center gap-1">
                          {item.nextPeriod.marginChange > 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span className={
                            item.nextPeriod.marginChange > 0 ? 'text-green-600' : 'text-red-600'
                          }>
                            {item.nextPeriod.marginChange > 0 ? '+' : ''}
                            {item.nextPeriod.marginChange.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Average Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {marginComparison.length > 0 
                  ? (marginComparison.reduce((sum, item) => sum + item.currentPeriod.margin, 0) / marginComparison.length).toFixed(1)
                  : '0.0'}%
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Products with Upcoming Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {marginComparison.filter(item => item.nextPeriod).length}
              </div>
              <div className="text-sm text-muted-foreground">
                of {marginComparison.length} products
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Next Cost Change</CardTitle>
            </CardHeader>
            <CardContent>
              {marginComparison.some(item => item.nextPeriod) ? (
                <div>
                  <div className="text-lg font-bold">
                    {format(
                      Math.min(...marginComparison
                        .filter(item => item.nextPeriod)
                        .map(item => item.nextPeriod.date.getTime())
                      ),
                      'MMM dd, yyyy'
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No changes scheduled</div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Cost Timeline Tab */}
      <TabsContent value="timeline" className="space-y-6">
        <div className="mb-6">
          <Select value={selectedSku} onValueChange={setSelectedSku}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a product" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(productData).map(([sku, product]) => (
                <SelectItem key={sku} value={sku}>
                  {sku} - {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CostTimeline selectedSku={selectedSku} productData={productData} />
      </TabsContent>
    </Tabs>
  )
}