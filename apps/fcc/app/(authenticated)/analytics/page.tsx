'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, TrendingUp, Building2, DollarSign, Calendar, BarChart3,
  Download, PieChart, TrendingDown, Activity, RefreshCw
} from 'lucide-react'
import { measurePageLoad } from '@/lib/performance-utils'
import { UnifiedPageHeader } from '@/components/ui/unified-page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/contexts/AuthContext'
import { formatNumber } from '@/lib/design-tokens'
import { SkeletonCard, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface VendorData {
  name: string
  totalSpend: number
  transactionCount: number
  lastTransaction: string
  growth?: number
}

interface SpendTrendData {
  date: string
  amount: number
}

interface CategoryData {
  category: string
  amount: number
  percentage: number
}

export default function BusinessAnalytics() {
  const router = useRouter()
  const { 
    hasData,
    hasActiveToken, 
    checkAuthStatus, 
    isLoading: authLoading,
    isSyncing,
    syncData
  } = useAuth()
  const [vendors, setVendors] = useState<VendorData[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')
  const [totalSpend, setTotalSpend] = useState(0)
  const [vendorCount, setVendorCount] = useState(0)
  const [topConcentration, setTopConcentration] = useState(0)
  const [spendTrend, setSpendTrend] = useState<SpendTrendData[]>([])
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryData[]>([])
  const [growthRate, setGrowthRate] = useState(0)

  // Measure page performance and check auth status on mount
  useEffect(() => {
    measurePageLoad('Business Analytics');
    console.log('[Analytics] Component mounted, checking auth status...')
    checkAuthStatus()
  }, [])

  useEffect(() => {
    console.log(`[Analytics] Auth state changed: authLoading=${authLoading}, hasActiveToken=${hasActiveToken}, hasData=${hasData}`)
    if (!authLoading) {
      // Always try to fetch data
      fetchVendorData()
      fetchSpendTrend()
      fetchCategoryBreakdown()
    }
  }, [timeRange, authLoading])

  const fetchVendorData = async () => {
    try {
      setLoading(true)
      console.log('[Analytics Page] Fetching vendor data for period:', timeRange)
      const response = await fetch(`/api/v1/analytics/top-vendors?period=${timeRange}`, {
        headers: { 'Cache-Control': 'max-age=600' }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('[Analytics Page] Received vendor data:', data)
        
        // Enhanced vendor data with growth metrics
        const enhancedVendors = data.topVendors?.map((vendor: any) => ({
          name: vendor.name,
          totalSpend: vendor.totalAmount,
          transactionCount: vendor.transactionCount,
          lastTransaction: vendor.lastTransaction,
          growth: vendor.growth || 0
        })) || []
        
        setVendors(enhancedVendors)
        
        // Calculate metrics
        const total = data.totalSpend || 0
        setTotalSpend(total)
        setVendorCount(data.vendorCount || 0)
        
        // Calculate top 5 concentration
        if (data.summary?.topVendorPercentage) {
          setTopConcentration(data.summary.topVendorPercentage)
        }
        
        // Calculate overall growth rate
        if (data.topVendors?.length > 0) {
          const avgGrowth = data.topVendors.reduce((sum: number, v: any) => sum + (v.growth || 0), 0) / data.topVendors.length
          setGrowthRate(avgGrowth)
        }
      }
    } catch (error) {
      console.error('Failed to fetch vendor data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSpendTrend = async () => {
    try {
      const response = await fetch(`/api/v1/analytics/spend-trend?period=${timeRange}`, {
        headers: { 'Cache-Control': 'max-age=600' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSpendTrend(data.trend || [])
      } else {
        console.error('Failed to fetch spend trend: HTTP', response.status)
        setSpendTrend([])
      }
    } catch (error) {
      console.error('Failed to fetch spend trend:', error)
      setSpendTrend([])
    }
  }

  const fetchCategoryBreakdown = async () => {
    try {
      const response = await fetch(`/api/v1/analytics/category-breakdown?period=${timeRange}`, {
        headers: { 'Cache-Control': 'max-age=600' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCategoryBreakdown(data.categories || [])
      } else {
        console.error('Failed to fetch category breakdown: HTTP', response.status)
        setCategoryBreakdown([])
      }
    } catch (error) {
      console.error('Failed to fetch category breakdown:', error)
      setCategoryBreakdown([])
    }
  }


  const formatCurrency = (amount: number) => {
    return formatNumber(amount, { currency: true, decimals: 2, abbreviate: true })
  }

  const exportData = () => {
    // Prepare CSV data
    const csvData = [
      ['Vendor Analytics Report', `Period: ${timeRange}`],
      [''],
      ['Summary'],
      ['Total Spend', formatCurrency(totalSpend)],
      ['Active Vendors', vendorCount],
      ['Average Growth Rate', `${growthRate.toFixed(1)}%`],
      [''],
      ['Top Vendors'],
      ['Rank', 'Vendor', 'Total Spend', 'Transactions', '% of Total', 'Growth']
    ]
    
    vendors.forEach((vendor, index) => {
      csvData.push([
        (index + 1).toString(),
        vendor.name,
        formatCurrency(vendor.totalSpend),
        vendor.transactionCount.toString(),
        `${((vendor.totalSpend / totalSpend) * 100).toFixed(1)}%`,
        `${vendor.growth?.toFixed(1) || 0}%`
      ])
    })
    
    // Convert to CSV string
    const csv = csvData.map(row => row.join(',')).join('\n')
    
    // Download file
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const COLORS = [
    'var(--brand-blue)', 
    'var(--brand-purple)', 
    'var(--brand-red)', 
    'var(--brand-amber)', 
    'var(--brand-emerald)',
    'var(--brand-blue-light)',
    'var(--brand-red-light)'
  ]

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <UnifiedPageHeader 
          title="Business Analytics"
          description="Analyze your business performance with detailed vendor insights and spending trends"
          showAuthStatus={true}
          showTimeRangeSelector={true}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          actions={
            vendors.length > 0 && (
              <button
                onClick={exportData}
                className="px-4 py-2 bg-brand-blue text-brand-blue rounded-lg hover:bg-brand-blue/20 transition-colors flex items-center gap-2 border border-brand-blue"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            )
          }
        />

        {authLoading || loading ? (
          <>
            {/* Loading Skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(5)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <SkeletonChart />
              <SkeletonChart />
            </div>
            <div className="bg-secondary border border-default rounded-2xl p-4 sm:p-6">
              <SkeletonTable />
            </div>
          </>
        ) : (
          <>
            {/* Enhanced Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-blue rounded-xl">
                    <DollarSign className="h-6 w-6 text-brand-blue" />
                  </div>
                  <span className={`text-xs font-medium ${growthRate >= 0 ? 'text-brand-emerald' : 'text-brand-red'}`}>
                    {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {totalSpend > 0 ? formatCurrency(totalSpend) : '-'}
                </div>
                <div className="text-sm text-tertiary mt-1">Total Spend</div>
              </div>

              <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-emerald rounded-xl">
                    <Building2 className="h-6 w-6 text-brand-emerald" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {vendorCount > 0 ? vendorCount : '-'}
                </div>
                <div className="text-sm text-tertiary mt-1">Active Vendors</div>
              </div>

              <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-purple rounded-xl">
                    <BarChart3 className="h-6 w-6 text-brand-purple" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {topConcentration > 0 ? `${topConcentration.toFixed(1)}%` : '-'}
                </div>
                <div className="text-sm text-tertiary mt-1">Top 5 Concentration</div>
              </div>

              <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-blue rounded-xl">
                    <TrendingUp className="h-6 w-6 text-brand-blue" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white truncate">
                  {vendors[0]?.name || '-'}
                </div>
                <div className="text-sm text-tertiary mt-1">Top Vendor</div>
              </div>

              <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-amber rounded-xl">
                    <Activity className="h-6 w-6 text-brand-amber" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">
                  {totalSpend > 0 && vendorCount > 0 ? formatCurrency(totalSpend / vendorCount) : '-'}
                </div>
                <div className="text-sm text-tertiary mt-1">Avg per Vendor</div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Spend Trend Chart */}
              <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6">
                <h2 className="text-xl font-semibold text-white mb-6">Spend Trend</h2>
                {spendTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={spendTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value)
                        return timeRange === 'year' 
                          ? date.toLocaleDateString('en-GB', { month: 'short' })
                          : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      }}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any) => formatCurrency(value)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="var(--brand-blue)" 
                      strokeWidth={2}
                      dot={{ fill: 'var(--brand-blue)', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <TrendingUp className="h-12 w-12 text-gray-600 mb-3" />
                    <p className="text-gray-400 text-lg font-medium">No spend data available</p>
                    <p className="text-gray-500 text-sm mt-1">Transaction data will appear here once synced</p>
                  </div>
                )}
              </div>

              {/* Category Breakdown */}
              <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6">
                <h2 className="text-xl font-semibold text-white mb-6">Expense Breakdown</h2>
                {categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ percentage }) => `${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any) => formatCurrency(value)}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => value}
                    />
                  </RePieChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <PieChart className="h-12 w-12 text-gray-600 mb-3" />
                    <p className="text-gray-400 text-lg font-medium">No category data available</p>
                    <p className="text-gray-500 text-sm mt-1">Categories will be shown once transactions are synced</p>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Top Vendors Table */}
            <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Top Vendors Analysis</h2>
              
              {vendors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-tertiary">Rank</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-tertiary">Vendor</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-tertiary">Total Spend</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-tertiary">Transactions</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-tertiary">% of Total</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-tertiary">Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.map((vendor, index) => (
                        <tr key={index} className="border-b border-default hover:bg-slate-800/50">
                          <td className="py-4 px-4">
                            <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
                              <span className="text-indigo-400 font-semibold">{index + 1}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-white font-medium">{vendor.name}</span>
                          </td>
                          <td className="py-4 px-4 text-right text-white font-medium">
                            {formatCurrency(vendor.totalSpend)}
                          </td>
                          <td className="py-4 px-4 text-right text-tertiary">
                            {vendor.transactionCount}
                          </td>
                          <td className="py-4 px-4 text-right text-tertiary">
                            {totalSpend > 0 ? ((vendor.totalSpend / totalSpend) * 100).toFixed(1) : '0.0'}%
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={`font-medium ${
                              (vendor.growth || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {(vendor.growth || 0) >= 0 ? '+' : ''}{vendor.growth?.toFixed(1) || 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-tertiary">No vendor data available for this period</p>
                </div>
              )}
            </div>

            {/* Additional Analytics Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <PieChart className="h-5 w-5 mr-2 text-indigo-400" />
                  Vendor Insights
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-tertiary">Average Transaction Size</span>
                    <span className="text-white font-medium">
                      {vendors.length > 0 ? formatCurrency(vendors.reduce((sum, v) => sum + (v.totalSpend / v.transactionCount), 0) / vendors.length) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-tertiary">Most Active Vendor</span>
                    <span className="text-white font-medium">
                      {vendors.length > 0 ? vendors.reduce((max, v) => v.transactionCount > (max?.transactionCount || 0) ? v : max, vendors[0])?.name : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-tertiary">Fastest Growing</span>
                    <span className="text-white font-medium">
                      {vendors.length > 0 ? vendors.reduce((max, v) => (v.growth || 0) > (max?.growth || 0) ? v : max, vendors[0])?.name : '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-emerald-400" />
                  Performance Metrics
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-tertiary">Daily Average Spend</span>
                    <span className="text-white font-medium">
                      {totalSpend > 0 ? formatCurrency(totalSpend / (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365)) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-tertiary">Vendor Efficiency</span>
                    <span className="text-white font-medium">
                      {vendors.length > 0 ? `${((vendors.filter(v => (v.growth || 0) < 0).length / vendors.length) * 100).toFixed(0)}% reducing` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-tertiary">Concentration Risk</span>
                    <span className={`font-medium ${topConcentration > 70 ? 'text-amber-400' : 'text-green-400'}`}>
                      {topConcentration > 70 ? 'High' : topConcentration > 50 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}