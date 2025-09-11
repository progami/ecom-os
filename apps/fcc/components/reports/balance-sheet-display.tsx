'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/design-tokens';
import { 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Building, 
  CreditCard, 
  Banknote,
  Calculator,
  PieChart,
  BarChart3
} from 'lucide-react';

interface BalanceSheetAccount {
  accountId?: string;
  accountCode?: string;
  accountName: string;
  accountType?: string;
  balance: number;
}

interface BalanceSheetData {
  assets: {
    currentAssets: BalanceSheetAccount[];
    nonCurrentAssets: BalanceSheetAccount[];
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: BalanceSheetAccount[];
    nonCurrentLiabilities: BalanceSheetAccount[];
    totalLiabilities: number;
  };
  equity: {
    accounts: BalanceSheetAccount[];
    totalEquity: number;
  };
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  netAssets: number;
  currentAssets?: number;
  currentLiabilities?: number;
  workingCapital?: number;
  currentRatio?: number;
  quickRatio?: number;
  debtToEquityRatio?: number;
  equityRatio?: number;
  reportDate?: string;
  source?: string;
  fetchedAt?: string;
}

interface BalanceSheetDisplayProps {
  data: BalanceSheetData | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function BalanceSheetDisplay({ 
  data, 
  loading = false, 
  error = null,
  className 
}: BalanceSheetDisplayProps) {
  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-secondary border border-default rounded-xl p-6 animate-pulse">
              <div className="h-4 w-24 bg-gray-700 rounded mb-2"></div>
              <div className="h-8 w-32 bg-gray-700 rounded mb-1"></div>
              <div className="h-3 w-20 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>

        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-secondary border border-default rounded-xl p-6 animate-pulse">
              <div className="h-6 w-32 bg-gray-700 rounded mb-4"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="flex justify-between">
                    <div className="h-4 w-48 bg-gray-700 rounded"></div>
                    <div className="h-4 w-24 bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex justify-between">
                  <div className="h-5 w-32 bg-gray-700 rounded"></div>
                  <div className="h-5 w-28 bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center", className)}>
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Error Loading Balance Sheet</h3>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center", className)}>
        <BarChart3 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No Balance Sheet Data</h3>
        <p className="text-gray-400">Fetch data from Xero or import data to view the balance sheet.</p>
      </div>
    );
  }

  const formatAccountBalance = (balance: number) => {
    return formatCurrency(Math.abs(balance));
  };

  const renderAccounts = (accounts: BalanceSheetAccount[]) => {
    return accounts.map((account, index) => (
      <div key={account.accountId || index} className="flex justify-between items-center py-2 hover:bg-gray-800/30 px-2 -mx-2 rounded transition-colors">
        <div className="flex items-center gap-2">
          {account.accountCode && (
            <span className="text-xs text-gray-500 font-mono">{account.accountCode}</span>
          )}
          <span className="text-gray-300">{account.accountName}</span>
        </div>
        <span className="text-white font-medium tabular-nums">
          {formatAccountBalance(account.balance)}
        </span>
      </div>
    ));
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-blue-400">Total Assets</span>
            <Building className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatCurrency(data.totalAssets)}
          </div>
          {data.currentAssets && (
            <div className="text-xs text-gray-400">
              Current: {formatCurrency(data.currentAssets)}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-red-600/20 to-red-700/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-red-400">Total Liabilities</span>
            <CreditCard className="h-5 w-5 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatCurrency(data.totalLiabilities)}
          </div>
          {data.currentLiabilities && (
            <div className="text-xs text-gray-400">
              Current: {formatCurrency(data.currentLiabilities)}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-green-600/20 to-green-700/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-green-400">Total Equity</span>
            <Banknote className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatCurrency(data.totalEquity)}
          </div>
          {data.equityRatio && (
            <div className="text-xs text-gray-400">
              Equity Ratio: {(data.equityRatio * 100).toFixed(1)}%
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-purple-400">Net Assets</span>
            <Calculator className="h-5 w-5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatCurrency(data.netAssets)}
          </div>
          {data.workingCapital && (
            <div className="text-xs text-gray-400">
              Working Capital: {formatCurrency(data.workingCapital)}
            </div>
          )}
        </div>
      </div>

      {/* Financial Ratios */}
      {(data.currentRatio || data.quickRatio || data.debtToEquityRatio) && (
        <div className="bg-secondary border border-default rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-gray-400" />
            Financial Ratios
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.currentRatio && (
              <div>
                <div className="text-sm text-gray-400 mb-1">Current Ratio</div>
                <div className="text-xl font-bold text-white flex items-center gap-2">
                  {data.currentRatio.toFixed(2)}
                  {data.currentRatio >= 1.5 ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : data.currentRatio < 1 ? (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ) : null}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {data.currentRatio >= 1.5 ? 'Good liquidity' : data.currentRatio < 1 ? 'Low liquidity' : 'Adequate liquidity'}
                </div>
              </div>
            )}
            {data.quickRatio && (
              <div>
                <div className="text-sm text-gray-400 mb-1">Quick Ratio</div>
                <div className="text-xl font-bold text-white flex items-center gap-2">
                  {data.quickRatio.toFixed(2)}
                  {data.quickRatio >= 1 ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {data.quickRatio >= 1 ? 'Good short-term position' : 'May face short-term challenges'}
                </div>
              </div>
            )}
            {data.debtToEquityRatio && (
              <div>
                <div className="text-sm text-gray-400 mb-1">Debt to Equity</div>
                <div className="text-xl font-bold text-white flex items-center gap-2">
                  {data.debtToEquityRatio.toFixed(2)}
                  {data.debtToEquityRatio <= 1 ? (
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  ) : data.debtToEquityRatio > 2 ? (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ) : null}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {data.debtToEquityRatio <= 1 ? 'Conservative leverage' : data.debtToEquityRatio > 2 ? 'High leverage' : 'Moderate leverage'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Balance Sheet Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assets */}
        <div className="bg-secondary border border-default rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-400" />
            Assets
          </h3>
          
          {data.assets.currentAssets.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Current Assets</h4>
              <div className="space-y-1">
                {renderAccounts(data.assets.currentAssets)}
              </div>
            </div>
          )}
          
          {data.assets.nonCurrentAssets.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Non-Current Assets</h4>
              <div className="space-y-1">
                {renderAccounts(data.assets.nonCurrentAssets)}
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-white">Total Assets</span>
              <span className="font-bold text-white text-lg tabular-nums">
                {formatCurrency(data.totalAssets)}
              </span>
            </div>
          </div>
        </div>

        {/* Liabilities */}
        <div className="bg-secondary border border-default rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-red-400" />
            Liabilities
          </h3>
          
          {data.liabilities.currentLiabilities.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Current Liabilities</h4>
              <div className="space-y-1">
                {renderAccounts(data.liabilities.currentLiabilities)}
              </div>
            </div>
          )}
          
          {data.liabilities.nonCurrentLiabilities.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Non-Current Liabilities</h4>
              <div className="space-y-1">
                {renderAccounts(data.liabilities.nonCurrentLiabilities)}
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-white">Total Liabilities</span>
              <span className="font-bold text-white text-lg tabular-nums">
                {formatCurrency(data.totalLiabilities)}
              </span>
            </div>
          </div>
        </div>

        {/* Equity */}
        <div className="bg-secondary border border-default rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-400" />
            Equity
          </h3>
          
          <div className="mb-6">
            <div className="space-y-1">
              {renderAccounts(data.equity.accounts)}
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-white">Total Equity</span>
              <span className="font-bold text-white text-lg tabular-nums">
                {formatCurrency(data.totalEquity)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata */}
      {(data.reportDate || data.fetchedAt || data.source) && (
        <div className="bg-gray-800/30 rounded-lg p-4 text-sm text-gray-400">
          <div className="flex flex-wrap gap-4">
            {data.reportDate && (
              <div>
                <span className="text-gray-500">Report Date:</span>{' '}
                <span className="text-gray-300">{new Date(data.reportDate).toLocaleDateString()}</span>
              </div>
            )}
            {data.fetchedAt && (
              <div>
                <span className="text-gray-500">Last Updated:</span>{' '}
                <span className="text-gray-300">{new Date(data.fetchedAt).toLocaleString()}</span>
              </div>
            )}
            {data.source && (
              <div>
                <span className="text-gray-500">Source:</span>{' '}
                <span className="text-gray-300 capitalize">{data.source}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}