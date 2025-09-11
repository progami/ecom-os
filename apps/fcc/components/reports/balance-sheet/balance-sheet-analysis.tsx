'use client';

import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { formatNumber } from '@/lib/design-tokens';
import type { BalanceSheetData } from '@/lib/schemas/report-schemas';

interface BalanceSheetAnalysisProps {
  data: BalanceSheetData;
}

const COLORS = {
  currentAssets: '#3B82F6',      // blue-500
  nonCurrentAssets: '#1E40AF',   // blue-800
  currentLiabilities: '#EF4444', // red-500
  nonCurrentLiabilities: '#991B1B', // red-800
  equity: '#10B981',             // emerald-500
};

export function BalanceSheetAnalysis({ data }: BalanceSheetAnalysisProps) {
  // Prepare data for pie chart
  const compositionData = [
    {
      name: 'Current Assets',
      value: data.currentAssets || 0,
      color: COLORS.currentAssets,
      percentage: ((data.currentAssets || 0) / (data.totalAssets + Math.abs(data.totalLiabilities))) * 100
    },
    {
      name: 'Non-Current Assets',
      value: data.nonCurrentAssets || 0,
      color: COLORS.nonCurrentAssets,
      percentage: ((data.nonCurrentAssets || 0) / (data.totalAssets + Math.abs(data.totalLiabilities))) * 100
    },
    {
      name: 'Current Liabilities',
      value: Math.abs(data.currentLiabilities || 0),
      color: COLORS.currentLiabilities,
      percentage: (Math.abs(data.currentLiabilities || 0) / (data.totalAssets + Math.abs(data.totalLiabilities))) * 100
    },
    {
      name: 'Non-Current Liabilities',
      value: Math.abs(data.nonCurrentLiabilities || 0),
      color: COLORS.nonCurrentLiabilities,
      percentage: (Math.abs(data.nonCurrentLiabilities || 0) / (data.totalAssets + Math.abs(data.totalLiabilities))) * 100
    }
  ].filter(item => item.value > 0);

  // Prepare data for waterfall chart
  const waterfallData = [
    { name: 'Current Assets', value: data.currentAssets || 0, type: 'positive' },
    { name: 'Non-Current Assets', value: data.nonCurrentAssets || 0, type: 'positive' },
    { name: 'Current Liabilities', value: -(Math.abs(data.currentLiabilities || 0)), type: 'negative' },
    { name: 'Non-Current Liabilities', value: -(Math.abs(data.nonCurrentLiabilities || 0)), type: 'negative' },
    { name: 'Net Assets', value: data.netAssets, type: 'total' }
  ];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-medium text-white mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value, { currency: true, currencyCode: 'GBP' })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom label for pie chart
  const renderCustomizedLabel = (entry: any) => {
    return `${entry.percentage.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balance Sheet Composition */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Balance Sheet Composition</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={compositionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {compositionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Asset vs Liability Comparison */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Assets vs Liabilities</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { category: 'Current', assets: data.currentAssets || 0, liabilities: Math.abs(data.currentLiabilities || 0) },
                { category: 'Non-Current', assets: data.nonCurrentAssets || 0, liabilities: Math.abs(data.nonCurrentLiabilities || 0) },
                { category: 'Total', assets: data.totalAssets, liabilities: Math.abs(data.totalLiabilities) }
              ]}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="category" stroke="#94A3B8" />
              <YAxis stroke="#94A3B8" tickFormatter={(value) => formatNumber(value, { abbreviate: true })} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>} />
              <Bar dataKey="assets" fill="#3B82F6" name="Assets" radius={[4, 4, 0, 0]} />
              <Bar dataKey="liabilities" fill="#EF4444" name="Liabilities" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Financial Ratios Analysis */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Key Financial Ratios</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Current Ratio */}
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center w-24 h-24 mb-2">
              <svg className="transform -rotate-90 w-24 h-24">
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="#334155"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="#3B82F6"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${Math.min((data.currentRatio || 0) / 3 * 226, 226)} 226`}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute text-xl font-semibold text-white">
                {(data.currentRatio || 0).toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-slate-400">Current Ratio</p>
            <p className="text-xs text-slate-500 mt-1">Target: ≥2.0</p>
          </div>

          {/* Quick Ratio */}
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center w-24 h-24 mb-2">
              <svg className="transform -rotate-90 w-24 h-24">
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="#334155"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="#10B981"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${Math.min((data.summary?.quickRatio || 0) / 2 * 226, 226)} 226`}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute text-xl font-semibold text-white">
                {(data.summary?.quickRatio || 0).toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-slate-400">Quick Ratio</p>
            <p className="text-xs text-slate-500 mt-1">Target: ≥1.0</p>
          </div>

          {/* Debt-to-Equity */}
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center w-24 h-24 mb-2">
              <svg className="transform -rotate-90 w-24 h-24">
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="#334155"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="#EF4444"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${Math.min((data.summary?.debtToEquityRatio || 0) / 2 * 226, 226)} 226`}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute text-xl font-semibold text-white">
                {(data.summary?.debtToEquityRatio || 0).toFixed(1)}
              </span>
            </div>
            <p className="text-sm text-slate-400">Debt-to-Equity</p>
            <p className="text-xs text-slate-500 mt-1">Target: ≤1.0</p>
          </div>

          {/* Equity Ratio */}
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center w-24 h-24 mb-2">
              <svg className="transform -rotate-90 w-24 h-24">
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="#334155"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="36"
                  stroke="#10B981"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${Math.min((data.equityRatio || 0) / 100 * 226, 226)} 226`}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute text-xl font-semibold text-white">
                {(data.equityRatio || 0).toFixed(0)}%
              </span>
            </div>
            <p className="text-sm text-slate-400">Equity Ratio</p>
            <p className="text-xs text-slate-500 mt-1">Target: ≥30%</p>
          </div>
        </div>
      </div>

      {/* Trends Analysis (if available) */}
      {data.trends && data.trends.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Historical Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="date" 
                stroke="#94A3B8"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                stroke="#94A3B8"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatNumber(value, { currency: true, abbreviate: true })}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>} />
              <Area 
                type="monotone" 
                dataKey="totalAssets" 
                stackId="1"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.6}
                name="Total Assets"
              />
              <Area 
                type="monotone" 
                dataKey="totalLiabilities" 
                stackId="2"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.6}
                name="Total Liabilities"
              />
              <Area 
                type="monotone" 
                dataKey="totalEquity" 
                stackId="3"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.6}
                name="Total Equity"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}