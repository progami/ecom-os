'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, LineChart as LineChartIcon, Activity, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/design-tokens';
import { ComparisonMetric, formatComparisonDataForChart } from '@/lib/comparison-utils';

interface BaseChartProps {
  data: ComparisonMetric[];
  height?: number;
  showLegend?: boolean;
  currencyCode?: string;
  title?: string;
  className?: string;
}

interface SideBySideBarChartProps extends BaseChartProps {
  showVariance?: boolean;
}

interface TrendLineChartProps extends BaseChartProps {
  multiPeriodData?: Array<{
    period: string;
    current: number;
    comparison: number;
    [key: string]: any;
  }>;
  showTrendLine?: boolean;
}

interface WaterfallChartProps extends BaseChartProps {
  startingValue?: number;
}

interface ComparisonHeatmapProps extends BaseChartProps {
  gridSize?: 'small' | 'medium' | 'large';
}

// Color scheme for charts
const CHART_COLORS = {
  current: '#10b981',      // emerald-500
  comparison: '#3b82f6',   // blue-500
  variance: '#f59e0b',     // amber-500
  positive: '#10b981',     // emerald-500
  negative: '#ef4444',     // red-500
  neutral: '#6b7280',      // gray-500
  gradient: {
    current: ['#10b981', '#059669'],
    comparison: ['#3b82f6', '#2563eb'],
    variance: ['#f59e0b', '#d97706']
  }
};

// Custom tooltip component
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  currencyCode?: string;
  showPercentage?: boolean;
}

function CustomTooltip({ active, payload, label, currencyCode = 'GBP', showPercentage = false }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-white font-medium mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-300">{entry.name}:</span>
          <span className="text-white font-medium">
            {showPercentage 
              ? `${entry.value?.toFixed(1)}%`
              : formatNumber(entry.value, { currency: true, currencyCode })}
          </span>
        </div>
      ))}
    </div>
  );
}

// Side-by-side bar chart for period comparisons
export function SideBySideBarChart({ 
  data, 
  height = 300, 
  showLegend = true, 
  showVariance = true,
  currencyCode = 'GBP',
  title,
  className 
}: SideBySideBarChartProps) {
  const chartData = useMemo(() => 
    formatComparisonDataForChart(data, 'bar'), 
    [data]
  );

  const maxValue = useMemo(() => {
    const values = chartData.flatMap(item => [item.current, item.comparison, Math.abs(item.variance || 0)]);
    return Math.max(...values) * 1.1; // Add 10% padding
  }, [chartData]);

  return (
    <div className={cn('bg-slate-800/30 rounded-xl border border-slate-700/50 p-6', className)}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="name" 
            stroke="#9CA3AF"
            tick={{ fontSize: 12, fill: '#9CA3AF' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#9CA3AF"
            tick={{ fontSize: 12, fill: '#9CA3AF' }}
            tickFormatter={(value) => formatNumber(value, { currency: true, abbreviate: true })}
            domain={[0, maxValue]}
          />
          <Tooltip 
            content={<CustomTooltip currencyCode={currencyCode} />}
          />
          {showLegend && <Legend wrapperStyle={{ color: '#fff', paddingTop: '20px' }} />}
          
          <Bar 
            dataKey="comparison" 
            fill={CHART_COLORS.comparison}
            name="Previous Period"
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            dataKey="current" 
            fill={CHART_COLORS.current}
            name="Current Period"
            radius={[4, 4, 0, 0]}
          />
          
          {showVariance && (
            <Bar 
              dataKey="variance" 
              fill={CHART_COLORS.variance}
              name="Variance"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isImprovement ? CHART_COLORS.positive : CHART_COLORS.negative} 
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Line chart showing trends over multiple periods
export function TrendLineChart({ 
  data, 
  multiPeriodData,
  height = 300, 
  showLegend = true,
  showTrendLine = true,
  currencyCode = 'GBP',
  title,
  className 
}: TrendLineChartProps) {
  // Use multiPeriodData if provided, otherwise format single period data
  const chartData = useMemo(() => {
    if (multiPeriodData) {
      return multiPeriodData;
    }
    // Convert single period comparison to trend data
    return [
      { period: 'Previous', ...data.reduce((acc, metric) => ({ ...acc, [metric.name]: metric.comparison }), {}) },
      { period: 'Current', ...data.reduce((acc, metric) => ({ ...acc, [metric.name]: metric.current }), {}) }
    ];
  }, [data, multiPeriodData]);

  const dataKeys = useMemo(() => {
    if (chartData.length === 0) return [];
    return Object.keys(chartData[0]).filter(key => key !== 'period');
  }, [chartData]);

  const colors = [
    CHART_COLORS.current,
    CHART_COLORS.comparison,
    CHART_COLORS.variance,
    '#8b5cf6', // purple-500
    '#f59e0b', // amber-500
    '#06b6d4', // cyan-500
  ];

  return (
    <div className={cn('bg-slate-800/30 rounded-xl border border-slate-700/50 p-6', className)}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          <LineChartIcon className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="period" 
            stroke="#9CA3AF"
            tick={{ fontSize: 12, fill: '#9CA3AF' }}
          />
          <YAxis 
            stroke="#9CA3AF"
            tick={{ fontSize: 12, fill: '#9CA3AF' }}
            tickFormatter={(value) => formatNumber(value, { currency: true, abbreviate: true })}
          />
          <Tooltip 
            content={<CustomTooltip currencyCode={currencyCode} />}
          />
          {showLegend && <Legend wrapperStyle={{ color: '#fff', paddingTop: '20px' }} />}
          
          {dataKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: colors[index % colors.length], strokeWidth: 2 }}
              name={key}
            />
          ))}
          
          {showTrendLine && (
            <ReferenceLine stroke="#64748b" strokeDasharray="5 5" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Waterfall chart for variance analysis
export function WaterfallChart({ 
  data, 
  startingValue = 0,
  height = 300, 
  showLegend = true,
  currencyCode = 'GBP',
  title,
  className 
}: WaterfallChartProps) {
  const chartData = useMemo(() => {
    const waterfallData = formatComparisonDataForChart(data, 'waterfall');
    
    // Calculate cumulative values for waterfall effect
    let cumulative = startingValue;
    return waterfallData.map((item, index) => {
      if (index === 0) {
        return { ...item, start: 0, end: item.value, cumulative: item.value };
      }
      
      const start = cumulative;
      cumulative += item.value;
      
      return {
        ...item,
        start,
        end: cumulative,
        cumulative,
        positive: item.value > 0
      };
    });
  }, [data, startingValue]);

  return (
    <div className={cn('bg-slate-800/30 rounded-xl border border-slate-700/50 p-6', className)}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      )}
      
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="name" 
            stroke="#9CA3AF"
            tick={{ fontSize: 12, fill: '#9CA3AF' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#9CA3AF"
            tick={{ fontSize: 12, fill: '#9CA3AF' }}
            tickFormatter={(value) => formatNumber(value, { currency: true, abbreviate: true })}
          />
          <Tooltip 
            content={<CustomTooltip currencyCode={currencyCode} />}
          />
          {showLegend && <Legend wrapperStyle={{ color: '#fff', paddingTop: '20px' }} />}
          
          <Bar dataKey="value" name="Change">
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.positive ? CHART_COLORS.positive : CHART_COLORS.negative} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Heatmap for multi-metric comparisons
export function ComparisonHeatmap({ 
  data, 
  height = 300,
  gridSize = 'medium',
  title,
  className 
}: ComparisonHeatmapProps) {
  const heatmapData = useMemo(() => 
    formatComparisonDataForChart(data, 'heatmap'), 
    [data]
  );

  const getIntensityColor = (percentageChange: number, isImprovement: boolean) => {
    const intensity = Math.min(Math.abs(percentageChange) / 50, 1); // Cap at 50% for full intensity
    
    if (isImprovement) {
      return `rgba(16, 185, 129, ${0.2 + intensity * 0.6})`; // emerald with varying opacity
    } else {
      return `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`; // red with varying opacity
    }
  };

  const cellSize = gridSize === 'small' ? 60 : gridSize === 'large' ? 120 : 80;
  const cols = Math.ceil(Math.sqrt(heatmapData.length));
  const rows = Math.ceil(heatmapData.length / cols);

  return (
    <div className={cn('bg-slate-800/30 rounded-xl border border-slate-700/50 p-6', className)}>
      {title && (
        <div className="flex items-center gap-2 mb-4">
          <Grid3X3 className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      )}
      
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {heatmapData.map((item, index) => (
          <div
            key={item.name}
            className="relative rounded-lg border border-slate-700/50 p-3 transition-all hover:scale-105 cursor-pointer"
            style={{ 
              backgroundColor: getIntensityColor(item.percentageChange, item.isImprovement),
              minHeight: cellSize
            }}
          >
            <div className="text-center">
              <h4 className="text-xs font-medium text-white mb-1 truncate" title={item.name}>
                {item.name}
              </h4>
              <div className={cn(
                'text-lg font-bold mb-1',
                item.isImprovement ? 'text-emerald-300' : 'text-red-300'
              )}>
                {item.percentageChange > 0 ? '+' : ''}{item.percentageChange.toFixed(1)}%
              </div>
              <div className="flex items-center justify-center">
                {item.isImprovement ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
              </div>
            </div>
            
            {/* Significance indicator */}
            <div className={cn(
              'absolute top-1 right-1 w-2 h-2 rounded-full',
              item.significance === 'high' ? 'bg-amber-400' :
              item.significance === 'medium' ? 'bg-blue-400' : 'bg-slate-400'
            )} />
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            <span>Improvement</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <span>Decline</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span>High Impact</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span>Medium Impact</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Low Impact</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Combined chart component that automatically selects the best visualization
interface SmartComparisonChartProps extends BaseChartProps {
  chartType?: 'auto' | 'bar' | 'line' | 'waterfall' | 'heatmap';
  showVariance?: boolean;
  multiPeriodData?: Array<{
    period: string;
    [key: string]: any;
  }>;
}

export function SmartComparisonChart({
  data,
  chartType = 'auto',
  height = 300,
  showLegend = true,
  showVariance = true,
  multiPeriodData,
  currencyCode = 'GBP',
  title,
  className
}: SmartComparisonChartProps) {
  const optimalChartType = useMemo(() => {
    if (chartType !== 'auto') return chartType;
    
    // Auto-select based on data characteristics
    if (data.length <= 3) return 'bar';
    if (data.length <= 6 && multiPeriodData) return 'line';
    if (data.length <= 12) return 'heatmap';
    return 'bar'; // Fallback
  }, [chartType, data, multiPeriodData]);

  switch (optimalChartType) {
    case 'line':
      return (
        <TrendLineChart
          data={data}
          multiPeriodData={multiPeriodData}
          height={height}
          showLegend={showLegend}
          currencyCode={currencyCode}
          title={title}
          className={className}
        />
      );
    
    case 'waterfall':
      return (
        <WaterfallChart
          data={data}
          height={height}
          showLegend={showLegend}
          currencyCode={currencyCode}
          title={title}
          className={className}
        />
      );
    
    case 'heatmap':
      return (
        <ComparisonHeatmap
          data={data}
          height={height}
          title={title}
          className={className}
        />
      );
    
    case 'bar':
    default:
      return (
        <SideBySideBarChart
          data={data}
          height={height}
          showLegend={showLegend}
          showVariance={showVariance}
          currencyCode={currencyCode}
          title={title}
          className={className}
        />
      );
  }
}