'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, AlertCircle, Save, Plus, Trash2, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'react-hot-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { LazyUnifiedForecastHotTable } from '@/components/LazyUnifiedForecastHotTable'
import { getWeekNumber, getWeekDateRange } from '@/lib/utils/weekHelpers'
import { useQueryClient } from '@tanstack/react-query'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { useActiveStrategy } from '@/hooks/useActiveStrategy'
import { getAccount, CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts'
import { format } from 'date-fns'

export default function ExpenseForecastPage() {
  // Use consistent initial values for both server and client to avoid hydration issues
  const defaultYear = new Date().getFullYear()
  const defaultQuarter = Math.ceil((new Date().getMonth() + 1) / 3)
  
  // Initialize with default values, then update from localStorage in useEffect
  const [currentYear, setCurrentYearState] = useState(defaultYear)
  const [currentQuarter, setCurrentQuarterState] = useState(defaultQuarter)
  
  // Wrapper functions to persist to localStorage
  const setCurrentYear = (value: number) => {
    setCurrentYearState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('expense-forecast-year', JSON.stringify(value))
    }
  }
  
  const setCurrentQuarter = (value: number) => {
    setCurrentQuarterState(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('expense-forecast-quarter', JSON.stringify(value))
    }
  }
  
  const queryClient = useQueryClient()
  const { activeStrategy } = useActiveStrategy()

  const [expenseData, setExpenseData] = useState<any[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'operating' | 'onetime'>('operating')
  
  // One-time expenses state
  const [onetimeExpenses, setOnetimeExpenses] = useState<any[]>([])
  const [newOnetimeExpense, setNewOnetimeExpense] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    category: '',
    amount: 0
  })
  const [onetimeChanges, setOnetimeChanges] = useState<Map<string, any>>(new Map())
  const [isLoadingOnetime, setIsLoadingOnetime] = useState(false)
  const [dataVersion, setDataVersion] = useState(0) // Force re-render of tables
  
  // Load from localStorage after mount to avoid hydration issues
  useEffect(() => {
    const storedYear = localStorage.getItem('expense-forecast-year')
    const storedQuarter = localStorage.getItem('expense-forecast-quarter')
    
    if (storedYear) {
      try {
        setCurrentYearState(JSON.parse(storedYear))
      } catch {}
    }
    
    if (storedQuarter) {
      try {
        setCurrentQuarterState(JSON.parse(storedQuarter))
      } catch {}
    }
  }, [])
  
  // Store ALL changes across ALL quarters in memory - one big spreadsheet
  const [allPendingChanges, setAllPendingChanges] = useState<Map<string, any>>(new Map())
  
  // Filter to get changes for current view only
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
  
  const hasChanges = allPendingChanges.size > 0
  
  // Page state persistence
  const scrollPositions = useRef<Record<string, number>>({})
  const tabContentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  
  // Load expense data function - loads ALL years/quarters ONCE
  const loadData = useCallback(async () => {
      setIsLoading(true)
      
      try {
        // Load ALL expense data for ALL years (2025-2030)
        const allExpenseData: any[] = []
        for (let year = 2025; year <= 2030; year++) {
          for (let q = 1; q <= 4; q++) {
            const expenseResponse = await fetch(`/api/expense-forecast?year=${year}&quarter=${q}`, {
              cache: 'no-store'
            })
            if (expenseResponse.ok) {
              const data = await expenseResponse.json()
              allExpenseData.push(...(data.expenses || []))
            }
          }
        }
        setExpenseData(allExpenseData)
        setIsInitialized(true)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setIsLoading(false)
      }
  }, [activeStrategy?.id]) // Only reload on strategy change
  
  // Load ALL data ONCE on mount
  useEffect(() => {
    // Skip if already loaded
    if (expenseData.length > 0) return
    loadData()
  }, [activeStrategy?.id]) // Only reload on strategy change
  
  // Load one-time expenses
  const loadOnetimeExpenses = useCallback(async () => {
    setIsLoadingOnetime(true)
    try {
      const response = await fetch(`/api/expense-forecast/onetime?year=${currentYear}`, {
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        setOnetimeExpenses(data.expenses || [])
      }
    } catch (error) {
      console.error('Error loading one-time expenses:', error)
    } finally {
      setIsLoadingOnetime(false)
    }
  }, [currentYear, activeStrategy?.id])
  
  // Add visibility change listener to reload data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reload data when page becomes visible
        loadData()
        setDataVersion(prev => prev + 1)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadData])
  
  // Load one-time expenses when tab changes or year changes
  useEffect(() => {
    if (activeTab === 'onetime') {
      loadOnetimeExpenses()
    }
  }, [activeTab, currentYear, loadOnetimeExpenses])
  
  // Add one-time expense
  const handleAddOnetimeExpense = useCallback(async () => {
    if (!newOnetimeExpense.description || !newOnetimeExpense.category || newOnetimeExpense.amount <= 0) {
      toast.error('Please fill all fields')
      return
    }
    
    try {
      const response = await fetch('/api/expense-forecast/onetime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newOnetimeExpense,
          strategyId: activeStrategy?.id
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to add expense')
      }
      
      // Reset form
      setNewOnetimeExpense({
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        category: '',
        amount: 0
      })
      
      // Reload data
      await loadOnetimeExpenses()
      toast.success('One-time expense added')
    } catch (error) {
      console.error('Error adding one-time expense:', error)
      toast.error('Failed to add expense')
    }
  }, [newOnetimeExpense, activeStrategy?.id, loadOnetimeExpenses])
  
  // Delete one-time expense
  const handleDeleteOnetimeExpense = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return
    
    try {
      const response = await fetch(`/api/expense-forecast/onetime/${id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete expense')
      }
      
      await loadOnetimeExpenses()
      toast.success('Expense deleted')
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast.error('Failed to delete expense')
    }
  }, [loadOnetimeExpenses])
  
  
  // Restore scroll position on mount and tab change
  useEffect(() => {
    // Load saved scroll positions from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('expenseForecast_scrollPositions')
      if (saved) {
        try {
          scrollPositions.current = JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse scroll positions:', e)
        }
      }
      
      // Restore scroll position
      const savedPosition = scrollPositions.current['main'] || 0
      if (savedPosition > 0) {
        // Use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          window.scrollTo(0, savedPosition)
        })
      }
    }
  }, [])
  
  // Save scroll position when scrolling
  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.current['main'] = window.scrollY
      // Also persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('expenseForecast_scrollPositions', JSON.stringify(scrollPositions.current))
      }
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  // Refresh data when page becomes visible (e.g., after switching tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also refresh when window gets focus
    const handleFocus = () => loadData()
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadData])

  // Generate weeks for the selected quarter
  const weeks = useMemo(() => {
    if (!currentYear || !currentQuarter) return []
    
    // Calculate week range for the quarter
    const startWeek = (currentQuarter - 1) * 13 + 1
    const endWeek = Math.min(currentQuarter * 13, 52)
    const quarterWeeks: number[] = []
    for (let w = startWeek; w <= endWeek; w++) {
      quarterWeeks.push(w)
    }
    
    const currentWeekNum = getWeekNumber(new Date())
    const currentDate = new Date()
    
    return quarterWeeks.map(week => {
      const weekRange = getWeekDateRange(currentYear, week)
      const isCurrentWeek = week === currentWeekNum && currentDate >= weekRange.start && currentDate <= weekRange.end
      const isPastWeek = weekRange.end < currentDate
      
      const formatDate = (date: Date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`
      }
      
      return {
        weekNum: week,
        weekLabel: `W${week.toString().padStart(2, '0')}`,
        dateRange: `${formatDate(weekRange.start)} - ${formatDate(weekRange.end)}`,
        isCurrentWeek,
        isPastWeek
      }
    })
  }, [currentYear, currentQuarter])

  // Extract expense categories and prepare data
  const { expenseRows, expenseDataByWeek } = useMemo(() => {
    const dataByWeek: Record<string, Record<string, number>> = {}
    
    // Get operating expense accounts directly from chart of accounts
    // Exclude COGS (5000, 5020-5040), Amazon fees (5050-5052, 5032, 4010), and Advertising (5310)
    const excludedRanges = [
      5000, // Cost of Goods Sold
      { start: 5020, end: 5040 }, // COGS range
      { start: 5050, end: 5052 }, // Amazon fees range
      5032, // Amazon storage AWD
      5310, // Amazon advertising
      4010, // Amazon Refunds (moved to Amazon expenses)
      4011, // Other Refunds (seeded via multi-channel service)
      5720  // Depreciation Expense (not used in our strategy)
    ]
    
    const rowList = Object.entries(CHART_OF_ACCOUNTS)
      .filter(([code, account]) => {
        const codeNum = parseInt(code)
        // Include Office Equipment (1700) even though it's an Asset
        if (code === '1700') return true
        // Only include expense accounts (5xxx)
        if (account.type !== 'Expense') return false
        // Exclude COGS and Amazon-related accounts
        for (const excluded of excludedRanges) {
          if (typeof excluded === 'number') {
            if (codeNum === excluded) return false
          } else {
            if (codeNum >= excluded.start && codeNum <= excluded.end) return false
          }
        }
        return true
      })
      .map(([code, account]) => ({
        id: code,
        name: account.name,
        subtext: code
      }))
    
    // Process expense data - filter by current year and quarter
    expenseData.forEach((expense: any) => {
      const expenseDate = new Date(expense.weekStarting)
      const expenseYear = expenseDate.getFullYear()
      const weekNum = getWeekNumber(expenseDate)
      
      // Only include expenses from the currently selected year
      if (expenseYear !== currentYear) return
      
      // Check if week is in currently selected quarter
      const quarterStartWeek = (currentQuarter - 1) * 13 + 1
      const quarterEndWeek = Math.min(currentQuarter * 13, 52)
      if (weekNum < quarterStartWeek || weekNum > quarterEndWeek) return
      
      if (!dataByWeek[weekNum]) {
        dataByWeek[weekNum] = {}
      }
      // Convert Decimal to number - expense.category is now the GL account code
      dataByWeek[weekNum][expense.category] = parseFloat(expense.amount) || 0
    })
    
    
    return {
      expenseRows: rowList,
      expenseDataByWeek: dataByWeek
    }
  }, [expenseData, currentYear, currentQuarter])

  // Track changes locally without saving - store with full context
  const handleCellChange = useCallback((changes: Array<{ week: number; rowId: string; value: number }>) => {
    setAllPendingChanges(prev => {
      const updated = new Map(prev)
      changes.forEach(change => {
        const key = `${currentYear}-${currentQuarter}-${change.week}-${change.rowId}`
        updated.set(key, {
          ...change,
          year: currentYear,
          quarter: currentQuarter
        })
      })
      return updated
    })
  }, [currentYear, currentQuarter])
  
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
      
        // Call batch API endpoint for this quarter
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
          throw new Error(`Failed to save changes for ${year} Q${quarter}`)
        }
        
        const result = await response.json()
        console.log(`Batch save result for ${year} Q${quarter}:`, result)
      }
      
      // Clear pending changes after successful save
      setAllPendingChanges(new Map())
      
      toast.success('Changes saved successfully')
      
      // Reload data to refresh tables
      await loadData()
      
      // Force re-render of all tables
      setDataVersion(prev => prev + 1)
    } catch (error) {
      console.error('Error saving changes:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }, [allPendingChanges, activeStrategy, loadData])
  

  // Navigation functions
  const navigateQuarter = (direction: 'prev' | 'next') => {
    // Don't clear changes - everything stays in memory like Google Sheets
    
    if (direction === 'prev') {
      // Don't go before 2025 Q1
      if (currentYear === 2025 && currentQuarter === 1) {
        return
      }
      
      if (currentQuarter > 1) {
        setCurrentQuarter(currentQuarter - 1)
      } else {
        setCurrentYear(currentYear - 1)
        setCurrentQuarter(4)
      }
    } else {
      // Don't go beyond 2030 Q4
      if (currentYear === 2030 && currentQuarter === 4) {
        return
      }
      
      if (currentQuarter < 4) {
        setCurrentQuarter(currentQuarter + 1)
      } else {
        setCurrentYear(currentYear + 1)
        setCurrentQuarter(1)
      }
    }
  }


  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expense Forecast</h1>
            <p className="text-muted-foreground mt-2">
              Manage recurring and one-time expense forecasts
            </p>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'operating' | 'onetime')} className="mt-6">
          <TabsList>
            <TabsTrigger value="operating">Operating Expenses</TabsTrigger>
            <TabsTrigger value="onetime">One-time Expenses</TabsTrigger>
          </TabsList>
          
          <TabsContent value="operating" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateQuarter('prev')}
                disabled={!!(currentYear === 2025 && currentQuarter === 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-2">
                <Select value={currentYear.toString()} onValueChange={(v) => {
                  if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to change the year?')) {
                    return
                  }
                  setAllPendingChanges(new Map())
                  setCurrentYear(parseInt(v))
                }}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {[2025, 2026, 2027, 2028, 2029, 2030].map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={currentQuarter.toString()} onValueChange={(v) => {
                  if (hasChanges && !confirm('You have unsaved changes. Are you sure you want to change the quarter?')) {
                    return
                  }
                  setAllPendingChanges(new Map())
                  setCurrentQuarter(parseInt(v))
                }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
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
                disabled={!!(currentYear === 2030 && currentQuarter === 4)}
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
                onClick={handleSaveAll}
                disabled={!!(!hasChanges || isSaving)}
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
          
          <div className="bg-white dark:bg-gray-950 rounded-lg">
            {!isInitialized || isLoading ? (
              // Show skeleton loader while data is loading
              <div className="p-4">
                <PageSkeleton variant="table" rows={8} />
              </div>
            ) : (
              // Only render HotTable when all data is ready
              <LazyUnifiedForecastHotTable
                key={`${currentYear}-${currentQuarter}-${expenseData.length}-${dataVersion}`}
                weeks={weeks}
                rows={expenseRows}
                dataByWeek={expenseDataByWeek}
                onCellChange={handleCellChange}
                immediateMode={false}
                type="expense"
                className="w-full"
              />
            )}
          </div>
          </TabsContent>
          
          <TabsContent value="onetime" className="mt-6">
            <div className="space-y-4">
              {/* Add new expense form */}
              <div className="bg-white dark:bg-gray-950 rounded-lg p-4 border">
                <h3 className="font-semibold mb-4">Add One-time Expense</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Date</label>
                    <Input
                      type="date"
                      value={newOnetimeExpense.date}
                      onChange={(e) => setNewOnetimeExpense({ ...newOnetimeExpense, date: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-1 block">Description</label>
                    <Input
                      placeholder="e.g., Equipment purchase, Consulting fee"
                      value={newOnetimeExpense.description}
                      onChange={(e) => setNewOnetimeExpense({ ...newOnetimeExpense, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Category</label>
                    <Select
                      value={newOnetimeExpense.category}
                      onValueChange={(value) => setNewOnetimeExpense({ ...newOnetimeExpense, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CHART_OF_ACCOUNTS)
                          .filter(([code, account]) => {
                            const codeNum = parseInt(code)
                            // Include Office Equipment (1700) even though it's an Asset
                            if (code === '1700') return true
                            // Only include operating expense accounts
                            if (account.type !== 'Expense') return false
                            // Exclude COGS, Amazon expenses
                            const excludedRanges = [
                              5000, // Cost of Goods Sold
                              { start: 5020, end: 5040 }, // COGS range
                              { start: 5050, end: 5052 }, // Amazon fees range
                              5032, // Amazon storage AWD
                              5310, // Amazon advertising
                              4010, // Amazon Refunds
                              4011, // Other Refunds (seeded via multi-channel service)
                              5720  // Depreciation Expense (not used in our strategy)
                            ]
                            for (const excluded of excludedRanges) {
                              if (typeof excluded === 'number') {
                                if (codeNum === excluded) return false
                              } else {
                                if (codeNum >= excluded.start && codeNum <= excluded.end) return false
                              }
                            }
                            return true
                          })
                          .map(([code, account]) => (
                            <SelectItem key={code} value={code}>
                              {account.name} ({code})
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Amount ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newOnetimeExpense.amount || ''}
                      onChange={(e) => setNewOnetimeExpense({ ...newOnetimeExpense, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Button onClick={handleAddOnetimeExpense}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                </div>
              </div>
              
              {/* Year selector */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Year:</span>
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
                </div>
              </div>
              
              {/* Expenses table */}
              <div className="bg-white dark:bg-gray-950 rounded-lg border">
                {isLoadingOnetime ? (
                  <div className="p-4">
                    <PageSkeleton variant="table" rows={5} />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {onetimeExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No one-time expenses for {currentYear}
                          </TableCell>
                        </TableRow>
                      ) : (
                        onetimeExpenses.map((expense: any) => (
                          <TableRow key={expense.id}>
                            <TableCell>{format(new Date(expense.date), 'MMM dd, yyyy')}</TableCell>
                            <TableCell>{expense.description}</TableCell>
                            <TableCell>
                              {CHART_OF_ACCOUNTS[expense.category]?.name || expense.category} ({expense.category})
                            </TableCell>
                            <TableCell className="text-right">${parseFloat(expense.amount).toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteOnetimeExpense(expense.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}