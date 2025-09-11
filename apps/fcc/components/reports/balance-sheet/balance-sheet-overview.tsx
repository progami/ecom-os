'use client';

import { formatNumber } from '@/lib/design-tokens';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import type { BalanceSheetData } from '@/lib/schemas/report-schemas';

interface BalanceSheetOverviewProps {
  data: BalanceSheetData;
}

export function BalanceSheetOverview({ data }: BalanceSheetOverviewProps) {
  // Calculate key metrics with safety checks
  const workingCapital = (data.currentAssets || 0) - Math.abs(data.currentLiabilities || 0);
  const currentRatio = data.currentRatio || 0;
  const debtToEquityRatio = data.summary?.debtToEquityRatio || 0;
  const equityRatio = data.equityRatio || 0;

  // Determine health indicators
  const liquidityHealth = currentRatio >= 2 ? 'excellent' : currentRatio >= 1 ? 'good' : 'concern';
  const leverageHealth = debtToEquityRatio <= 0.5 ? 'excellent' : debtToEquityRatio <= 1 ? 'moderate' : 'high';
  const equityHealth = equityRatio >= 50 ? 'strong' : equityRatio >= 30 ? 'moderate' : 'weak';

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assets */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Total Assets</h3>
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <div className="w-5 h-5 bg-blue-500 rounded" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-white mb-1">
            {formatNumber(data.totalAssets, { currency: true, currencyCode: 'GBP' })}
          </p>
          <p className="text-xs text-slate-500">
            Current: {formatNumber(data.currentAssets || 0, { currency: true, currencyCode: 'GBP', abbreviate: true })}
          </p>
        </div>

        {/* Total Liabilities */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Total Liabilities</h3>
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <div className="w-5 h-5 bg-red-500 rounded" />
            </div>
          </div>
          <p className="text-2xl font-semibold text-white mb-1">
            {formatNumber(Math.abs(data.totalLiabilities), { currency: true, currencyCode: 'GBP' })}
          </p>
          <p className="text-xs text-slate-500">
            Current: {formatNumber(Math.abs(data.currentLiabilities || 0), { currency: true, currencyCode: 'GBP', abbreviate: true })}
          </p>
        </div>

        {/* Net Assets */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Net Assets</h3>
            {data.netAssets > 0 ? (
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
          </div>
          <p className={`text-2xl font-semibold ${data.netAssets > 0 ? 'text-emerald-400' : 'text-red-400'} mb-1`}>
            {formatNumber(data.netAssets, { currency: true, currencyCode: 'GBP' })}
          </p>
          <p className="text-xs text-slate-500">
            Equity ratio: {equityRatio.toFixed(1)}%
          </p>
        </div>

        {/* Working Capital */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-400">Working Capital</h3>
            {workingCapital > 0 ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <p className={`text-2xl font-semibold ${workingCapital > 0 ? 'text-white' : 'text-amber-400'} mb-1`}>
            {formatNumber(workingCapital, { currency: true, currencyCode: 'GBP' })}
          </p>
          <p className="text-xs text-slate-500">
            Current ratio: {currentRatio.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Financial Health Indicators */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Financial Health Indicators</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Liquidity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Liquidity Position</span>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                liquidityHealth === 'excellent' ? 'bg-emerald-500/20 text-emerald-400' :
                liquidityHealth === 'good' ? 'bg-blue-500/20 text-blue-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {liquidityHealth.charAt(0).toUpperCase() + liquidityHealth.slice(1)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Current Ratio</span>
                <span className="text-white font-medium">{currentRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Quick Ratio</span>
                <span className="text-white font-medium">{(data.summary?.quickRatio || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Leverage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Leverage Position</span>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                leverageHealth === 'excellent' ? 'bg-emerald-500/20 text-emerald-400' :
                leverageHealth === 'moderate' ? 'bg-blue-500/20 text-blue-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {leverageHealth.charAt(0).toUpperCase() + leverageHealth.slice(1)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Debt-to-Equity</span>
                <span className="text-white font-medium">{debtToEquityRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Debt</span>
                <span className="text-white font-medium">
                  {formatNumber(Math.abs(data.totalLiabilities), { currency: true, currencyCode: 'GBP', abbreviate: true })}
                </span>
              </div>
            </div>
          </div>

          {/* Solvency */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Solvency Position</span>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                equityHealth === 'strong' ? 'bg-emerald-500/20 text-emerald-400' :
                equityHealth === 'moderate' ? 'bg-blue-500/20 text-blue-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {equityHealth.charAt(0).toUpperCase() + equityHealth.slice(1)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Equity Ratio</span>
                <span className="text-white font-medium">{equityRatio.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Equity</span>
                <span className="text-white font-medium">
                  {formatNumber(data.totalEquity, { currency: true, currencyCode: 'GBP', abbreviate: true })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asset & Liability Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Asset Breakdown */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Asset Composition</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Current Assets</span>
                <span className="text-sm text-white font-medium">
                  {formatNumber(data.currentAssets || 0, { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((data.currentAssets || 0) / data.totalAssets) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Non-Current Assets</span>
                <span className="text-sm text-white font-medium">
                  {formatNumber(data.nonCurrentAssets || 0, { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((data.nonCurrentAssets || 0) / data.totalAssets) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Liability Breakdown */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Liability Composition</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Current Liabilities</span>
                <span className="text-sm text-white font-medium">
                  {formatNumber(Math.abs(data.currentLiabilities || 0), { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(Math.abs(data.currentLiabilities || 0) / Math.abs(data.totalLiabilities)) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-400">Non-Current Liabilities</span>
                <span className="text-sm text-white font-medium">
                  {formatNumber(Math.abs(data.nonCurrentLiabilities || 0), { currency: true, currencyCode: 'GBP' })}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(Math.abs(data.nonCurrentLiabilities || 0) / Math.abs(data.totalLiabilities)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}