'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  FileText, Activity, TrendingUp, TrendingDown, AlertCircle, 
  BarChart3, ArrowLeft, Zap, Cloud,
  DollarSign, Building2, Receipt, Clock, 
  Wallet, ArrowUpRight, CreditCard, CheckCircle,
  BookOpen, AlertTriangle, RefreshCw, PieChart,
  TrendingUp as TrendingUpIcon, FileBarChart, Banknote
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { measurePageLoad } from '@/lib/performance-utils'
import { UnifiedPageHeader } from '@/components/ui/unified-page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonMetricCard, SkeletonTransactionList } from '@/components/ui/skeleton'
import { ReconciliationTracker } from '@/components/bookkeeping/reconciliation-tracker'
import { calculateHealthScore } from '@/lib/financial-calculations'
import { formatNumber } from '@/lib/design-tokens'
import { format } from 'date-fns'

interface FinancialOverview {
  cashInBank: number
  balanceSheet: {
    totalAssets: number
    totalLiabilities: number
    netAssets: number
  }
  profitLoss: {
    revenue: number
    expenses: number
    netProfit: number
  }
  vatLiability: number
  netCashFlow: number
  periodComparison: {
    revenueChange: number
    profitChange: number
  }
  healthScore?: number
  // New fields from financial overview API
  keyMetrics?: {
    currentRatio: number
    profitMargin: number
    workingCapital: number
    overdueReceivables: number
    overduePayables: number
    debtToEquityRatio: number
    quickRatio: number
  }
}

interface BankAccount {
  id: string
  name: string
  currency: string
  balance: number
  unreconciledCount: number
  lastUpdated: string
}

interface DashboardStats {
  financial: FinancialOverview
  bankAccounts: BankAccount[]
  reconciliation: {
    totalUnreconciled: number
    needsAttention: number
    reconciliationRate: number
  }
  recentTransactions: Array<{
    id: string
    date: string
    description: string
    amount: number
    type: 'SPEND' | 'RECEIVE'
    status: 'reconciled' | 'unreconciled'
    bankAccount: string
  }>
}

export default function BookkeepingDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { 
    hasData, 
    hasActiveToken, 
    organization, 
    lastSync,
    isLoading: authLoading,
    isSyncing,
    connectToXero,
    syncData,
    checkAuthStatus 
  } = useAuth()
  
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')

  // Measure page performance after component mounts
  useEffect(() => {
    measurePageLoad('Bookkeeping Dashboard');
  }, []);

  useEffect(() => {
    // Check for OAuth callback params
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    if (connected === 'true') {
      toast.success('Successfully connected to Xero!')
      // Re-check auth status to update the UI
      checkAuthStatus()
    } else if (error) {
      toast.error(`Failed to connect to Xero: ${error}`)
    }
  }, [searchParams, checkAuthStatus])

  useEffect(() => {
    // Always try to fetch dashboard data
    if (!authLoading) {
      fetchDashboardData()
    }
  }, [authLoading, timeRange])

  const fetchDashboardData = async () => {
    try {
      setDataLoading(true)
      
      // Fetch multiple data sources in parallel with cache headers
      // Always use local database endpoints
      const [financialOverviewRes, statsResponse, accountsResponse] = await Promise.all([
        fetch('/api/v1/xero/reports/financial-overview', {
          headers: { 'Cache-Control': 'max-age=300' }
        }),
        fetch('/api/v1/bookkeeping/stats', {
          headers: { 'Cache-Control': 'max-age=60' }
        }),
        fetch('/api/v1/bookkeeping/bank-accounts', {
          headers: { 'Cache-Control': 'max-age=180' }
        })
      ])

      const financialOverviewData = financialOverviewRes.ok ? await financialOverviewRes.json() : null
      const statsData = statsResponse.ok ? await statsResponse.json() : null
      const accountsData = accountsResponse.ok ? await accountsResponse.json() : null

      // Extract data from the financial overview API response
      const overview = financialOverviewData?.overview || {}
      const reports = financialOverviewData?.reports || {}
      
      // Calculate values for health score
      const cashInBank = overview.cashPosition || 
                        accountsData?.accounts?.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0) || 0
      const totalAssets = overview.totalAssets || 0
      const totalLiabilities = overview.totalLiabilities || 0
      const netAssets = overview.netWorth || 0
      const revenue = overview.totalRevenue || 0
      const expenses = overview.totalExpenses || 0
      const netProfit = overview.netProfit || 0
      const currentAssets = reports.balanceSheet?.currentAssets || 0
      const currentLiabilities = reports.balanceSheet?.currentLiabilities || 0

      // Calculate financial health score
      const healthScore = calculateHealthScore(
        cashInBank,
        revenue,
        expenses,
        netProfit,
        currentAssets,
        currentLiabilities
      )

      // Transform and combine data
      setStats({
        financial: {
          // Use cash from financial overview
          cashInBank,
          balanceSheet: {
            totalAssets,
            totalLiabilities,
            netAssets
          },
          profitLoss: {
            revenue,
            expenses,
            netProfit
          },
          vatLiability: reports.balanceSheet?.vatLiability || 0,
          netCashFlow: overview.netCashFlow || netProfit,
          periodComparison: {
            revenueChange: 0, // TODO: Calculate from historical data
            profitChange: 0 // TODO: Calculate from historical data
          },
          healthScore,
          keyMetrics: {
            currentRatio: overview.currentRatio || 0,
            profitMargin: overview.profitMargin || 0,
            workingCapital: overview.workingCapital || 0,
            overdueReceivables: overview.overdueReceivables || 0,
            overduePayables: overview.overduePayables || 0,
            debtToEquityRatio: overview.debtToEquityRatio || 0,
            quickRatio: overview.quickRatio || 0
          }
        },
        bankAccounts: accountsData?.accounts?.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          currency: acc.currencyCode || 'GBP',
          balance: acc.balance || 0,
          unreconciledCount: acc.unreconciledTransactions || 0,
          lastUpdated: acc.lastSynced || new Date().toISOString()
        })) || [],
        reconciliation: {
          totalUnreconciled: accountsData?.totalUnreconciled || 0,
          needsAttention: accountsData?.accounts?.filter((acc: any) => acc.unreconciledTransactions > 10).length || 0,
          reconciliationRate: accountsData?.reconciliationRate || 0
        },
        recentTransactions: statsData?.recentTransactions || []
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setDataLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency = 'GBP') => {
    // Use locale-appropriate formatting for different currencies
    const locale = currency === 'USD' ? 'en-US' : 'en-GB';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Show loading while auth is checking
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-pulse" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <UnifiedPageHeader 
          title="Bookkeeping Dashboard"
          description="Manage your accounts and transactions"
          showAuthStatus={true}
          showTimeRangeSelector={true}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        {/* Content based on state */}
        {dataLoading ? (
        /* Loading dashboard data */
        <div className="space-y-8">
          {/* Financial Overview Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <SkeletonMetricCard key={i} />
            ))}
          </div>
          
          {/* Bank Accounts Skeleton */}
          <SkeletonTransactionList />
          
          {/* Transactions Skeleton */}
          <SkeletonTransactionList />
        </div>
      ) : (
        <>


          {/* Enhanced Financial Overview - Revolutionary Design */}
          <div className="relative mb-8">
            {/* Animated Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5 rounded-3xl blur-3xl animate-pulse" />
            
            {/* Main Financial Card */}
            <div className="relative bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
              
              {/* Header Section */}
              <div className="relative z-10 mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Financial Health Overview</h2>
                <p className="text-gray-400">Real-time financial metrics synchronized with Xero</p>
              </div>
              
              {/* Metrics Grid with Hover Effects */}
              <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Net Assets - Primary Metric */}
                <div className="group cursor-pointer">
                  <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-2xl p-6 border border-emerald-500/20 transition-all duration-500 hover:scale-105 hover:border-emerald-500/40">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-500/20 rounded-xl">
                          <Wallet className="h-6 w-6 text-emerald-400" />
                        </div>
                        {stats?.financial.periodComparison?.profitChange !== undefined && stats.financial.periodComparison.profitChange !== 0 && (
                          <div className="flex items-center gap-1">
                            {stats.financial.periodComparison.profitChange > 0 ? (
                              <TrendingUp className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-400" />
                            )}
                            <span className={`text-sm font-medium ${
                              stats.financial.periodComparison.profitChange > 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {Math.abs(stats.financial.periodComparison.profitChange).toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-sm text-gray-400 mb-1">Net Assets</p>
                        <p className="text-3xl font-bold text-white">
                          {formatCurrency(stats?.financial.balanceSheet.netAssets || 0)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Assets - Liabilities</span>
                        <span className="text-emerald-400">→</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Profit with Visual Indicator */}
                <div className="group cursor-pointer">
                  <div className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl p-6 border border-blue-500/20 transition-all duration-500 hover:scale-105 hover:border-blue-500/40">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-xl ${
                          (stats?.financial.profitLoss.netProfit || 0) >= 0 
                            ? 'bg-blue-500/20' 
                            : 'bg-red-500/20'
                        }`}>
                          {(stats?.financial.profitLoss.netProfit || 0) >= 0 ? (
                            <TrendingUp className="h-6 w-6 text-blue-400" />
                          ) : (
                            <TrendingDown className="h-6 w-6 text-red-400" />
                          )}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          (stats?.financial.profitLoss.netProfit || 0) >= 0
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {(stats?.financial.profitLoss.netProfit || 0) >= 0 ? 'Profit' : 'Loss'}
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-sm text-gray-400 mb-1">Net Result</p>
                        <p className={`text-3xl font-bold ${
                          (stats?.financial.profitLoss.netProfit || 0) >= 0 ? 'text-white' : 'text-red-400'
                        }`}>
                          {formatCurrency(stats?.financial.profitLoss.netProfit || 0)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          Rev: {formatCurrency(stats?.financial.profitLoss.revenue || 0)}
                        </span>
                        <span className="text-blue-400">→</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VAT Liability with Progress Indicator */}
                <div className="group cursor-pointer">
                  <div className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-2xl p-6 border border-purple-500/20 transition-all duration-500 hover:scale-105 hover:border-purple-500/40">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                          <Receipt className="h-6 w-6 text-purple-400" />
                        </div>
                        <Clock className="h-4 w-4 text-purple-400" />
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-sm text-gray-400 mb-1">VAT Liability</p>
                        <p className="text-3xl font-bold text-white">
                          {formatCurrency(Math.abs(stats?.financial.vatLiability || 0))}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Current quarter</span>
                        <span className="text-purple-400">→</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cash Flow with Animated Indicator */}
                <div className="group cursor-pointer">
                  <div className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-amber-600/10 rounded-2xl p-6 border border-amber-500/20 transition-all duration-500 hover:scale-105 hover:border-amber-500/40">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-500/20 rounded-xl">
                          <Activity className="h-6 w-6 text-amber-400" />
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${
                            (stats?.financial.netCashFlow || 0) >= 0 
                              ? 'bg-green-400 animate-pulse' 
                              : 'bg-red-400'
                          }`} />
                          <span className="text-xs text-gray-400">
                            {(stats?.financial.netCashFlow || 0) >= 0 ? 'Positive' : 'Negative'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-sm text-gray-400 mb-1">Net Profit/Loss</p>
                        <p className={`text-3xl font-bold ${
                          (stats?.financial.netCashFlow || 0) >= 0 ? 'text-white' : 'text-red-400'
                        }`}>
                          {formatCurrency(stats?.financial.netCashFlow || 0)}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Revenue - Expenses</span>
                        <span className="text-amber-400">→</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>

          {/* Financial Health Indicators */}
          {stats?.financial.keyMetrics && (
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center">
                <div className="w-1 h-6 bg-blue-500 rounded-full mr-3" />
                Financial Health Indicators
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Current Ratio */}
                <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <BarChart3 className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Current Ratio</p>
                        <p className="text-2xl font-bold text-white">
                          {stats.financial.keyMetrics.currentRatio.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className={`p-1 rounded-full ${
                      stats.financial.keyMetrics.currentRatio >= 1.5 
                        ? 'bg-green-500/20' 
                        : stats.financial.keyMetrics.currentRatio >= 1 
                        ? 'bg-amber-500/20' 
                        : 'bg-red-500/20'
                    }`}>
                      <CheckCircle className={`h-4 w-4 ${
                        stats.financial.keyMetrics.currentRatio >= 1.5 
                          ? 'text-green-400' 
                          : stats.financial.keyMetrics.currentRatio >= 1 
                          ? 'text-amber-400' 
                          : 'text-red-400'
                      }`} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {stats.financial.keyMetrics.currentRatio >= 1.5 
                      ? 'Excellent liquidity' 
                      : stats.financial.keyMetrics.currentRatio >= 1 
                      ? 'Adequate liquidity' 
                      : 'Low liquidity - attention needed'}
                  </p>
                </div>

                {/* Profit Margin */}
                <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Profit Margin</p>
                        <p className="text-2xl font-bold text-white">
                          {stats.financial.keyMetrics.profitMargin.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className={`p-1 rounded-full ${
                      stats.financial.keyMetrics.profitMargin >= 20 
                        ? 'bg-green-500/20' 
                        : stats.financial.keyMetrics.profitMargin >= 10 
                        ? 'bg-amber-500/20' 
                        : 'bg-red-500/20'
                    }`}>
                      <CheckCircle className={`h-4 w-4 ${
                        stats.financial.keyMetrics.profitMargin >= 20 
                          ? 'text-green-400' 
                          : stats.financial.keyMetrics.profitMargin >= 10 
                          ? 'text-amber-400' 
                          : 'text-red-400'
                      }`} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {stats.financial.keyMetrics.profitMargin >= 20 
                      ? 'Strong profitability' 
                      : stats.financial.keyMetrics.profitMargin >= 10 
                      ? 'Healthy margin' 
                      : 'Margin improvement needed'}
                  </p>
                </div>

                {/* Debt to Equity */}
                <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Activity className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Debt/Equity</p>
                        <p className="text-2xl font-bold text-white">
                          {stats.financial.keyMetrics.debtToEquityRatio.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className={`p-1 rounded-full ${
                      stats.financial.keyMetrics.debtToEquityRatio <= 0.5 
                        ? 'bg-green-500/20' 
                        : stats.financial.keyMetrics.debtToEquityRatio <= 1 
                        ? 'bg-amber-500/20' 
                        : 'bg-red-500/20'
                    }`}>
                      <CheckCircle className={`h-4 w-4 ${
                        stats.financial.keyMetrics.debtToEquityRatio <= 0.5 
                          ? 'text-green-400' 
                          : stats.financial.keyMetrics.debtToEquityRatio <= 1 
                          ? 'text-amber-400' 
                          : 'text-red-400'
                      }`} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {stats.financial.keyMetrics.debtToEquityRatio <= 0.5 
                      ? 'Low leverage - strong position' 
                      : stats.financial.keyMetrics.debtToEquityRatio <= 1 
                      ? 'Moderate leverage' 
                      : 'High leverage - monitor closely'}
                  </p>
                </div>

                {/* Overdue Receivables */}
                <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 rounded-lg">
                        <Clock className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Overdue AR</p>
                        <p className="text-2xl font-bold text-white">
                          {formatCurrency(stats.financial.keyMetrics.overdueReceivables)}
                        </p>
                      </div>
                    </div>
                    {stats.financial.keyMetrics.overdueReceivables > 0 && (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {stats.financial.keyMetrics.overdueReceivables === 0 
                      ? 'All receivables current' 
                      : 'Collection follow-up needed'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reports Quick Access Section */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center">
              <div className="w-1 h-6 bg-emerald-500 rounded-full mr-3" />
              Financial Reports
              <span className="ml-3 px-2 py-1 bg-emerald-500/20 rounded text-xs text-emerald-400 font-medium">NEW</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Profit & Loss Report */}
              <button
                onClick={() => router.push('/reports/profit-loss')}
                className="group relative overflow-hidden bg-gradient-to-br from-emerald-600/20 to-green-600/20 border border-emerald-500/30 rounded-2xl p-4 sm:p-6 hover:border-emerald-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-emerald-500/20 rounded-xl">
                      <TrendingUpIcon className="h-8 w-8 text-emerald-400" />
                    </div>
                    {stats?.financial.profitLoss.netProfit !== undefined && (
                      <span className={`text-sm font-semibold ${
                        stats.financial.profitLoss.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(stats.financial.profitLoss.netProfit)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Profit & Loss</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    Revenue, expenses, and profitability analysis
                  </p>
                  {stats?.financial.keyMetrics?.profitMargin !== undefined && (
                    <div className="mt-3 text-xs text-gray-500">
                      Profit Margin: {stats.financial.keyMetrics.profitMargin.toFixed(1)}%
                    </div>
                  )}
                </div>
              </button>

              {/* Balance Sheet Report */}
              <button
                onClick={() => router.push('/reports/balance-sheet')}
                className="group relative overflow-hidden bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-2xl p-4 sm:p-6 hover:border-blue-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                      <PieChart className="h-8 w-8 text-blue-400" />
                    </div>
                    {stats?.financial.balanceSheet.netAssets !== undefined && (
                      <span className="text-sm font-semibold text-blue-400">
                        {formatCurrency(stats.financial.balanceSheet.netAssets)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Balance Sheet</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    Assets, liabilities, and equity position
                  </p>
                  {stats?.financial.keyMetrics?.currentRatio !== undefined && (
                    <div className="mt-3 text-xs text-gray-500">
                      Current Ratio: {stats.financial.keyMetrics.currentRatio.toFixed(2)}
                    </div>
                  )}
                </div>
              </button>

              {/* Cash Flow Report */}
              <button
                onClick={() => router.push('/reports/cash-flow')}
                className="group relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-4 sm:p-6 hover:border-purple-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                      <Banknote className="h-8 w-8 text-purple-400" />
                    </div>
                    {stats?.financial.netCashFlow !== undefined && (
                      <span className={`text-sm font-semibold ${
                        stats.financial.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(stats.financial.netCashFlow)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Cash Flow</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    Cash movements and liquidity analysis
                  </p>
                  {stats?.financial.keyMetrics?.workingCapital !== undefined && (
                    <div className="mt-3 text-xs text-gray-500">
                      Working Capital: {formatCurrency(stats.financial.keyMetrics.workingCapital)}
                    </div>
                  )}
                </div>
              </button>

              {/* All Reports */}
              <button
                onClick={() => router.push('/reports')}
                className="group relative overflow-hidden bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-2xl p-4 sm:p-6 hover:border-amber-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-amber-500/20 rounded-xl">
                      <FileBarChart className="h-8 w-8 text-amber-400" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">All Reports</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    View all financial reports and insights
                  </p>
                  <div className="mt-3 text-xs text-amber-400">
                    10+ Report Types Available
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Main Bookkeeping Apps */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Bookkeeping Tools</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* SOP Generator */}
              <button
                onClick={() => router.push('/bookkeeping/sop-generator')}
                className="group relative overflow-hidden bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 border border-emerald-500/30 rounded-2xl p-4 sm:p-6 hover:border-emerald-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-emerald-500/20 rounded-xl">
                      <Zap className="h-8 w-8 text-emerald-400 group-hover:animate-pulse" />
                    </div>
                    <span className="px-2 py-1 bg-emerald-500/20 rounded text-xs text-emerald-400 font-medium">NEW</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">SOP Generator</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    Generate Standard Operating Procedure codes for Xero transactions
                  </p>
                </div>
              </button>


              {/* SOP Tables */}
              <button
                onClick={() => router.push('/bookkeeping/sop-tables')}
                className="group relative overflow-hidden bg-gradient-to-br from-cyan-600/20 to-teal-600/20 border border-cyan-500/30 rounded-2xl p-4 sm:p-6 hover:border-cyan-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-cyan-500/20 rounded-xl">
                      <FileText className="h-8 w-8 text-cyan-400" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">SOP Tables</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    View complete Standard Operating Procedure reference tables
                  </p>
                </div>
              </button>
              
              {/* Chart of Accounts */}
              <button
                onClick={() => router.push('/bookkeeping/chart-of-accounts')}
                className="group relative overflow-hidden bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-2xl p-4 sm:p-6 hover:border-amber-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-amber-500/20 rounded-xl">
                      <BookOpen className="h-8 w-8 text-amber-400" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Chart of Accounts</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    View and sync GL accounts from Xero
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Bank Accounts */}
            <div className="lg:col-span-2 space-y-6">
              {/* Bank Accounts Section */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <div className="w-1 h-6 bg-cyan-500 rounded-full mr-3" />
                    Bank Accounts
                  </h2>
                  <span className="text-sm text-gray-400">
                    {stats?.bankAccounts.length || 0} accounts
                  </span>
                </div>
                
                <div className="space-y-4">
                  {stats?.bankAccounts
                    .sort((a, b) => b.balance - a.balance) // Sort by balance descending
                    .map((account) => (
                    <div
                      key={account.id}
                      className="p-4 bg-slate-900/50 rounded-xl"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-gray-400" />
                            <div>
                              <h3 className="font-medium text-white">{account.name}</h3>
                              <p className="text-sm text-gray-400">
                                {account.unreconciledCount > 0 ? (
                                  <span className="text-amber-400">
                                    {account.unreconciledCount} unreconciled
                                  </span>
                                ) : (
                                  <span className="text-green-400">All reconciled</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-white">
                            {formatNumber(account.balance, { 
                              currency: true, 
                              decimals: 2, 
                              abbreviate: false,
                              currencyCode: account.currency 
                            })}
                          </div>
                          <div className="text-xs text-gray-500">
                            Updated {format(new Date(account.lastUpdated), 'MMM dd, yyyy')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!stats?.bankAccounts || stats.bankAccounts.length === 0) && (
                    <div className="text-center py-8 text-gray-400">
                      <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No bank accounts found</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Reconciliation Status */}
            <div className="space-y-6">
              {/* Finance Meeting Reconciliation Tracker */}
              <ReconciliationTracker />
              
              {/* Overall Reconciliation Status */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                <h2 className="text-xl font-semibold text-white mb-6">Overall Status</h2>
                
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
                      {stats?.reconciliation.totalUnreconciled || 0}
                    </div>
                    <p className="text-sm text-gray-400">Total Unreconciled</p>
                  </div>
                  
                  <div className="h-px bg-slate-700" />
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Overall Rate</span>
                      <span className="text-sm font-medium text-white">
                        {stats?.reconciliation.reconciliationRate || 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Needs Attention</span>
                      <span className="text-sm font-medium text-amber-400">
                        {stats?.reconciliation.needsAttention || 0} accounts
                      </span>
                    </div>
                  </div>
                  
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