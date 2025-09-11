'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { LazyUnifiedForecastHotTable } from '@/components/LazyUnifiedForecastHotTable'
import { getWeekNumber, getWeekDateRange } from '@/lib/utils/weekHelpers'
import { calculateInventoryTimeline } from '@/lib/utils/inventoryCalculations'
import { sortBySkuOrder } from '@/config/sku-order'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { useActiveStrategy } from '@/hooks/useActiveStrategy'
import { CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, Save, ChevronLeft, ChevronRight, Package, TrendingUp, DollarSign } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function OrderPlanningPage() {
  const [currentYear, setCurrentYear] = useState(2025)
  const [currentQuarter, setCurrentQuarter] = useState(4)
  const [activeTab, setActiveTab] = useState<'quantities' | 'stock' | 'cogs'>('quantities')
  const { activeStrategy } = useActiveStrategy()
  
  // Data states
  const [products, setProducts] = useState<Record<string, any>>({})
  const [salesData, setSalesData] = useState<any[]>([])
  const [orderData, setOrderData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Track changes - store ALL changes across ALL quarters
  const [allPendingChanges, setAllPendingChanges] = useState<Map<string, any>>(new Map())
  
  // Track Land Freight data and changes separately
  const [originalLandFreightData, setOriginalLandFreightData] = useState<Map<string, number>>(new Map())
  const [landFreightChanges, setLandFreightChanges] = useState<Map<string, number>>(new Map())
  const [dataVersion, setDataVersion] = useState(0) // Force re-render of tables
  
  // Get pending changes for current quarter
  const pendingChanges = useMemo(() => {
    const changes = new Map()
    allPendingChanges.forEach((change, key) => {
      // Key format: "year-quarter-week-rowId"
      const [year, quarter] = key.split('-')
      if (parseInt(year) === currentYear && parseInt(quarter) === currentQuarter) {
        changes.set(key, change)
      }
    })
    return changes
  }, [allPendingChanges, currentYear, currentQuarter])
  
  const hasChanges = allPendingChanges.size > 0 || landFreightChanges.size > 0
  
  
  // Load data function
  const loadData = async () => {
    setIsLoading(true)
    
    try {
      // Load products
      const productsRes = await fetch('/api/products')
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        const productMap: Record<string, any> = {}
        productsData.forEach((p: any) => {
          productMap[p.sku] = {
            ...p,
            price: Number(p.pricing) || 0,
            manufacturing: Number(p.manufacturing) || 0,
            freight: Number(p.freight) || 0,
            tariff: Number(p.tariff) || 0,
            awd: Number(p.awd) || 0,
            currentStock: Number(p.currentStock) || 0  // Add current stock for opening balance
          }
        })
        setProducts(productMap)
      }
      
      // Load ALL sales data for ALL years (2025-2030)
      const allSalesData: any[] = []
      for (let year = 2025; year <= 2030; year++) {
        for (let q = 1; q <= 4; q++) {
          const salesRes = await fetch(`/api/unit-sales?year=${year}&quarter=${q}`)
          if (salesRes.ok) {
            const salesData = await salesRes.json()
            allSalesData.push(...(salesData.unitSales || []))
          }
        }
      }
      setSalesData(allSalesData)
      
      // Load ALL orders data for ALL years
      const allOrdersData: any[] = []
      for (let year = 2025; year <= 2030; year++) {
        for (let q = 1; q <= 4; q++) {
          const ordersRes = await fetch(`/api/order-timeline?year=${year}&quarter=${q}&t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache'
            }
          })
          if (ordersRes.ok) {
            const ordersData = await ordersRes.json()
            allOrdersData.push(...(ordersData.orders || []))
          }
        }
      }
      setOrderData(allOrdersData)
      
      // Load Land Freight expenses (account 5031) for ALL years
      const landFreightData = new Map()
      for (let year = 2025; year <= 2030; year++) {
        for (let q = 1; q <= 4; q++) {
          const expenseRes = await fetch(`/api/expense-forecast?year=${year}&quarter=${q}`)
          if (expenseRes.ok) {
            const expenseJson = await expenseRes.json()
            const expenses = expenseJson.expenses || []
            // Filter for Land Freight (5031)
            expenses.forEach((expense: any) => {
              if (expense.category === '5031') {
                const key = `${year}-${q}-${expense.weekNum}`
                landFreightData.set(key, expense.amount)
              }
            })
          }
        }
      }
      setOriginalLandFreightData(landFreightData)
      
      // Increment version to force re-render
      setDataVersion(prev => prev + 1)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Load data on mount and when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reload data when page becomes visible
        loadData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
  
  // Load data on mount
  useEffect(() => {
    loadData()
  }, []) // Load once on mount
  
  // Generate weeks for the quarter
  const weeks = useMemo(() => {
    const startWeek = (currentQuarter - 1) * 13 + 1
    const endWeek = Math.min(currentQuarter * 13, 52)
    const quarterWeeks: number[] = []
    
    for (let w = startWeek; w <= endWeek; w++) {
      quarterWeeks.push(w)
    }
    
    return quarterWeeks.map(week => {
      const weekRange = getWeekDateRange(currentYear, week)
      const formatDate = (date: Date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`
      }
      
      return {
        weekNum: week,
        weekLabel: `W${week}`,
        dateRange: `${formatDate(weekRange.start)} - ${formatDate(weekRange.end)}`,
        isCurrentWeek: false,
        isPastWeek: false
      }
    })
  }, [currentYear, currentQuarter])
  
  // Process data for display
  const { rows, orderQuantities, weeksOfStock, cogsData, cogsRows } = useMemo(() => {
    // Create rows from products
    const sortedRows = sortBySkuOrder(Object.entries(products))
      .map(([sku, product]: [string, any]) => ({
        id: sku,
        name: sku,
        subtext: `${product.price.toFixed(2)}`
      }))
    
    // Build order quantities map - need ALL data for inventory tracking
    const allOrderQuantitiesByYear: Record<number, Record<string, Record<string, number>>> = {}
    
    // First add saved orders
    orderData.forEach((order: any) => {
      const orderYear = order.year
      const weekNum = order.week
      
      if (!allOrderQuantitiesByYear[orderYear]) allOrderQuantitiesByYear[orderYear] = {}
      if (!allOrderQuantitiesByYear[orderYear][weekNum]) allOrderQuantitiesByYear[orderYear][weekNum] = {}
      allOrderQuantitiesByYear[orderYear][weekNum][order.sku] = order.quantity || 0
    })
    
    // Then apply ALL pending changes
    allPendingChanges.forEach((change, key) => {
      const year = change.year
      const week = change.week
      
      if (!allOrderQuantitiesByYear[year]) allOrderQuantitiesByYear[year] = {}
      if (!allOrderQuantitiesByYear[year][week]) allOrderQuantitiesByYear[year][week] = {}
      allOrderQuantitiesByYear[year][week][change.rowId] = change.value
    })
    
    // Get quantities for current year display
    const allOrderQuantities = allOrderQuantitiesByYear[currentYear] || {}
    
    // Extract quantities for current quarter display
    const quantities: Record<string, Record<string, number>> = {}
    weeks.forEach(week => {
      if (allOrderQuantities[week.weekNum]) {
        quantities[week.weekNum] = allOrderQuantities[week.weekNum]
      }
    })
    
    // Build sales map BY YEAR AND WEEK
    const allSalesDataByYear: Record<number, Record<string, Record<string, number>>> = {}
    salesData.forEach((sale: any) => {
      const year = sale.year
      const weekNum = sale.week
      
      if (!allSalesDataByYear[year]) allSalesDataByYear[year] = {}
      if (!allSalesDataByYear[year][weekNum]) allSalesDataByYear[year][weekNum] = {}
      allSalesDataByYear[year][weekNum][sale.sku] = sale.units || 0
    })
    
    // Get sales for current year (for backward compatibility with rest of code)
    const sales = allSalesDataByYear[currentYear] || {}
    
    // Calculate weeks of stock for each SKU/week with CORRECT logic order
    const stock: Record<string, Record<string, number>> = {}
    
    sortedRows.forEach(row => {
      const sku = row.id
      const product = products[sku]
      if (!product) return
      
      // START WITH OPENING BALANCE (current stock from product)
      const openingBalance = product.currentStock || 0
      
      // Calculate running inventory from 2025 W1 all the way to current year/quarter
      let runningInventory = openingBalance
      
      // Process ALL years from 2025 to current year
      for (let year = 2025; year < currentYear; year++) {
        // Process all weeks of each prior year (2026 has 53 weeks)
        const maxWeeks = year === 2026 ? 53 : 52
        for (let w = 1; w <= maxWeeks; w++) {
          // Get orders for that specific year
          const orderQty = allOrderQuantitiesByYear[year]?.[w]?.[sku] || 0
          
          // Get sales for that specific year
          const salesQty = allSalesDataByYear[year]?.[w]?.[sku] || 0
          
          runningInventory += orderQty
          runningInventory -= salesQty
        }
      }
      
      // Now process current year up to current quarter
      const startWeek = (currentQuarter - 1) * 13 + 1
      for (let w = 1; w < startWeek; w++) {
        // Get orders from allOrderQuantities (includes saved + pending)
        const orderQty = allOrderQuantities[w]?.[sku] || 0
        
        // Get sales from loaded data for current year
        const salesQty = allSalesDataByYear[currentYear]?.[w]?.[sku] || 0
        
        runningInventory += orderQty
        runningInventory -= salesQty
      }
      
      // Now process current quarter week by week
      weeks.forEach(week => {
        const weekNum = week.weekNum
        
        // Add THIS week's order (arrives at start of week)
        const orderQty = allOrderQuantities[weekNum]?.[sku] || 0
        runningInventory += orderQty
        
        // Calculate inventory at start of week (after receiving order)
        let currentInventory = runningInventory
        
        // Subtract THIS week's sales at END of week
        const weekSales = allSalesDataByYear[currentYear]?.[weekNum]?.[sku] || 0
        runningInventory -= weekSales
        
        // Validation: warn about negative inventory (overselling) - commented out to reduce noise
        // if (currentInventory < 0) {
        //   console.warn(`⚠️ Negative inventory detected for ${sku} in week ${weekNum}: ${currentInventory} units`)
        // }
        
        // Calculate weeks of stock - SIMPLE: inventory / weekly sales
        if (!stock[weekNum]) stock[weekNum] = {}
        
        // weekSales already calculated above (line 307)
        if (currentInventory <= 0) {
          // No inventory - don't show weeks of stock
          // Leave it undefined (blank cell)
        } else if (weekSales <= 0) {
          // Inventory but no sales - show "∞" or a high number to indicate infinite stock
          stock[weekNum][sku] = 999 // Show as 999 weeks (effectively infinite)
        } else {
          // Simple division: current inventory / weekly sales
          const weeksOfCoverage = currentInventory / weekSales
          
          // Round to 1 decimal place
          const rounded = Math.round(weeksOfCoverage * 10) / 10
          stock[weekNum][sku] = rounded
        }
      })
    })
    
    // Calculate COGS by account (independent of inventory tracking)
    const cogs: Record<string, Record<string, number>> = {}
    weeks.forEach(week => {
      const weekNum = week.weekNum
      if (!cogs[weekNum]) cogs[weekNum] = {}
      
      // Initialize COGS accounts
      cogs[weekNum]['5020'] = 0 // Manufacturing
      cogs[weekNum]['5030'] = 0 // Freight & Custom Duty
      cogs[weekNum]['5031'] = 0 // Land Freight (only when inventory ordered, editable)
      cogs[weekNum]['5040'] = 0 // VAT/Tariffs
      
      sortedRows.forEach(row => {
        const sku = row.id
        const product = products[sku]
        if (!product) return
        
        const orderQty = quantities[weekNum]?.[sku] || 0
        if (orderQty > 0) {
          // Manufacturing goes to account 5020
          const manufacturingCost = orderQty * product.manufacturing
          cogs[weekNum]['5020'] += Math.round(manufacturingCost)
          
          // Freight goes to account 5030
          const freightCost = orderQty * product.freight
          cogs[weekNum]['5030'] += Math.round(freightCost)
          
          // Tariff goes to account 5040
          const tariffCost = orderQty * product.tariff
          cogs[weekNum]['5040'] += Math.round(tariffCost)
        }
      })
      
      // Add Land Freight - check for user changes first, then original data, then default $0
      const landFreightKey = `${currentYear}-${currentQuarter}-${weekNum}`
      const userLandFreight = landFreightChanges.get(landFreightKey)
      const originalLandFreight = originalLandFreightData.get(landFreightKey)
      cogs[weekNum]['5031'] = userLandFreight !== undefined ? userLandFreight : 
                              originalLandFreight !== undefined ? originalLandFreight : 0
    })
    
    // Create rows for COGS accounts
    const cogsRows = [
      { 
        id: '5020', 
        name: CHART_OF_ACCOUNTS['5020'].name, 
        subtext: '5020'
      },
      { 
        id: '5030', 
        name: CHART_OF_ACCOUNTS['5030'].name, 
        subtext: '5030'
      },
      { 
        id: '5031', 
        name: CHART_OF_ACCOUNTS['5031'].name, 
        subtext: '5031'
      },
      { 
        id: '5040', 
        name: CHART_OF_ACCOUNTS['5040'].name, 
        subtext: '5040'
      }
    ]
    
    return {
      rows: sortedRows,
      orderQuantities: quantities,
      weeksOfStock: stock,
      cogsData: cogs,
      cogsRows
    }
  }, [products, orderData, salesData, allPendingChanges, originalLandFreightData, landFreightChanges, currentYear, currentQuarter, weeks])
  
  // Handle order quantity changes
  const handleOrderChange = useCallback((changes: Array<{ week: number; rowId: string; value: number }>) => {
    setAllPendingChanges(prev => {
      const updated = new Map(prev)
      changes.forEach(change => {
        const key = `${currentYear}-${currentQuarter}-${change.week}-${change.rowId}`
        if (change.value === 0) {
          // If value is 0, we want to delete the order
          updated.set(key, { ...change, value: 0, year: currentYear, quarter: currentQuarter })
        } else {
          updated.set(key, { ...change, year: currentYear, quarter: currentQuarter })
        }
      })
      console.log('Updated pending changes:', updated.size, 'items')
      return updated
    })
  }, [currentYear, currentQuarter])
  
  // Handle COGS changes (only Land Freight is editable)
  const handleCogsChange = useCallback((changes: Array<{ week: number; rowId: string; value: number }>) => {
    setLandFreightChanges(prev => {
      const updated = new Map(prev)
      changes.forEach(change => {
        // Only allow changes to Land Freight (5031)
        if (change.rowId === '5031') {
          const key = `${currentYear}-${currentQuarter}-${change.week}`
          updated.set(key, change.value)
        }
      })
      return updated
    })
  }, [currentYear, currentQuarter])
  
  // Save changes to database
  const handleSave = useCallback(async () => {
    if (allPendingChanges.size === 0 && landFreightChanges.size === 0) return
    
    setIsSaving(true)
    
    try {
      // Save order changes
      if (allPendingChanges.size > 0) {
        // Group changes by year and quarter for batch saving
        const changesByQuarter = new Map()
        allPendingChanges.forEach((change, key) => {
          const quarterKey = `${change.year}-${change.quarter}`
          if (!changesByQuarter.has(quarterKey)) {
            changesByQuarter.set(quarterKey, [])
          }
          changesByQuarter.get(quarterKey).push(change)
        })
        
        // Save all quarters
        for (const [quarterKey, changes] of changesByQuarter) {
          const [year, quarter] = quarterKey.split('-').map(Number)
          
          console.log('Saving order changes:', {
            year,
            quarter,
            strategyId: activeStrategy?.id,
            changes
          })
          
          const response = await fetch('/api/order-timeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              changes,
              year,
              quarter,
              strategyId: activeStrategy?.id
            })
          })
          
          if (!response.ok) {
            const errorText = await response.text()
            console.error(`Failed to save changes for ${year} Q${quarter}:`, errorText)
            throw new Error(`Failed to save changes for ${year} Q${quarter}: ${errorText}`)
          }
        }
      }
      
      // Save Land Freight changes
      if (landFreightChanges.size > 0) {
        // Convert Land Freight changes to expense API format
        const expenseChanges: any[] = []
        landFreightChanges.forEach((value, key) => {
          const [year, quarter, week] = key.split('-').map(Number)
          expenseChanges.push({
            week,
            rowId: '5031',
            value,
            year,
            quarter
          })
        })
        
        // Group by quarter and save
        const expensesByQuarter = new Map()
        expenseChanges.forEach(change => {
          const quarterKey = `${change.year}-${change.quarter}`
          if (!expensesByQuarter.has(quarterKey)) {
            expensesByQuarter.set(quarterKey, [])
          }
          expensesByQuarter.get(quarterKey).push(change)
        })
        
        for (const [quarterKey, changes] of expensesByQuarter) {
          const [year, quarter] = quarterKey.split('-').map(Number)
          
          const response = await fetch('/api/expense-forecast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              changes,
              year,
              quarter,
              strategyId: activeStrategy?.id
            })
          })
          
          if (!response.ok) {
            const errorText = await response.text()
            console.error(`Failed to save Land Freight for ${year} Q${quarter}:`, errorText)
            throw new Error(`Failed to save Land Freight for ${year} Q${quarter}: ${errorText}`)
          }
        }
      }
      
      // Clear pending changes after successful save
      setAllPendingChanges(new Map())
      
      // Move saved land freight changes to original data
      const updatedOriginalData = new Map(originalLandFreightData)
      landFreightChanges.forEach((value, key) => {
        updatedOriginalData.set(key, value)
      })
      setOriginalLandFreightData(updatedOriginalData)
      setLandFreightChanges(new Map())
      
      toast.success('All changes saved successfully')
      
      // Reload data to refresh tables
      await loadData()
      
      // Force re-render of all tables
      setDataVersion(Date.now())
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }, [allPendingChanges, landFreightChanges, originalLandFreightData, activeStrategy?.id, loadData])
  
  // Navigation
  const navigateQuarter = (direction: 'prev' | 'next') => {
    // Don't clear changes - they persist across quarters like a big spreadsheet
    
    if (direction === 'prev') {
      if (currentQuarter > 1) {
        setCurrentQuarter(currentQuarter - 1)
      } else if (currentYear > 2025) {
        setCurrentYear(currentYear - 1)
        setCurrentQuarter(4)
      }
    } else {
      if (currentQuarter < 4) {
        setCurrentQuarter(currentQuarter + 1)
      } else {
        setCurrentYear(currentYear + 1)
        setCurrentQuarter(1)
      }
    }
  }
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <PageSkeleton />
      </DashboardLayout>
    )
  }
  
  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Order Planning</h1>
            <p className="text-muted-foreground mt-2">
              Manage order quantities, inventory levels, and cost of goods sold
            </p>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid w-fit grid-cols-3">
              <TabsTrigger value="quantities" className="px-6">
                <Package className="h-4 w-4 mr-2" />
                Order Quantities
              </TabsTrigger>
              <TabsTrigger value="stock" className="px-6">
                <TrendingUp className="h-4 w-4 mr-2" />
                Weeks of Stock
              </TabsTrigger>
              <TabsTrigger value="cogs" className="px-6">
                <DollarSign className="h-4 w-4 mr-2" />
                Cost of Goods Sold
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateQuarter('prev')}
                disabled={currentYear === 2025 && currentQuarter === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2">
                <Select value={currentYear.toString()} onValueChange={(v) => setCurrentYear(parseInt(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2025, 2026, 2027, 2028, 2029, 2030].map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={currentQuarter.toString()} onValueChange={(v) => setCurrentQuarter(parseInt(v))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(q => (
                      <SelectItem key={q} value={q.toString()}>
                        Q{q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateQuarter('next')}
                disabled={currentYear === 2030 && currentQuarter === 4}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="border-l h-8 mx-2" />
              
              {hasChanges && (
                <Badge variant="outline" className="text-orange-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {pendingChanges.size} Unsaved Changes
                </Badge>
              )}
              
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                variant={hasChanges ? "default" : "outline"}
              >
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <TabsContent value="quantities">
            <div className="space-y-4">
              <LazyUnifiedForecastHotTable
                key={`orders-${currentYear}-${currentQuarter}-${pendingChanges.size}-${dataVersion}`}
                weeks={weeks}
                rows={rows}
                dataByWeek={orderQuantities}
                onCellChange={handleOrderChange}
                immediateMode={true}
                reconciliationDate={null}
                type="orders"
                className="w-full"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="stock">
            <div className="space-y-4">
              <LazyUnifiedForecastHotTable
                key={`stock-${currentYear}-${currentQuarter}-${pendingChanges.size}-${dataVersion}`}
                weeks={weeks}
                rows={rows}
                dataByWeek={weeksOfStock}
                onBatchSave={async () => {}}
                reconciliationDate={null}
                type="stock"
                readOnly={true}
                className="w-full"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="cogs">
            <div className="space-y-4">
              <LazyUnifiedForecastHotTable
                key={`cogs-${currentYear}-${currentQuarter}-${landFreightChanges.size}-${dataVersion}`}
                weeks={weeks}
                rows={cogsRows}
                dataByWeek={cogsData}
                onCellChange={handleCogsChange}
                immediateMode={true}
                reconciliationDate={null}
                type="expense"
                readOnly={false}
                editableRows={['5031']}  // Only Land Freight is editable
                className="w-full"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}