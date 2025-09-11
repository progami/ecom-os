'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Package,
  CreditCard,
  Wallet,
  FileText,
  Copy,
  ChevronDown
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts'
import ClientGLService from '@/lib/services/ClientGLService'
import { CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts'
import clientLogger from '@/utils/clientLogger'
import { calculateInventoryFromData } from '@/lib/utils/clientInventoryCalculation'
import { PageSkeleton } from '@/components/ui/page-skeleton'

type TimeframeOption = 'monthly' | 'quarterly' | 'yearly'

interface FinancialMetrics {
  accounts: { [accountCode: string]: number }
  totalRevenue: number
  totalCOGS: number
  totalAmazon: number
  totalOperating: number
  grossProfit: number
  netIncome: number
  inventoryChange?: number
  contributionsChange?: number
  distributionsChange?: number
}

interface PeriodData {
  [period: string]: FinancialMetrics
}

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            <span className="font-medium">{entry.name}:</span>{' '}
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(entry.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Metric card component
const MetricCard = ({ 
  title, 
  value, 
  change, 
  icon: Icon,
  color = 'blue'
}: {
  title: string
  value: number
  change?: number
  icon: React.ElementType
  color?: 'blue' | 'green' | 'purple' | 'orange'
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200'
  }

  return (
    <div className={`p-6 rounded-xl border ${colorClasses[color]} bg-opacity-50 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between mb-4">
        <Icon className="h-8 w-8 opacity-80" />
        {change !== undefined && (
          <div className={`flex items-center text-sm font-medium ${
            change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {change > 0 ? <ArrowUpRight className="h-4 w-4" /> : 
             change < 0 ? <ArrowDownRight className="h-4 w-4" /> : 
             <Minus className="h-4 w-4" />}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value)}
      </p>
    </div>
  )
}

export default function ComprehensiveReportsPage() {
  const [periodData, setPeriodData] = useState<PeriodData>({})
  const [retainedEarningsByPeriod, setRetainedEarningsByPeriod] = useState<Record<string, number>>({})
  const [activeStrategy, setActiveStrategy] = useState<any>(null)
  
  // Initialize with default values (no localStorage check during SSR)
  const [timeframe, setTimeframe] = useState<TimeframeOption>('yearly')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Load saved values from localStorage after mount
  useEffect(() => {
    const savedTimeframe = localStorage.getItem('reports-timeframe')
    const savedYear = localStorage.getItem('reports-selectedYear')
    const savedTab = localStorage.getItem('reports-activeTab')
    
    if (savedTimeframe) {
      setTimeframe(savedTimeframe as TimeframeOption)
    }
    if (savedYear) {
      setSelectedYear(parseInt(savedYear))
    }
    if (savedTab) {
      setActiveTab(savedTab)
    }
  }, [])
  
  const [inventoryData, setInventoryData] = useState<Record<string, number>>({})
  
  // Persist state changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reports-timeframe', timeframe)
    }
  }, [timeframe])
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reports-selectedYear', selectedYear.toString())
    }
  }, [selectedYear])
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('reports-activeTab', activeTab)
    }
  }, [activeTab])
  
  const getAccountsByType = (type: string, subtype?: string) => {
    return Object.values(CHART_OF_ACCOUNTS).filter(account => {
      if (subtype) {
        return account.type === type && account.subtype === subtype
      }
      return account.type === type
    }).sort((a, b) => a.code.localeCompare(b.code))
  }

  useEffect(() => {
    generateReports()
  }, [timeframe, selectedYear])

  const generateReports = async () => {
    setLoading(true)
    const glService = ClientGLService.getInstance()
    
    try {
      const strategyResponse = await fetch('/api/strategies/active')
      const { strategy } = await strategyResponse.json()
      
      if (!strategy) {
        console.error('No active strategy found')
        return
      }
      
      setActiveStrategy(strategy)

      let startDate: Date
      let endDate: Date
      
      if (timeframe === 'yearly') {
        startDate = new Date(2025, 0, 1)
        endDate = new Date(2030, 11, 31)
      } else {
        startDate = new Date(selectedYear, 0, 1)
        endDate = new Date(selectedYear, 11, 31)
      }
      
      const periodEntries = await glService.getGLEntries(startDate, endDate)
      const cumulativeEntries = await glService.getGLEntries(null, endDate)
      
      // Fetch unit sales for all years (needed for inventory calculations)
      let unitSales: any[] = []
      if (timeframe === 'yearly') {
        // Fetch all years 2025-2030
        for (let year = 2025; year <= 2030; year++) {
          const yearSalesResponse = await fetch(`/api/unit-sales?year=${year}`)
          const yearSalesData = await yearSalesResponse.json()
          if (yearSalesData.unitSales) {
            unitSales = [...unitSales, ...yearSalesData.unitSales]
          }
        }
      } else {
        // For quarterly/monthly views, fetch the selected year and any prior years for historical inventory
        for (let year = 2025; year <= selectedYear; year++) {
          const yearSalesResponse = await fetch(`/api/unit-sales?year=${year}`)
          const yearSalesData = await yearSalesResponse.json()
          if (yearSalesData.unitSales) {
            unitSales = [...unitSales, ...yearSalesData.unitSales]
          }
        }
      }
      
      console.log(`Fetched ${unitSales.length} unit sales records`)
      
      const data: PeriodData = {}
      
      if (timeframe === 'yearly') {
        for (let year = 2025; year <= 2030; year++) {
          data[year.toString()] = createEmptyMetrics()
        }
      } else if (timeframe === 'quarterly') {
        for (let q = 1; q <= 4; q++) {
          data[`Q${q} ${selectedYear}`] = createEmptyMetrics()
        }
      } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        for (let m = 0; m < 12; m++) {
          data[`${months[m]} ${selectedYear}`] = createEmptyMetrics()
        }
      }
      
      // Process income statement accounts
      periodEntries.forEach(entry => {
        const entryDate = new Date(entry.date)
        const year = entryDate.getFullYear()
        const month = entryDate.getMonth()
        const quarter = Math.ceil((month + 1) / 3)
        
        let period: string
        if (timeframe === 'yearly') {
          period = year.toString()
        } else if (timeframe === 'quarterly') {
          if (year !== selectedYear) return
          period = `Q${quarter} ${year}`
        } else {
          if (year !== selectedYear) return
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          period = `${months[month]} ${year}`
        }
        
        if (!data[period]) return
        
        const metrics = data[period]
        
        let accountCode = 'UNKNOWN'
        // Handle both 'account' and 'accountCode' fields
        const accountField = entry.account || entry.accountCode
        if (accountField) {
          if (accountField.includes(' - ')) {
            accountCode = accountField.split(' - ')[0]
          } else {
            accountCode = accountField
          }
        }
        
        const account = CHART_OF_ACCOUNTS[accountCode]
        if (!account) return
        
        if (account.type !== 'Revenue' && account.type !== 'Expense') return
        
        let amount = 0
        // Handle both formats: debit/credit and amount field
        if (entry.amount !== undefined) {
          // New format with single amount field - negative for revenue
          amount = Math.abs(Number(entry.amount) || 0)
        } else {
          // Old format with debit/credit
          if (account.type === 'Revenue') {
            amount = Number(entry.credit) || 0
          } else if (account.type === 'Expense') {
            // Special handling for contra-COGS account (5025) which has credits
            if (accountCode === '5025') {
              amount = -(Number(entry.credit) || 0) + (Number(entry.debit) || 0)
            } else {
              amount = Number(entry.debit) || 0
            }
          }
        }
        
        if (amount === 0 && accountCode !== '5025') return
        
        if (!metrics.accounts[accountCode]) {
          metrics.accounts[accountCode] = 0
        }
        metrics.accounts[accountCode] += amount
      })
      
      // Process balance sheet accounts
      Object.keys(data).forEach(period => {
        const metrics = data[period]
        
        let periodEndDate: Date
        if (timeframe === 'yearly') {
          const year = parseInt(period)
          periodEndDate = new Date(year, 11, 31)
        } else if (timeframe === 'quarterly') {
          const quarter = parseInt(period.split('Q')[1])
          periodEndDate = new Date(selectedYear, quarter * 3 - 1, 30)
        } else {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const monthIndex = months.indexOf(period.split(' ')[0])
          periodEndDate = new Date(selectedYear, monthIndex + 1, 0)
        }
        
        cumulativeEntries.forEach(entry => {
          const entryDate = new Date(entry.date)
          if (entryDate > periodEndDate) return
          
          let accountCode = 'UNKNOWN'
          // Handle both 'account' and 'accountCode' fields
          const accountField = entry.account || entry.accountCode
          if (accountField) {
            if (accountField.includes(' - ')) {
              accountCode = accountField.split(' - ')[0]
            } else {
              accountCode = accountField
            }
          }
          
          const account = CHART_OF_ACCOUNTS[accountCode]
          if (!account) return
          
          if (account.type !== 'Asset' && account.type !== 'Liability' && account.type !== 'Equity') return
          
          let amount = 0
          // Handle both formats: debit/credit and amount field
          if (entry.amount !== undefined) {
            // New format with single amount field
            amount = Number(entry.amount) || 0
          } else {
            // Old format with debit/credit
            if (account.type === 'Asset') {
              amount = (Number(entry.debit) || 0) - (Number(entry.credit) || 0)
            } else if (account.type === 'Liability' || account.type === 'Equity') {
              amount = (Number(entry.credit) || 0) - (Number(entry.debit) || 0)
            }
          }
          
          if (amount === 0) return
          
          if (!metrics.accounts[accountCode]) {
            metrics.accounts[accountCode] = 0
          }
          metrics.accounts[accountCode] += amount
        })
      })
      
      // Calculate derived metrics
      Object.entries(data).forEach(([period, metrics]) => {
        metrics.totalRevenue = 0
        metrics.totalCOGS = 0
        metrics.totalAmazon = 0
        metrics.totalOperating = 0
        
        Object.entries(metrics.accounts).forEach(([code, amount]) => {
          const account = CHART_OF_ACCOUNTS[code]
          if (account) {
            if (account.type === 'Revenue') {
              metrics.totalRevenue += Math.abs(amount)
            } else if (account.type === 'Expense') {
              if (account.subtype === 'COGS') {
                // For COGS, we need actual amounts (not abs) to handle inventory adjustment credits
                // Credits (negative amounts) reduce COGS for unsold inventory
                metrics.totalCOGS += amount
              } else if (account.subtype === 'Marketplace Expenses') {
                metrics.totalAmazon += Math.abs(amount)
              } else if (account.subtype === 'Operating Expense') {
                metrics.totalOperating += Math.abs(amount)
              }
            }
          }
        })
        
        metrics.grossProfit = metrics.totalRevenue - metrics.totalCOGS - metrics.totalAmazon
        metrics.netIncome = metrics.grossProfit - metrics.totalOperating
      })
      
      setPeriodData(data)
      
      // Calculate inventory with proper historical tracking
      const inventoryCalcs: Record<string, number> = {}
      let runningInventory = 0
      
      // Sort periods chronologically
      const sortedPeriods = Object.keys(data).sort((a, b) => {
        if (timeframe === 'yearly') {
          return parseInt(a) - parseInt(b)
        } else if (timeframe === 'quarterly') {
          const qA = parseInt(a.split('Q')[1])
          const qB = parseInt(b.split('Q')[1])
          return qA - qB
        } else {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          return months.indexOf(a.split(' ')[0]) - months.indexOf(b.split(' ')[0])
        }
      })
      
      // Calculate historical inventory if not starting from Q4 2025
      const firstPeriod = sortedPeriods[0]
      const needsHistoricalInventory = (() => {
        if (timeframe === 'yearly') {
          return parseInt(firstPeriod) > 2025
        } else if (timeframe === 'quarterly') {
          if (selectedYear > 2025) return true
          if (selectedYear === 2025) {
            const quarter = parseInt(firstPeriod.split('Q')[1])
            return quarter > 4
          }
          return false
        } else { // monthly
          if (selectedYear > 2025) return true
          if (selectedYear === 2025) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const monthIndex = months.indexOf(firstPeriod.split(' ')[0])
            return monthIndex > 9 // After October (index 9)
          }
          return false
        }
      })()
      
      if (needsHistoricalInventory) {
        // Calculate inventory from Q4 2025 to just before the first period
        let histPeriodStart = new Date(2025, 9, 1) // Oct 1, 2025
        let histPeriodEnd: Date
        
        if (timeframe === 'yearly') {
          const firstYear = parseInt(firstPeriod)
          // For yearly view, calculate from Q4 2025 through end of previous year
          histPeriodEnd = new Date(firstYear - 1, 11, 31)
        } else if (timeframe === 'quarterly') {
          const quarter = parseInt(firstPeriod.split('Q')[1])
          if (selectedYear === 2025) {
            // This shouldn't happen as Q4 2025 is the start
            histPeriodEnd = new Date(2025, 11, 31)
          } else {
            // Calculate through end of previous quarter
            if (quarter === 1) {
              histPeriodEnd = new Date(selectedYear - 1, 11, 31)
            } else {
              histPeriodEnd = new Date(selectedYear, (quarter - 1) * 3 - 1, 30)
            }
          }
        } else { // monthly
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const monthIndex = months.indexOf(firstPeriod.split(' ')[0])
          if (selectedYear === 2025 && monthIndex > 9) {
            // Within 2025, calculate Oct-Nov if starting from Dec
            histPeriodEnd = new Date(2025, monthIndex - 1, 30)
          } else if (selectedYear > 2025) {
            // Calculate through end of previous month
            if (monthIndex === 0) {
              histPeriodEnd = new Date(selectedYear - 1, 11, 31)
            } else {
              histPeriodEnd = new Date(selectedYear, monthIndex - 1, 30)
            }
          } else {
            histPeriodEnd = new Date(2025, 11, 31)
          }
        }
        
        // Filter historical entries and sales
        const historicalEntries = cumulativeEntries.filter(e => {
          const entryDate = new Date(e.date)
          return entryDate >= histPeriodStart && entryDate <= histPeriodEnd
        })
        
        const historicalSales = (unitSales || []).filter((sale: any) => {
          const saleDate = new Date(sale.weekStarting)
          return saleDate >= histPeriodStart && saleDate <= histPeriodEnd
        })
        
        // Calculate historical inventory
        const histInvCalc = calculateInventoryFromData(
          historicalEntries,
          historicalSales,
          histPeriodStart,
          histPeriodEnd,
          0 // Always start from 0 in Q4 2025
        )
        
        runningInventory = histInvCalc.endingInventory
        console.log(`Historical inventory from Q4 2025 to ${histPeriodEnd.toISOString().split('T')[0]}: $${runningInventory.toFixed(2)}`)
      }
      
      // Now calculate inventory for each period in the view
      for (const period of sortedPeriods) {
        let periodStart: Date, periodEnd: Date
        
        if (timeframe === 'yearly') {
          const year = parseInt(period)
          periodStart = new Date(year, 0, 1)
          periodEnd = new Date(year, 11, 31)
        } else if (timeframe === 'quarterly') {
          const quarter = parseInt(period.split('Q')[1])
          periodStart = new Date(selectedYear, (quarter - 1) * 3, 1)
          periodEnd = new Date(selectedYear, quarter * 3 - 1, 30)
        } else {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const monthIndex = months.indexOf(period.split(' ')[0])
          periodStart = new Date(selectedYear, monthIndex, 1)
          periodEnd = new Date(selectedYear, monthIndex + 1, 0)
        }
        
        // Filter entries and sales for this specific period
        const periodEntries = cumulativeEntries.filter(e => {
          const entryDate = new Date(e.date)
          return entryDate >= periodStart && entryDate <= periodEnd
        })
        
        const periodSales = (unitSales || []).filter((sale: any) => {
          const saleDate = new Date(sale.weekStarting)
          return saleDate >= periodStart && saleDate <= periodEnd
        })
        
        const invCalc = calculateInventoryFromData(
          periodEntries,
          periodSales,
          periodStart,
          periodEnd,
          runningInventory
        )
        
        inventoryCalcs[period] = invCalc.endingInventory
        runningInventory = invCalc.endingInventory
      }
      
      setInventoryData(inventoryCalcs)
      
      // Calculate retained earnings
      let cumulativeNetIncome = 0
      let previousInventory = 0
      let previousContributions = 0
      let previousDistributions = 0
      
      Object.keys(data).forEach(period => {
        // Use actual GL account balance for inventory, not calculated value
        const currentInventory = data[period].accounts['1200'] || 0
        const inventoryChange = currentInventory - previousInventory
        
        data[period].inventoryChange = inventoryChange
        
        const currentContributions = data[period].accounts['3000'] || 0
        const currentDistributions = data[period].accounts['3950'] || 0
        
        data[period].contributionsChange = currentContributions - previousContributions
        data[period].distributionsChange = currentDistributions - previousDistributions
        
        const adjustedNetIncome = data[period].netIncome + inventoryChange
        cumulativeNetIncome += adjustedNetIncome
        
        // DO NOT set accounts['3900'] here - retained earnings is calculated correctly later
        // data[period].accounts['3900'] = cumulativeNetIncome
        
        previousInventory = currentInventory
        previousContributions = currentContributions
        previousDistributions = currentDistributions
      })
      
      setPeriodData({...data})
      
      // Calculate cumulative retained earnings after setting period data
      const periods = Object.keys(data).sort((a, b) => {
        if (timeframe === 'yearly') {
          return parseInt(a) - parseInt(b)
        }
        // For quarterly/monthly within same year
        return 0
      })
      
      let cumulativeRE = 0
      const retainedEarnings: Record<string, number> = {}
      
      periods.forEach(period => {
        cumulativeRE += data[period].netIncome || 0
        retainedEarnings[period] = cumulativeRE
      })
      
      setRetainedEarningsByPeriod(retainedEarnings)
      
    } catch (error) {
      clientLogger.error('Error generating reports:', error)
    } finally {
      setLoading(false)
    }
  }

  
  const createEmptyMetrics = (): FinancialMetrics => ({
    accounts: {},
    totalRevenue: 0,
    totalCOGS: 0,
    totalAmazon: 0,
    totalOperating: 0,
    grossProfit: 0,
    netIncome: 0
  })
  
  const periods = useMemo(() => Object.keys(periodData), [periodData])
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }
  
  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return formatCurrency(value)
  }
  
  const exportToPDF = async () => {
    const doc = new jsPDF('landscape', 'pt', 'letter')
    const pageHeight = doc.internal.pageSize.height
    const pageWidth = doc.internal.pageSize.width
    
    // Title - aligned to the right
    doc.setFontSize(18)
    const titleText = `Financial Reports - ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} ${timeframe !== 'yearly' ? selectedYear : '2025-2030'}`
    doc.text(titleText, pageWidth - 40, 40, { align: 'right' })
    
    let yPosition = 70
    
    // Income Statement
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text('INCOME STATEMENT', 40, yPosition)
    yPosition += 10
    
    // Prepare Income Statement data
    const incomeHeaders = [['Account', ...periods]]
    const incomeData = []
    
    // Revenue
    incomeData.push(['REVENUE', ...periods.map(() => '')])
    getAccountsByType('Revenue').forEach(account => {
      incomeData.push([
        `  ${account.code} - ${account.name}`,
        ...periods.map(period => formatCurrency(Math.abs(periodData[period].accounts[account.code] || 0)))
      ])
    })
    incomeData.push([
      'Total Revenue',
      ...periods.map(period => formatCurrency(periodData[period].totalRevenue))
    ])
    
    // COGS
    incomeData.push(['', ...periods.map(() => '')])
    incomeData.push(['COST OF GOODS SOLD', ...periods.map(() => '')])
    getAccountsByType('Expense', 'COGS').forEach(account => {
      incomeData.push([
        `  ${account.code} - ${account.name}`,
        ...periods.map(period => {
          const amount = periodData[period].accounts[account.code] || 0
          // For contra-COGS account (5025), show negative values as negative
          if (account.code === '5025') {
            return formatCurrency(amount)
          }
          return formatCurrency(Math.abs(amount))
        })
      ])
    })
    incomeData.push([
      'Total Cost of Goods Sold',
      ...periods.map(period => formatCurrency(periodData[period].totalCOGS))
    ])
    
    // Marketplace Expenses
    incomeData.push(['', ...periods.map(() => '')])
    incomeData.push(['MARKETPLACE EXPENSES', ...periods.map(() => '')])
    getAccountsByType('Expense', 'Marketplace Expenses')
      .filter(account => account.code !== '5052') // Suppress Storage Fees as it's always 0
      .forEach(account => {
        incomeData.push([
          `  ${account.code} - ${account.name}`,
          ...periods.map(period => formatCurrency(Math.abs(periodData[period].accounts[account.code] || 0)))
        ])
      })
    incomeData.push([
      'Total Marketplace Expenses',
      ...periods.map(period => formatCurrency(periodData[period].totalAmazon))
    ])
    
    // Gross Profit - no empty row before it to save space
    incomeData.push([
      'GROSS PROFIT',
      ...periods.map(period => formatCurrency(periodData[period].grossProfit))
    ])
    
    // Operating Expenses - no empty row before it
    incomeData.push(['OPERATING EXPENSES', ...periods.map(() => '')])
    getAccountsByType('Expense', 'Operating Expense').forEach(account => {
      incomeData.push([
        `  ${account.code} - ${account.name}`,
        ...periods.map(period => formatCurrency(Math.abs(periodData[period].accounts[account.code] || 0)))
      ])
    })
    incomeData.push([
      'Total Operating Expenses',
      ...periods.map(period => formatCurrency(periodData[period].totalOperating))
    ])
    
    // Net Income
    incomeData.push(['', ...periods.map(() => '')])
    incomeData.push([
      'NET INCOME',
      ...periods.map(period => formatCurrency(periodData[period].netIncome))
    ])
    
    // Margins
    incomeData.push(['', ...periods.map(() => '')])
    incomeData.push([
      'GROSS MARGIN %',
      ...periods.map(period => {
        const revenue = periodData[period].totalRevenue
        const grossProfit = periodData[period].grossProfit
        if (revenue === 0) return '0.0%'
        return ((grossProfit / revenue) * 100).toFixed(1) + '%'
      })
    ])
    incomeData.push([
      'NET MARGIN %',
      ...periods.map(period => {
        const revenue = periodData[period].totalRevenue
        const netIncome = periodData[period].netIncome
        if (revenue === 0) return '0.0%'
        return ((netIncome / revenue) * 100).toFixed(1) + '%'
      })
    ])
    
    // Add Income Statement table
    let incomePageCount = 0
    autoTable(doc, {
      head: incomeHeaders,
      body: incomeData,
      startY: yPosition,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 180 },
        ...Object.fromEntries(periods.map((_, i) => [i + 1, { halign: 'right', cellWidth: 'auto' }]))
      },
      showHead: 'everyPage', // Show header on every page
      didDrawPage: function(data: any) {
        incomePageCount++
        if (incomePageCount > 1) {
          // Add continued text at the top of the page, above the table
          doc.setFontSize(14)
          doc.setFont(undefined, 'bold')
          doc.text('INCOME STATEMENT (continued)', 40, 30)
        }
      },
      didParseCell: function(data: any) {
        // Bold section headers
        if (data.row.raw[0] && (
          data.row.raw[0].includes('REVENUE') ||
          data.row.raw[0].includes('COST OF GOODS SOLD') ||
          data.row.raw[0].includes('MARKETPLACE EXPENSES') ||
          data.row.raw[0].includes('OPERATING EXPENSES') ||
          data.row.raw[0].includes('GROSS PROFIT') ||
          data.row.raw[0].includes('NET INCOME') ||
          data.row.raw[0].includes('GROSS MARGIN') ||
          data.row.raw[0].includes('NET MARGIN') ||
          data.row.raw[0].includes('Total')
        )) {
          data.cell.styles.fontStyle = 'bold'
          
          // Color coding
          if (data.row.raw[0].includes('GROSS PROFIT')) {
            data.cell.styles.fillColor = [220, 252, 231]
            data.cell.styles.textColor = [22, 101, 52]
          } else if (data.row.raw[0].includes('NET INCOME')) {
            data.cell.styles.fillColor = [219, 234, 254]
            data.cell.styles.textColor = [29, 78, 216]
          } else if (data.row.raw[0].includes('GROSS MARGIN') || data.row.raw[0].includes('NET MARGIN')) {
            data.cell.styles.fillColor = [243, 244, 246]
            data.cell.styles.textColor = [31, 41, 55]
          }
        }
      }
    })
    
    // Always start Balance Sheet on a new page
    doc.addPage()
    yPosition = 40
    
    // Balance Sheet
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text('BALANCE SHEET', 40, yPosition)
    yPosition += 10
    
    // Prepare Balance Sheet data
    const balanceHeaders = [['Account', ...periods]]
    const balanceData = []
    
    // Assets
    balanceData.push(['ASSETS', ...periods.map(() => '')])
    getAccountsByType('Asset').forEach(account => {
      if (account.code === '1200') {
        balanceData.push([
          `  ${account.code} - ${account.name}`,
          ...periods.map(period => {
            // Use the GL entry value directly, not the calculated value
            const glValue = periodData[period].accounts['1200'] || 0
            return formatCurrency(glValue)
          })
        ])
      } else if (account.code === '1750') {
        // Show accumulated depreciation as negative (contra-asset)
        balanceData.push([
          `  ${account.code} - ${account.name}`,
          ...periods.map(period => {
            const value = periodData[period].accounts[account.code] || 0
            return value !== 0 ? formatCurrency(-Math.abs(value)) : '-'
          })
        ])
      } else {
        balanceData.push([
          `  ${account.code} - ${account.name}`,
          ...periods.map(period => formatCurrency(periodData[period].accounts[account.code] || 0))
        ])
      }
    })
    balanceData.push([
      'TOTAL ASSETS',
      ...periods.map(period => {
        let totalAssets = 0
        Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
          const account = CHART_OF_ACCOUNTS[code]
          if (account && account.type === 'Asset') {
            // Account 1750 (Accumulated Depreciation) is a contra-asset, so it reduces total assets
            if (code === '1750') {
              totalAssets -= Math.abs(amount)
            } else {
              totalAssets += amount
            }
          }
        })
        return formatCurrency(totalAssets)
      })
    ])
    
    // Liabilities
    balanceData.push(['', ...periods.map(() => '')])
    balanceData.push(['LIABILITIES', ...periods.map(() => '')])
    getAccountsByType('Liability').forEach(account => {
      balanceData.push([
        `  ${account.code} - ${account.name}`,
        ...periods.map(period => formatCurrency(periodData[period].accounts[account.code] || 0))
      ])
    })
    
    // Equity
    balanceData.push(['', ...periods.map(() => '')])
    balanceData.push(['EQUITY', ...periods.map(() => '')])
    
    // Calculate cumulative retained earnings
    let cumulativeRetainedEarnings = 0
    const calculatedRetainedEarnings: Record<string, number> = {}
    
    // Sort periods to calculate cumulative properly
    const sortedPeriodsForRetained = [...periods].sort((a, b) => {
      if (timeframe === 'yearly') {
        return parseInt(a) - parseInt(b)
      }
      // For quarterly/monthly, compare within the same year
      return 0
    })
    
    sortedPeriodsForRetained.forEach(period => {
      // Add current period's net income to cumulative retained earnings
      cumulativeRetainedEarnings += periodData[period].netIncome || 0
      calculatedRetainedEarnings[period] = cumulativeRetainedEarnings
    })
    
    // Update state for use in JSX
    setRetainedEarningsByPeriod(calculatedRetainedEarnings)
    const retainedEarningsByPeriod = calculatedRetainedEarnings
    
    getAccountsByType('Equity').forEach(account => {
      if (account.code === '3900') {
        // Special handling for Retained Earnings - use calculated value
        balanceData.push([
          `  ${account.code} - ${account.name}`,
          ...periods.map(period => formatCurrency(retainedEarningsByPeriod[period] || 0))
        ])
      } else if (account.code === '3000') {
        // Owner's Equity - should only show in first year (opening balance)
        balanceData.push([
          `  ${account.code} - ${account.name}`,
          ...periods.map(period => {
            // Owner's equity is a one-time contribution, show cumulative
            const year = timeframe === 'yearly' ? parseInt(period) : selectedYear
            // Only show if 2025 or later (when contribution was made)
            return year >= 2025 ? formatCurrency(70000) : '-'
          })
        ])
      } else {
        balanceData.push([
          `  ${account.code} - ${account.name}`,
          ...periods.map(period => formatCurrency(periodData[period].accounts[account.code] || 0))
        ])
      }
    })
    balanceData.push([
      'TOTAL LIABILITIES & EQUITY',
      ...periods.map(period => {
        let totalLiabilities = 0
        let totalEquity = 0
        Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
          const account = CHART_OF_ACCOUNTS[code]
          if (account) {
            if (account.type === 'Liability') totalLiabilities += amount
            // Skip 3900 (Retained Earnings) and 3000 (Owner's Equity) as we handle them specially
            if (account.type === 'Equity' && code !== '3900' && code !== '3000') totalEquity += amount
          }
        })
        // Add calculated retained earnings
        totalEquity += retainedEarningsByPeriod[period] || 0
        // Add Owner's Equity (constant $70k from opening balance)
        const year = timeframe === 'yearly' ? parseInt(period) : selectedYear
        if (year >= 2025) totalEquity += 70000
        return formatCurrency(totalLiabilities + totalEquity)
      })
    ])
    
    // Add Balance Sheet table
    let balancePageCount = 0
    autoTable(doc, {
      head: balanceHeaders,
      body: balanceData,
      startY: yPosition,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 180 },
        ...Object.fromEntries(periods.map((_, i) => [i + 1, { halign: 'right', cellWidth: 'auto' }]))
      },
      showHead: 'everyPage',
      didDrawPage: function(data: any) {
        balancePageCount++
        if (balancePageCount > 1) {
          // Add continued text at the top of the page, above the table
          doc.setFontSize(14)
          doc.setFont(undefined, 'bold')
          doc.text('BALANCE SHEET (continued)', 40, 30)
        }
      },
      didParseCell: function(data: any) {
        if (data.row.raw[0] && (
          data.row.raw[0].includes('ASSETS') ||
          data.row.raw[0].includes('LIABILITIES') ||
          data.row.raw[0].includes('EQUITY') ||
          data.row.raw[0].includes('TOTAL')
        )) {
          data.cell.styles.fontStyle = 'bold'
          
          if (data.row.raw[0].includes('TOTAL ASSETS')) {
            data.cell.styles.fillColor = [220, 252, 231]
            data.cell.styles.textColor = [22, 101, 52]
          } else if (data.row.raw[0].includes('TOTAL LIABILITIES & EQUITY')) {
            data.cell.styles.fillColor = [219, 234, 254]
            data.cell.styles.textColor = [29, 78, 216]
          }
        }
      }
    })
    
    // Always start Cash Flow Statement on a new page
    doc.addPage()
    yPosition = 40
    
    // Cash Flow Statement
    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.text('CASH FLOW STATEMENT', 40, yPosition)
    yPosition += 10
    
    // Prepare Cash Flow data
    const cashFlowHeaders = [['Activity', ...periods]]
    const cashFlowData = []
    
    // Operating Activities
    cashFlowData.push(['OPERATING ACTIVITIES', ...periods.map(() => '')])
    cashFlowData.push([
      '  Net Income',
      ...periods.map(period => formatCurrency(periodData[period].netIncome))
    ])
    cashFlowData.push([
      '  Net Cash from Operating',
      ...periods.map((period, index) => {
        const netIncome = periodData[period].netIncome || 0
        
        // Add back depreciation (non-cash expense)
        const depreciation = periodData[period]?.accounts?.['5720'] || 0
        
        // Subtract inventory increase (cash used to buy inventory)
        const prevPeriod = index > 0 ? periods[index - 1] : null
        const currentInventory = inventoryData[period] || 0
        const prevInventory = prevPeriod ? (inventoryData[prevPeriod] || 0) : 0
        const inventoryIncrease = currentInventory - prevInventory
        
        const operatingCF = netIncome + depreciation - inventoryIncrease
        return formatCurrency(operatingCF)
      })
    ])
    
    // Investing Activities
    cashFlowData.push(['', ...periods.map(() => '')])
    cashFlowData.push(['INVESTING ACTIVITIES', ...periods.map(() => '')])
    cashFlowData.push([
      '  Equipment Purchases',
      ...periods.map((period, index) => {
        const prevPeriod = index > 0 ? periods[index - 1] : null
        const currentEquipment = periodData[period]?.accounts?.['1700'] || 0
        const prevEquipment = prevPeriod ? (periodData[prevPeriod]?.accounts?.['1700'] || 0) : 0
        const equipmentPurchases = currentEquipment - prevEquipment
        return equipmentPurchases > 0 ? formatCurrency(-equipmentPurchases) : '-'
      })
    ])
    
    // Financing Activities
    cashFlowData.push(['', ...periods.map(() => '')])
    cashFlowData.push(['FINANCING ACTIVITIES', ...periods.map(() => '')])
    cashFlowData.push([
      '  Member Contributions',
      ...periods.map(period => formatCurrency(periodData[period].contributionsChange || 0))
    ])
    cashFlowData.push([
      '  Member Distributions',
      ...periods.map(period => formatCurrency(-(periodData[period].distributionsChange || 0)))
    ])
    
    // Net Change
    cashFlowData.push(['', ...periods.map(() => '')])
    cashFlowData.push([
      'NET CHANGE IN CASH',
      ...periods.map((period, index) => {
        const prevPeriod = index > 0 ? periods[index - 1] : null
        const currentCash = periodData[period]?.accounts?.['1000'] || 0
        const prevCash = prevPeriod ? (periodData[prevPeriod]?.accounts?.['1000'] || 0) : 70000
        const netChange = currentCash - prevCash
        return formatCurrency(netChange)
      })
    ])
    cashFlowData.push([
      'Beginning Cash Balance',
      ...periods.map((period, index) => {
        const prevPeriod = index > 0 ? periods[index - 1] : null
        // Only show $70,000 beginning cash if this is September 2025 or later
        const periodYear = parseInt(period.split('-')[0])
        const periodMonth = period.includes('-') ? parseInt(period.split('-')[1]) : 0
        const isBeforeBusinessStart = periodYear < 2025 || (periodYear === 2025 && periodMonth < 9)
        const beginningCash = prevPeriod ? (periodData[prevPeriod]?.accounts?.['1000'] || 0) : (isBeforeBusinessStart ? 0 : 70000)
        return formatCurrency(beginningCash)
      })
    ])
    cashFlowData.push([
      'ENDING CASH BALANCE',
      ...periods.map(period => formatCurrency(periodData[period]?.accounts?.['1000'] || 0))
    ])
    
    // Add Cash Flow table
    let cashFlowPageCount = 0
    autoTable(doc, {
      head: cashFlowHeaders,
      body: cashFlowData,
      startY: yPosition,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 180 },
        ...Object.fromEntries(periods.map((_, i) => [i + 1, { halign: 'right', cellWidth: 'auto' }]))
      },
      showHead: 'everyPage',
      didDrawPage: function(data: any) {
        cashFlowPageCount++
        if (cashFlowPageCount > 1) {
          // Add continued text at the top of the page, above the table
          doc.setFontSize(14)
          doc.setFont(undefined, 'bold')
          doc.text('CASH FLOW STATEMENT (continued)', 40, 30)
        }
      },
      didParseCell: function(data: any) {
        if (data.row.raw[0] && (
          data.row.raw[0].includes('OPERATING ACTIVITIES') ||
          data.row.raw[0].includes('INVESTING ACTIVITIES') ||
          data.row.raw[0].includes('FINANCING ACTIVITIES') ||
          data.row.raw[0].includes('NET CHANGE') ||
          data.row.raw[0].includes('ENDING CASH')
        )) {
          data.cell.styles.fontStyle = 'bold'
          
          if (data.row.raw[0].includes('ENDING CASH')) {
            data.cell.styles.fillColor = [219, 234, 254]
            data.cell.styles.textColor = [29, 78, 216]
          }
        }
      }
    })
    
    // Add page numbers
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 60, pageHeight - 20)
      
    }
    
    // Convert PDF to base64 and save via API
    const pdfBase64 = doc.output('datauristring').split(',')[1]
    
    try {
      const response = await fetch('/api/reports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: pdfBase64,
          filename: 'financial-reports.pdf',
          format: 'pdf',
          strategyName: activeStrategy?.name || 'E2 Conservative'
        })
      })
      
      const result = await response.json()
      if (result.success) {
        // Show success notification with green toast
        const toast = document.createElement('div')
        toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-bottom-5'
        toast.textContent = `PDF report saved to: ${result.message}`
        document.body.appendChild(toast)
        
        setTimeout(() => {
          toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-5')
          setTimeout(() => document.body.removeChild(toast), 200)
        }, 3000)
      } else {
        // Fallback to download if API fails
        doc.save('financial-reports.pdf')
      }
    } catch (error) {
      console.error('Error saving PDF:', error)
      // Fallback to download
      doc.save('financial-reports.pdf')
    }
  }
  
  const copyAllReports = () => {
    let allReports = ''
    const separator = '='.repeat(80)
    
    // Format timeframe text
    const timeframeText = timeframe === 'yearly' ? '2025-2030' : 
                         timeframe === 'quarterly' ? `${selectedYear} Quarterly` :
                         `${selectedYear} Monthly`
    
    // INCOME STATEMENT - DETAILED
    allReports += 'INCOME STATEMENT (DETAILED)\n'
    allReports += `${timeframeText}\n`
    allReports += separator + '\n\n'
    
    // Header row with all periods
    allReports += 'Account\t' + periods.join('\t') + '\n'
    allReports += '-'.repeat(80) + '\n'
    
    // REVENUE SECTION
    allReports += 'REVENUE\n'
    const revenueAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'Revenue')
    revenueAccounts.forEach(account => {
      allReports += `  ${account.code} - ${account.name}\t`
      allReports += periods.map(period => {
        const amount = periodData[period].accounts[account.code] || 0
        return amount !== 0 ? `$${Math.abs(amount).toLocaleString()}` : '-'
      }).join('\t') + '\n'
    })
    allReports += 'Total Revenue\t' + periods.map(p => `$${periodData[p].totalRevenue.toLocaleString()}`).join('\t') + '\n\n'
    
    // COGS SECTION
    allReports += 'COST OF GOODS SOLD\n'
    const cogsAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.subtype === 'COGS')
    cogsAccounts.forEach(account => {
      allReports += `  ${account.code} - ${account.name}\t`
      allReports += periods.map(period => {
        const amount = periodData[period].accounts[account.code] || 0
        // For contra-COGS account (5025), show negative values as negative
        if (account.code === '5025' && amount < 0) {
          return `-$${Math.abs(amount).toLocaleString()}`
        }
        return amount !== 0 ? `$${Math.abs(amount).toLocaleString()}` : '-'
      }).join('\t') + '\n'
    })
    allReports += 'Total Cost of Goods Sold\t' + periods.map(p => `$${periodData[p].totalCOGS.toLocaleString()}`).join('\t') + '\n\n'
    
    // MARKETPLACE EXPENSES SECTION
    allReports += 'MARKETPLACE EXPENSES\n'
    const amazonAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.subtype === 'Marketplace Expenses')
    amazonAccounts.forEach(account => {
      allReports += `  ${account.code} - ${account.name}\t`
      allReports += periods.map(period => {
        const amount = periodData[period].accounts[account.code] || 0
        return amount !== 0 ? `$${Math.abs(amount).toLocaleString()}` : '-'
      }).join('\t') + '\n'
    })
    allReports += 'Total Marketplace Expenses\t' + periods.map(p => `$${periodData[p].totalAmazon.toLocaleString()}`).join('\t') + '\n\n'
    
    // GROSS PROFIT (after COGS and Marketplace Expenses)
    allReports += 'Gross Profit\t' + periods.map(p => `$${periodData[p].grossProfit.toLocaleString()}`).join('\t') + '\n\n'
    
    // OPERATING EXPENSES SECTION
    allReports += 'OPERATING EXPENSES\n'
    const operatingAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => 
      a.type === 'Expense' && a.subtype === 'Operating Expense'
    )
    operatingAccounts.forEach(account => {
      allReports += `  ${account.code} - ${account.name}\t`
      allReports += periods.map(period => {
        const amount = periodData[period].accounts[account.code] || 0
        return amount !== 0 ? `$${Math.abs(amount).toLocaleString()}` : '-'
      }).join('\t') + '\n'
    })
    allReports += 'Total Operating Expenses\t' + periods.map(p => `$${periodData[p].totalOperating.toLocaleString()}`).join('\t') + '\n\n'
    
    // NET INCOME
    allReports += 'NET INCOME\t' + periods.map(p => `$${periodData[p].netIncome.toLocaleString()}`).join('\t') + '\n\n'
    
    // MARGINS
    allReports += 'GROSS MARGIN %\t' + periods.map(p => {
      const revenue = periodData[p].totalRevenue
      const grossProfit = periodData[p].grossProfit
      if (revenue === 0) return '0.0%'
      return ((grossProfit / revenue) * 100).toFixed(1) + '%'
    }).join('\t') + '\n'
    
    allReports += 'NET MARGIN %\t' + periods.map(p => {
      const revenue = periodData[p].totalRevenue
      const netIncome = periodData[p].netIncome
      if (revenue === 0) return '0.0%'
      return ((netIncome / revenue) * 100).toFixed(1) + '%'
    }).join('\t') + '\n'
    
    allReports += '\n' + separator + '\n\n'
    
    // BALANCE SHEET - DETAILED
    allReports += 'BALANCE SHEET (DETAILED)\n'
    allReports += `${timeframeText}\n`
    allReports += separator + '\n\n'
    
    allReports += 'Account\t' + periods.join('\t') + '\n'
    allReports += '-'.repeat(80) + '\n'
    
    // ASSETS SECTION
    allReports += 'ASSETS\n'
    const assetAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'Asset')
    assetAccounts.forEach(account => {
      allReports += `  ${account.code} - ${account.name}\t`
      allReports += periods.map(period => {
        let amount = 0
        if (account.code === '1200') {
          // Use GL entry value directly
          amount = periodData[period].accounts[account.code] || 0
        } else {
          amount = periodData[period].accounts[account.code] || 0
        }
        
        // Handle contra-asset (accumulated depreciation)
        if (account.code === '1750' && amount !== 0) {
          return `-$${Math.abs(amount).toLocaleString()}`
        }
        return amount !== 0 ? `$${amount.toLocaleString()}` : '-'
      }).join('\t') + '\n'
    })
    
    // Total Assets
    allReports += 'TOTAL ASSETS\t'
    allReports += periods.map(period => {
      let totalAssets = 0
      Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
        const account = CHART_OF_ACCOUNTS[code]
        if (account && account.type === 'Asset') {
          if (code === '1750') {
            totalAssets -= Math.abs(amount)
          } else {
            totalAssets += amount
          }
        }
      })
      return `$${totalAssets.toLocaleString()}`
    }).join('\t') + '\n\n'
    
    // LIABILITIES SECTION
    allReports += 'LIABILITIES\n'
    const liabilityAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'Liability')
    if (liabilityAccounts.length > 0) {
      liabilityAccounts.forEach(account => {
        allReports += `  ${account.code} - ${account.name}\t`
        allReports += periods.map(period => {
          const amount = periodData[period].accounts[account.code] || 0
          return amount !== 0 ? `$${amount.toLocaleString()}` : '-'
        }).join('\t') + '\n'
      })
    } else {
      allReports += '  No liabilities\t' + periods.map(() => '-').join('\t') + '\n'
    }
    
    // Total Liabilities
    allReports += 'TOTAL LIABILITIES\t'
    allReports += periods.map(period => {
      let totalLiabilities = 0
      Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
        const account = CHART_OF_ACCOUNTS[code]
        if (account && account.type === 'Liability') {
          totalLiabilities += amount
        }
      })
      return `$${totalLiabilities.toLocaleString()}`
    }).join('\t') + '\n\n'
    
    // EQUITY SECTION
    allReports += 'EQUITY\n'
    const equityAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'Equity')
    equityAccounts.forEach(account => {
      allReports += `  ${account.code} - ${account.name}\t`
      allReports += periods.map(period => {
        if (account.code === '3900') {
          // Use calculated retained earnings
          const retainedEarnings = retainedEarningsByPeriod[period] || 0
          return `$${retainedEarnings.toLocaleString()}`
        }
        const amount = periodData[period].accounts[account.code] || 0
        return amount !== 0 ? `$${amount.toLocaleString()}` : '-'
      }).join('\t') + '\n'
    })
    
    // Total Equity
    allReports += 'TOTAL EQUITY\t'
    allReports += periods.map(period => {
      let totalEquity = 0
      Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
        const account = CHART_OF_ACCOUNTS[code]
        if (account && account.type === 'Equity' && code !== '3900') {
          totalEquity += amount
        }
      })
      totalEquity += retainedEarningsByPeriod[period] || 0
      return `$${totalEquity.toLocaleString()}`
    }).join('\t') + '\n\n'
    
    // Total L&E
    allReports += 'TOTAL LIABILITIES & EQUITY\t'
    allReports += periods.map(period => {
      let totalLiabilities = 0
      let totalEquity = 0
      Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
        const account = CHART_OF_ACCOUNTS[code]
        if (account) {
          if (account.type === 'Liability') totalLiabilities += amount
          if (account.type === 'Equity' && code !== '3900') totalEquity += amount
        }
      })
      totalEquity += retainedEarningsByPeriod[period] || 0
      return `$${(totalLiabilities + totalEquity).toLocaleString()}`
    }).join('\t') + '\n'
    
    allReports += '\n' + separator + '\n\n'
    
    // CASH FLOW STATEMENT - DETAILED
    allReports += 'CASH FLOW STATEMENT (DETAILED)\n'
    allReports += `${timeframeText}\n`
    allReports += separator + '\n\n'
    
    allReports += 'Item\t' + periods.join('\t') + '\n'
    allReports += '-'.repeat(80) + '\n'
    
    // Operating Activities
    allReports += 'OPERATING ACTIVITIES\n'
    allReports += '  Net Income\t' + periods.map(p => `$${periodData[p].netIncome.toLocaleString()}`).join('\t') + '\n'
    allReports += '  Add: Depreciation\t' + periods.map(p => {
      const depreciation = periodData[p].accounts['5720'] || 0
      return depreciation !== 0 ? `$${depreciation.toLocaleString()}` : '-'
    }).join('\t') + '\n'
    allReports += '  Less: Inventory Increase\t' + periods.map(p => {
      const change = periodData[p].inventoryChange || 0
      return change !== 0 ? `$${change.toLocaleString()}` : '-'
    }).join('\t') + '\n'
    allReports += 'Net Cash from Operating Activities\t' + periods.map(p => {
      const inventoryChange = periodData[p].inventoryChange || 0
      const depreciation = periodData[p].accounts['5720'] || 0
      // Add back depreciation (non-cash expense), subtract inventory increase
      const operatingCF = periodData[p].netIncome + depreciation - inventoryChange
      return `$${operatingCF.toLocaleString()}`
    }).join('\t') + '\n\n'
    
    // Investing Activities
    allReports += 'INVESTING ACTIVITIES\n'
    allReports += '  Capital Expenditures\t' + periods.map((p, index) => {
      const currentEquipment = periodData[p].accounts['1700'] || 0
      const prevEquipment = index > 0 ? (periodData[periods[index-1]]?.accounts['1700'] || 0) : 0
      const capex = currentEquipment - prevEquipment
      return capex !== 0 ? `-$${capex.toLocaleString()}` : '-'
    }).join('\t') + '\n'
    allReports += 'Net Cash from Investing Activities\t' + periods.map((p, index) => {
      const currentEquipment = periodData[p].accounts['1700'] || 0
      const prevEquipment = index > 0 ? (periodData[periods[index-1]]?.accounts['1700'] || 0) : 0
      const capex = currentEquipment - prevEquipment
      return capex !== 0 ? `-$${capex.toLocaleString()}` : '-'
    }).join('\t') + '\n\n'
    
    // Financing Activities
    allReports += 'FINANCING ACTIVITIES\n'
    allReports += '  Owner Contributions\t' + periods.map(p => {
      const contrib = periodData[p].contributionsChange || 0
      return contrib !== 0 ? `$${contrib.toLocaleString()}` : '-'
    }).join('\t') + '\n'
    allReports += '  Owner Distributions\t' + periods.map(p => {
      const dist = periodData[p].distributionsChange || 0
      return dist !== 0 ? `-$${dist.toLocaleString()}` : '-'
    }).join('\t') + '\n'
    allReports += 'Net Cash from Financing Activities\t' + periods.map(p => {
      const contrib = periodData[p].contributionsChange || 0
      const dist = periodData[p].distributionsChange || 0
      const net = contrib - dist
      return net !== 0 ? `$${net.toLocaleString()}` : '-'
    }).join('\t') + '\n\n'
    
    // Net Change in Cash
    allReports += 'NET CHANGE IN CASH\t' + periods.map((p, index) => {
      const inventoryChange = periodData[p].inventoryChange || 0
      const depreciation = periodData[p].accounts['5720'] || 0
      const operatingCF = periodData[p].netIncome + depreciation - inventoryChange
      
      const currentEquipment = periodData[p].accounts['1700'] || 0
      const prevEquipment = index > 0 ? (periodData[periods[index-1]]?.accounts['1700'] || 0) : 0
      const capex = currentEquipment - prevEquipment
      const investingCF = -capex
      
      const contrib = periodData[p].contributionsChange || 0
      const dist = periodData[p].distributionsChange || 0
      const netCashFlow = operatingCF + investingCF + contrib - dist
      return `$${netCashFlow.toLocaleString()}`
    }).join('\t') + '\n'
    
    // Copy to clipboard
    navigator.clipboard.writeText(allReports).then(() => {
      // Create toast notification
      const toast = document.createElement('div')
      toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-bottom-5'
      toast.textContent = 'All detailed reports copied to clipboard!'
      document.body.appendChild(toast)
      
      setTimeout(() => {
        toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-5')
        setTimeout(() => document.body.removeChild(toast), 200)
      }, 3000)
    }).catch(err => {
      clientLogger.error('Failed to copy reports:', err)
      alert('Failed to copy reports to clipboard')
    })
  }

  const exportAllReportsToCSV = async () => {
    const timestamp = new Date().toISOString().split('T')[0]
    
    // Helper function to format numbers for CSV (no commas)
    const formatCSVNumber = (num: number) => Math.round(num).toString()
    
    // 1. Income Statement CSV - DETAILED with all accounts
    const incomeHeaders = ['Account', ...periods]
    const incomeRows = []
    
    // REVENUE SECTION
    incomeRows.push(['REVENUE', ...periods.map(() => '')])
    const revenueAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'Revenue')
    revenueAccounts.forEach(account => {
      incomeRows.push([
        `${account.code} - ${account.name}`,
        ...periods.map(period => {
          const amount = periodData[period].accounts[account.code] || 0
          return amount !== 0 ? formatCSVNumber(Math.abs(amount)) : '0'
        })
      ])
    })
    incomeRows.push([
      'Total Revenue',
      ...periods.map(p => formatCSVNumber(periodData[p].totalRevenue))
    ])
    incomeRows.push(['', ...periods.map(() => '')]) // empty row
    
    // COGS SECTION
    incomeRows.push(['COST OF GOODS SOLD', ...periods.map(() => '')])
    const cogsAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.subtype === 'COGS')
    cogsAccounts.forEach(account => {
      incomeRows.push([
        `${account.code} - ${account.name}`,
        ...periods.map(period => {
          const amount = periodData[period].accounts[account.code] || 0
          // For contra-COGS account (5025), preserve negative values
          if (account.code === '5025' && amount < 0) {
            return formatCSVNumber(amount)
          }
          return amount !== 0 ? formatCSVNumber(Math.abs(amount)) : '0'
        })
      ])
    })
    incomeRows.push([
      'Total Cost of Goods Sold',
      ...periods.map(p => formatCSVNumber(periodData[p].totalCOGS))
    ])
    incomeRows.push(['', ...periods.map(() => '')]) // empty row
    
    // MARKETPLACE EXPENSES SECTION
    incomeRows.push(['MARKETPLACE EXPENSES', ...periods.map(() => '')])
    const amazonAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.subtype === 'Marketplace Expenses')
    amazonAccounts.forEach(account => {
      incomeRows.push([
        `${account.code} - ${account.name}`,
        ...periods.map(period => {
          const amount = periodData[period].accounts[account.code] || 0
          return amount !== 0 ? formatCSVNumber(Math.abs(amount)) : '0'
        })
      ])
    })
    incomeRows.push([
      'Total Marketplace Expenses',
      ...periods.map(p => formatCSVNumber(periodData[p].totalAmazon))
    ])
    incomeRows.push(['', ...periods.map(() => '')]) // empty row
    
    // GROSS PROFIT
    incomeRows.push([
      'Gross Profit',
      ...periods.map(p => formatCSVNumber(periodData[p].grossProfit))
    ])
    incomeRows.push(['', ...periods.map(() => '')]) // empty row
    
    // OPERATING EXPENSES SECTION
    incomeRows.push(['OPERATING EXPENSES', ...periods.map(() => '')])
    const operatingAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => 
      a.type === 'Expense' && a.subtype === 'Operating Expense'
    )
    operatingAccounts.forEach(account => {
      incomeRows.push([
        `${account.code} - ${account.name}`,
        ...periods.map(period => {
          const amount = periodData[period].accounts[account.code] || 0
          return amount !== 0 ? formatCSVNumber(Math.abs(amount)) : '0'
        })
      ])
    })
    incomeRows.push([
      'Total Operating Expenses',
      ...periods.map(p => formatCSVNumber(periodData[p].totalOperating))
    ])
    incomeRows.push(['', ...periods.map(() => '')]) // empty row
    
    // NET INCOME
    incomeRows.push([
      'NET INCOME',
      ...periods.map(p => formatCSVNumber(periodData[p].netIncome))
    ])
    incomeRows.push(['', ...periods.map(() => '')]) // empty row
    
    // MARGINS
    incomeRows.push([
      'GROSS MARGIN %',
      ...periods.map(p => {
        const revenue = periodData[p].totalRevenue
        const grossProfit = periodData[p].grossProfit
        if (revenue === 0) return '0.0%'
        return ((grossProfit / revenue) * 100).toFixed(1) + '%'
      })
    ])
    incomeRows.push([
      'NET MARGIN %',
      ...periods.map(p => {
        const revenue = periodData[p].totalRevenue
        const netIncome = periodData[p].netIncome
        if (revenue === 0) return '0.0%'
        return ((netIncome / revenue) * 100).toFixed(1) + '%'
      })
    ])
    
    const incomeCsv = [incomeHeaders, ...incomeRows].map(row => row.join(',')).join('\n')
    
    // 2. Balance Sheet CSV - DETAILED with all accounts
    const balanceHeaders = ['Account', ...periods]
    const balanceRows = []
    
    // ASSETS SECTION
    balanceRows.push(['ASSETS', ...periods.map(() => '')])
    const assetAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'Asset')
    assetAccounts.forEach(account => {
      balanceRows.push([
        `${account.code} - ${account.name}`,
        ...periods.map(period => {
          const amount = periodData[period].accounts[account.code] || 0
          // Handle contra-asset (accumulated depreciation)
          if (account.code === '1750' && amount !== 0) {
            return '-' + formatCSVNumber(Math.abs(amount))
          }
          return amount !== 0 ? formatCSVNumber(amount) : '0'
        })
      ])
    })
    balanceRows.push([
      'TOTAL ASSETS',
      ...periods.map(period => {
        let totalAssets = 0
        Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
          const account = CHART_OF_ACCOUNTS[code]
          if (account && account.type === 'Asset') {
            totalAssets += code === '1750' ? -Math.abs(amount) : amount
          }
        })
        return formatCSVNumber(totalAssets)
      })
    ])
    balanceRows.push(['', ...periods.map(() => '')]) // empty row
    
    // LIABILITIES SECTION
    balanceRows.push(['LIABILITIES', ...periods.map(() => '')])
    const liabilityAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'Liability')
    if (liabilityAccounts.length > 0) {
      liabilityAccounts.forEach(account => {
        balanceRows.push([
          `${account.code} - ${account.name}`,
          ...periods.map(period => {
            const amount = periodData[period].accounts[account.code] || 0
            return amount !== 0 ? formatCSVNumber(amount) : '0'
          })
        ])
      })
    } else {
      balanceRows.push(['No liabilities', ...periods.map(() => '0')])
    }
    balanceRows.push([
      'TOTAL LIABILITIES',
      ...periods.map(period => {
        let totalLiabilities = 0
        Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
          const account = CHART_OF_ACCOUNTS[code]
          if (account && account.type === 'Liability') {
            totalLiabilities += amount
          }
        })
        return formatCSVNumber(totalLiabilities)
      })
    ])
    balanceRows.push(['', ...periods.map(() => '')]) // empty row
    
    // EQUITY SECTION
    balanceRows.push(['EQUITY', ...periods.map(() => '')])
    const equityAccounts = Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'Equity')
    equityAccounts.forEach(account => {
      balanceRows.push([
        `${account.code} - ${account.name}`,
        ...periods.map(period => {
          if (account.code === '3900') {
            // Use calculated retained earnings
            return formatCSVNumber(retainedEarningsByPeriod[period] || 0)
          }
          const amount = periodData[period].accounts[account.code] || 0
          return amount !== 0 ? formatCSVNumber(amount) : '0'
        })
      ])
    })
    balanceRows.push([
      'TOTAL EQUITY',
      ...periods.map(period => {
        let totalEquity = 0
        Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
          const account = CHART_OF_ACCOUNTS[code]
          if (account && account.type === 'Equity' && code !== '3900') {
            totalEquity += amount
          }
        })
        totalEquity += retainedEarningsByPeriod[period] || 0
        return formatCSVNumber(totalEquity)
      })
    ])
    balanceRows.push(['', ...periods.map(() => '')]) // empty row
    
    // TOTAL LIABILITIES & EQUITY
    balanceRows.push([
      'TOTAL LIABILITIES & EQUITY',
      ...periods.map(period => {
        let totalLiabilities = 0
        let totalEquity = 0
        Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
          const account = CHART_OF_ACCOUNTS[code]
          if (account) {
            if (account.type === 'Liability') totalLiabilities += amount
            if (account.type === 'Equity' && code !== '3900') totalEquity += amount
          }
        })
        totalEquity += retainedEarningsByPeriod[period] || 0
        return formatCSVNumber(totalLiabilities + totalEquity)
      })
    ])
    
    const balanceCsv = [balanceHeaders, ...balanceRows].map(row => row.join(',')).join('\n')
    
    // 3. Cash Flow CSV - DETAILED with all line items
    const cashHeaders = ['Item', ...periods]
    const cashRows = []
    
    // OPERATING ACTIVITIES SECTION
    cashRows.push(['OPERATING ACTIVITIES', ...periods.map(() => '')])
    cashRows.push([
      'Net Income',
      ...periods.map(p => formatCSVNumber(periodData[p].netIncome))
    ])
    cashRows.push([
      'Add: Depreciation',
      ...periods.map(p => formatCSVNumber(periodData[p].accounts['5720'] || 0))
    ])
    cashRows.push([
      'Less: Inventory Increase',
      ...periods.map(p => {
        const invChange = periodData[p].inventoryChange || 0
        return formatCSVNumber(invChange)
      })
    ])
    cashRows.push([
      'Net Cash from Operating Activities',
      ...periods.map(p => {
        const netIncome = periodData[p].netIncome
        const depreciation = periodData[p].accounts['5720'] || 0
        const invChange = periodData[p].inventoryChange || 0
        return formatCSVNumber(netIncome + depreciation - invChange)
      })
    ])
    cashRows.push(['', ...periods.map(() => '')]) // empty row
    
    // INVESTING ACTIVITIES SECTION
    cashRows.push(['INVESTING ACTIVITIES', ...periods.map(() => '')])
    cashRows.push([
      'Capital Expenditures',
      ...periods.map((p, index) => {
        const prevPeriod = index > 0 ? periods[index - 1] : null
        const currentEquipment = periodData[p].accounts['1700'] || 0
        const prevEquipment = prevPeriod ? (periodData[prevPeriod].accounts['1700'] || 0) : 0
        const capex = currentEquipment - prevEquipment
        return capex > 0 ? '-' + formatCSVNumber(capex) : '0'
      })
    ])
    cashRows.push([
      'Net Cash from Investing Activities',
      ...periods.map((p, index) => {
        const prevPeriod = index > 0 ? periods[index - 1] : null
        const currentEquipment = periodData[p].accounts['1700'] || 0
        const prevEquipment = prevPeriod ? (periodData[prevPeriod].accounts['1700'] || 0) : 0
        const capex = currentEquipment - prevEquipment
        return capex > 0 ? '-' + formatCSVNumber(capex) : '0'
      })
    ])
    cashRows.push(['', ...periods.map(() => '')]) // empty row
    
    // FINANCING ACTIVITIES SECTION
    cashRows.push(['FINANCING ACTIVITIES', ...periods.map(() => '')])
    cashRows.push([
      'Owner Contributions',
      ...periods.map(p => formatCSVNumber(periodData[p].contributionsChange || 0))
    ])
    cashRows.push([
      'Owner Distributions',
      ...periods.map(p => {
        const dist = periodData[p].distributionsChange || 0
        return dist > 0 ? '-' + formatCSVNumber(dist) : '0'
      })
    ])
    cashRows.push([
      'Net Cash from Financing Activities',
      ...periods.map(p => {
        const contrib = periodData[p].contributionsChange || 0
        const dist = periodData[p].distributionsChange || 0
        return formatCSVNumber(contrib - dist)
      })
    ])
    cashRows.push(['', ...periods.map(() => '')]) // empty row
    
    // NET CHANGE IN CASH
    cashRows.push([
      'NET CHANGE IN CASH',
      ...periods.map((p, index) => {
        const netIncome = periodData[p].netIncome
        const depreciation = periodData[p].accounts['5720'] || 0
        const invChange = periodData[p].inventoryChange || 0
        const operatingCF = netIncome + depreciation - invChange
        
        const prevPeriod = index > 0 ? periods[index - 1] : null
        const currentEquipment = periodData[p].accounts['1700'] || 0
        const prevEquipment = prevPeriod ? (periodData[prevPeriod].accounts['1700'] || 0) : 0
        const investingCF = -(currentEquipment - prevEquipment)
        
        const contrib = periodData[p].contributionsChange || 0
        const dist = periodData[p].distributionsChange || 0
        const financingCF = contrib - dist
        
        return formatCSVNumber(operatingCF + investingCF + financingCF)
      })
    ])
    cashRows.push(['', ...periods.map(() => '')]) // empty row
    
    // CASH BALANCES
    cashRows.push([
      'Beginning Cash Balance',
      ...periods.map((p, index) => {
        if (index === 0) {
          return timeframe === 'yearly' && parseInt(p) === 2025 ? '0' : '70000'
        }
        return formatCSVNumber(periodData[periods[index - 1]].accounts['1000'] || 0)
      })
    ])
    cashRows.push([
      'Ending Cash Balance',
      ...periods.map(p => formatCSVNumber(periodData[p].accounts['1000'] || 0))
    ])
    
    const cashCsv = [cashHeaders, ...cashRows].map(row => row.join(',')).join('\n')
    
    // Combine all three CSV files into one
    const combinedCsv = [
      '=== INCOME STATEMENT ===',
      '',
      incomeCsv,
      '',
      '',
      '=== BALANCE SHEET ===', 
      '',
      balanceCsv,
      '',
      '',
      '=== CASH FLOW STATEMENT ===',
      '',
      cashCsv
    ].join('\n')
    
    // Save with consistent filename (will overwrite)
    const filename = 'financial-reports.csv'
    
    try {
      const response = await fetch('/api/reports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: combinedCsv,
          filename,
          format: 'csv',
          strategyName: activeStrategy?.name || 'E2 Conservative'
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Show success notification
        const toast = document.createElement('div')
        toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-bottom-5'
        toast.textContent = `CSV report saved to: ${result.message}`
        document.body.appendChild(toast)
        
        setTimeout(() => {
          toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-5')
          setTimeout(() => document.body.removeChild(toast), 200)
        }, 3000)
      } else {
        alert('Failed to save CSV report')
      }
    } catch (error) {
      console.error('Error saving CSV:', error)
      alert('Failed to save CSV report')
    }
  }
  
  const exportAllReportsToJSON = async () => {
    const timestamp = new Date().toISOString().split('T')[0]
    
    // Helper function to format numbers for JSON (matching CSV - no commas)
    const formatJSONNumber = (num: number) => Math.round(num)
    
    // Build JSON with EXACT same structure as CSV - arrays of arrays
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        timeframe,
        year: timeframe !== 'yearly' ? selectedYear : '2025-2030',
        periods,
        strategy: activeStrategy
      },
      
      // Income Statement - exact same structure as CSV
      incomeStatement: {
        headers: ['Account', ...periods],
        data: [
          // REVENUE SECTION
          ['REVENUE', ...periods.map(() => '')],
          ...Object.values(CHART_OF_ACCOUNTS)
            .filter(a => a.type === 'Revenue')
            .map(account => [
              `${account.code} - ${account.name}`,
              ...periods.map(period => {
                const amount = periodData[period].accounts[account.code] || 0
                return amount !== 0 ? formatJSONNumber(Math.abs(amount)) : 0
              })
            ]),
          ['Total Revenue', ...periods.map(p => formatJSONNumber(periodData[p].totalRevenue))],
          ['', ...periods.map(() => '')], // empty row
          
          // COGS SECTION
          ['COST OF GOODS SOLD', ...periods.map(() => '')],
          ...Object.values(CHART_OF_ACCOUNTS)
            .filter(a => a.subtype === 'COGS')
            .map(account => [
              `${account.code} - ${account.name}`,
              ...periods.map(period => {
                const amount = periodData[period].accounts[account.code] || 0
                if (account.code === '5025' && amount < 0) {
                  return formatJSONNumber(amount)
                }
                return amount !== 0 ? formatJSONNumber(Math.abs(amount)) : 0
              })
            ]),
          ['Total Cost of Goods Sold', ...periods.map(p => formatJSONNumber(periodData[p].totalCOGS))],
          ['', ...periods.map(() => '')], // empty row
          
          // MARKETPLACE EXPENSES SECTION
          ['MARKETPLACE EXPENSES', ...periods.map(() => '')],
          ...Object.values(CHART_OF_ACCOUNTS)
            .filter(a => a.subtype === 'Marketplace Expenses')
            .map(account => [
              `${account.code} - ${account.name}`,
              ...periods.map(period => {
                const amount = periodData[period].accounts[account.code] || 0
                return amount !== 0 ? formatJSONNumber(Math.abs(amount)) : 0
              })
            ]),
          ['Total Marketplace Expenses', ...periods.map(p => formatJSONNumber(periodData[p].totalAmazon))],
          ['', ...periods.map(() => '')], // empty row
          
          // GROSS PROFIT
          ['Gross Profit', ...periods.map(p => formatJSONNumber(periodData[p].grossProfit))],
          ['', ...periods.map(() => '')], // empty row
          
          // OPERATING EXPENSES SECTION
          ['OPERATING EXPENSES', ...periods.map(() => '')],
          ...Object.values(CHART_OF_ACCOUNTS)
            .filter(a => a.type === 'Expense' && a.subtype === 'Operating Expense')
            .map(account => [
              `${account.code} - ${account.name}`,
              ...periods.map(period => {
                const amount = periodData[period].accounts[account.code] || 0
                return amount !== 0 ? formatJSONNumber(Math.abs(amount)) : 0
              })
            ]),
          ['Total Operating Expenses', ...periods.map(p => formatJSONNumber(periodData[p].totalOperating))],
          ['', ...periods.map(() => '')], // empty row
          
          // NET INCOME
          ['NET INCOME', ...periods.map(p => formatJSONNumber(periodData[p].netIncome))],
          ['', ...periods.map(() => '')], // empty row
          
          // MARGINS
          ['GROSS MARGIN %', ...periods.map(p => {
            const revenue = periodData[p].totalRevenue
            const grossProfit = periodData[p].grossProfit
            return revenue === 0 ? '0.0%' : ((grossProfit / revenue) * 100).toFixed(1) + '%'
          })],
          ['NET MARGIN %', ...periods.map(p => {
            const revenue = periodData[p].totalRevenue
            const netIncome = periodData[p].netIncome
            return revenue === 0 ? '0.0%' : ((netIncome / revenue) * 100).toFixed(1) + '%'
          })]
        ]
      },
      
      // Balance Sheet - exact same structure as CSV
      balanceSheet: {
        headers: ['Account', ...periods],
        data: [
          // ASSETS SECTION
          ['ASSETS', ...periods.map(() => '')],
          ...Object.values(CHART_OF_ACCOUNTS)
            .filter(a => a.type === 'Asset')
            .map(account => [
              `${account.code} - ${account.name}`,
              ...periods.map(period => {
                const amount = periodData[period].accounts[account.code] || 0
                if (account.code === '1750' && amount !== 0) {
                  return -formatJSONNumber(Math.abs(amount))
                }
                return amount !== 0 ? formatJSONNumber(amount) : 0
              })
            ]),
          ['TOTAL ASSETS', ...periods.map(period => {
            let totalAssets = 0
            Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
              const account = CHART_OF_ACCOUNTS[code]
              if (account && account.type === 'Asset') {
                totalAssets += code === '1750' ? -Math.abs(amount) : amount
              }
            })
            return formatJSONNumber(totalAssets)
          })],
          ['', ...periods.map(() => '')], // empty row
          
          // LIABILITIES SECTION
          ['LIABILITIES', ...periods.map(() => '')],
          ...(Object.values(CHART_OF_ACCOUNTS).filter(a => a.type === 'Liability').length > 0 ?
            Object.values(CHART_OF_ACCOUNTS)
              .filter(a => a.type === 'Liability')
              .map(account => [
                `${account.code} - ${account.name}`,
                ...periods.map(period => {
                  const amount = periodData[period].accounts[account.code] || 0
                  return amount !== 0 ? formatJSONNumber(amount) : 0
                })
              ]) : [['No liabilities', ...periods.map(() => 0)]]),
          ['TOTAL LIABILITIES', ...periods.map(period => {
            let totalLiabilities = 0
            Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
              const account = CHART_OF_ACCOUNTS[code]
              if (account && account.type === 'Liability') {
                totalLiabilities += amount
              }
            })
            return formatJSONNumber(totalLiabilities)
          })],
          ['', ...periods.map(() => '')], // empty row
          
          // EQUITY SECTION
          ['EQUITY', ...periods.map(() => '')],
          ...Object.values(CHART_OF_ACCOUNTS)
            .filter(a => a.type === 'Equity')
            .map(account => [
              `${account.code} - ${account.name}`,
              ...periods.map(period => {
                if (account.code === '3900') {
                  return formatJSONNumber(retainedEarningsByPeriod[period] || 0)
                }
                const amount = periodData[period].accounts[account.code] || 0
                return amount !== 0 ? formatJSONNumber(amount) : 0
              })
            ]),
          ['TOTAL EQUITY', ...periods.map(period => {
            let totalEquity = 0
            Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
              const account = CHART_OF_ACCOUNTS[code]
              if (account && account.type === 'Equity' && code !== '3900') {
                totalEquity += amount
              }
            })
            totalEquity += retainedEarningsByPeriod[period] || 0
            return formatJSONNumber(totalEquity)
          })],
          ['', ...periods.map(() => '')], // empty row
          
          // TOTAL LIABILITIES & EQUITY
          ['TOTAL LIABILITIES & EQUITY', ...periods.map(period => {
            let totalLiabilities = 0
            let totalEquity = 0
            Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
              const account = CHART_OF_ACCOUNTS[code]
              if (account) {
                if (account.type === 'Liability') totalLiabilities += amount
                if (account.type === 'Equity' && code !== '3900') totalEquity += amount
              }
            })
            totalEquity += retainedEarningsByPeriod[period] || 0
            return formatJSONNumber(totalLiabilities + totalEquity)
          })]
        ]
      },
      
      // Cash Flow Statement - exact same structure as CSV
      cashFlow: {
        headers: ['Item', ...periods],
        data: [
          // OPERATING ACTIVITIES SECTION
          ['OPERATING ACTIVITIES', ...periods.map(() => '')],
          ['Net Income', ...periods.map(p => formatJSONNumber(periodData[p].netIncome))],
          ['Add: Depreciation', ...periods.map(p => formatJSONNumber(periodData[p].accounts['5720'] || 0))],
          ['Less: Inventory Increase', ...periods.map(p => {
            const invChange = periodData[p].inventoryChange || 0
            return formatJSONNumber(invChange)
          })],
          ['Net Cash from Operating Activities', ...periods.map(p => {
            const netIncome = periodData[p].netIncome
            const depreciation = periodData[p].accounts['5720'] || 0
            const invChange = periodData[p].inventoryChange || 0
            return formatJSONNumber(netIncome + depreciation - invChange)
          })],
          ['', ...periods.map(() => '')], // empty row
          
          // INVESTING ACTIVITIES SECTION
          ['INVESTING ACTIVITIES', ...periods.map(() => '')],
          ['Capital Expenditures', ...periods.map((p, index) => {
            const prevPeriod = index > 0 ? periods[index - 1] : null
            const currentEquipment = periodData[p].accounts['1700'] || 0
            const prevEquipment = prevPeriod ? (periodData[prevPeriod].accounts['1700'] || 0) : 0
            const capex = currentEquipment - prevEquipment
            return capex > 0 ? -formatJSONNumber(capex) : 0
          })],
          ['Net Cash from Investing Activities', ...periods.map((p, index) => {
            const prevPeriod = index > 0 ? periods[index - 1] : null
            const currentEquipment = periodData[p].accounts['1700'] || 0
            const prevEquipment = prevPeriod ? (periodData[prevPeriod].accounts['1700'] || 0) : 0
            const capex = currentEquipment - prevEquipment
            return capex > 0 ? -formatJSONNumber(capex) : 0
          })],
          ['', ...periods.map(() => '')], // empty row
          
          // FINANCING ACTIVITIES SECTION
          ['FINANCING ACTIVITIES', ...periods.map(() => '')],
          ['Owner Contributions', ...periods.map(p => formatJSONNumber(periodData[p].contributionsChange || 0))],
          ['Owner Distributions', ...periods.map(p => {
            const dist = periodData[p].distributionsChange || 0
            return dist > 0 ? -formatJSONNumber(dist) : 0
          })],
          ['Net Cash from Financing Activities', ...periods.map(p => {
            const contrib = periodData[p].contributionsChange || 0
            const dist = periodData[p].distributionsChange || 0
            return formatJSONNumber(contrib - dist)
          })],
          ['', ...periods.map(() => '')], // empty row
          
          // NET CHANGE IN CASH
          ['NET CHANGE IN CASH', ...periods.map((p, index) => {
            const netIncome = periodData[p].netIncome
            const depreciation = periodData[p].accounts['5720'] || 0
            const invChange = periodData[p].inventoryChange || 0
            const operatingCF = netIncome + depreciation - invChange
            
            const prevPeriod = index > 0 ? periods[index - 1] : null
            const currentEquipment = periodData[p].accounts['1700'] || 0
            const prevEquipment = prevPeriod ? (periodData[prevPeriod].accounts['1700'] || 0) : 0
            const investingCF = -(currentEquipment - prevEquipment)
            
            const contrib = periodData[p].contributionsChange || 0
            const dist = periodData[p].distributionsChange || 0
            const financingCF = contrib - dist
            
            return formatJSONNumber(operatingCF + investingCF + financingCF)
          })],
          ['', ...periods.map(() => '')], // empty row
          
          // CASH BALANCES
          ['Beginning Cash Balance', ...periods.map((p, index) => {
            if (index === 0) {
              return timeframe === 'yearly' && parseInt(p) === 2025 ? 0 : 70000
            }
            return formatJSONNumber(periodData[periods[index - 1]].accounts['1000'] || 0)
          })],
          ['Ending Cash Balance', ...periods.map(p => formatJSONNumber(periodData[p].accounts['1000'] || 0))]
        ]
      }
    }
    
    // Save with consistent filename (will overwrite)
    const filename = 'financial-reports.json'
    
    try {
      const response = await fetch('/api/reports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: JSON.stringify(exportData, null, 2),
          filename,
          format: 'json',
          strategyName: activeStrategy?.name || 'E2 Conservative'
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Show success notification
        const toast = document.createElement('div')
        toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-bottom-5'
        toast.textContent = `JSON report saved to: ${result.message}`
        document.body.appendChild(toast)
        
        setTimeout(() => {
          toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-5')
          setTimeout(() => document.body.removeChild(toast), 200)
        }, 3000)
      } else {
        alert('Failed to save JSON report')
      }
    } catch (error) {
      console.error('Error saving JSON:', error)
      alert('Failed to save JSON report')
    }
  }
  
  // Prepare chart data with more meaningful metrics
  const chartData = useMemo(() => {
    let cumulativeRetained = 0
    let cumulativeCashBalance = 70000 // Starting with opening balance
    
    return periods.map(period => {
      const netIncome = periodData[period]?.netIncome || 0
      const operatingCashFlow = netIncome + 
        (periodData[period]?.accounts['5720'] || 0) - // Add back depreciation
        (periodData[period]?.inventoryChange || 0) // Subtract inventory increase
      
      // Get actual cash position from GL account 1000 (Business Bank Account)
      // This represents the cumulative cash balance at the end of each period
      const cashFromGL = periodData[period]?.accounts['1000'] || 0
      cumulativeCashBalance += cashFromGL
      
      cumulativeRetained += netIncome
      
      const revenue = periodData[period]?.totalRevenue || 0
      const grossMargin = revenue > 0 ? ((periodData[period]?.grossProfit || 0) / revenue) * 100 : 0
      const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0
      
      return {
        period,
        revenue: periodData[period]?.totalRevenue || 0,
        grossProfit: periodData[period]?.grossProfit || 0,
        netIncome: periodData[period]?.netIncome || 0,
        cashPosition: cumulativeCashBalance, // Using actual GL bank account balance
        operatingCashFlow,
        grossMargin,
        netMargin,
        retainedEarnings: cumulativeRetained,
        expenses: (periodData[period]?.totalCOGS || 0) + 
                  (periodData[period]?.totalAmazon || 0) + 
                  (periodData[period]?.totalOperating || 0)
      }
    })
  }, [periods, periodData])
  
  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    const currentPeriod = periods[periods.length - 1]
    const previousPeriod = periods[periods.length - 2]
    
    const current = periodData[currentPeriod] || createEmptyMetrics()
    const previous = periodData[previousPeriod] || createEmptyMetrics()
    
    return {
      totalRevenue: current.totalRevenue,
      revenueChange: previous.totalRevenue ? 
        ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 : 0,
      grossProfit: current.grossProfit,
      grossProfitChange: previous.grossProfit ? 
        ((current.grossProfit - previous.grossProfit) / previous.grossProfit) * 100 : 0,
      netIncome: current.netIncome,
      netIncomeChange: previous.netIncome ? 
        ((current.netIncome - previous.netIncome) / previous.netIncome) * 100 : 0,
      totalExpenses: current.totalCOGS + current.totalAmazon + current.totalOperating,
      expensesChange: previous.totalCOGS + previous.totalAmazon + previous.totalOperating ? 
        (((current.totalCOGS + current.totalAmazon + current.totalOperating) - 
          (previous.totalCOGS + previous.totalAmazon + previous.totalOperating)) / 
          (previous.totalCOGS + previous.totalAmazon + previous.totalOperating)) * 100 : 0
    }
  }, [periods, periodData])
  
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Financial Reports</h1>
                <p className="text-xs text-gray-500">Comprehensive financial analysis</p>
              </div>
              <div className="flex items-center gap-3">
                {timeframe !== 'yearly' && (
                  <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-32 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2025, 2026, 2027, 2028, 2029, 2030].map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="bg-gray-100 p-1 rounded-lg">
                  <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as TimeframeOption)}>
                    <TabsList className="bg-transparent">
                      <TabsTrigger value="monthly" className="data-[state=active]:bg-white">Monthly</TabsTrigger>
                      <TabsTrigger value="quarterly" className="data-[state=active]:bg-white">Quarterly</TabsTrigger>
                      <TabsTrigger value="yearly" className="data-[state=active]:bg-white">Yearly</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="bg-white">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={exportAllReportsToCSV}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportAllReportsToJSON}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToPDF}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as PDF
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={copyAllReports}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="px-6 py-4">
          {loading ? (
            <PageSkeleton variant="chart" />
          ) : (
            <>
              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-white border">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="income">Income Statement</TabsTrigger>
                  <TabsTrigger value="balance">Balance Sheet</TabsTrigger>
                  <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
                </TabsList>
                
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  {/* Net Income Trend - Main Chart for PDF */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-medium">Net Income Trend</CardTitle>
                      <CardDescription className="text-sm">Bottom line performance over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatCompactCurrency(value)} />
                          <Tooltip content={<CustomTooltip />} />
                          <ReferenceLine y={0} stroke="#666" />
                          <Bar dataKey="netIncome" fill={(entry: any) => entry.netIncome >= 0 ? '#10b981' : '#ef4444'} radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Income Statement Tab */}
                <TabsContent value="income">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left py-2 px-3 font-medium text-gray-700 text-xs">Account</th>
                              {periods.map(period => (
                                <th key={period} className="text-right py-2 px-3 font-medium text-gray-700 whitespace-nowrap text-xs">
                                  {period}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {/* Revenue Section */}
                            <tr className="bg-blue-50">
                              <td className="py-2 px-3 font-semibold text-blue-900 text-sm">Revenue</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            {getAccountsByType('Revenue').map(account => (
                              <tr key={account.code} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2 px-3 pl-6 text-gray-700 text-sm">
                                  <span className="font-mono text-xs text-gray-500 mr-2">{account.code}</span>
                                  {account.name}
                                </td>
                                {periods.map(period => (
                                  <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                    {formatCurrency(Math.abs(periodData[period].accounts[account.code] || 0))}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="bg-gray-50 font-semibold">
                              <td className="py-2 px-3 pl-6 text-sm">Total Revenue</td>
                              {periods.map(period => (
                                <td key={period} className="text-right py-2 px-3 text-blue-600 text-xs font-semibold">
                                  {formatCurrency(periodData[period].totalRevenue)}
                                </td>
                              ))}
                            </tr>
                            
                            {/* COGS Section */}
                            <tr className="bg-orange-50">
                              <td className="py-2 px-3 font-semibold text-orange-900 text-sm">Cost of Goods Sold</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            {getAccountsByType('Expense', 'COGS').map(account => (
                              <tr key={account.code} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2 px-3 pl-6 text-gray-700 text-sm">
                                  <span className="font-mono text-xs text-gray-500 mr-2">{account.code}</span>
                                  {account.name}
                                </td>
                                {periods.map(period => (
                                  <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                    {account.code === '5025' 
                                      ? formatCurrency(periodData[period].accounts[account.code] || 0)
                                      : formatCurrency(Math.abs(periodData[period].accounts[account.code] || 0))}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="bg-gray-50 font-semibold">
                              <td className="py-2 px-3 pl-6 text-sm">Total Cost of Goods Sold</td>
                              {periods.map(period => (
                                <td key={period} className="text-right py-2 px-3 text-orange-600 text-xs font-semibold">
                                  {formatCurrency(periodData[period].totalCOGS)}
                                </td>
                              ))}
                            </tr>
                            
                            {/* Marketplace Expenses */}
                            <tr className="bg-purple-50">
                              <td className="py-2 px-3 font-semibold text-purple-900 text-sm">Marketplace Expenses</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            {getAccountsByType('Expense', 'Marketplace Expenses').map(account => (
                              <tr key={account.code} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2 px-3 pl-6 text-gray-700 text-sm">
                                  <span className="font-mono text-xs text-gray-500 mr-2">{account.code}</span>
                                  {account.name}
                                </td>
                                {periods.map(period => (
                                  <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                    {formatCurrency(Math.abs(periodData[period].accounts[account.code] || 0))}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="border-t font-semibold">
                              <td className="py-2 px-3 pl-4 text-gray-700 text-sm">Total Marketplace Expenses</td>
                              {periods.map(period => (
                                <td key={period} className="text-right py-2 px-3 text-gray-700 text-xs font-semibold">
                                  {formatCurrency(periodData[period].totalAmazon)}
                                </td>
                              ))}
                            </tr>
                            
                            {/* Gross Profit */}
                            <tr className="bg-green-50 font-semibold">
                              <td className="py-2 px-3 text-green-900 text-sm">Gross Profit</td>
                              {periods.map(period => (
                                <td key={period} className="text-right py-2 px-3 text-green-600 text-xs font-semibold">
                                  {formatCurrency(periodData[period].grossProfit)}
                                </td>
                              ))}
                            </tr>
                            
                            {/* Operating Expenses */}
                            <tr className="bg-gray-100">
                              <td className="py-2 px-3 font-semibold text-gray-900 text-sm">Operating Expenses</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            {getAccountsByType('Expense', 'Operating Expense').map(account => (
                              <tr key={account.code} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2 px-3 pl-6 text-gray-700 text-sm">
                                  <span className="font-mono text-xs text-gray-500 mr-2">{account.code}</span>
                                  {account.name}
                                </td>
                                {periods.map(period => (
                                  <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                    {formatCurrency(Math.abs(periodData[period].accounts[account.code] || 0))}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="border-t font-semibold">
                              <td className="py-2 px-3 pl-4 text-gray-700 text-sm">Total Operating Expenses</td>
                              {periods.map(period => (
                                <td key={period} className="text-right py-2 px-3 text-gray-700 text-xs font-semibold">
                                  {formatCurrency(periodData[period].totalOperating)}
                                </td>
                              ))}
                            </tr>
                            
                            {/* Net Income */}
                            <tr className="bg-blue-100 font-bold">
                              <td className="py-2 px-3 text-blue-900">Net Income</td>
                              {periods.map(period => (
                                <td key={period} className={`text-right py-2 px-3 text-xs font-semibold ${
                                  periodData[period].netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {formatCurrency(periodData[period].netIncome)}
                                </td>
                              ))}
                            </tr>
                            
                            {/* Margins */}
                            <tr className="bg-gray-50">
                              <td className="py-2 px-3 font-semibold text-gray-700 text-sm">Gross Margin %</td>
                              {periods.map(period => {
                                const revenue = periodData[period].totalRevenue
                                const grossProfit = periodData[period].grossProfit
                                const margin = revenue === 0 ? 0 : (grossProfit / revenue) * 100
                                return (
                                  <td key={period} className="text-right py-2 px-3 font-mono text-xs font-semibold text-gray-700">
                                    {margin.toFixed(1)}%
                                  </td>
                                )
                              })}
                            </tr>
                            <tr className="bg-gray-50">
                              <td className="py-2 px-3 font-semibold text-gray-700 text-sm">Net Margin %</td>
                              {periods.map(period => {
                                const revenue = periodData[period].totalRevenue
                                const netIncome = periodData[period].netIncome
                                const margin = revenue === 0 ? 0 : (netIncome / revenue) * 100
                                return (
                                  <td key={period} className={`text-right py-2 px-3 font-mono text-xs font-semibold ${
                                    margin >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {margin.toFixed(1)}%
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Balance Sheet Tab */}
                <TabsContent value="balance">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left py-2 px-3 font-medium text-gray-700 text-xs">Account</th>
                              {periods.map(period => (
                                <th key={period} className="text-right py-2 px-3 font-medium text-gray-700 whitespace-nowrap text-xs">
                                  {period}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {/* Assets */}
                            <tr className="bg-green-50">
                              <td className="py-2 px-3 font-semibold text-green-900 text-sm">Assets</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            {getAccountsByType('Asset').map(account => {
                              if (account.code === '1200') {
                                return (
                                  <tr key={account.code} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-2 px-3 pl-6 text-gray-700 text-sm">
                                      <span className="font-mono text-xs text-gray-500 mr-2">{account.code}</span>
                                      {account.name}
                                    </td>
                                    {periods.map(period => (
                                      <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                        {formatCurrency(periodData[period].accounts['1200'] || 0)}
                                      </td>
                                    ))}
                                  </tr>
                                )
                              }
                              return (
                                <tr key={account.code} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-2 px-3 pl-6 text-gray-700 text-sm">
                                    <span className="font-mono text-xs text-gray-500 mr-2">{account.code}</span>
                                    {account.name}
                                  </td>
                                  {periods.map(period => (
                                    <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                      {formatCurrency(periodData[period].accounts[account.code] || 0)}
                                    </td>
                                  ))}
                                </tr>
                              )
                            })}
                            <tr className="bg-gray-50 font-semibold">
                              <td className="py-2 px-3 pl-6 text-sm">Total Assets</td>
                              {periods.map(period => {
                                let totalAssets = 0
                                Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
                                  const account = CHART_OF_ACCOUNTS[code]
                                  if (account && account.type === 'Asset') {
                                    totalAssets += amount
                                  }
                                })
                                return (
                                  <td key={period} className="text-right py-2 px-3 text-blue-600 text-xs font-semibold">
                                    {formatCurrency(totalAssets)}
                                  </td>
                                )
                              })}
                            </tr>
                            
                            {/* Liabilities */}
                            <tr className="bg-red-50">
                              <td className="py-2 px-3 font-semibold text-red-900 text-sm">Liabilities</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            {getAccountsByType('Liability').map(account => (
                              <tr key={account.code} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2 px-3 pl-6 text-gray-700 text-sm">
                                  <span className="font-mono text-xs text-gray-500 mr-2">{account.code}</span>
                                  {account.name}
                                </td>
                                {periods.map(period => (
                                  <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                    {formatCurrency(periodData[period].accounts[account.code] || 0)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="bg-gray-50 font-semibold">
                              <td className="py-2 px-3 pl-6 text-sm">Total Liabilities</td>
                              {periods.map(period => {
                                let totalLiabilities = 0
                                Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
                                  const account = CHART_OF_ACCOUNTS[code]
                                  if (account && account.type === 'Liability') {
                                    totalLiabilities += amount
                                  }
                                })
                                return (
                                  <td key={period} className="text-right py-2 px-3 text-blue-600 text-xs font-semibold">
                                    {formatCurrency(totalLiabilities)}
                                  </td>
                                )
                              })}
                            </tr>
                            
                            {/* Equity */}
                            <tr className="bg-blue-50">
                              <td className="py-2 px-3 font-semibold text-blue-900 text-sm">Equity</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            {getAccountsByType('Equity').map(account => (
                              <tr key={account.code} className="hover:bg-gray-50 transition-colors">
                                <td className="py-2 px-3 pl-6 text-gray-700 text-sm">
                                  <span className="font-mono text-xs text-gray-500 mr-2">{account.code}</span>
                                  {account.name}
                                </td>
                                {periods.map(period => (
                                  <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                    {account.code === '3900' 
                                      ? formatCurrency(retainedEarningsByPeriod[period] || 0)
                                      : formatCurrency(periodData[period].accounts[account.code] || 0)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr className="bg-gray-50 font-semibold">
                              <td className="py-2 px-3 pl-6 text-sm">Total Equity</td>
                              {periods.map(period => {
                                let totalEquity = 0
                                Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
                                  const account = CHART_OF_ACCOUNTS[code]
                                  // Include all equity accounts EXCEPT retained earnings (we'll add that separately)
                                  if (account && account.type === 'Equity' && code !== '3900') {
                                    totalEquity += amount
                                  }
                                })
                                // Add calculated retained earnings
                                totalEquity += retainedEarningsByPeriod[period] || 0
                                return (
                                  <td key={period} className="text-right py-2 px-3 text-blue-600 text-xs font-semibold">
                                    {formatCurrency(totalEquity)}
                                  </td>
                                )
                              })}
                            </tr>
                            
                            <tr className="bg-blue-100 font-bold">
                              <td className="py-2 px-3 text-blue-900">Total Liabilities & Equity</td>
                              {periods.map(period => {
                                let totalLiabilities = 0
                                let totalEquity = 0
                                Object.entries(periodData[period].accounts).forEach(([code, amount]) => {
                                  const account = CHART_OF_ACCOUNTS[code]
                                  if (account) {
                                    if (account.type === 'Liability') totalLiabilities += amount
                                    // Include all equity accounts EXCEPT retained earnings (we'll add that separately)
                                    if (account.type === 'Equity' && code !== '3900') totalEquity += amount
                                  }
                                })
                                // Add calculated retained earnings
                                totalEquity += retainedEarningsByPeriod[period] || 0
                                return (
                                  <td key={period} className="text-right py-2 px-3 text-blue-600 text-xs font-semibold">
                                    {formatCurrency(totalLiabilities + totalEquity)}
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                {/* Cash Flow Tab */}
                <TabsContent value="cashflow">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left py-2 px-3 font-medium text-gray-700 text-xs">Activity</th>
                              {periods.map(period => (
                                <th key={period} className="text-right py-2 px-3 font-medium text-gray-700 whitespace-nowrap text-xs">
                                  {period}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {/* Operating Activities */}
                            <tr className="bg-green-50">
                              <td className="py-2 px-3 font-semibold text-green-900 text-sm">Operating Activities</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            <tr className="hover:bg-gray-50 transition-colors">
                              <td className="py-2 px-3 pl-6 text-gray-700 text-sm">Net Income</td>
                              {periods.map(period => (
                                <td key={period} className={`text-right py-2 px-3 font-mono text-xs ${
                                  periodData[period].netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {formatCurrency(periodData[period].netIncome)}
                                </td>
                              ))}
                            </tr>
                            <tr className="bg-gray-50 font-semibold">
                              <td className="py-2 px-3 pl-6 text-sm">Net Cash from Operating</td>
                              {periods.map((period, index) => {
                                const netIncome = periodData[period].netIncome || 0
                                
                                // Add back depreciation (non-cash expense)
                                const depreciation = periodData[period]?.accounts?.['5720'] || 0
                                
                                // Subtract inventory increase (uses cash)
                                const prevPeriod = index > 0 ? periods[index - 1] : null
                                const currentInventory = inventoryData[period] || 0
                                const prevInventory = prevPeriod ? (inventoryData[prevPeriod] || 0) : 0
                                const inventoryIncrease = currentInventory - prevInventory
                                
                                // Operating CF = Net Income + Depreciation - Inventory Increase
                                const operatingCF = netIncome + depreciation - inventoryIncrease
                                
                                return (
                                  <td key={period} className={`text-right py-2 px-3 text-sm ${
                                    operatingCF >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {formatCurrency(operatingCF)}
                                  </td>
                                )
                              })}
                            </tr>
                            
                            {/* Investing Activities */}
                            <tr className="bg-blue-50">
                              <td className="py-2 px-3 font-semibold text-blue-900 text-sm">Investing Activities</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            <tr className="hover:bg-gray-50 transition-colors">
                              <td className="py-2 px-3 pl-6 text-gray-700 text-sm">Equipment Purchases</td>
                              {periods.map((period, index) => {
                                const metrics = periodData[period]
                                const prevPeriod = index > 0 ? periods[index - 1] : null
                                const prevMetrics = prevPeriod ? periodData[prevPeriod] : null
                                
                                const currentEquipment = metrics?.accounts?.['1700'] || 0
                                const prevEquipment = prevMetrics?.accounts?.['1700'] || 0
                                const equipmentPurchases = currentEquipment - prevEquipment
                                
                                return (
                                  <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                    {equipmentPurchases > 0 ? formatCurrency(-equipmentPurchases) : '-'}
                                  </td>
                                )
                              })}
                            </tr>
                            
                            {/* Financing Activities */}
                            <tr className="bg-purple-50">
                              <td className="py-2 px-3 font-semibold text-purple-900 text-sm">Financing Activities</td>
                              <td colSpan={periods.length}></td>
                            </tr>
                            <tr className="hover:bg-gray-50 transition-colors">
                              <td className="py-2 px-3 pl-6 text-gray-700 text-sm">Member Contributions</td>
                              {periods.map(period => (
                                <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                  {formatCurrency(periodData[period].contributionsChange || 0)}
                                </td>
                              ))}
                            </tr>
                            <tr className="hover:bg-gray-50 transition-colors">
                              <td className="py-2 px-3 pl-6 text-gray-700 text-sm">Member Distributions</td>
                              {periods.map(period => (
                                <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                  {formatCurrency(-(periodData[period].distributionsChange || 0))}
                                </td>
                              ))}
                            </tr>
                            
                            {/* Net Change */}
                            <tr className="bg-gray-100 font-bold">
                              <td className="py-2 px-3 text-sm">Net Change in Cash</td>
                              {periods.map((period, index) => {
                                // Net change in cash is simply the difference in cash balances
                                const periodIndex = periods.indexOf(period)
                                const prevPeriod = periodIndex > 0 ? periods[periodIndex - 1] : null
                                
                                const currentCash = periodData[period]?.accounts?.['1000'] || 0
                                const prevCash = prevPeriod ? (periodData[prevPeriod]?.accounts?.['1000'] || 0) : 70000
                                const netChange = currentCash - prevCash
                                
                                return (
                                  <td key={period} className={`text-right py-2 px-3 text-sm ${
                                    netChange >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {formatCurrency(netChange)}
                                  </td>
                                )
                              })}
                            </tr>
                            
                            {/* Beginning Cash */}
                            <tr className="hover:bg-gray-50 transition-colors">
                              <td className="py-2 px-3 pl-6 text-gray-700 text-sm">Beginning Cash Balance</td>
                              {periods.map((period, index) => {
                                const periodIndex = periods.indexOf(period)
                                const prevPeriod = periodIndex > 0 ? periods[periodIndex - 1] : null
                                // Only show $70,000 beginning cash if this is September 2025 or later
                                const periodYear = parseInt(period.split('-')[0])
                                const periodMonth = period.includes('-') ? parseInt(period.split('-')[1]) : 0
                                const isBeforeBusinessStart = periodYear < 2025 || (periodYear === 2025 && periodMonth < 9)
                                const beginningCash = prevPeriod ? (periodData[prevPeriod]?.accounts?.['1000'] || 0) : (isBeforeBusinessStart ? 0 : 70000)
                                
                                return (
                                  <td key={period} className="text-right py-2 px-3 font-mono text-xs">
                                    {formatCurrency(beginningCash)}
                                  </td>
                                )
                              })}
                            </tr>
                            
                            {/* Ending Cash */}
                            <tr className="bg-blue-100 font-bold">
                              <td className="py-2 px-3 text-blue-900">Ending Cash Balance</td>
                              {periods.map(period => {
                                const endingCash = periodData[period]?.accounts?.['1000'] || 0
                                return (
                                  <td key={period} className="text-right py-2 px-3 text-blue-600 text-xs font-semibold">
                                    {formatCurrency(endingCash)}
                                  </td>
                                )
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}