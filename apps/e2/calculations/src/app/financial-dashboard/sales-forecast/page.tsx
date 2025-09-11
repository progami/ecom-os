'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  DollarSign,
  TrendingUp,
  Package
} from 'lucide-react'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { LazyUnifiedForecastHotTable } from '@/components/LazyUnifiedForecastHotTable'
import { getWeekNumber, getWeekDateRange, getWeeksInYear } from '@/lib/utils/weekHelpers'
import { useFinancePageData, useUpdateUnitSales } from '@/hooks/useFinancialData'
import { useQueryClient } from '@tanstack/react-query'
import { sortBySkuOrder } from '@/config/sku-order'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { useActiveStrategy } from '@/hooks/useActiveStrategy'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts'

export default function SalesForecastPage() {
  // State for year/quarter navigation  
  const [currentYearState, setCurrentYearState] = useState(2025)
  const [currentQuarterState, setCurrentQuarterState] = useState(4)
  
  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedYear = window.localStorage.getItem('sales-forecast-year')
      const savedQuarter = window.localStorage.getItem('sales-forecast-quarter')
      
      if (savedYear) {
        setCurrentYearState(JSON.parse(savedYear))
      }
      if (savedQuarter) {
        setCurrentQuarterState(JSON.parse(savedQuarter))
      }
    }
  }, [])
  
  const [activeTab, setActiveTab] = useState<'units' | 'revenue' | 'amazon'>('units')
  
  // Wrapper functions to persist to localStorage
  const setCurrentYear = (value: number) => {
    setCurrentYearState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sales-forecast-year', JSON.stringify(value))
    }
  }
  
  const setCurrentQuarter = (value: number) => {
    setCurrentQuarterState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sales-forecast-quarter', JSON.stringify(value))
    }
  }
  
  const queryClient = useQueryClient()
  const { reconciliation, isLoading: reconciliationLoading } = useFinancePageData(currentYearState, currentQuarterState)
  const updateUnitSalesMutation = useUpdateUnitSales()
  const { activeStrategy } = useActiveStrategy()

  const [productData, setProductData] = useState<Record<string, any>>({})
  const [unitSalesData, setUnitSalesData] = useState<any[]>([])
  const [dataVersion, setDataVersion] = useState(0) // Force re-render of tables
  const [amazonExpenses, setAmazonExpenses] = useState<any[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Store ALL changes across ALL quarters in memory - this is one big spreadsheet
  const [allPendingChanges, setAllPendingChanges] = useState<Map<string, any>>(new Map())
  
  // Filter to get changes for current view only
  const pendingChanges = useMemo(() => {
    const changes = new Map()
    allPendingChanges.forEach((change, key) => {
      // Key format: "year-quarter-week-rowId-type"
      const [year, quarter] = key.split('-')
      if (parseInt(year) === currentYearState && parseInt(quarter) === currentQuarterState) {
        changes.set(key, change)
      }
    })
    return changes
  }, [allPendingChanges, currentYearState, currentQuarterState])
  
  const hasChanges = allPendingChanges.size > 0

  // Add visibility change listener to reload data
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Reload product data when page becomes visible
        const productsResponse = await fetch('/api/products')
        if (productsResponse.ok) {
          const productsData = await productsResponse.json()
          const productMap: Record<string, any> = {}
          productsData.forEach((p: any) => {
            productMap[p.sku] = {
              ...p,
              price: Number(p.pricing) || 0
            }
          })
          setProductData(productMap)
          // Force re-render
          setDataVersion(prev => prev + 1)
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Load all data on mount
  useEffect(() => {
    const loadData = async () => {
      console.log('Loading all forecast data...')
      setIsLoading(true)
      
      try {
        // Load ALL unit sales data for ALL years (2025-2030)
        const allUnitSales: any[] = []
        for (let year = 2025; year <= 2030; year++) {
          for (let q = 1; q <= 4; q++) {
            const unitSalesResponse = await fetch(`/api/unit-sales?year=${year}&quarter=${q}`)
            if (unitSalesResponse.ok) {
              const unitSalesJson = await unitSalesResponse.json()
              console.log(`Loaded ${unitSalesJson.unitSales?.length || 0} records for ${year} Q${q}`)
              allUnitSales.push(...(unitSalesJson.unitSales || []))
            }
          }
        }
        console.log(`Total unit sales loaded: ${allUnitSales.length}`)
        setUnitSalesData(allUnitSales)
        setIsInitialized(true)
        
        // Load products ONCE
        const productsResponse = await fetch('/api/products')
        if (productsResponse.ok) {
          const productsData = await productsResponse.json()
          const productMap: Record<string, any> = {}
          productsData.forEach((p: any) => {
            productMap[p.sku] = {
              ...p,
              price: Number(p.pricing) || 0
            }
          })
          setProductData(productMap)
        }
        
        // Load ALL Amazon expenses for ALL years
        const allExpenses: any[] = []
        for (let year = 2025; year <= 2030; year++) {
          for (let q = 1; q <= 4; q++) {
            const expenseResponse = await fetch(`/api/expense-forecast?year=${year}&quarter=${q}`)
            if (expenseResponse.ok) {
              const expenseData = await expenseResponse.json()
              allExpenses.push(...(expenseData.amazonFees || []))
            }
          }
        }
        setAmazonExpenses(allExpenses)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [activeStrategy?.id]) // Only reload on strategy change


  // Generate weeks for the quarter
  const weeks = useMemo(() => {
    const startWeek = (currentQuarterState - 1) * 13 + 1
    const endWeek = Math.min(currentQuarterState * 13, 52)
    const quarterWeeks: number[] = []
    
    for (let w = startWeek; w <= endWeek; w++) {
      quarterWeeks.push(w)
    }
    
    const currentWeekNum = getWeekNumber(new Date())
    const currentDate = new Date()
    
    return quarterWeeks.map(week => {
      const weekRange = getWeekDateRange(currentYearState, week)
      const isCurrentWeek = week === currentWeekNum && currentDate >= weekRange.start && currentDate <= weekRange.end
      const isPastWeek = weekRange.end < currentDate
      
      const formatDate = (date: Date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`
      }
      
      return {
        weekNum: week,
        weekLabel: `W${week}`,
        dateRange: `${formatDate(weekRange.start)} - ${formatDate(weekRange.end)}`,
        isCurrentWeek,
        isPastWeek
      }
    })
  }, [currentYearState, currentQuarterState])

  // Process data for display
  const { salesRows, salesDataByWeek, revenueDataByWeek, amazonRows, amazonDataByWeek } = useMemo(() => {
    const salesData: Record<string, Record<string, number>> = {}
    const revenueData: Record<string, Record<string, number>> = {}
    const amazonData: Record<string, Record<string, number>> = {}
    
    // Process unit sales - current year AND previous year (for fee rollover)
    console.log(`Processing sales for year ${currentYearState}, found ${unitSalesData.length} total records`)
    let matchingRecords = 0
    const prevYearSalesData: Record<string, Record<string, number>> = {}
    
    unitSalesData.forEach((sale: any) => {
      const saleYear = sale.year
      const weekNum = sale.week
      
      // Include sales for the current year we're viewing
      if (saleYear === currentYearState) {
        matchingRecords++
        if (!salesData[weekNum]) salesData[weekNum] = {}
        salesData[weekNum][sale.sku] = sale.units || 0
      }
      // Also include sales from previous year (for fee rollover calculation)
      else if (saleYear === currentYearState - 1) {
        if (!prevYearSalesData[weekNum]) prevYearSalesData[weekNum] = {}
        prevYearSalesData[weekNum][sale.sku] = sale.units || 0
      }
    })
    console.log(`Found ${matchingRecords} records for year ${currentYearState}`)
    
    // Apply ALL pending changes for current quarter from memory
    allPendingChanges.forEach((change, key) => {
      if (change.year === currentYearState && change.quarter === currentQuarterState) {
        if (!salesData[change.week]) salesData[change.week] = {}
        salesData[change.week][change.rowId] = change.value
      }
    })
    
    // Calculate revenue based on updated sales data (with 2 week delay)
    const nextYearQ1Revenue: Record<number, Record<string, number>> = {} // Store overflow revenue for next year
    
    Object.entries(salesData).forEach(([weekNum, skuData]) => {
      const paymentWeek = parseInt(weekNum) + 2 // Revenue arrives 2 weeks later
      if (paymentWeek <= 52) {
        if (!revenueData[paymentWeek]) revenueData[paymentWeek] = {}
        Object.entries(skuData).forEach(([sku, units]) => {
          const product = productData[sku]
          const price = Number(product?.pricing) || 0
          if (!revenueData[paymentWeek][sku]) revenueData[paymentWeek][sku] = 0
          revenueData[paymentWeek][sku] += units * price
        })
      } else {
        // Handle revenue that rolls into next year (weeks 51-52 -> weeks 1-2 of next year)
        const nextYearWeek = paymentWeek - 52
        if (currentYearState < 2030 && currentQuarterState === 4) {
          // Store for potential next year Q1 processing
          if (!nextYearQ1Revenue[nextYearWeek]) nextYearQ1Revenue[nextYearWeek] = {}
          Object.entries(skuData).forEach(([sku, units]) => {
            const product = productData[sku]
            const price = Number(product?.pricing) || 0
            if (!nextYearQ1Revenue[nextYearWeek][sku]) nextYearQ1Revenue[nextYearWeek][sku] = 0
            nextYearQ1Revenue[nextYearWeek][sku] += units * price
          })
        }
      }
    })
    
    // First, process previous year's week 51-53 sales for REVENUE AND FEES that roll into current year Q1
    if (currentYearState > 2025 && currentQuarterState === 1) {
      // Check if previous year has 53 weeks
      const prevYearHas53Weeks = getWeeksInYear(currentYearState - 1) === 53
      const lastWeekOfPrevYear = prevYearHas53Weeks ? 53 : 52
      
      Object.entries(prevYearSalesData).forEach(([weekNum, skuData]) => {
        const week = parseInt(weekNum)
        // Process last 2-3 weeks from previous year
        if (week >= 51) {
          const paymentWeek = week + 2 // Revenue and fees arrive 2 weeks later
          const rolledWeek = paymentWeek - lastWeekOfPrevYear // Roll over to next year
          
          if (rolledWeek >= 1 && rolledWeek <= 3) {
            Object.entries(skuData).forEach(([sku, units]) => {
              const product = productData[sku]
              if (product && units > 0) {
                // Add REVENUE from previous year's sales
                if (!revenueData[rolledWeek]) revenueData[rolledWeek] = {}
                const price = Number(product?.pricing) || 0
                if (!revenueData[rolledWeek][sku]) revenueData[rolledWeek][sku] = 0
                revenueData[rolledWeek][sku] += units * price
                
                // Add FEES from previous year's sales
                if (!amazonData[rolledWeek]) amazonData[rolledWeek] = {}
                
                // FBA Fees - Account 5051
                const fbaFee = (Number(product.fulfillmentFee) || 0) * units
                amazonData[rolledWeek]['5051'] = (amazonData[rolledWeek]['5051'] || 0) + fbaFee
                
                // Referral Fees - Account 5050
                const referralFee = (Number(product.referralFee) || 0) * units
                amazonData[rolledWeek]['5050'] = (amazonData[rolledWeek]['5050'] || 0) + referralFee
              }
            })
          }
        }
      })
    }
    
    // Calculate Amazon expenses by CATEGORY (with 2 week delay for fees)
    // Categories: FBA Fees, Referral Fees, Advertising, AWD Storage
    Object.entries(salesData).forEach(([weekNum, skuData]) => {
      const week = parseInt(weekNum)
      const feeWeek = week + 2 // Fees charged 2 weeks later
      const currentWeek = week // Advertising is immediate
      
      Object.entries(skuData).forEach(([sku, units]) => {
        const product = productData[sku]
        if (product && units > 0) {
          const price = Number(product?.pricing) || 0
          const revenue = units * price
          
          // Determine if current year has 53 weeks (2026 is the only one in our range)
          const currentYearHas53Weeks = currentYearState === 2026
          const lastWeekOfCurrentYear = currentYearHas53Weeks ? 53 : 52
          
          // FBA, Referral Fees, and Refunds (2 week delay) - only add if within current year
          if (feeWeek <= lastWeekOfCurrentYear) {
            if (!amazonData[feeWeek]) amazonData[feeWeek] = {}
            
            // FBA Fees - Account 5051
            const fbaFee = (Number(product.fulfillmentFee) || 0) * units
            amazonData[feeWeek]['5051'] = (amazonData[feeWeek]['5051'] || 0) + fbaFee
            
            // Referral Fees - Account 5050
            const referralFee = (Number(product.referralFee) || 0) * units
            amazonData[feeWeek]['5050'] = (amazonData[feeWeek]['5050'] || 0) + referralFee
            
            // Amazon Refunds - Account 4010 (contra-revenue but shown as expense)
            const refundAmount = (Number(product.refund) || 0) * units
            amazonData[feeWeek]['4010'] = (amazonData[feeWeek]['4010'] || 0) + refundAmount
          }
          // Fees for week 51-53 sales will roll to next year and be handled there
          
          // Advertising & AWD Storage (immediate - current week)
          if (currentWeek <= 52) {
            if (!amazonData[currentWeek]) amazonData[currentWeek] = {}
            
            // Advertising - Account 5310
            const tacos = Number(product.tacos) || 0.12 // 12% TACoS default
            const advertising = revenue * tacos
            amazonData[currentWeek]['5310'] = (amazonData[currentWeek]['5310'] || 0) + advertising
            
            // AWD Storage (immediate) - Account 5032
            const awdFee = (Number(product.awd) || 0) * units
            amazonData[currentWeek]['5032'] = (amazonData[currentWeek]['5032'] || 0) + awdFee
          }
        }
      })
    })
    
    // Create rows for sales (SKUs)
    const sortedRows = sortBySkuOrder(Object.entries(productData))
      .map(([sku, product]: [string, any]) => ({
        id: sku,
        name: sku,
        subtext: `$${Number(product.pricing).toFixed(2)}`
      }))
    
    // Create rows for Amazon expenses using Chart of Accounts
    const amazonCodes = ['5051', '5050', '5310', '5032', '4010'] // FBA, Referral, Advertising, AWD Storage, Amazon Refunds
    const amazonCategoryRows = amazonCodes
      .map(code => ({
        id: code,
        name: CHART_OF_ACCOUNTS[code].name,
        subtext: code
      }))
    
    return {
      salesRows: sortedRows,
      salesDataByWeek: salesData,
      revenueDataByWeek: revenueData,
      amazonRows: amazonCategoryRows,
      amazonDataByWeek: amazonData
    }
  }, [productData, unitSalesData, allPendingChanges, currentYearState, currentQuarterState])

  // Handle cell changes - store with full context
  const handleCellChange = useCallback((changes: Array<{ week: number; rowId: string; value: number }>) => {
    setAllPendingChanges(prev => {
      const updated = new Map(prev)
      changes.forEach(change => {
        // Full key with year, quarter for true persistence
        const key = `${currentYearState}-${currentQuarterState}-${change.week}-${change.rowId}`
        updated.set(key, {
          ...change,
          year: currentYearState,
          quarter: currentQuarterState
        })
      })
      return updated
    })
  }, [currentYearState, currentQuarterState])

  // Save all pending changes across ALL quarters
  const handleSaveAll = useCallback(async () => {
    if (allPendingChanges.size === 0) return
    
    setIsSaving(true)
    
    try {
      // Group changes by year-quarter for batch processing
      const changesByQuarter = new Map()
      allPendingChanges.forEach((change, key) => {
        const quarterKey = `${change.year}-${change.quarter}`
        if (!changesByQuarter.has(quarterKey)) {
          changesByQuarter.set(quarterKey, [])
        }
        changesByQuarter.get(quarterKey).push(change)
      })
      
      // Save each quarter's changes
      for (const [quarterKey, changes] of changesByQuarter) {
        const [year, quarter] = quarterKey.split('-').map(Number)
      
        const response = await fetch('/api/unit-sales', {
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
          throw new Error(`Failed to save changes for ${year} Q${quarter}`)
        }
      }
      
      // Clear pending changes after successful save
      setAllPendingChanges(new Map())
      
      toast.success('Changes saved successfully')
      
      // Reload product data to ensure UI is fresh
      const productsResponse = await fetch('/api/products')
      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        const productMap: Record<string, any> = {}
        productsData.forEach((p: any) => {
          productMap[p.sku] = {
            ...p,
            price: Number(p.pricing) || 0
          }
        })
        setProductData(productMap)
      }
      
      // Force re-render of all tables
      setDataVersion(prev => prev + 1)
    } catch (error) {
      console.error('Error saving changes:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }, [allPendingChanges, activeStrategy])

  // Navigation
  const navigateQuarter = (direction: 'prev' | 'next') => {
    // Don't clear changes - everything stays in memory like Google Sheets
    
    if (direction === 'prev') {
      if (currentQuarterState > 1) {
        setCurrentQuarter(currentQuarterState - 1)
      } else if (currentYearState > 2025) {
        setCurrentYear(currentYearState - 1)
        setCurrentQuarter(4)
      }
    } else {
      if (currentQuarterState < 4) {
        setCurrentQuarter(currentQuarterState + 1)
      } else {
        setCurrentYear(currentYearState + 1)
        setCurrentQuarter(1)
      }
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sales Forecast</h1>
            <p className="text-muted-foreground mt-2">
              Manage sales forecasts and Amazon expenses
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid w-fit grid-cols-3">
              <TabsTrigger value="units" className="px-6">
                <Package className="h-4 w-4 mr-2" />
                Unit Sales
              </TabsTrigger>
              <TabsTrigger value="revenue" className="px-6">
                <DollarSign className="h-4 w-4 mr-2" />
                Revenue
              </TabsTrigger>
              <TabsTrigger value="amazon" className="px-6">
                <TrendingUp className="h-4 w-4 mr-2" />
                Amazon Expenses
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateQuarter('prev')}
                disabled={currentYearState === 2025 && currentQuarterState === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2">
                <Select value={currentYearState.toString()} onValueChange={(v) => setCurrentYear(parseInt(v))}>
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
                
                <Select value={currentQuarterState.toString()} onValueChange={(v) => setCurrentQuarter(parseInt(v))}>
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
                disabled={currentYearState === 2030 && currentQuarterState === 4}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <div className="border-l h-8 mx-2" />
              
              {hasChanges && activeTab === 'units' && (
                <Badge variant="outline" className="text-orange-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {pendingChanges.size} Unsaved Changes
                </Badge>
              )}
              
              {activeTab === 'units' && (
                <Button
                  onClick={handleSaveAll}
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
              )}
            </div>
          </div>

          {reconciliation?.data?.isActive && reconciliation.data.lastReconciledDate && (
            <Alert className="mb-4">
              <CalendarDays className="h-4 w-4" />
              <AlertDescription>
                Data reconciled through {new Date(reconciliation.data.lastReconciledDate).toLocaleDateString()} - 
                historical data before this date is locked
              </AlertDescription>
            </Alert>
          )}

          <TabsContent value="units">
            <div className="space-y-4">
              {!isInitialized || isLoading ? (
                <div className="p-4">
                  <PageSkeleton variant="table" rows={8} />
                </div>
              ) : (
                <LazyUnifiedForecastHotTable
                  key={`units-${currentYearState}-${currentQuarterState}-${unitSalesData.length}-${pendingChanges.size}-${dataVersion}`}
                  weeks={weeks}
                  rows={salesRows}
                  dataByWeek={salesDataByWeek}
                  onCellChange={handleCellChange}
                  immediateMode={false}
                  reconciliationDate={reconciliation?.data?.lastReconciledDate}
                  type="sales"
                  className="w-full"
                />
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="revenue">
            <div className="space-y-4">
              {!isInitialized || isLoading ? (
                <div className="p-4">
                  <PageSkeleton variant="table" rows={8} />
                </div>
              ) : (
                <LazyUnifiedForecastHotTable
                  key={`revenue-${currentYearState}-${currentQuarterState}-${unitSalesData.length}-${pendingChanges.size}-${dataVersion}`}
                  weeks={weeks}
                  rows={salesRows}
                  dataByWeek={revenueDataByWeek}
                  onBatchSave={async () => {}}
                  reconciliationDate={reconciliation?.data?.lastReconciledDate}
                  type="revenue"
                  readOnly={true}
                  className="w-full"
                />
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="amazon">
            <div className="space-y-4">
              {!isInitialized || isLoading ? (
                <div className="p-4">
                  <PageSkeleton variant="table" rows={8} />
                </div>
              ) : (
                <LazyUnifiedForecastHotTable
                  key={`amazon-${currentYearState}-${currentQuarterState}-${pendingChanges.size}-${dataVersion}`}
                  weeks={weeks}
                  rows={amazonRows}
                  dataByWeek={amazonDataByWeek}
                  onBatchSave={async () => {}}
                  reconciliationDate={null}
                  type="expense"
                  readOnly={true}
                  className="w-full"
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}