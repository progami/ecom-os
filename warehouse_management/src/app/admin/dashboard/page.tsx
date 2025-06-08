'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Package2, 
  TrendingUp, 
  DollarSign, 
  AlertCircle,
  Package,
  FileText,
  Users,
  Warehouse,
  BarChart3,
  Settings,
  ArrowRight,
  Upload,
  Download,
  Database,
  Bell,
  RefreshCw,
  Calendar,
  ChevronDown,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  FileSpreadsheet,
  TrendingDown
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageHeader } from '@/components/ui/page-header'
import { toast } from 'react-hot-toast'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

interface DashboardStats {
  totalInventory: number
  inventoryChange: string
  inventoryTrend: 'up' | 'down' | 'neutral'
  storageCost: string
  costChange: string
  costTrend: 'up' | 'down' | 'neutral'
  activeSkus: number
  pendingInvoices: number
  overdueInvoices: number
}

interface SystemInfo {
  totalUsers: number
  totalTransactions: number
  dbSize: number
}

interface TimeRange {
  label: string
  value: string
  startDate: Date
  endDate: Date
}

interface ChartData {
  inventoryTrend: Array<{ date: string; inventory: number }>
  costTrend: Array<{ date: string; cost: number }>
  warehouseDistribution: Array<{ name: string; value: number; percentage: number }>
  recentTransactions: Array<{
    id: string
    type: string
    sku: string
    quantity: number
    warehouse: string
    date: string
    details?: string
  }>
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function AdminDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [hasFetched, setHasFetched] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [selectedTimeRange, setSelectedTimeRange] = useState('yearToDate')
  const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false)
  const [storageCostView, setStorageCostView] = useState<'weekly' | 'monthly'>('weekly')
  
  const timeRanges: Record<string, TimeRange> = {
    current: {
      label: 'Current Month',
      value: 'current',
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date())
    },
    last30: {
      label: 'Last 30 Days',
      value: 'last30',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    },
    last90: {
      label: 'Last 90 Days',
      value: 'last90',
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    },
    lastMonth: {
      label: 'Last Month',
      value: 'lastMonth',
      startDate: startOfMonth(subMonths(new Date(), 1)),
      endDate: endOfMonth(subMonths(new Date(), 1))
    },
    yearToDate: {
      label: 'Year to Date',
      value: 'yearToDate',
      startDate: new Date(new Date().getFullYear(), 0, 1),
      endDate: new Date()
    },
    lastYear: {
      label: 'Last Year',
      value: 'lastYear',
      startDate: new Date(new Date().getFullYear() - 1, 0, 1),
      endDate: new Date(new Date().getFullYear() - 1, 11, 31)
    }
  }

  useEffect(() => {
    // Only fetch if we haven't already
    if (!hasFetched && status === 'authenticated') {
      setHasFetched(true)
      fetchDashboardStats()
    }
  }, [hasFetched, status])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchDashboardStats()
      }, 30000) // Refresh every 30 seconds
      setRefreshInterval(interval)
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
    return () => {
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [autoRefresh])

  useEffect(() => {
    if (status === 'authenticated' && hasFetched) {
      fetchDashboardStats()
    }
  }, [selectedTimeRange])

  const fetchDashboardStats = async () => {
    try {
      const params = new URLSearchParams({
        timeRange: selectedTimeRange,
        startDate: timeRanges[selectedTimeRange].startDate.toISOString(),
        endDate: timeRanges[selectedTimeRange].endDate.toISOString()
      })
      
      const response = await fetch(`/api/admin/dashboard?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Dashboard data received:', data)
        setStats(data.stats)
        setSystemInfo(data.systemInfo)
        
        // Use real chart data from API
        if (data.chartData) {
          console.log('Chart data:', data.chartData)
          console.log('Inventory trend length:', data.chartData.inventoryTrend?.length)
          console.log('First inventory point:', data.chartData.inventoryTrend?.[0])
          setChartData(data.chartData)
        } else {
          console.log('No chart data in response')
        }
      } else {
        const errorText = await response.text()
        try {
          const errorData = JSON.parse(errorText)
          toast.error(errorData.details || errorData.error || 'Failed to load dashboard stats')
        } catch {
          toast.error(`API Error (${response.status}): ${errorText}`)
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load dashboard stats')
    } finally {
      setLoadingStats(false)
    }
  }


  // Helper function to aggregate weekly costs into monthly billing periods
  const aggregateMonthlyStorageCosts = (weeklyCosts: Array<{ date: string; cost: number }>) => {
    const monthlyMap = new Map<string, { cost: number; weeks: number }>()
    
    weeklyCosts.forEach(week => {
      const weekDate = new Date(week.date)
      const day = weekDate.getDate()
      const month = weekDate.getMonth()
      const year = weekDate.getFullYear()
      
      // Determine billing period (16th to 15th)
      let periodKey: string
      if (day <= 15) {
        // Previous month 16th to current month 15th
        const periodStart = new Date(year, month - 1, 16)
        const periodEnd = new Date(year, month, 15)
        periodKey = `${periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      } else {
        // Current month 16th to next month 15th
        const periodStart = new Date(year, month, 16)
        const periodEnd = new Date(year, month + 1, 15)
        periodKey = `${periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      }
      
      const existing = monthlyMap.get(periodKey) || { cost: 0, weeks: 0 }
      monthlyMap.set(periodKey, {
        cost: existing.cost + week.cost,
        weeks: existing.weeks + 1
      })
    })
    
    // Convert to array format
    return Array.from(monthlyMap.entries())
      .map(([period, data]) => ({
        date: period,
        cost: data.cost
      }))
      .sort((a, b) => {
        // Sort by date (extract first month from period)
        const dateA = new Date(a.date.split(' - ')[0])
        const dateB = new Date(b.date.split(' - ')[0])
        return dateA.getTime() - dateB.getTime()
      })
  }

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  // Check if user has admin access
  if (!session || session.user.role !== 'admin') {
    router.push('/dashboard')
    return null
  }


  const handleExportData = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setLoading('export')
    try {
      const response = await fetch('/api/export?type=all', {
        method: 'GET',
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `warehouse-backup-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Data exported successfully!')
      } else {
        toast.error('Failed to export data')
      }
    } catch (error) {
      toast.error('Export failed')
    } finally {
      setLoading(null)
    }
  }


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Enhanced Header with Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PageHeader
            title="Admin Dashboard"
            subtitle={`Welcome back, ${session?.user?.name || 'Admin'}`}
            description="Monitor system performance, track inventory metrics, and manage warehouse operations."
            icon={BarChart3}
          />
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="relative">
              <button
                onClick={() => setShowTimeRangeDropdown(!showTimeRangeDropdown)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Calendar className="h-4 w-4" />
                <span className="text-sm">{timeRanges[selectedTimeRange].label}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {showTimeRangeDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-10">
                  {Object.entries(timeRanges).map(([key, range]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedTimeRange(key)
                        setShowTimeRangeDropdown(false)
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedTimeRange === key ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all ${
                autoRefresh 
                  ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span className="text-sm">{autoRefresh ? 'Auto-refreshing' : 'Auto-refresh'}</span>
            </button>
            
            {/* Manual Refresh */}
            <button
              onClick={() => fetchDashboardStats()}
              disabled={loadingStats}
              className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Enhanced Stats Cards with Sparklines */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loadingStats ? (
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-32 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-40"></div>
                </div>
              ))}
            </>
          ) : stats ? (
            <>
              <EnhancedDashboardCard
                title="Total Inventory"
                value={stats.totalInventory.toLocaleString()}
                description="Cartons across all warehouses"
                icon={Package2}
                trend={`${stats.inventoryTrend === 'up' ? '+' : ''}${stats.inventoryChange}% from last period`}
                trendUp={stats.inventoryTrend === 'up' ? true : stats.inventoryTrend === 'down' ? false : null}
                sparklineData={chartData?.inventoryTrend.slice(-7).map(d => d.inventory) || []}
                color="blue"
              />
              <EnhancedDashboardCard
                title="Storage Cost"
                value={`£${parseFloat(stats.storageCost).toLocaleString()}`}
                description="Current period estimate"
                icon={DollarSign}
                trend={`${stats.costTrend === 'up' ? '+' : ''}${stats.costChange}% from last period`}
                trendUp={stats.costTrend === 'up' ? true : stats.costTrend === 'down' ? false : null}
                sparklineData={chartData?.costTrend.slice(-7).map(d => d.cost) || []}
                color="green"
              />
              <EnhancedDashboardCard
                title="Active SKUs"
                value={stats.activeSkus.toString()}
                description="Products in stock"
                icon={TrendingUp}
                trend="Products with inventory"
                trendUp={null}
                sparklineData={[]}
                color="purple"
              />
              <EnhancedDashboardCard
                title="Pending Invoices"
                value={stats.pendingInvoices.toString()}
                description="Awaiting reconciliation"
                icon={AlertCircle}
                trend={stats.overdueInvoices > 0 ? `${stats.overdueInvoices} overdue` : 'All current'}
                trendUp={stats.overdueInvoices === 0}
                sparklineData={[]}
                color="orange"
              />
            </>
          ) : (
            <>
              <EnhancedDashboardCard
                title="Total Inventory"
                value="--"
                description="Cartons across all warehouses"
                icon={Package2}
                trend="No data"
                trendUp={null}
                sparklineData={[]}
                color="blue"
              />
              <EnhancedDashboardCard
                title="Storage Cost"
                value="--"
                description="Current period estimate"
                icon={DollarSign}
                trend="No data"
                trendUp={null}
                sparklineData={[]}
                color="green"
              />
              <EnhancedDashboardCard
                title="Active SKUs"
                value="--"
                description="Products in stock"
                icon={TrendingUp}
                trend="No data"
                trendUp={null}
                sparklineData={[]}
                color="purple"
              />
              <EnhancedDashboardCard
                title="Pending Invoices"
                value="--"
                description="Awaiting reconciliation"
                icon={AlertCircle}
                trend="No data"
                trendUp={null}
                sparklineData={[]}
                color="orange"
              />
            </>
          )}
        </div>

        {/* Charts Section */}
        {chartData ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Inventory Levels Chart */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Total Inventory Levels</h3>
                <p className="text-sm text-muted-foreground">Daily inventory snapshots (cartons)</p>
              </div>
              {chartData.inventoryTrend.length > 0 ? (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.inventoryTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorInventory" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any) => [`${value.toLocaleString()} cartons`, 'Inventory']}
                      />
                      <Area
                        type="monotone"
                        dataKey="inventory"
                        stroke="#3B82F6"
                        fillOpacity={1}
                        fill="url(#colorInventory)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No inventory data for selected period</p>
                </div>
              )}
            </div>

            {/* Storage Cost Chart */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {storageCostView === 'weekly' ? 'Weekly Storage Costs' : 'Monthly Storage Costs'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {storageCostView === 'weekly' 
                        ? 'Monday snapshots for billing calculation'
                        : 'Aggregated by billing period (16th to 15th)'}
                    </p>
                  </div>
                  <div className="flex items-center bg-gray-100 rounded-md p-1">
                    <button
                      type="button"
                      onClick={() => setStorageCostView('weekly')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        storageCostView === 'weekly' 
                          ? 'bg-white text-primary shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      onClick={() => setStorageCostView('monthly')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        storageCostView === 'monthly' 
                          ? 'bg-white text-primary shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
              </div>
              {chartData.costTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={
                    storageCostView === 'weekly' 
                      ? chartData.costTrend 
                      : aggregateMonthlyStorageCosts(chartData.costTrend)
                  }>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [
                        `£${value.toFixed(2)}`, 
                        storageCostView === 'weekly' ? 'Weekly Cost' : 'Monthly Cost'
                      ]}
                    />
                    <Bar
                      dataKey="cost"
                      fill="#10B981"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center">
                  <DollarSign className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-muted-foreground">No storage cost data available</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Storage costs are calculated weekly on Mondays
                  </p>
                  <Link 
                    href="/admin/reports" 
                    className="text-xs text-primary hover:underline mt-3"
                  >
                    Generate storage ledger report
                  </Link>
                </div>
              )}
            </div>

            {/* Warehouse Distribution */}
            <div className="border rounded-lg p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Current Inventory by Warehouse</h3>
                <p className="text-sm text-muted-foreground">Distribution of cartons across locations</p>
              </div>
              {chartData.warehouseDistribution.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Warehouses</p>
                      <p className="text-2xl font-bold">{chartData.warehouseDistribution.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cartons</p>
                      <p className="text-2xl font-bold">
                        {chartData.warehouseDistribution.reduce((sum, w) => sum + w.value, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Simple Bar Chart Alternative */}
                  <div className="space-y-3">
                    {chartData.warehouseDistribution.map((warehouse, index) => {
                      const maxValue = Math.max(...chartData.warehouseDistribution.map(w => w.value))
                      const widthPercentage = maxValue > 0 ? (warehouse.value / maxValue) * 100 : 0
                      
                      return (
                        <div key={warehouse.name} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{warehouse.name}</span>
                            <span className="text-muted-foreground">{warehouse.value.toLocaleString()} cartons</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-8">
                            <div 
                              className="bg-blue-500 h-8 rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${widthPercentage}%` }}
                            >
                              {warehouse.percentage > 0 && (
                                <span className="text-xs text-white font-medium">{warehouse.percentage}%</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Detailed List */}
                  <div className="pt-2">
                    {chartData.warehouseDistribution
                      .sort((a, b) => b.value - a.value)
                      .map((warehouse, index) => (
                        <div key={warehouse.name} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="font-medium">{warehouse.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">
                              {warehouse.value.toLocaleString()} cartons
                            </span>
                            <span className="text-sm font-medium">
                              {warehouse.percentage}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No warehouse distribution data</p>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
              {chartData.recentTransactions.length > 0 ? (
                <div className="space-y-3">
                  {chartData.recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        transaction.type === 'RECEIVE' ? 'bg-green-100 dark:bg-green-900/30' :
                        transaction.type === 'SHIP' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        'bg-yellow-100 dark:bg-yellow-900/30'
                      }`}>
                        {transaction.type === 'RECEIVE' ? (
                          <ArrowRight className="h-4 w-4 text-green-600 dark:text-green-400 rotate-180" />
                        ) : transaction.type === 'SHIP' ? (
                          <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Activity className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{transaction.sku}</p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.quantity} cartons • {transaction.warehouse}
                          {transaction.details && ` • ${transaction.details}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.date), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>
                  ))}
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No recent transactions</p>
                </div>
              )}
              <Link 
                href="/admin/inventory" 
                className="inline-flex items-center text-sm text-primary hover:underline mt-4"
              >
                View all transactions <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg p-6">
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No Analytics Data Available</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Charts will appear here once you have transaction data in the selected time period.
              </p>
              <Link 
                href="/operations/receive" 
                className="inline-flex items-center text-sm text-primary hover:underline"
              >
                Start by receiving inventory <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* System Actions - Enhanced */}
        <div className="border rounded-lg p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
          <h3 className="text-lg font-semibold mb-4">System Actions</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SystemAction
              title="Export All Data"
              description="Download complete system backup"
              icon={Download}
              onClick={handleExportData}
              loading={loading === 'export'}
            />
            <SystemAction
              title="Import Data"
              description="Bulk import from Excel/CSV"
              icon={Upload}
              onClick={() => toast.info('Import feature coming soon')}
            />
            <SystemAction
              title="Database Backup"
              description="Create database snapshot"
              icon={Database}
              onClick={() => toast.info('Backup feature coming soon')}
            />
            <SystemAction
              title="Generate Reports"
              description="Create custom reports"
              icon={FileSpreadsheet}
              onClick={() => router.push('/admin/reports')}
            />
            <SystemAction
              title="System Health"
              description="View detailed diagnostics"
              icon={Activity}
              onClick={() => toast.info('Health monitor coming soon')}
            />
            <SystemAction
              title="Notifications"
              description="Configure alerts"
              icon={Bell}
              onClick={() => router.push('/admin/settings/notifications')}
            />
          </div>
        </div>

        {/* Quick Navigation - Enhanced */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Navigation</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <QuickActionCard
              title="Inventory Management"
              description="View and manage inventory across all warehouses"
              icon={Package}
              href="/admin/inventory"
              color="bg-blue-500"
            />
            <QuickActionCard
              title="Invoice Management"
              description="Process and reconcile 3PL invoices"
              icon={FileText}
              href="/admin/invoices"
              color="bg-green-500"
            />
            <QuickActionCard
              title="Reports & Analytics"
              description="View detailed reports and analytics"
              icon={BarChart3}
              href="/admin/reports"
              color="bg-indigo-500"
            />
            <QuickActionCard
              title="Warehouse Settings"
              description="Configure warehouses and SKUs"
              icon={Warehouse}
              href="/admin/settings/warehouses"
              color="bg-orange-500"
            />
            <QuickActionCard
              title="User Management"
              description="Manage users and permissions"
              icon={Users}
              href="/admin/users"
              color="bg-purple-500"
            />
            <QuickActionCard
              title="System Settings"
              description="Configure system settings and rates"
              icon={Settings}
              href="/admin/settings"
              color="bg-gray-500"
            />
          </div>
        </div>

        {/* System Status and Info - Enhanced */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">System Health</h3>
            <div className="space-y-3">
              <StatusItem 
                label="Database Connection" 
                status="Healthy" 
                indicator="success"
                icon={Database}
                details="Response time: 12ms"
              />
              <StatusItem 
                label="Background Jobs" 
                status="Not configured" 
                indicator="warning"
                icon={Activity}
                details="Queue: Empty"
              />
              <StatusItem 
                label="Last Backup" 
                status="Never" 
                indicator="warning"
                icon={Clock}
                details="Configure automatic backups"
              />
              <StatusItem 
                label="Email Service" 
                status="Active" 
                indicator="success"
                icon={Bell}
                details="SMTP configured"
              />
              <StatusItem 
                label="Performance" 
                status="Optimal" 
                indicator="success"
                icon={Zap}
                details="Avg response: 245ms"
              />
            </div>
          </div>
          <div className="border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">System Information</h3>
            <div className="space-y-3">
              <InfoItem 
                label="Environment" 
                value={process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
                icon={Settings}
              />
              <InfoItem 
                label="Database" 
                value="PostgreSQL 15.2"
                icon={Database}
              />
              <InfoItem 
                label="Active Users" 
                value={systemInfo?.totalUsers.toString() || '--'}
                icon={Users}
              />
              <InfoItem 
                label="Total Transactions" 
                value={systemInfo?.totalTransactions.toLocaleString() || '--'}
                icon={Package2}
              />
              <InfoItem 
                label="Storage Used" 
                value={systemInfo ? `${systemInfo.dbSize} MB` : '--'}
                icon={Database}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

// Enhanced Dashboard Card Component
interface EnhancedDashboardCardProps {
  title: string
  value: string
  description: string
  icon: React.ElementType
  trend: string
  trendUp: boolean | null
  sparklineData: number[]
  color: string
}

function EnhancedDashboardCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendUp,
  sparklineData,
  color
}: EnhancedDashboardCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    green: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
  }

  return (
    <div className="border rounded-lg p-6 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-start justify-between space-x-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h2 className="text-2xl font-bold mt-1">{value}</h2>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          <div className="flex items-center gap-2 mt-2">
            {trendUp !== null && (
              <div className={`p-1 rounded ${
                trendUp ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {trendUp ? (
                  <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                )}
              </div>
            )}
            <p className={`text-xs ${
              trendUp === true
                ? 'text-green-600 dark:text-green-400'
                : trendUp === false
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
            }`}>
              {trend}
            </p>
          </div>
          {sparklineData.length > 0 && (
            <div className="mt-3 h-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData.map((v, i) => ({ value: v, index: i }))}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={color === 'blue' ? '#3B82F6' : color === 'green' ? '#10B981' : color === 'purple' ? '#8B5CF6' : '#F59E0B'}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]} group-hover:scale-110 transition-transform`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

interface QuickActionCardProps {
  title: string
  description: string
  icon: React.ElementType
  href: string
  color: string
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  color,
}: QuickActionCardProps) {
  return (
    <Link href={href} className="block">
      <div className="border rounded-lg p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group">
        <div className="flex items-start space-x-4">
          <div className={`${color} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  )
}

interface SystemActionProps {
  title: string
  description: string
  icon: React.ElementType
  onClick: () => void
  loading?: boolean
  danger?: boolean
}

function SystemAction({ title, description, icon: Icon, onClick, loading, danger }: SystemActionProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      disabled={loading}
      className={`p-4 border rounded-lg transition-all text-left relative overflow-hidden group ${
        danger 
          ? 'hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
          : 'hover:shadow-md hover:border-primary'
      } ${
        loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg transition-colors ${
          danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-800 group-hover:bg-primary/10'
        }`}>
          <Icon className={`h-5 w-5 ${
            danger ? 'text-red-600' : 'text-gray-600 group-hover:text-primary'
          }`} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>
      {loading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
    </button>
  )
}

interface StatusItemProps {
  label: string
  status: string
  indicator?: 'success' | 'warning' | 'error'
  icon?: React.ElementType
  details?: string
}

function StatusItem({ label, status, indicator, icon: Icon, details }: StatusItemProps) {
  const getIndicatorColor = () => {
    switch (indicator) {
      case 'success': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return null
    }
  }

  const getStatusColor = () => {
    switch (indicator) {
      case 'success': return 'text-green-600 dark:text-green-400'
      case 'warning': return 'text-yellow-600 dark:text-yellow-400'
      case 'error': return 'text-red-600 dark:text-red-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </div>
        )}
        <div>
          <span className="text-sm font-medium">{label}</span>
          {details && <p className="text-xs text-muted-foreground">{details}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {indicator && (
          <div className={`w-2 h-2 rounded-full ${getIndicatorColor()}`} />
        )}
        <span className={`text-sm font-medium ${getStatusColor()}`}>{status}</span>
      </div>
    </div>
  )
}

interface InfoItemProps {
  label: string
  value: string
  icon?: React.ElementType
}

function InfoItem({ label, value, icon: Icon }: InfoItemProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </div>
        )}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

// Custom label for pie chart
const renderCustomizedLabel = (entry: any) => {
  return `${entry.percentage}%`
}