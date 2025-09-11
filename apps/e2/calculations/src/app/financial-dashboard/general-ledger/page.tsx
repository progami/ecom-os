'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Search, Filter, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Upload, FileText, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import ClientGLService from '@/lib/services/ClientGLService'
import ClientBankReconciliationService from '@/lib/services/ClientBankReconciliationService'
import ClientCutoffDateService from '@/lib/services/ClientCutoffDateService'
import ClientForecastDefinitionService, { GeneratedForecast } from '@/lib/services/ClientForecastDefinitionService'
import ClientRevenueService from '@/lib/services/ClientRevenueService'
import { CHART_OF_ACCOUNTS, getAccount } from '@/lib/chart-of-accounts'
import { getCategoryAccount } from '@/lib/category-account-mapping'
import { Badge } from '@/components/ui/badge'
import { generateWeekArray, getWeekLabel, getMonthFromWeek } from '@/lib/utils/weekHelpers'
import { format } from 'date-fns'
import { formatDateShort } from '@/lib/utils/dateFormatters'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { MultiSelect } from '@/components/ui/multi-select'
import { PageSkeleton } from '@/components/ui/page-skeleton'

const clientGLService = ClientGLService.getInstance()
const bankReconciliationService = ClientBankReconciliationService.getInstance()
const cutoffDateService = ClientCutoffDateService.getInstance()
const forecastService = ClientForecastDefinitionService.getInstance()
const revenueService = ClientRevenueService.getInstance()

interface GLEntry {
  date: Date
  description: string | any  // Allow any for now to fix type errors
  accountCode: string | any  // Allow any for now to fix type errors
  accountName: string
  accountCategory: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense' | any  // Allow any for compatibility
  amount: number
  runningBalance: number
  isProjection: boolean
  isReconciled: boolean
  source: 'bank' | 'system' | 'forecast' | 'manual' | string  // Allow manual and other sources
}

export default function GeneralLedgerPage() {
  const [entries, setEntries] = useState<GLEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<GLEntry[]>([])
  const [searchQuery, setSearchQuery] = useLocalStorage('gl-search-query', '')
  const [categoryFilter, setCategoryFilter] = useLocalStorage<string[]>('gl-category-filter', [])
  const [dateFilter, setDateFilter] = useLocalStorage('gl-date-filter', 'all')
  const [accountFilter, setAccountFilter] = useLocalStorage<string[]>('gl-account-filter', [])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [cutoffDate, setCutoffDate] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Bank statement upload states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastReconciledDate, setLastReconciledDate] = useState<Date | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Year selection for filtering - default to current year
  const [selectedYear, setSelectedYear] = useLocalStorage('gl-selected-year', new Date().getFullYear())
  const currentYear = new Date().getFullYear()
  const weeks = useMemo(() => generateWeekArray(selectedYear), [selectedYear])
  
  // Load cutoff date on component mount
  useEffect(() => {
    const loadCutoffDate = async () => {
      try {
        const date = await cutoffDateService.getActiveCutoffDate()
        setCutoffDate(date)
        setLastReconciledDate(date)
      } catch (error) {
        console.error('Error loading cutoff date:', error)
      }
    }
    loadCutoffDate()
  }, [])

  // Generate GL entries from actuals and forecasts
  const processGLEntries = async () => {
    setIsLoading(true)
    try {
      const glEntries: GLEntry[] = []
      const todayDate = new Date()
      
      // Get cutoff date from service
      const effectiveCutoff = await cutoffDateService.getActiveCutoffDate()
      
      // Define year boundaries
      const yearStart = new Date(selectedYear, 0, 1)
      const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999)
      
      // Load ONLY entries for the selected year from GL data service
      const actualEntries = await clientGLService.getGLEntries(yearStart, yearEnd)
      
      // Process actual entries - skip bank account entries
      const historicalEntries = actualEntries
        .filter(entry => {
          // Skip bank account entries (1000) as they're just the other side of double-entry
          // This cuts the data in half and improves performance
          return entry.accountCode !== '1000'
        })
        .map(entry => {
          // Determine source and reconciliation status
          const entryDate = new Date(entry.date)
          const actualSource = entry.source || 'unknown'
          const isUnitSales = actualSource === 'unit-sales'
          const isBankEntry = actualSource === 'bank'
          const isReconciled = entryDate <= effectiveCutoff && isBankEntry
          
          // Determine the display source
          let displaySource: 'bank' | 'system' | 'forecast'
          if (isUnitSales) {
            displaySource = 'system'
          } else if (isBankEntry) {
            displaySource = 'bank'
          } else {
            displaySource = 'system' // Default for other actual entries
          }
          
          // Raw API returns 'account' not 'accountCode'
          const accountCode = entry.account || entry.accountCode || 'UNKNOWN'
          const account = getAccount(accountCode)
          
          // Calculate amount from debit/credit based on account type
          let amount = 0
          if (entry.debit !== undefined && entry.credit !== undefined) {
            // Raw entries have debit/credit fields
            const debit = Number(entry.debit) || 0
            const credit = Number(entry.credit) || 0
            
            // Determine amount based on CHART OF ACCOUNTS, not database category
            // This fixes the issue where Amazon Refunds (4010) has wrong category in DB
            const chartAccount = CHART_OF_ACCOUNTS[accountCode]
            if (chartAccount) {
              // Use chart of accounts type, not database category
              if (chartAccount.type === 'Revenue') {
                amount = credit  // Revenue credits are positive (money in)
              } else if (chartAccount.type === 'Expense') {
                amount = -debit  // Expense debits are negative (money out)
              } else if (chartAccount.type === 'Asset') {
                // For assets in cash flow view
                if (accountCode === '1000') {
                  // Cash account: show actual flow
                  amount = debit - credit
                } else {
                  amount = debit - credit  // Other assets: debit increases
                }
              } else if (chartAccount.type === 'Liability' || chartAccount.type === 'Equity') {
                amount = credit - debit  // Credits increase liabilities/equity
              }
            } else {
              // Fallback to database category if account not in chart
              if (entry.accountCategory === 'Revenue') {
                amount = credit
              } else if (entry.accountCategory === 'Expense') {
                amount = -debit
              } else if (entry.accountCategory === 'Asset') {
                amount = debit - credit
              } else if (entry.accountCategory === 'Liability' || entry.accountCategory === 'Equity') {
                amount = credit - debit
              } else {
                amount = credit - debit
              }
            }
          } else if (entry.amount !== undefined) {
            // Transformed entries already have amount
            amount = Number(entry.amount) || 0
          }
          
          // Check if entry is after current week (should be marked as forecast)
          const currentDate = new Date()
          const currentWeekStart = new Date(currentDate)
          const day = currentWeekStart.getDay()
          const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1) // Get Monday
          currentWeekStart.setDate(diff)
          currentWeekStart.setHours(0, 0, 0, 0)
          
          const currentWeekEnd = new Date(currentWeekStart)
          currentWeekEnd.setDate(currentWeekStart.getDate() + 6) // Get Sunday
          currentWeekEnd.setHours(23, 59, 59, 999)
          
          const isFutureWeek = entryDate > currentWeekEnd
          
          return {
            date: entryDate,
            description: entry.description,
            accountCode: accountCode,
            accountName: account?.name || 'Unknown Account',
            accountCategory: (entry.accountCategory || entry.accountType || 'Expense') as any,
            amount: amount,
            runningBalance: 0,
            isProjection: isFutureWeek, // Mark future weeks as projections
            isReconciled: isReconciled,
            source: isFutureWeek ? 'forecast' : displaySource
          }
        })
      
      glEntries.push(...historicalEntries)
      
      // Generate expense forecasts starting from cutoff + 1, but only for selected year
      const forecastStartDate = await cutoffDateService.getForecastStartDate()
      const forecastEndDate = yearEnd < new Date('2030-12-31') ? yearEnd : new Date('2030-12-31')
      const expenseForecasts = await forecastService.generateForecasts(forecastStartDate, forecastEndDate)
      
      // Convert expense forecasts to GL entries - filter by selected year
      const expenseForecastEntries = expenseForecasts
        .filter(forecast => {
          const forecastDate = new Date(forecast.date)
          return forecastDate >= yearStart && forecastDate <= yearEnd
        })
        .map(forecast => {
        const account = getAccount(forecast.accountCode)
        // Extract category name from description if account not found
        const categoryName = forecast.description.split(' - ')[0] || forecast.category || forecast.accountCode
        return {
          date: forecast.date,
          description: forecast.description,
          accountCode: forecast.accountCode,
          accountName: account?.name || categoryName,
          accountCategory: 'Expense' as const,
          amount: forecast.amount,
          runningBalance: 0,
          isProjection: true, // ALL forecasts are projections, not just future ones
          isReconciled: false,
          source: 'forecast' as const
        }
      })
      
      glEntries.push(...expenseForecastEntries)
      
      // Revenue entries are already in the GL database from unit sales
      // No need to generate them separately - that would create duplicates!
      
      // Sort by date
      glEntries.sort((a, b) => a.date.getTime() - b.date.getTime())
      
      // Don't calculate running balance - it's meaningless in double-entry bookkeeping
      // Each transaction has both debit and credit entries that cancel out
      
      setEntries(glEntries)
      setFilteredEntries(glEntries)
      setLastUpdated(new Date())
      
    } catch (error) {
      console.error('Error processing GL entries:', error)
      toast.error('Failed to load GL entries')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Process entries on mount and when cutoff date or selected year changes
  useEffect(() => {
    if (cutoffDate) {
      processGLEntries()
    }
  }, [cutoffDate, selectedYear])
  
  // Filter entries based on search and filters
  useEffect(() => {
    let filtered = [...entries]
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(entry => 
        entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.accountCode.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Category filter (multi-select) - empty array means show all
    if (categoryFilter.includes('__NONE_SELECTED__')) {
      filtered = [] // Show nothing
    } else if (categoryFilter.length > 0) {
      filtered = filtered.filter(entry => categoryFilter.includes(entry.accountCategory))
    }
    
    // Account filter (multi-select) - empty array means show all
    if (accountFilter.includes('__NONE_SELECTED__')) {
      filtered = [] // Show nothing
    } else if (accountFilter.length > 0) {
      filtered = filtered.filter(entry => accountFilter.includes(entry.accountCode))
    }
    
    // Date filter
    if (dateFilter !== 'all') {
      const [year, week] = dateFilter.split('-W')
      const weekStart = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      
      filtered = filtered.filter(entry => 
        entry.date >= weekStart && entry.date <= weekEnd
      )
    }
    
    setFilteredEntries(filtered)
  }, [searchQuery, categoryFilter, dateFilter, accountFilter, entries])
  
  // Process bank statement file
  const processBankStatementFile = async (file: File) => {
    if (!file) {
      return
    }
    
    setIsProcessing(true)
    
    try {
      const text = await file.text()
      
      // Use the bank reconciliation service to process the statement
      const summary = await bankReconciliationService.processBankStatement(text, file.name)
      
      console.log(`Bank statement processed: ${summary.totalTransactions} transactions, ${summary.newEntriesCreated} new entries created`)
      
      // Update cutoff date from service
      const newCutoffDate = await cutoffDateService.getActiveCutoffDate()
      setCutoffDate(newCutoffDate)
      setLastReconciledDate(newCutoffDate)
      
      // Refresh GL entries
      await processGLEntries()
      
      // Clear file selection
      setUploadedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      // Format date properly to avoid timezone issues
      const formattedDate = formatDateShort(newCutoffDate)
      toast.success(`Successfully processed ${summary.totalTransactions} transactions. Cutoff date updated to ${formattedDate}.`)
      
    } catch (error) {
      console.error('Error processing bank statement:', error)
      toast.error(`Processing failed: ${error instanceof Error ? error.message : 'Failed to process bank statement'}`);
    } finally {
      setIsProcessing(false)
    }
  }


  // Handle adding new expense
  // Export to CSV
  const exportToCSV = async () => {
    const headers = ['Date', 'Description', 'Account', 'Account Code', 'Category', 'Amount', 'Source']
    const rows = filteredEntries.map(entry => [
      entry.date.toISOString().split('T')[0],
      entry.description,
      entry.accountName,
      entry.accountCode,
      entry.accountCategory,
      (entry.amount || 0).toFixed(2),
      entry.source === 'bank' ? 'Bank Import' :
        entry.source === 'manual' ? 'Manual Entry' :
        'System Forecast'
    ])
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    
    try {
      const response = await fetch('/api/reports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: csv,
          filename: 'general-ledger.csv',
          format: 'csv',
          strategyName: 'E2 Conservative'
        })
      })
      
      const result = await response.json()
      if (result.success) {
        // Show success notification with green toast
        const toast = document.createElement('div')
        toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-bottom-5'
        toast.textContent = `General Ledger saved to: ${result.message}`
        document.body.appendChild(toast)
        
        setTimeout(() => {
          toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-5')
          setTimeout(() => document.body.removeChild(toast), 200)
        }, 3000)
      } else {
        // Fallback to download if API fails
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'general-ledger.csv'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error saving CSV to server:', error)
      // Fallback to download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'general-ledger.csv'
      a.click()
      URL.revokeObjectURL(url)
    }
  }
  
  // Get unique categories and accounts for filters
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(entries.map(e => e.accountCategory)))
    return uniqueCategories.sort()
  }, [entries])
  
  const accounts = useMemo(() => {
    const uniqueAccounts = new Map<string, string>()
    entries.forEach(e => {
      if (!uniqueAccounts.has(e.accountCode)) {
        // Only add accounts that have proper names (not just the code repeated)
        // Skip entries where the name is just the code or "Unknown Account"
        if (e.accountName && e.accountName !== e.accountCode && e.accountName !== 'Unknown Account') {
          uniqueAccounts.set(e.accountCode, e.accountName)
        }
      }
    })
    return Array.from(uniqueAccounts.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([code, name]) => ({ code, name }))
  }, [entries])
  
  // Calculate summary metrics
  const summary = useMemo(() => {
    // Use chart of accounts to determine account type, not the database category
    // This ensures Amazon Refunds (4010) is counted as an expense (COGS)
    const revenueEntries = entries.filter(e => {
      const account = CHART_OF_ACCOUNTS[e.accountCode]
      return account && account.type === 'Revenue'
    })
    const totalRevenue = revenueEntries.reduce((sum, e) => {
      // For revenue accounts, use the absolute value
      return sum + Math.abs(e.amount)
    }, 0)
    
    const expenseEntries = entries.filter(e => {
      const account = CHART_OF_ACCOUNTS[e.accountCode]
      return account && account.type === 'Expense'
    })
    const totalExpenses = expenseEntries.reduce((sum, e) => sum + Math.abs(e.amount), 0)
    
    // Debug: Check if 4010 is included
    const refundEntries = entries.filter(e => e.accountCode === '4010')
    const refundTotal = refundEntries.reduce((sum, e) => sum + Math.abs(e.amount), 0)
    console.log('GL Page Summary Debug:')
    console.log('  4010 entries found:', refundEntries.length)
    console.log('  4010 total amount:', refundTotal)
    console.log('  Total expenses (should include 4010):', totalExpenses)
    
    // Amazon-related expenses - specifically Amazon platform fees and services
    // These are fees charged by Amazon for using their platform:
    // - 5050: Amazon Seller Fees (Referral fee - typically 15% of sales)
    // - 5051: Amazon FBA Fees (Fulfillment fees per unit)
    // - 5032: Storage AWD (Amazon Warehousing & Distribution)
    // - 5310: Amazon Advertising
    // - 4010: Amazon Refunds (customer returns and refunds)
    const amazonExpenses = expenseEntries.filter(e => 
      e.accountCode === '5050' || // Amazon Seller Fees (Referral)
      e.accountCode === '5051' || // Amazon FBA Fees
      e.accountCode === '5032' || // Storage AWD (Amazon storage)
      e.accountCode === '5310' || // Amazon Advertising
      e.accountCode === '4010'    // Amazon Refunds
    ).reduce((sum, e) => sum + Math.abs(e.amount), 0)
    
    // Cost of Goods Sold (COGS) - Direct costs of producing/acquiring products
    const cogsExpenses = expenseEntries.filter(e => 
      e.accountCode === '5000' ||  // Cost of Goods Sold (general)
      e.accountCode === '5020' ||  // Manufacturing
      e.accountCode === '5030' ||  // Ocean Freight
      e.accountCode === '5040'     // Tariffs
    ).reduce((sum, e) => sum + Math.abs(e.amount), 0)
    
    // Operating Expenses (payroll, rent, utilities, etc.)
    // These are expenses that are NOT COGS and NOT Amazon-specific
    const operatingExpenses = expenseEntries.filter(e => {
      const code = e.accountCode
      
      // Exclude COGS accounts
      if (code === '5000' || code === '5020' || code === '5030' || code === '5040') {
        return false
      }
      
      // Exclude Amazon-specific accounts
      if (code === '5050' || code === '5051' || code === '5032' || 
          code === '5310' || code === '4010') {
        return false
      }
      
      // Everything else is operating expenses
      return true
    }).reduce((sum, e) => sum + Math.abs(e.amount), 0)
    
    // For backward compatibility, keep recurringExpenses as an alias
    const recurringExpenses = operatingExpenses
    
    const netIncome = totalRevenue - totalExpenses
    const actualEntries = entries.filter(e => !e.isProjection)
    const projectedEntries = entries.filter(e => e.isProjection)
    
    // By definition, everything that's not COGS or Amazon is Operating Expenses
    // So there should be no "Other Expenses"
    const otherExpenses = 0
    
    // Verify the totals match
    const calculatedTotal = cogsExpenses + amazonExpenses + operatingExpenses
    if (Math.abs(totalExpenses - calculatedTotal) > 0.01) {
      console.warn('Expense categorization mismatch:', {
        total: totalExpenses,
        cogs: cogsExpenses,
        amazon: amazonExpenses,
        operating: operatingExpenses,
        sum: calculatedTotal,
        difference: totalExpenses - calculatedTotal
      })
    }
    
    // Count revenue and expense entries
    const revenueEntryCount = entries.filter(e => {
      const account = CHART_OF_ACCOUNTS[e.accountCode]
      return account && account.type === 'Revenue'
    }).length
    
    const expenseEntryCount = expenseEntries.length
    
    return {
      totalRevenue,
      totalExpenses,
      amazonExpenses,
      cogsExpenses,
      operatingExpenses,
      recurringExpenses, // Kept for compatibility
      otherExpenses,
      netIncome,
      actualCount: actualEntries.length,
      projectedCount: projectedEntries.length,
      revenueCount: revenueEntryCount,
      expenseCount: expenseEntryCount
    }
  }, [entries])
  
  return (
    <DashboardLayout>
      <div className="p-8">
        {isLoading ? (
          <PageSkeleton variant="table" />
        ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">General Ledger</h1>
            <p className="text-muted-foreground">Complete financial transaction history</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedYear(selectedYear - 1)}
                disabled={selectedYear <= 2025}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
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
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedYear(selectedYear + 1)}
                disabled={selectedYear >= 2030}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {cutoffDate && (
              <div className="text-sm text-muted-foreground mx-2">
                <span>Reconciled: {format(cutoffDate, 'MMM dd, yyyy')}</span>
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Bank Statement
            </Button>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${(summary.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {summary.revenueCount || 0} entries
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">COGS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ${(summary.cogsExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {(summary.totalExpenses || 0) > 0 ? `${(((summary.cogsExpenses || 0) / (summary.totalExpenses || 1)) * 100).toFixed(1)}% of expenses` : 'Manufacturing, Inventory'}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Marketplace Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                ${(summary.amazonExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {(summary.totalExpenses || 0) > 0 ? `${(((summary.amazonExpenses || 0) / (summary.totalExpenses || 1)) * 100).toFixed(1)}% of expenses` : 'FBA, Referral, Storage'}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Operating Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                ${(summary.operatingExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {(summary.totalExpenses || 0) > 0 ? `${(((summary.operatingExpenses || 0) / (summary.totalExpenses || 1)) * 100).toFixed(1)}% of expenses` : 'Payroll, Rent, Utilities'}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ${(summary.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {summary.expenseCount || 0} entries
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(summary.netIncome || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${(summary.netIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {(summary.totalRevenue || 0) > 0 ? `${(((summary.netIncome || 0) / (summary.totalRevenue || 1)) * 100).toFixed(1)}% margin` : ((summary.netIncome || 0) >= 0 ? 'Profit' : 'Loss')}
              </div>
            </CardContent>
          </Card>
        </div>
        
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <MultiSelect
            options={accounts.map(account => ({
              value: account.code,
              label: account.name
            }))}
            selected={accountFilter}
            onChange={setAccountFilter}
            placeholder="All Accounts"
            className="w-[250px]"
          />
          <MultiSelect
            options={categories.map(category => ({
              value: category,
              label: category
            }))}
            selected={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="All Types"
            className="w-[200px]"
          />
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              {weeks.map(week => {
                const weekMatch = week.match(/(\d{4})-W(\d{2})/)
                if (!weekMatch) return null
                const year = parseInt(weekMatch[1])
                const weekNum = parseInt(weekMatch[2])
                return (
                  <SelectItem key={week} value={week}>
                    {`W${weekNum} - ${getMonthFromWeek(weekNum, year)}`}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
        
        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              Showing {filteredEntries.length} of {entries.length} entries
              {lastUpdated && ` • Last updated: ${format(lastUpdated, 'MMM dd, yyyy HH:mm')}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2 text-left text-sm font-medium min-w-[100px]">Date</th>
                    <th className="p-2 text-left text-sm font-medium">Description</th>
                    <th className="p-2 text-left text-sm font-medium">Account</th>
                    <th className="p-2 text-left text-sm font-medium">Code</th>
                    <th className="p-2 text-left text-sm font-medium">Category</th>
                    <th className="p-2 text-right text-sm font-medium">Amount</th>
                    <th className="p-2 text-left text-sm font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        {entries.length === 0 ? (
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="h-8 w-8 text-gray-400" />
                            <p className="text-lg font-medium">No transactions found</p>
                            <p className="text-sm">Upload a bank statement to get started or wait for data to load</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Search className="h-8 w-8 text-gray-400" />
                            <p className="text-lg font-medium">No matching transactions</p>
                            <p className="text-sm">Try adjusting your filters or search query</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                  filteredEntries.map((entry, index) => (
                    <tr key={index} className={`border-b ${entry.isProjection ? 'bg-gray-50 opacity-70' : ''}`}>
                      <td className="p-2 text-sm whitespace-nowrap">{formatDateShort(entry.date)}</td>
                      <td className="p-2 text-sm">{entry.description}</td>
                      <td className="p-2 text-sm">{entry.accountName}</td>
                      <td className="p-2 text-sm">
                        <span className="text-xs text-muted-foreground">
                          {entry.accountCode?.length > 3 ? entry.accountCode : entry.accountCode?.padStart(3, '0')}
                        </span>
                      </td>
                      <td className="p-2 text-sm">
                        <span className={`text-xs font-medium ${
                          entry.accountCategory === 'Asset' ? 'text-blue-600' :
                          entry.accountCategory === 'Liability' ? 'text-orange-600' :
                          entry.accountCategory === 'Revenue' ? 'text-green-600' :
                          entry.accountCategory === 'Expense' ? 'text-red-600' :
                          'text-gray-600'
                        }`}>
                          {entry.accountCategory}
                        </span>
                      </td>
                      <td className="p-2 text-sm text-right font-mono">
                        {(entry.amount || 0) < 0 ? 
                          `(${Math.abs(entry.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` :
                          (entry.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        }
                      </td>
                      <td className="p-2 text-sm">
                        <span className="text-xs text-muted-foreground">
                          {entry.source === 'bank' ? 'Bank Import' :
                           entry.source === 'manual' ? 'Manual Entry' :
                           'System Forecast'}
                        </span>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              setUploadedFile(file)
              processBankStatementFile(file)
            }
          }}
        />
        </div>
        )}
      </div>
    </DashboardLayout>
  )
}