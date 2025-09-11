'use client';

import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Target,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/design-tokens';
import {
  ComparisonType,
  ComparisonMetric,
  PeriodComparison,
  DateRange,
  generateComparisonPeriod,
  createComparisonMetric,
  performVarianceAnalysis,
  generatePeriodLabels,
  TrendDirection
} from '@/lib/comparison-utils';

interface PeriodComparisonProps {
  currentPeriod: DateRange;
  comparisonType: ComparisonType;
  customPeriod?: DateRange;
  metrics: Array<{
    name: string;
    current: number;
    comparison: number;
    type: 'revenue' | 'expense' | 'profit' | 'asset' | 'liability' | 'equity' | 'margin';
    format?: 'currency' | 'percentage' | 'number';
    currencyCode?: string;
  }>;
  showDetailedAnalysis?: boolean;
  compactView?: boolean;
  className?: string;
}

interface VarianceCardProps {
  metric: ComparisonMetric;
  format?: 'currency' | 'percentage' | 'number';
  currencyCode?: string;
  compactView?: boolean;
}

function VarianceCard({ metric, format = 'currency', currencyCode = 'GBP', compactView = false }: VarianceCardProps) {
  const getVarianceColor = (isImprovement: boolean, significance: string) => {
    if (significance === 'low') return 'text-slate-400';
    return isImprovement ? 'text-emerald-400' : 'text-red-400';
  };

  const getVarianceBgColor = (isImprovement: boolean, significance: string) => {
    if (significance === 'low') return 'bg-slate-800/30 border-slate-700/50';
    return isImprovement 
      ? 'bg-emerald-600/10 border-emerald-500/30' 
      : 'bg-red-600/10 border-red-500/30';
  };

  const formatValue = (value: number) => {
    switch (format) {
      case 'currency':
        return formatNumber(value, { currency: true, currencyCode });
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
      default:
        return formatNumber(value);
    }
  };

  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;

  if (compactView) {
    return (
      <div className={cn(
        'p-3 rounded-lg border transition-all',
        getVarianceBgColor(metric.isImprovement, metric.significance)
      )}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-white truncate">{metric.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">
                {formatValue(metric.comparison)} → {formatValue(metric.current)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-3">
            <TrendIcon className={cn('h-4 w-4', getVarianceColor(metric.isImprovement, metric.significance))} />
            <div className="text-right">
              <div className={cn('text-sm font-semibold', getVarianceColor(metric.isImprovement, metric.significance))}>
                {metric.percentageChange > 0 ? '+' : ''}{metric.percentageChange.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all',
      getVarianceBgColor(metric.isImprovement, metric.significance)
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-base font-semibold text-white mb-1">{metric.name}</h4>
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-1 rounded text-xs font-medium',
              metric.significance === 'high' ? 'bg-amber-600/20 text-amber-400' :
              metric.significance === 'medium' ? 'bg-blue-600/20 text-blue-400' :
              'bg-slate-600/20 text-slate-400'
            )}>
              {metric.significance} impact
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendIcon className={cn('h-5 w-5', getVarianceColor(metric.isImprovement, metric.significance))} />
          {metric.isImprovement ? (
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-400" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">Previous</p>
          <p className="text-lg font-semibold text-white">{formatValue(metric.comparison)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Current</p>
          <p className="text-lg font-semibold text-white">{formatValue(metric.current)}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Change</p>
            <p className={cn('text-sm font-semibold', getVarianceColor(metric.isImprovement, metric.significance))}>
              {formatValue(metric.variance)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Percentage</p>
            <p className={cn('text-lg font-bold', getVarianceColor(metric.isImprovement, metric.significance))}>
              {metric.percentageChange > 0 ? '+' : ''}{metric.percentageChange.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PeriodComparisonComponent({
  currentPeriod,
  comparisonType,
  customPeriod,
  metrics,
  showDetailedAnalysis = true,
  compactView = false,
  className
}: PeriodComparisonProps) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Generate comparison period and labels
  const periodComparison = useMemo(() => {
    return generateComparisonPeriod(currentPeriod, comparisonType, customPeriod);
  }, [currentPeriod, comparisonType, customPeriod]);

  const periodLabels = useMemo(() => {
    return generatePeriodLabels(periodComparison);
  }, [periodComparison]);

  // Create comparison metrics
  const comparisonMetrics = useMemo(() => {
    return metrics.map(metric => 
      createComparisonMetric(metric.name, metric.current, metric.comparison, metric.type)
    );
  }, [metrics]);

  // Perform variance analysis
  const varianceAnalysis = useMemo(() => {
    return performVarianceAnalysis(comparisonMetrics);
  }, [comparisonMetrics]);

  const getOverallTrendColor = (trend: TrendDirection) => {
    switch (trend) {
      case 'up': return 'text-emerald-400';
      case 'down': return 'text-red-400';
      default: return 'text-amber-400';
    }
  };

  const getOverallTrendIcon = (trend: TrendDirection) => {
    switch (trend) {
      case 'up': return TrendingUp;
      case 'down': return TrendingDown;
      default: return Minus;
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Period Header */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Period Comparison</h3>
            <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded">
              {periodLabels.shortLabel}
            </span>
          </div>
          
          {/* Overall Trend Indicator */}
          <div className="flex items-center gap-2">
            {(() => {
              const TrendIcon = getOverallTrendIcon(varianceAnalysis.overallTrend);
              return (
                <div className="flex items-center gap-2">
                  <TrendIcon className={cn('h-5 w-5', getOverallTrendColor(varianceAnalysis.overallTrend))} />
                  <span className={cn('text-sm font-medium', getOverallTrendColor(varianceAnalysis.overallTrend))}>
                    {varianceAnalysis.overallTrend === 'up' ? 'Improving' : 
                     varianceAnalysis.overallTrend === 'down' ? 'Declining' : 'Stable'}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400 mb-1">Current Period</p>
            <p className="text-white font-medium">{periodLabels.currentLabel}</p>
          </div>
          <div>
            <p className="text-slate-400 mb-1">Comparison Period</p>
            <p className="text-white font-medium">{periodLabels.comparisonLabel}</p>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      {showDetailedAnalysis && varianceAnalysis.keyInsights.length > 0 && (
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-blue-400" />
            <h4 className="font-semibold text-white">Key Insights</h4>
          </div>
          <ul className="space-y-1 text-sm text-slate-300">
            {varianceAnalysis.keyInsights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2">
                <Target className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Factors */}
      {showDetailedAnalysis && varianceAnalysis.riskFactors.length > 0 && (
        <div className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h4 className="font-semibold text-white">Risk Factors</h4>
          </div>
          <ul className="space-y-1 text-sm text-slate-300">
            {varianceAnalysis.riskFactors.map((risk, index) => (
              <li key={index} className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metrics Grid */}
      <div className={cn(
        'grid gap-4',
        compactView 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
          : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
      )}>
        {comparisonMetrics.map((metric, index) => {
          const originalMetric = metrics[index];
          return (
            <VarianceCard
              key={metric.name}
              metric={metric}
              format={originalMetric.format}
              currencyCode={originalMetric.currencyCode}
              compactView={compactView}
            />
          );
        })}
      </div>

      {/* Summary Statistics */}
      {showDetailedAnalysis && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h4 className="font-semibold text-white">Improvements</h4>
            </div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">
              {varianceAnalysis.favorableVariances.length}
            </div>
            <p className="text-sm text-slate-300">
              metrics showing positive variance
            </p>
          </div>

          <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-5 w-5 text-red-400" />
              <h4 className="font-semibold text-white">Declines</h4>
            </div>
            <div className="text-2xl font-bold text-red-400 mb-1">
              {varianceAnalysis.unfavorableVariances.length}
            </div>
            <p className="text-sm text-slate-300">
              metrics showing negative variance
            </p>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-slate-400" />
              <h4 className="font-semibold text-white">Total Metrics</h4>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {comparisonMetrics.length}
            </div>
            <p className="text-sm text-slate-300">
              metrics analyzed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}