'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  TrendingUp, TrendingDown, DollarSign, BarChart3, 
  FileText, Wallet, Calculator, ArrowUpRight, ArrowDownRight,
  Building2, Clock, AlertCircle, CheckCircle, Activity,
  Receipt, CreditCard, PieChart, Target, ArrowLeft,
  RefreshCw, Shield, BookOpen, LineChart, Database, LogOut, Cloud, Lock
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { MetricCard } from '@/components/ui/metric-card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { SkeletonDashboard, SkeletonMetricCard } from '@/components/ui/skeleton'
import { BackButton } from '@/components/ui/back-button'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { UnifiedPageHeader } from '@/components/ui/unified-page-header'
import { formatNumber } from '@/lib/design-tokens'
import { HelpTooltip, ContextualHelp } from '@/components/ui/tooltip'
import { responsiveText } from '@/lib/responsive-utils'
import { cn } from '@/lib/utils'
import { gridLayouts } from '@/lib/grid-utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { calculateDailyBurnRate, getTimeRangeDays } from '@/lib/financial-calculations'

interface FinanceMetrics {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  cashBalance: number
  accountsReceivable: number
  accountsPayable: number
  revenueGrowth: number
  expenseGrowth: number
  profitMargin: number
  quickRatio: number
  cashFlowTrend: 'positive' | 'negative' | 'neutral'
  upcomingPayments: number
  overdueInvoices: number
  lastSyncedAt?: string | null
}

interface ModuleStatus {
  bookkeeping: {
    unreconciledCount: number
    lastSync: string | null
    syncStatus: 'connected' | 'disconnected' | 'error'
  }
  cashFlow: {
    forecast30Day: number
    criticalDate: string | null
    healthScore: number
  }
  analytics: {
    vendorCount: number
    topVendor: string | null
  }
}

// Calculate financial health score based on multiple factors
function calculateHealthScore(
  cash: number,
  revenue: number,
  expenses: number,
  netIncome: number,
  currentAssets: number,
  currentLiabilities: number
): number {
  let score = 0;
  let weightedFactors = 0;
  
  // Cash runway (30% weight) - Can the business survive 3+ months?
  if (expenses > 0) {
    const monthsOfCash = cash / (expenses / 12);
    const cashScore = Math.min(monthsOfCash / 3, 1) * 100;
    score += cashScore * 0.3;
    weightedFactors += 0.3;
  } else if (cash > 0) {
    // If no expenses but has cash, give partial credit
    score += 50 * 0.3;
    weightedFactors += 0.3;
  }
  
  // Profitability (25% weight)
  if (revenue > 0) {
    const profitMargin = (netIncome / revenue) * 100;
    const profitScore = Math.max(0, Math.min(profitMargin, 20)) * 5; // 0-20% margin = 0-100 score
    score += profitScore * 0.25;
    weightedFactors += 0.25;
  }
  
  // Quick ratio (25% weight) - Liquidity
  // Note: This function doesn't have access to inventory data, 
  // so it still uses current ratio. The actual quick ratio is calculated 
  // in the main component where inventory data is available.
  if (currentLiabilities > 0) {
    const quickRatio = currentAssets / currentLiabilities;
    const quickScore = Math.min(quickRatio, 2) * 50; // 0-2 ratio = 0-100 score
    score += quickScore * 0.25;
    weightedFactors += 0.25;
  } else if (currentAssets > 0) {
    // If no liabilities but has assets, that's good
    score += 100 * 0.25;
    weightedFactors += 0.25;
  }
  
  // Revenue health (20% weight) - Is there business activity?
  if (revenue > 0) {
    score += 100 * 0.2;
    weightedFactors += 0.2;
  }
  
  // Normalize score based on available factors
  if (weightedFactors > 0) {
    return Math.round(score / weightedFactors);
  }
  
  // If no data available, return 0
  return 0;
}

export default function FinanceDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { 
    hasData, 
    hasActiveToken, 
    organization, 
    lastSync,
    checkAuthStatus,
    isLoading: authLoading 
  } = useAuth()
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null)
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState('30d')
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)

  useEffect(() => {
    // Check for OAuth callback params
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    const xeroError = searchParams.get('xero_error')
    const xeroConnected = searchParams.get('xero_connected')
    const authRefresh = searchParams.get('auth_refresh')
    
    // Handle Xero auth errors
    if (xeroError) {
      toast.error(`Xero connection failed: ${xeroError.replace(/_/g, ' ')}`)
      window.history.replaceState({}, document.title, '/finance')
      return
    }
    
    // Check for new OAuth success parameters
    if (xeroConnected === 'true' || authRefresh === 'true') {
      console.log('[FinancePage] OAuth completed successfully, immediately refreshing auth status...')
      // Immediately refresh auth status - skip server check since we just came from OAuth
      checkAuthStatus(true)
      // Clean up URL
      window.history.replaceState({}, document.title, '/finance')
      return
    }
    
    if (connected === 'true') {
      // This is legacy behavior - clean it up
      window.history.replaceState({}, document.title, '/finance')
      // The sync should have already happened via /sync page
    } else if (error) {
      toast.error(`Failed to connect to Xero: ${error}`)
      window.history.replaceState({}, document.title, '/finance')
    }
    
    // Fallback: If we just came back from Xero auth (no error params), refresh auth status
    // This handles the case where we successfully connected but the UI hasn't updated yet
    const isReturningFromAuth = document.referrer.includes('/api/v1/xero/auth')
    if (isReturningFromAuth && !error && !xeroError) {
      console.log('[FinancePage] Returning from Xero auth (referrer check), refreshing auth status...')
      checkAuthStatus(true)
    }
  }, [searchParams, checkAuthStatus])

  useEffect(() => {
    // Always try to fetch data - let the API handle the case where there's no data
    if (!authLoading) {
      fetchFinanceData()
    }
    
    // Set a timeout to prevent infinite loading on initial mount
    const loadTimeout = setTimeout(() => {
      if (loading && !initialLoadComplete) {
        console.log('[Finance] Initial load timeout reached, forcing completion');
        setLoading(false)
        setInitialLoadComplete(true)
      }
    }, 10000) // 10 second timeout to account for server startup
    
    return () => clearTimeout(loadTimeout)
  }, [timeRange, authLoading, hasActiveToken, organization])

  // Listen for sync completion events
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('[FinancePage] Sync completed, refreshing data...')
      // Refresh auth status and data
      checkAuthStatus().then(() => {
        fetchFinanceData()
      })
    }

    // Listen for custom sync completion event
    window.addEventListener('syncComplete', handleSyncComplete)

    return () => {
      window.removeEventListener('syncComplete', handleSyncComplete)
    }
  }, [checkAuthStatus])

  // Force refresh auth status when page becomes visible (handles OAuth redirects)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Small delay to ensure cookies are set
        setTimeout(() => {
          console.log('[FinancePage] Page became visible, checking auth status...')
          checkAuthStatus()
        }, 100)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkAuthStatus])

  const fetchFinanceData = async () => {
    try {
      setLoading(true)
      
      // Add timeout protection for API calls
      const fetchWithTimeout = async (url: string, options: RequestInit = {}) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(timeout);
          return response;
        } catch (error: any) {
          clearTimeout(timeout);
          if (error.name === 'AbortError') {
            console.error(`[Finance] Request timeout for ${url}`);
            throw new Error('Request timeout');
          }
          throw error;
        }
      };
      
      // Fetch real data from database APIs with timeout protection
      const [balanceSheetRes, plRes, cashBalanceRes, vendorsRes] = await Promise.allSettled([
        fetchWithTimeout('/api/v1/xero/reports/balance-sheet', {
          headers: { 'Cache-Control': 'max-age=300' } // 5 min cache
        }),
        fetchWithTimeout('/api/v1/xero/reports/profit-loss', {
          headers: { 'Cache-Control': 'max-age=300' } // 5 min cache
        }),
        fetchWithTimeout('/api/v1/bookkeeping/cash-balance', {
          headers: { 'Cache-Control': 'max-age=60' } // 1 min cache
        }),
        fetchWithTimeout('/api/v1/analytics/top-vendors', {
          headers: { 'Cache-Control': 'max-age=600' } // 10 min cache
        })
      ])

      // Handle settled promises
      const balanceSheet = balanceSheetRes.status === 'fulfilled' && balanceSheetRes.value.ok 
        ? await balanceSheetRes.value.json() 
        : null;
      const profitLoss = plRes.status === 'fulfilled' && plRes.value.ok 
        ? await plRes.value.json() 
        : null;
      const cashBalance = cashBalanceRes.status === 'fulfilled' && cashBalanceRes.value.ok 
        ? await cashBalanceRes.value.json() 
        : null;
      const vendorsData = vendorsRes.status === 'fulfilled' && vendorsRes.value.ok 
        ? await vendorsRes.value.json() 
        : null;

      // Get the latest sync time from any of the responses
      const lastSyncedAt = balanceSheet?.lastSyncedAt || profitLoss?.lastSyncedAt || null;

      // Extract real financial metrics
      const revenue = profitLoss?.totalRevenue || 0
      const expenses = profitLoss?.totalExpenses || 0
      const netIncome = profitLoss?.netProfit || 0
      const totalCash = balanceSheet?.cash || cashBalance?.totalBalance || 0
      const currentAssets = balanceSheet?.currentAssets || 0
      const currentLiabilities = balanceSheet?.currentLiabilities || 0
      
      // Calculate quick ratio with proper logging
      const quickRatioValue = currentLiabilities > 0 
        ? ((currentAssets || 0) - (balanceSheet?.inventory || 0)) / currentLiabilities 
        : 0;
      
      console.log('[Finance] Quick Ratio Calculation:', {
        currentAssets,
        inventory: balanceSheet?.inventory || 0,
        currentLiabilities,
        liquidAssets: (currentAssets || 0) - (balanceSheet?.inventory || 0),
        quickRatio: quickRatioValue
      });

      setMetrics({
        totalRevenue: revenue,
        totalExpenses: expenses,
        netIncome: netIncome,
        cashBalance: totalCash,
        accountsReceivable: balanceSheet?.accountsReceivable || 0,
        accountsPayable: balanceSheet?.accountsPayable || 0,
        revenueGrowth: 0, // Will calculate from historical data
        expenseGrowth: 0,
        profitMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
        quickRatio: quickRatioValue,
        cashFlowTrend: netIncome >= 0 ? 'positive' : 'negative',
        upcomingPayments: 0, // Will fetch from bills
        overdueInvoices: 0, // Will fetch from invoices
        lastSyncedAt: lastSyncedAt
      })

      setModuleStatus({
        bookkeeping: {
          unreconciledCount: 0, // Will fetch from transactions
          lastSync: new Date().toISOString(),
          syncStatus: hasActiveToken ? 'connected' : 'disconnected'
        },
        cashFlow: {
          forecast30Day: totalCash + (netIncome * 30 / 365), // Simple projection
          criticalDate: null,
          healthScore: calculateHealthScore(totalCash, revenue, expenses, netIncome, currentAssets, currentLiabilities)
        },
        analytics: {
          vendorCount: vendorsData?.vendorCount || 0,
          topVendor: vendorsData?.topVendors?.[0]?.name || null
        }
      })
    } catch (error) {
      console.error('Error fetching finance data:', error)
      toast.error('Failed to load finance data')
    } finally {
      setLoading(false)
      setInitialLoadComplete(true)
    }
  }


  const formatCurrency = (amount: number) => {
    return formatNumber(amount, { currency: true, decimals: 2, abbreviate: false })
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 50) return 'text-brand-amber'
    return 'text-red-400'
  }

  // Show loading skeleton while auth is loading OR while loading initial data
  if (authLoading || (loading && !initialLoadComplete)) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="mb-8">
            <div className="h-8 w-48 bg-slate-800 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="grid gap-6 lg:gap-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <SkeletonMetricCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
        <Toaster position="top-right" />
        <div className="container mx-auto px-4 py-6 sm:py-8">
          
          {/* Enhanced Header with custom sync button */}
          <UnifiedPageHeader 
            title="Financial Overview"
            description="Real-time insights into your business performance"
            showBackButton={false}
            showAuthStatus={true}
            showSyncButton={false}
            showTimeRangeSelector={true}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />


          {/* Show skeleton while auth is loading OR while loading data */}
          {(authLoading || loading) ? (
            <SkeletonDashboard />
          ) : (
          <>
            {/* Remove the warning since we now show empty state when not connected */}
            
            {/* Financial Health Score Card */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 mb-8">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div>
                  <h2 className={cn(responsiveText.heading[2], "font-semibold text-white mb-2 flex items-center gap-2")}>
                    Financial Health Score
                    <ContextualHelp
                      title="Financial Health Score"
                      description="A comprehensive metric that evaluates your business's financial wellbeing based on multiple factors."
                      tips={[
                        "Score above 80: Excellent financial health",
                        "Score 60-80: Good health with room for improvement",
                        "Score below 60: Requires attention to financial management"
                      ]}
                      learnMoreUrl="#"
                    />
                  </h2>
                  <div className="flex items-baseline gap-3">
                    <span className={cn(
                      responsiveText.display[2], 
                      "font-bold",
                      getHealthColor(moduleStatus?.cashFlow.healthScore || 0)
                    )}>
                      {moduleStatus?.cashFlow.healthScore || 0}
                    </span>
                    <span className={cn(responsiveText.heading[3], "text-tertiary")}>/100</span>
                  </div>
                  <p className="text-tertiary mt-2">
                    Based on cash reserves, profit margins, and liquidity ratios
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">
                      {metrics?.quickRatio.toFixed(2)}
                    </div>
                    <div className="text-sm text-tertiary flex items-center justify-center gap-1">
                      Quick Ratio
                      <HelpTooltip 
                        content="Measures ability to pay short-term obligations with liquid assets. A ratio > 1.0 is generally good."
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">
                      {metrics?.profitMargin.toFixed(1)}%
                    </div>
                    <div className="text-sm text-tertiary flex items-center justify-center gap-1">
                      Profit Margin
                      <HelpTooltip 
                        content="Percentage of revenue that becomes profit. Higher margins indicate better cost control."
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold capitalize ${
                      metrics?.cashFlowTrend === 'positive' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {metrics?.cashFlowTrend}
                    </div>
                    <div className="text-sm text-tertiary flex items-center justify-center gap-1">
                      Cash Flow
                      <HelpTooltip 
                        content="Direction of cash movement. Positive means more cash coming in than going out."
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* Key Financial Metrics - Non-clickable info cards */}
            <div className={cn(gridLayouts.cards.metrics, "mb-8")}>
              {/* Cash Balance - Most Important */}
              <div className="relative bg-slate-800/30 border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-blue rounded-xl">
                    <Wallet className="h-6 w-6 text-brand-blue" />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
                </div>
                <div className={cn(responsiveText.metric.medium, "font-bold text-white")}>
                  {formatCurrency(metrics?.cashBalance || 0)}
                </div>
                <div className="text-sm text-tertiary mt-1">Cash Balance</div>
                <div className="text-xs text-gray-500 mt-2">
                  Forecast: {formatCurrency(moduleStatus?.cashFlow.forecast30Day || 0)}
                </div>
              </div>

              {/* Accounts Receivable */}
              <div className="relative bg-slate-800/30 border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-emerald/20 rounded-xl">
                    <Receipt className="h-6 w-6 text-brand-emerald" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">
                    Outstanding
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(metrics?.accountsReceivable || 0)}
                </div>
                <div className="text-sm text-tertiary mt-1">Accounts Receivable</div>
                <div className="text-xs text-gray-500 mt-2">
                  Money owed to you
                </div>
              </div>

              {/* Accounts Payable */}
              <div className="relative bg-slate-800/30 border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-amber-500/20 rounded-xl">
                    <CreditCard className="h-6 w-6 text-amber-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">
                    Outstanding
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(metrics?.accountsPayable || 0)}
                </div>
                <div className="text-sm text-tertiary mt-1">Accounts Payable</div>
                <div className="text-xs text-gray-500 mt-2">
                  Money you owe
                </div>
              </div>

              {/* Net Income */}
              <div className="relative bg-slate-800/30 border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-cyan-500/20 rounded-xl">
                    <Activity className="h-6 w-6 text-cyan-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">
                    {metrics?.profitMargin.toFixed(1)}% margin
                  </span>
                </div>
                <div className={`text-3xl font-bold ${
                  (metrics?.netIncome ?? 0) >= 0 ? 'text-white' : 'text-red-400'
                }`}>
                  {formatCurrency(metrics?.netIncome || 0)}
                </div>
                <div className="text-sm text-tertiary mt-1">Net Profit</div>
                <div className="text-xs text-gray-500 mt-2">
                  Daily avg: {formatCurrency(calculateDailyBurnRate(metrics?.netIncome || 0, getTimeRangeDays(timeRange)))}
                </div>
              </div>
            </div>

            {/* Active Modules Section - Better Organization */}
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Shield className="h-6 w-6 mr-3 text-brand-emerald" />
              Financial Modules
            </h2>
            
            <div className={cn(gridLayouts.cards.modules, "mb-8")}>
              {/* Bookkeeping - PRIMARY MODULE */}
              <div 
                className="group relative bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6 hover:border-brand-emerald hover:shadow-lg hover:shadow-brand-emerald/10 transition-all cursor-pointer transform hover:-translate-y-1"
                onClick={() => router.push('/bookkeeping')}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-emerald/10 rounded-full blur-3xl group-hover:bg-brand-emerald/20 transition-all" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-brand-emerald/20 rounded-xl">
                        <BookOpen className="h-6 w-6 text-brand-emerald" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">Bookkeeping</h3>
                        <p className="text-sm text-tertiary">Core accounting & reconciliation</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-tertiary group-hover:text-brand-emerald transition-colors" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-2xl font-bold text-white">{moduleStatus?.bookkeeping.unreconciledCount || 0}</div>
                      <div className="text-xs text-tertiary">Unreconciled</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          hasActiveToken ? 'bg-brand-emerald' : 'bg-gray-400'
                        }`} />
                        <span className="text-sm text-white">Xero</span>
                      </div>
                      <div className="text-xs text-tertiary">{hasActiveToken ? 'Connected' : 'Not Connected'}</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-sm font-medium text-white">3</div>
                      <div className="text-xs text-tertiary">Reports</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-brand-emerald/20 text-brand-emerald rounded text-xs">Balance Sheet</span>
                    <span className="px-2 py-1 bg-brand-emerald/20 text-brand-emerald rounded text-xs">P&L Statement</span>
                    <span className="px-2 py-1 bg-brand-emerald/20 text-brand-emerald rounded text-xs">VAT Reports</span>
                  </div>
                </div>
              </div>

              {/* Cash Flow - Active */}
              <div 
                className={`group relative bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6 transition-all transform ${
                  !hasData 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer hover:-translate-y-1'
                }`}
                onClick={() => !hasData ? null : router.push('/cashflow')}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-cyan-500/20 rounded-xl">
                        <LineChart className="h-6 w-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">Cash Flow</h3>
                        <p className="text-sm text-tertiary">
                          {!hasData ? 'Requires initial sync' : '90-day forecasting & planning'}
                        </p>
                      </div>
                    </div>
                    {!hasData ? (
                      <Lock className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-tertiary group-hover:text-cyan-400 transition-colors" />
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-primary rounded-lg p-3">
                      <div className={`text-2xl font-bold ${
                        !hasData ? 'text-gray-500' : getHealthColor(moduleStatus?.cashFlow.healthScore || 0)
                      }`}>
                        {!hasData ? '-' : `${moduleStatus?.cashFlow.healthScore || 0}%`}
                      </div>
                      <div className="text-xs text-tertiary">Health</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-sm font-medium text-white">90d</div>
                      <div className="text-xs text-tertiary">Forecast</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className={`text-sm font-medium ${!hasData ? 'text-gray-500' : 'text-white'}`}>
                        {!hasData ? 'Locked' : 'Active'}
                      </div>
                      <div className="text-xs text-tertiary">Status</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">Forecasting</span>
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">Scenarios</span>
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">Tax Planning</span>
                  </div>
                </div>
              </div>

              {/* Business Analytics */}
              <div 
                className={`group relative bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6 transition-all transform ${
                  !hasData 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer hover:-translate-y-1'
                }`}
                onClick={() => !hasData ? null : router.push('/analytics')}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <BarChart3 className="h-6 w-6 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">Analytics</h3>
                        <p className="text-sm text-tertiary">
                          {!hasData ? 'Requires initial sync' : 'Business intelligence & insights'}
                        </p>
                      </div>
                    </div>
                    {!hasData ? (
                      <Lock className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-tertiary group-hover:text-indigo-400 transition-colors" />
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-primary rounded-lg p-3">
                      <div className={`text-2xl font-bold ${!hasData ? 'text-gray-500' : 'text-white'}`}>
                        {!hasData ? '-' : (moduleStatus?.analytics.vendorCount || 0)}
                      </div>
                      <div className="text-xs text-tertiary">Vendors</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className={`text-sm font-medium truncate ${!hasData ? 'text-gray-500' : 'text-white'}`}>
                        {!hasData ? '-' : (moduleStatus?.analytics.topVendor || 'N/A')}
                      </div>
                      <div className="text-xs text-tertiary">Top Vendor</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className={`text-sm font-medium ${!hasData ? 'text-gray-500' : 'text-white'}`}>
                        {!hasData ? 'Locked' : 'Live'}
                      </div>
                      <div className="text-xs text-tertiary">Data</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">Vendor Analysis</span>
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">Spend Trends</span>
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">KPIs</span>
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