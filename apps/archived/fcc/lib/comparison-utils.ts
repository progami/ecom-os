/**
 * Comparison Utilities for Financial Report Analysis
 * 
 * Provides functions for:
 * - Period comparison calculations
 * - Variance analysis
 * - Trend detection
 * - Statistical analysis
 * - Data formatting for charts and tables
 */

import { format, addDays, subDays, subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

export type ComparisonType = 
  | 'previous-period'    // Same length period before current
  | 'year-over-year'     // Same period last year
  | 'month-over-month'   // Previous month
  | 'custom'             // User-defined period
  | 'quarter-over-quarter' // Previous quarter
  | 'rolling-average';   // Rolling average comparison

export type TrendDirection = 'up' | 'down' | 'flat';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface PeriodComparison {
  current: DateRange;
  comparison: DateRange;
  type: ComparisonType;
  label: string;
}

export interface ComparisonMetric {
  name: string;
  current: number;
  comparison: number;
  variance: number;
  percentageChange: number;
  trend: TrendDirection;
  isImprovement: boolean;
  significance: 'high' | 'medium' | 'low';
}

export interface VarianceAnalysis {
  favorableVariances: ComparisonMetric[];
  unfavorableVariances: ComparisonMetric[];
  keyInsights: string[];
  overallTrend: TrendDirection;
  riskFactors: string[];
}

/**
 * Generate comparison period based on current period and comparison type
 */
export function generateComparisonPeriod(
  currentPeriod: DateRange,
  type: ComparisonType,
  customPeriod?: DateRange
): PeriodComparison {
  const { startDate, endDate } = currentPeriod;
  const periodLengthDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  let comparisonPeriod: DateRange;
  let label: string;

  switch (type) {
    case 'previous-period':
      comparisonPeriod = {
        startDate: subDays(startDate, periodLengthDays),
        endDate: subDays(endDate, periodLengthDays)
      };
      label = 'Previous Period';
      break;

    case 'year-over-year':
      comparisonPeriod = {
        startDate: subYears(startDate, 1),
        endDate: subYears(endDate, 1)
      };
      label = 'Same Period Last Year';
      break;

    case 'month-over-month':
      comparisonPeriod = {
        startDate: startOfMonth(subMonths(startDate, 1)),
        endDate: endOfMonth(subMonths(endDate, 1))
      };
      label = 'Previous Month';
      break;

    case 'quarter-over-quarter':
      comparisonPeriod = {
        startDate: subMonths(startDate, 3),
        endDate: subMonths(endDate, 3)
      };
      label = 'Previous Quarter';
      break;

    case 'custom':
      if (!customPeriod) {
        throw new Error('Custom period must be provided for custom comparison type');
      }
      comparisonPeriod = customPeriod;
      label = 'Custom Period';
      break;

    case 'rolling-average':
      // For rolling average, we'll use the previous 3 periods of the same length
      comparisonPeriod = {
        startDate: subDays(startDate, periodLengthDays * 3),
        endDate: subDays(endDate, periodLengthDays)
      };
      label = '3-Period Average';
      break;

    default:
      throw new Error(`Unsupported comparison type: ${type}`);
  }

  return {
    current: currentPeriod,
    comparison: comparisonPeriod,
    type,
    label
  };
}

/**
 * Calculate variance between two values
 */
export function calculateVariance(current: number, comparison: number): {
  variance: number;
  percentageChange: number;
  trend: TrendDirection;
} {
  const variance = current - comparison;
  
  // Handle division by zero for percentage calculation
  let percentageChange = 0;
  if (comparison !== 0) {
    percentageChange = (variance / Math.abs(comparison)) * 100;
  } else if (current !== 0) {
    // If comparison is 0 but current isn't, use a large percentage
    percentageChange = current > 0 ? 100 : -100;
  }

  // Determine trend direction
  let trend: TrendDirection = 'flat';
  if (Math.abs(percentageChange) > 1) { // Only consider significant changes (>1%)
    trend = variance > 0 ? 'up' : 'down';
  }

  return { variance, percentageChange, trend };
}

/**
 * Analyze whether a variance is an improvement based on the metric type
 */
export function analyzeImprovement(
  variance: number,
  metricType: 'revenue' | 'expense' | 'profit' | 'asset' | 'liability' | 'equity' | 'margin'
): boolean {
  switch (metricType) {
    case 'revenue':
    case 'profit':
    case 'asset':
    case 'equity':
    case 'margin':
      return variance > 0; // Increase is good
    
    case 'expense':
    case 'liability':
      return variance < 0; // Decrease is good
    
    default:
      return variance > 0; // Default to increase being good
  }
}

/**
 * Determine variance significance based on percentage change
 */
export function determineSignificance(percentageChange: number): 'high' | 'medium' | 'low' {
  const absChange = Math.abs(percentageChange);
  
  if (absChange >= 20) return 'high';
  if (absChange >= 5) return 'medium';
  return 'low';
}

/**
 * Create comparison metric from current and comparison values
 */
export function createComparisonMetric(
  name: string,
  current: number,
  comparison: number,
  metricType: 'revenue' | 'expense' | 'profit' | 'asset' | 'liability' | 'equity' | 'margin' = 'revenue'
): ComparisonMetric {
  const { variance, percentageChange, trend } = calculateVariance(current, comparison);
  const isImprovement = analyzeImprovement(variance, metricType);
  const significance = determineSignificance(percentageChange);

  return {
    name,
    current,
    comparison,
    variance,
    percentageChange,
    trend,
    isImprovement,
    significance
  };
}

/**
 * Perform comprehensive variance analysis on a set of metrics
 */
export function performVarianceAnalysis(metrics: ComparisonMetric[]): VarianceAnalysis {
  const favorableVariances = metrics.filter(m => m.isImprovement && m.significance !== 'low');
  const unfavorableVariances = metrics.filter(m => !m.isImprovement && m.significance !== 'low');
  
  // Generate insights
  const keyInsights: string[] = [];
  
  // Find significant improvements
  const significantImprovements = favorableVariances.filter(m => m.significance === 'high');
  if (significantImprovements.length > 0) {
    keyInsights.push(`Strong performance in ${significantImprovements.map(m => m.name).join(', ')}`);
  }
  
  // Find concerning trends
  const significantDeclines = unfavorableVariances.filter(m => m.significance === 'high');
  if (significantDeclines.length > 0) {
    keyInsights.push(`Areas needing attention: ${significantDeclines.map(m => m.name).join(', ')}`);
  }
  
  // Analyze overall trend
  const upTrends = metrics.filter(m => m.trend === 'up').length;
  const downTrends = metrics.filter(m => m.trend === 'down').length;
  
  let overallTrend: TrendDirection = 'flat';
  if (upTrends > downTrends) overallTrend = 'up';
  else if (downTrends > upTrends) overallTrend = 'down';
  
  // Identify risk factors
  const riskFactors: string[] = [];
  if (unfavorableVariances.length > favorableVariances.length) {
    riskFactors.push('More metrics declining than improving');
  }
  
  const highRiskMetrics = unfavorableVariances.filter(m => m.significance === 'high');
  if (highRiskMetrics.length > 2) {
    riskFactors.push('Multiple high-impact negative variances');
  }

  return {
    favorableVariances,
    unfavorableVariances,
    keyInsights,
    overallTrend,
    riskFactors
  };
}

/**
 * Format comparison data for chart display
 */
export function formatComparisonDataForChart(
  metrics: ComparisonMetric[],
  chartType: 'bar' | 'line' | 'waterfall' | 'heatmap' = 'bar'
) {
  switch (chartType) {
    case 'bar':
      return metrics.map(metric => ({
        name: metric.name,
        current: metric.current,
        comparison: metric.comparison,
        variance: metric.variance,
        isImprovement: metric.isImprovement
      }));

    case 'waterfall':
      // Create waterfall data showing how we get from comparison to current
      const waterfallData = [
        { name: 'Starting Value', value: metrics[0]?.comparison || 0, cumulative: metrics[0]?.comparison || 0 }
      ];
      
      let cumulative = metrics[0]?.comparison || 0;
      metrics.forEach(metric => {
        cumulative += metric.variance;
        waterfallData.push({
          name: metric.name,
          value: metric.variance,
          cumulative
        });
      });
      
      return waterfallData;

    case 'heatmap':
      return metrics.map(metric => ({
        name: metric.name,
        percentageChange: metric.percentageChange,
        significance: metric.significance,
        isImprovement: metric.isImprovement
      }));

    case 'line':
    default:
      return metrics.map(metric => ({
        name: metric.name,
        current: metric.current,
        comparison: metric.comparison
      }));
  }
}

/**
 * Handle edge cases in comparison calculations
 */
export function handleComparisonEdgeCases(current: number, comparison: number): {
  isValid: boolean;
  message?: string;
  adjustedComparison?: number;
} {
  // Handle both values being zero
  if (current === 0 && comparison === 0) {
    return { isValid: false, message: 'No data to compare' };
  }
  
  // Handle negative values
  if (current < 0 && comparison > 0) {
    return { isValid: true, message: 'Negative variance due to sign change' };
  }
  
  if (current > 0 && comparison < 0) {
    return { isValid: true, message: 'Positive variance due to sign change' };
  }
  
  // Handle very small comparison values (avoid inflated percentages)
  if (Math.abs(comparison) < 0.01 && Math.abs(comparison) > 0) {
    return { 
      isValid: true, 
      message: 'Small base value may cause large percentage changes',
      adjustedComparison: comparison < 0 ? -0.01 : 0.01
    };
  }
  
  return { isValid: true };
}

/**
 * Generate period labels for display
 */
export function generatePeriodLabels(comparison: PeriodComparison): {
  currentLabel: string;
  comparisonLabel: string;
  shortLabel: string;
} {
  const currentLabel = `${format(comparison.current.startDate, 'MMM d, yyyy')} - ${format(comparison.current.endDate, 'MMM d, yyyy')}`;
  const comparisonLabel = `${format(comparison.comparison.startDate, 'MMM d, yyyy')} - ${format(comparison.comparison.endDate, 'MMM d, yyyy')}`;
  
  let shortLabel = '';
  switch (comparison.type) {
    case 'year-over-year':
      shortLabel = 'YoY';
      break;
    case 'month-over-month':
      shortLabel = 'MoM';
      break;
    case 'quarter-over-quarter':
      shortLabel = 'QoQ';
      break;
    case 'previous-period':
      shortLabel = 'vs Prev';
      break;
    default:
      shortLabel = 'vs Custom';
  }
  
  return { currentLabel, comparisonLabel, shortLabel };
}

/**
 * Calculate rolling averages for trend analysis
 */
export function calculateRollingAverage(
  values: number[],
  periods: number = 3
): number[] {
  if (values.length < periods) {
    return values;
  }
  
  const rollingAverages: number[] = [];
  
  for (let i = periods - 1; i < values.length; i++) {
    const sum = values.slice(i - periods + 1, i + 1).reduce((acc, val) => acc + val, 0);
    rollingAverages.push(sum / periods);
  }
  
  return rollingAverages;
}

/**
 * Detect seasonal patterns in financial data
 */
export function detectSeasonalPatterns(
  monthlyData: Array<{ month: string; value: number }>
): {
  hasSeasonality: boolean;
  peakMonths: string[];
  lowMonths: string[];
  seasonalityStrength: number;
} {
  if (monthlyData.length < 12) {
    return {
      hasSeasonality: false,
      peakMonths: [],
      lowMonths: [],
      seasonalityStrength: 0
    };
  }
  
  const values = monthlyData.map(d => d.value);
  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate coefficient of variation as seasonality strength
  const seasonalityStrength = stdDev / average;
  
  // Find peak and low months (values significantly above/below average)
  const threshold = stdDev * 0.5;
  const peakMonths = monthlyData.filter(d => d.value > average + threshold).map(d => d.month);
  const lowMonths = monthlyData.filter(d => d.value < average - threshold).map(d => d.month);
  
  return {
    hasSeasonality: seasonalityStrength > 0.2, // 20% coefficient of variation indicates seasonality
    peakMonths,
    lowMonths,
    seasonalityStrength
  };
}