'use client';

import { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target,
  AlertTriangle,
  Zap,
  Award,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/design-tokens';
import { 
  ComparisonMetric, 
  VarianceAnalysis, 
  performVarianceAnalysis,
  TrendDirection 
} from '@/lib/comparison-utils';

interface ComparisonSummaryProps {
  metrics: ComparisonMetric[];
  title?: string;
  showTopMetrics?: number;
  compactView?: boolean;
  currencyCode?: string;
  className?: string;
}

interface MetricSummaryCardProps {
  metric: ComparisonMetric;
  rank: number;
  type: 'improvement' | 'decline';
  currencyCode?: string;
  showRank?: boolean;
}

interface PerformanceIndicatorProps {
  label: string;
  current: number;
  target?: number;
  trend: TrendDirection;
  format?: 'currency' | 'percentage' | 'number';
  currencyCode?: string;
  size?: 'small' | 'medium' | 'large';
}

function MetricSummaryCard({ 
  metric, 
  rank, 
  type, 
  currencyCode = 'GBP',
  showRank = true 
}: MetricSummaryCardProps) {
  const formatValue = (value: number) => {
    return formatNumber(value, { currency: true, currencyCode });
  };

  const isImprovement = type === 'improvement';
  const bgColor = isImprovement 
    ? 'bg-emerald-600/10 border-emerald-500/30' 
    : 'bg-red-600/10 border-red-500/30';
  const textColor = isImprovement ? 'text-emerald-400' : 'text-red-400';
  const Icon = isImprovement ? TrendingUp : TrendingDown;

  return (
    <div className={cn('p-4 rounded-xl border transition-all hover:scale-105', bgColor)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {showRank && (
            <div className={cn(
              'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mb-2',
              isImprovement ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            )}>
              {rank}
            </div>
          )}
          <h4 className="font-semibold text-white text-sm mb-1">{metric.name}</h4>
          <div className={cn('text-xs px-2 py-1 rounded', 
            metric.significance === 'high' ? 'bg-amber-600/20 text-amber-400' :
            metric.significance === 'medium' ? 'bg-blue-600/20 text-blue-400' :
            'bg-slate-600/20 text-slate-400'
          )}>
            {metric.significance} impact
          </div>
        </div>
        <Icon className={cn('h-5 w-5', textColor)} />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">Change:</span>
          <span className={cn('font-semibold', textColor)}>
            {formatValue(metric.variance)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">Percentage:</span>
          <span className={cn('font-bold text-lg', textColor)}>
            {metric.percentageChange > 0 ? '+' : ''}{metric.percentageChange.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function PerformanceIndicator({ 
  label, 
  current, 
  target, 
  trend, 
  format = 'currency',
  currencyCode = 'GBP',
  size = 'medium'
}: PerformanceIndicatorProps) {
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

  const getTrendColor = (t: TrendDirection) => {
    switch (t) {
      case 'up': return 'text-emerald-400';
      case 'down': return 'text-red-400';
      default: return 'text-amber-400';
    }
  };

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  
  const sizeClasses = {
    small: { container: 'p-3', value: 'text-lg', label: 'text-xs' },
    medium: { container: 'p-4', value: 'text-xl', label: 'text-sm' },
    large: { container: 'p-6', value: 'text-2xl', label: 'text-base' }
  };

  const classes = sizeClasses[size];

  return (
    <div className={cn('bg-slate-800/30 border border-slate-700/50 rounded-xl', classes.container)}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn('font-medium text-slate-300', classes.label)}>{label}</span>
        <TrendIcon className={cn('h-4 w-4', getTrendColor(trend))} />
      </div>
      
      <div className={cn('font-bold text-white mb-1', classes.value)}>
        {formatValue(current)}
      </div>
      
      {target && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Target:</span>
          <span className="text-slate-300">{formatValue(target)}</span>
        </div>
      )}
    </div>
  );
}

export function ComparisonSummary({
  metrics,
  title = "Performance Summary",
  showTopMetrics = 3,
  compactView = false,
  currencyCode = 'GBP',
  className
}: ComparisonSummaryProps) {
  // Perform variance analysis
  const analysis = useMemo(() => performVarianceAnalysis(metrics), [metrics]);
  
  // Get top improvements and declines
  const topImprovements = useMemo(() => {
    return analysis.favorableVariances
      .sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
      .slice(0, showTopMetrics);
  }, [analysis.favorableVariances, showTopMetrics]);

  const topDeclines = useMemo(() => {
    return analysis.unfavorableVariances
      .sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
      .slice(0, showTopMetrics);
  }, [analysis.unfavorableVariances, showTopMetrics]);

  // Calculate overall performance score
  const performanceScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    
    const improvementCount = analysis.favorableVariances.length;
    const totalCount = metrics.length;
    const significantImprovements = analysis.favorableVariances.filter(m => m.significance !== 'low').length;
    const significantDeclines = analysis.unfavorableVariances.filter(m => m.significance !== 'low').length;
    
    const baseScore = (improvementCount / totalCount) * 100;
    const significanceAdjustment = (significantImprovements - significantDeclines) * 5;
    
    return Math.max(0, Math.min(100, baseScore + significanceAdjustment));
  }, [metrics, analysis]);

  const getPerformanceGrade = (score: number) => {
    if (score >= 80) return { grade: 'A', color: 'text-emerald-400', bg: 'bg-emerald-600/20' };
    if (score >= 60) return { grade: 'B', color: 'text-blue-400', bg: 'bg-blue-600/20' };
    if (score >= 40) return { grade: 'C', color: 'text-amber-400', bg: 'bg-amber-600/20' };
    return { grade: 'D', color: 'text-red-400', bg: 'bg-red-600/20' };
  };

  const performanceGrade = getPerformanceGrade(performanceScore);

  if (compactView) {
    return (
      <div className={cn('bg-slate-800/30 rounded-xl border border-slate-700/50 p-4', className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <div className={cn('px-3 py-1 rounded-lg font-bold', performanceGrade.bg, performanceGrade.color)}>
            {performanceGrade.grade}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-emerald-400">{analysis.favorableVariances.length}</div>
            <div className="text-xs text-slate-400">Improvements</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-400">{analysis.unfavorableVariances.length}</div>
            <div className="text-xs text-slate-400">Declines</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{metrics.length}</div>
            <div className="text-xs text-slate-400">Total</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Performance Score */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-slate-400">Performance Score</div>
              <div className="text-2xl font-bold text-white">{performanceScore.toFixed(0)}/100</div>
            </div>
            <div className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold',
              performanceGrade.bg,
              performanceGrade.color
            )}>
              {performanceGrade.grade}
            </div>
          </div>
        </div>

        {/* Overall Trend Indicator */}
        <div className="flex items-center gap-2">
          {(() => {
            const TrendIcon = analysis.overallTrend === 'up' ? TrendingUp : 
                            analysis.overallTrend === 'down' ? TrendingDown : Minus;
            const trendColor = analysis.overallTrend === 'up' ? 'text-emerald-400' :
                             analysis.overallTrend === 'down' ? 'text-red-400' : 'text-amber-400';
            const trendText = analysis.overallTrend === 'up' ? 'Improving' :
                            analysis.overallTrend === 'down' ? 'Declining' : 'Stable';
            
            return (
              <>
                <TrendIcon className={cn('h-5 w-5', trendColor)} />
                <span className={cn('font-medium', trendColor)}>Overall {trendText} Trend</span>
              </>
            );
          })()}
        </div>
      </div>

      {/* Key Insights */}
      {analysis.keyInsights.length > 0 && (
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-blue-400" />
            <h3 className="font-semibold text-white">Key Insights</h3>
          </div>
          <ul className="space-y-1">
            {analysis.keyInsights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                <Target className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Improvements */}
        {topImprovements.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">Top Improvements</h3>
            </div>
            <div className="space-y-3">
              {topImprovements.map((metric, index) => (
                <MetricSummaryCard
                  key={metric.name}
                  metric={metric}
                  rank={index + 1}
                  type="improvement"
                  currencyCode={currencyCode}
                />
              ))}
            </div>
          </div>
        )}

        {/* Top Declines */}
        {topDeclines.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-semibold text-white">Areas Needing Attention</h3>
            </div>
            <div className="space-y-3">
              {topDeclines.map((metric, index) => (
                <MetricSummaryCard
                  key={metric.name}
                  metric={metric}
                  rank={index + 1}
                  type="decline"
                  currencyCode={currencyCode}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Performance Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <PerformanceIndicator
          label="Favorable Metrics"
          current={analysis.favorableVariances.length}
          trend={analysis.favorableVariances.length > analysis.unfavorableVariances.length ? 'up' : 'down'}
          format="number"
        />
        
        <PerformanceIndicator
          label="Unfavorable Metrics"
          current={analysis.unfavorableVariances.length}
          trend={analysis.unfavorableVariances.length > analysis.favorableVariances.length ? 'up' : 'down'}
          format="number"
        />
        
        <PerformanceIndicator
          label="High Impact Changes"
          current={metrics.filter(m => m.significance === 'high').length}
          trend={metrics.filter(m => m.significance === 'high' && m.isImprovement).length > 
                 metrics.filter(m => m.significance === 'high' && !m.isImprovement).length ? 'up' : 'down'}
          format="number"
        />
        
        <PerformanceIndicator
          label="Total Metrics"
          current={metrics.length}
          trend="flat"
          format="number"
        />
      </div>

      {/* Risk Factors */}
      {analysis.riskFactors.length > 0 && (
        <div className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h3 className="font-semibold text-white">Risk Factors</h3>
          </div>
          <ul className="space-y-1">
            {analysis.riskFactors.map((risk, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}