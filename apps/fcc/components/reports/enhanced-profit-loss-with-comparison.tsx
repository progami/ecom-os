'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Download,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  LineChart as LineChartIcon,
  Calculator,
  Target,
  Calendar,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format, subMonths, subYears } from 'date-fns';
import { UnifiedPageHeader } from '@/components/ui/unified-page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { SkeletonCard, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/design-tokens';
import { FilterPanel } from '@/components/reports/filter-panel';
import { useFilterState } from '@/hooks/use-filter-state';
import { getReportFilters, formatFiltersForAPI } from '@/lib/report-filters';

// Import our new comparison components
import { PeriodComparisonComponent } from './period-comparison';
import { SmartComparisonChart, SideBySideBarChart, TrendLineChart } from './comparison-charts';
import { ComparisonTable, transformToComparisonData, ComparisonColumn } from './comparison-table';
import { ComparisonSummary } from './comparison-summary';
import { 
  ComparisonType, 
  DateRange, 
  createComparisonMetric,
  ComparisonMetric
} from '@/lib/comparison-utils';

interface PLAccount {
  accountId: string;
  accountName: string;
  accountType: string;
  accountClass: 'REVENUE' | 'EXPENSE' | 'OTHERINCOME' | 'OTHEREXPENSE';
  balance: number;
  parentAccount?: string;
  level: number;
}

interface ProfitLossData {
  revenue: {
    operatingRevenue: PLAccount[];
    otherIncome: PLAccount[];
    totalRevenue: number;
  };
  expenses: {
    costOfSales: PLAccount[];
    operatingExpenses: PLAccount[];
    otherExpenses: PLAccount[];
    totalExpenses: number;
  };
  profitability: {
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
    ebitda: number;
  };
  margins: {
    grossMargin: number;
    operatingMargin: number;
    netMargin: number;
    ebitdaMargin: number;
  };
  trends: Array<{
    period: string;
    revenue: number;
    expenses: number;
    grossProfit: number;
    operatingProfit: number;
    netProfit: number;
  }>;
  comparison: {
    previousPeriod: {
      totalRevenue: number;
      totalExpenses: number;
      netProfit: number;
      grossProfit: number;
      operatingProfit: number;
      ebitda: number;
      date: string;
    };
    variance: {
      totalRevenue: number;
      totalExpenses: number;
      netProfit: number;
      grossProfit: number;
      operatingProfit: number;
      ebitda: number;
      percentageChange: number;
    };
  };
  breakdown: {
    revenueByCategory: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
    expensesByCategory: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  reportDate: string;
  fromDate: string;
  toDate: string;
  fetchedAt: string;
  source: string;
  currency: string;
}

export default function EnhancedProfitLossWithComparison() {
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [comparisonData, setComparisonData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Comparison settings
  const [comparisonType, setComparisonType] = useState<ComparisonType>('previous-period');
  const [showComparison, setShowComparison] = useState(true);
  const [selectedView, setSelectedView] = useState<'summary' | 'detailed' | 'comparison'>('comparison');

  // Initialize filter state
  const {
    filters,
    setFilters,
    isLoading: filtersLoading,
    hasActiveFilters
  } = useFilterState({
    onFiltersChange: (newFilters) => {
      fetchData(false, newFilters);
    }
  });

  // Current period from filters or default
  const currentPeriod: DateRange = useMemo(() => {
    const endDate = filters.toDate ? new Date(filters.toDate) : new Date();
    const startDate = filters.fromDate ? new Date(filters.fromDate) : subMonths(endDate, 1);
    return { startDate, endDate };
  }, [filters.fromDate, filters.toDate]);

  const fetchData = async (forceRefresh = false, filterValues = filters) => {
    try {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      
      // Format filters for API
      const apiFilters = formatFiltersForAPI(filterValues);
      const queryParams = new URLSearchParams();
      
      if (forceRefresh) {
        queryParams.set('refresh', 'true');
      }
      
      // Add filter parameters
      Object.entries(apiFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.set(key, String(value));
        }
      });
      
      const url = `/api/v1/xero/reports/profit-loss${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch profit & loss data');
      }
      
      const result = await response.json();
      setData(result);

      // Fetch comparison data if comparison is enabled
      if (showComparison) {
        await fetchComparisonData(filterValues);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchComparisonData = async (filterValues = filters) => {
    try {
      // Calculate comparison period dates
      const endDate = filterValues.toDate ? new Date(filterValues.toDate) : new Date();
      const startDate = filterValues.fromDate ? new Date(filterValues.fromDate) : subMonths(endDate, 1);
      
      let comparisonEndDate: Date;
      let comparisonStartDate: Date;
      
      switch (comparisonType) {
        case 'year-over-year':
          comparisonEndDate = subYears(endDate, 1);
          comparisonStartDate = subYears(startDate, 1);
          break;
        case 'previous-period':
        default:
          const periodLength = endDate.getTime() - startDate.getTime();
          comparisonEndDate = new Date(startDate.getTime() - 1);
          comparisonStartDate = new Date(comparisonEndDate.getTime() - periodLength);
          break;
      }
      
      const comparisonFilters = {
        ...formatFiltersForAPI(filterValues),
        fromDate: format(comparisonStartDate, 'yyyy-MM-dd'),
        toDate: format(comparisonEndDate, 'yyyy-MM-dd')
      };
      
      const queryParams = new URLSearchParams(comparisonFilters);
      const url = `/api/v1/xero/reports/profit-loss?${queryParams.toString()}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const result = await response.json();
        setComparisonData(result);
      }
    } catch (err) {
      console.error('Failed to fetch comparison data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (data && showComparison) {
      fetchComparisonData();
    }
  }, [comparisonType, showComparison]);

  // Generate comparison metrics
  const comparisonMetrics = useMemo(() => {
    if (!data || !comparisonData) return [];

    return [
      createComparisonMetric('Total Revenue', data.revenue.totalRevenue, comparisonData.revenue.totalRevenue, 'revenue'),
      createComparisonMetric('Total Expenses', Math.abs(data.expenses.totalExpenses), Math.abs(comparisonData.expenses.totalExpenses), 'expense'),
      createComparisonMetric('Gross Profit', data.profitability.grossProfit, comparisonData.profitability.grossProfit, 'profit'),
      createComparisonMetric('Operating Profit', data.profitability.operatingProfit, comparisonData.profitability.operatingProfit, 'profit'),
      createComparisonMetric('Net Profit', data.profitability.netProfit, comparisonData.profitability.netProfit, 'profit'),
      createComparisonMetric('EBITDA', data.profitability.ebitda, comparisonData.profitability.ebitda, 'profit'),
      createComparisonMetric('Gross Margin', data.margins.grossMargin, comparisonData.margins.grossMargin, 'margin'),
      createComparisonMetric('Net Margin', data.margins.netMargin, comparisonData.margins.netMargin, 'margin')
    ];
  }, [data, comparisonData]);

  // Prepare comparison table data
  const comparisonTableData = useMemo(() => {
    if (!data || !comparisonData) return [];

    const allAccounts = [
      ...data.revenue.operatingRevenue,
      ...data.revenue.otherIncome,
      ...data.expenses.costOfSales,
      ...data.expenses.operatingExpenses,
      ...data.expenses.otherExpenses
    ];

    const allComparisonAccounts = [
      ...comparisonData.revenue.operatingRevenue,
      ...comparisonData.revenue.otherIncome,
      ...comparisonData.expenses.costOfSales,
      ...comparisonData.expenses.operatingExpenses,
      ...comparisonData.expenses.otherExpenses
    ];

    return transformToComparisonData(
      allAccounts.map(acc => ({ 
        id: acc.accountId, 
        accountName: acc.accountName,
        accountType: acc.accountType,
        section: acc.accountClass === 'REVENUE' ? 'Revenue' : 
                acc.accountClass === 'OTHERINCOME' ? 'Other Income' : 'Expenses',
        balance: acc.balance
      })),
      allComparisonAccounts.map(acc => ({ 
        id: acc.accountId, 
        balance: acc.balance 
      })),
      'id',
      [{ field: 'balance', type: acc => acc.section === 'Expenses' ? 'expense' : 'revenue' as any }]
    );
  }, [data, comparisonData]);

  const comparisonTableColumns: ComparisonColumn<any>[] = [
    {
      key: 'section',
      header: 'Section',
      sortable: true,
      className: 'font-medium text-white'
    },
    {
      key: 'accountName',
      header: 'Account Name',
      sortable: true,
      className: 'text-slate-300'
    },
    {
      key: 'accountType',
      header: 'Type',
      sortable: true,
      className: 'text-slate-400 text-sm'
    },
    {
      key: 'balance',
      header: 'Current Amount',
      accessor: (row) => formatNumber(Math.abs(row.balance), { currency: true, currencyCode: 'GBP' }),
      sortable: true,
      className: 'text-right font-semibold',
      showComparison: true,
      showVariance: true,
      format: 'currency' as const,
      metricType: 'revenue' as const
    }
  ];

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleApplyFilters = () => {
    fetchData(false);
  };

  const handleResetFilters = () => {
    setFilters({});
  };

  const handleExport = () => {
    if (!data) return;
    
    const csvData = [
      ['Enhanced Profit & Loss Statement with Comparison', `${data.fromDate} to ${data.toDate}`],
      ['Comparison Type:', comparisonType],
      [''],
      ...comparisonMetrics.map(metric => [
        metric.name,
        formatNumber(metric.current, { currency: true, currencyCode: 'GBP' }),
        formatNumber(metric.comparison, { currency: true, currencyCode: 'GBP' }),
        formatNumber(metric.variance, { currency: true, currencyCode: 'GBP' }),
        `${metric.percentageChange.toFixed(1)}%`,
        metric.isImprovement ? 'Improvement' : 'Decline'
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `profit-loss-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  // Get filter configuration for profit-loss report
  const filterConfigs = getReportFilters('profit-loss');

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <UnifiedPageHeader 
          title="Enhanced Profit & Loss with Comparison"
          description="Advanced income statement analysis with period comparison"
          showAuthStatus={true}
        />
        <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-brand-red mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Error Loading Report</h3>
          <p className="text-slate-400 mb-4">{error}</p>
          <button 
            onClick={() => fetchData()}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <UnifiedPageHeader 
        title="Enhanced Profit & Loss with Comparison"
        description="Advanced income statement analysis with period comparison"
        showAuthStatus={true}
        showBreadcrumbs={true}
        breadcrumbItems={[
          { label: 'Reports', href: '/reports' },
          { label: 'Detailed Reports', href: '/reports/detailed-reports' },
          { label: 'Enhanced Profit & Loss' }
        ]}
        actions={
          <div className="flex space-x-2">
            {/* View Toggle */}
            <div className="flex bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setSelectedView('summary')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  selectedView === 'summary' 
                    ? 'bg-brand-blue text-white' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setSelectedView('comparison')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  selectedView === 'comparison' 
                    ? 'bg-brand-blue text-white' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Comparison
              </button>
              <button
                onClick={() => setSelectedView('detailed')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  selectedView === 'detailed' 
                    ? 'bg-brand-blue text-white' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Detailed
              </button>
            </div>
            
            {/* Comparison Type Selector */}
            <select
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value as ComparisonType)}
              className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm border border-slate-600"
            >
              <option value="previous-period">vs Previous Period</option>
              <option value="year-over-year">vs Same Period Last Year</option>
              <option value="month-over-month">vs Previous Month</option>
              <option value="quarter-over-quarter">vs Previous Quarter</option>
            </select>
            
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button 
              onClick={handleExport}
              disabled={!data}
              className="flex items-center space-x-2 px-4 py-2 bg-brand-blue hover:bg-brand-blue/80 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        }
      />

      {/* Filter Panel */}
      <div className="mb-8">
        <FilterPanel
          filters={filterConfigs}
          values={filters}
          onChange={setFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          isLoading={loading || refreshing || filtersLoading}
          showActiveFilters={true}
          defaultCollapsed={!hasActiveFilters}
        />
      </div>

      {/* Comparison Summary Widget */}
      {selectedView === 'comparison' && showComparison && comparisonMetrics.length > 0 && (
        <div className="mb-8">
          <ComparisonSummary
            metrics={comparisonMetrics}
            title={`Performance Analysis: ${comparisonType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
            currencyCode="GBP"
          />
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))
        ) : data ? (
          <>
            <MetricCard
              title="Total Revenue"
              value={formatNumber(data.revenue.totalRevenue, { currency: true, currencyCode: 'GBP' })}
              subtitle={data.comparison ? 
                `${data.comparison.variance.totalRevenue > 0 ? '+' : ''}${formatNumber(data.comparison.variance.totalRevenue, { currency: true, currencyCode: 'GBP' })} vs previous` 
                : 'Total income'
              }
              icon={DollarSign}
              variant="default"
            />
            <MetricCard
              title="Net Profit"
              value={formatNumber(data.profitability.netProfit, { currency: true, currencyCode: 'GBP' })}
              subtitle={`${data.margins.netMargin.toFixed(1)}% margin`}
              icon={data.profitability.netProfit > 0 ? TrendingUp : TrendingDown}
              variant={data.profitability.netProfit > 0 ? 'success' : 'danger'}
            />
            <MetricCard
              title="Gross Profit"
              value={formatNumber(data.profitability.grossProfit, { currency: true, currencyCode: 'GBP' })}
              subtitle={`${data.margins.grossMargin.toFixed(1)}% margin`}
              icon={Target}
              variant={data.margins.grossMargin > 30 ? 'success' : 'warning'}
            />
            <MetricCard
              title="EBITDA"
              value={formatNumber(data.profitability.ebitda, { currency: true, currencyCode: 'GBP' })}
              subtitle={`${data.margins.ebitdaMargin.toFixed(1)}% margin`}
              icon={Calculator}
              variant={data.profitability.ebitda > 0 ? 'success' : 'warning'}
            />
          </>
        ) : null}
      </div>

      {/* Period Comparison Component */}
      {selectedView === 'comparison' && showComparison && comparisonMetrics.length > 0 && (
        <div className="mb-8">
          <PeriodComparisonComponent
            currentPeriod={currentPeriod}
            comparisonType={comparisonType}
            metrics={comparisonMetrics.map(metric => ({
              name: metric.name,
              current: metric.current,
              comparison: metric.comparison,
              type: metric.name.includes('Expense') ? 'expense' as const : 
                    metric.name.includes('Margin') ? 'margin' as const : 'revenue' as const,
              format: metric.name.includes('Margin') ? 'percentage' as const : 'currency' as const,
              currencyCode: 'GBP'
            }))}
            showDetailedAnalysis={true}
          />
        </div>
      )}

      {/* Comparison Charts */}
      {selectedView === 'comparison' && showComparison && comparisonMetrics.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <SideBySideBarChart
            data={comparisonMetrics.filter(m => !m.name.includes('Margin'))}
            title="Financial Performance Comparison"
            showVariance={true}
            currencyCode="GBP"
          />
          
          {data?.trends && (
            <TrendLineChart
              data={comparisonMetrics}
              multiPeriodData={data.trends.map(trend => ({
                period: trend.period,
                revenue: trend.revenue,
                expenses: Math.abs(trend.expenses),
                netProfit: trend.netProfit
              }))}
              title="Performance Trends"
              currencyCode="GBP"
            />
          )}
        </div>
      )}

      {/* Detailed Comparison Table */}
      {selectedView === 'detailed' && comparisonTableData.length > 0 && (
        <div className="mb-8">
          <ComparisonTable
            data={comparisonTableData}
            columns={comparisonTableColumns}
            showComparisonColumns={showComparison}
            showVarianceColumns={showComparison}
            enableDrillDown={true}
            exportFileName="profit-loss-account-comparison"
            defaultCurrencyCode="GBP"
          />
        </div>
      )}

      {/* Traditional Summary View */}
      {selectedView === 'summary' && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Summary */}
          <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Revenue Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Operating Revenue</span>
                <span className="font-semibold text-white">
                  {formatNumber(data.revenue.operatingRevenue.reduce((sum, acc) => sum + acc.balance, 0), { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Other Income</span>
                <span className="font-semibold text-white">
                  {formatNumber(data.revenue.otherIncome.reduce((sum, acc) => sum + acc.balance, 0), { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <hr className="border-slate-600" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-white">Total Revenue</span>
                <span className="font-bold text-brand-emerald">
                  {formatNumber(data.revenue.totalRevenue, { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
            </div>
          </div>

          {/* Expenses Summary */}
          <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Expenses Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Cost of Sales</span>
                <span className="font-semibold text-white">
                  {formatNumber(Math.abs(data.expenses.costOfSales.reduce((sum, acc) => sum + acc.balance, 0)), { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Operating Expenses</span>
                <span className="font-semibold text-white">
                  {formatNumber(Math.abs(data.expenses.operatingExpenses.reduce((sum, acc) => sum + acc.balance, 0)), { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Other Expenses</span>
                <span className="font-semibold text-white">
                  {formatNumber(Math.abs(data.expenses.otherExpenses.reduce((sum, acc) => sum + acc.balance, 0)), { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <hr className="border-slate-600" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-white">Total Expenses</span>
                <span className="font-bold text-brand-red">
                  {formatNumber(Math.abs(data.expenses.totalExpenses), { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
            </div>
          </div>

          {/* Profitability Summary */}
          <div className="bg-secondary backdrop-blur-sm border border-default rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Profitability Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Gross Profit</span>
                <span className="font-semibold text-white">
                  {formatNumber(data.profitability.grossProfit, { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Operating Profit</span>
                <span className="font-semibold text-white">
                  {formatNumber(data.profitability.operatingProfit, { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">EBITDA</span>
                <span className="font-semibold text-white">
                  {formatNumber(data.profitability.ebitda, { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <hr className="border-slate-600" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-white">Net Profit</span>
                <span className={`font-bold ${data.profitability.netProfit > 0 ? 'text-brand-emerald' : 'text-brand-red'}`}>
                  {formatNumber(data.profitability.netProfit, { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Metadata */}
      {data && (
        <div className="mt-6 text-xs text-slate-500 flex items-center justify-between">
          <div>
            Data source: {data.source} • Period: {new Date(data.fromDate).toLocaleDateString()} - {new Date(data.toDate).toLocaleDateString()}
            {showComparison && comparisonData && (
              <span> • Compared to: {new Date(comparisonData.fromDate).toLocaleDateString()} - {new Date(comparisonData.toDate).toLocaleDateString()}</span>
            )}
          </div>
          <div>
            Last updated: {new Date(data.fetchedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}