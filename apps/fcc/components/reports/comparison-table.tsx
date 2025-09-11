'use client';

import { useState, useMemo, ReactNode } from 'react';
import { 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Download,
  Eye,
  EyeOff,
  Filter,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/design-tokens';
import { table as tableTypography } from '@/lib/typography';
import { DataTable, Column, BulkAction } from '@/components/ui/data-table';
import { ComparisonMetric, TrendDirection } from '@/lib/comparison-utils';

export interface ComparisonColumn<T> extends Omit<Column<T>, 'accessor'> {
  accessor?: (row: T) => ReactNode;
  comparisonAccessor?: (row: T) => ReactNode;
  varianceAccessor?: (row: T) => ReactNode;
  showComparison?: boolean;
  showVariance?: boolean;
  format?: 'currency' | 'percentage' | 'number';
  currencyCode?: string;
  metricType?: 'revenue' | 'expense' | 'profit' | 'asset' | 'liability' | 'equity' | 'margin';
}

export interface ComparisonTableRow {
  id: string;
  [key: string]: any;
  // Comparison-specific fields
  _comparison?: Record<string, number>;
  _variance?: Record<string, number>;
  _percentageChange?: Record<string, number>;
  _trend?: Record<string, TrendDirection>;
  _isImprovement?: Record<string, boolean>;
  _significance?: Record<string, 'high' | 'medium' | 'low'>;
}

interface ComparisonTableProps {
  data: ComparisonTableRow[];
  columns: ComparisonColumn<ComparisonTableRow>[];
  bulkActions?: BulkAction[];
  onRowClick?: (row: ComparisonTableRow) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  showComparisonColumns?: boolean;
  showVarianceColumns?: boolean;
  enableDrillDown?: boolean;
  exportFileName?: string;
  className?: string;
  defaultCurrencyCode?: string;
}

interface VarianceCellProps {
  value: number;
  percentageChange: number;
  trend: TrendDirection;
  isImprovement: boolean;
  significance: 'high' | 'medium' | 'low';
  format?: 'currency' | 'percentage' | 'number';
  currencyCode?: string;
  compact?: boolean;
}

function VarianceCell({
  value,
  percentageChange,
  trend,
  isImprovement,
  significance,
  format = 'currency',
  currencyCode = 'GBP',
  compact = false
}: VarianceCellProps) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return formatNumber(val, { currency: true, currencyCode });
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'number':
      default:
        return formatNumber(val);
    }
  };

  const getVarianceColor = (improvement: boolean, sig: string) => {
    if (sig === 'low') return 'text-slate-400';
    return improvement ? 'text-emerald-400' : 'text-red-400';
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <TrendIcon className={cn('h-3 w-3', getVarianceColor(isImprovement, significance))} />
        <span className={cn('text-sm font-medium', getVarianceColor(isImprovement, significance))}>
          {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <TrendIcon className={cn('h-4 w-4', getVarianceColor(isImprovement, significance))} />
        <span className={cn('font-semibold', getVarianceColor(isImprovement, significance))}>
          {formatValue(value)}
        </span>
      </div>
      <div className={cn('text-xs', getVarianceColor(isImprovement, significance))}>
        {percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%
      </div>
      {significance !== 'low' && (
        <div className={cn(
          'text-xs px-1 py-0.5 rounded text-center',
          significance === 'high' ? 'bg-amber-600/20 text-amber-400' :
          'bg-blue-600/20 text-blue-400'
        )}>
          {significance}
        </div>
      )}
    </div>
  );
}

export function ComparisonTable({
  data,
  columns,
  bulkActions = [],
  onRowClick,
  isLoading = false,
  emptyMessage = 'No data found',
  showComparisonColumns = true,
  showVarianceColumns = true,
  enableDrillDown = false,
  exportFileName,
  className,
  defaultCurrencyCode = 'GBP'
}: ComparisonTableProps) {
  const [showAllColumns, setShowAllColumns] = useState(true);
  const [sortBy, setSortBy] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [varianceFilter, setVarianceFilter] = useState<'all' | 'improvements' | 'declines'>('all');

  // Generate enhanced columns with comparison and variance data
  const enhancedColumns = useMemo(() => {
    const baseColumns: Column<ComparisonTableRow>[] = [];

    columns.forEach(column => {
      // Add the base column
      baseColumns.push({
        key: column.key,
        header: column.header,
        accessor: column.accessor,
        sortable: column.sortable,
        className: column.className
      });

      // Add comparison column if enabled and available
      if (showComparisonColumns && column.showComparison && showAllColumns) {
        baseColumns.push({
          key: `${column.key}_comparison`,
          header: `${column.header} (Previous)`,
          accessor: (row) => {
            if (column.comparisonAccessor) {
              return column.comparisonAccessor(row);
            }
            
            const comparisonValue = row._comparison?.[column.key as string];
            if (comparisonValue === undefined) return '-';
            
            switch (column.format) {
              case 'currency':
                return formatNumber(comparisonValue, { currency: true, currencyCode: column.currencyCode || defaultCurrencyCode });
              case 'percentage':
                return `${comparisonValue.toFixed(1)}%`;
              case 'number':
              default:
                return formatNumber(comparisonValue);
            }
          },
          sortable: true,
          className: 'text-slate-400'
        });
      }

      // Add variance column if enabled and available
      if (showVarianceColumns && column.showVariance && showAllColumns) {
        baseColumns.push({
          key: `${column.key}_variance`,
          header: `${column.header} (Change)`,
          accessor: (row) => {
            if (column.varianceAccessor) {
              return column.varianceAccessor(row);
            }
            
            const variance = row._variance?.[column.key as string];
            const percentageChange = row._percentageChange?.[column.key as string];
            const trend = row._trend?.[column.key as string];
            const isImprovement = row._isImprovement?.[column.key as string];
            const significance = row._significance?.[column.key as string];
            
            if (variance === undefined || percentageChange === undefined) return '-';
            
            return (
              <VarianceCell
                value={variance}
                percentageChange={percentageChange}
                trend={trend || 'flat'}
                isImprovement={isImprovement || false}
                significance={significance || 'low'}
                format={column.format}
                currencyCode={column.currencyCode || defaultCurrencyCode}
                compact={true}
              />
            );
          },
          sortable: true,
          className: 'min-w-[120px]'
        });
      }
    });

    return baseColumns;
  }, [columns, showComparisonColumns, showVarianceColumns, showAllColumns, defaultCurrencyCode]);

  // Filter data based on variance filter
  const filteredData = useMemo(() => {
    if (varianceFilter === 'all') return data;
    
    return data.filter(row => {
      const improvements = Object.values(row._isImprovement || {});
      
      if (varianceFilter === 'improvements') {
        return improvements.some(improvement => improvement === true);
      } else if (varianceFilter === 'declines') {
        return improvements.some(improvement => improvement === false);
      }
      
      return true;
    });
  }, [data, varianceFilter]);

  // Enhanced bulk actions with export functionality
  const enhancedBulkActions = useMemo(() => {
    const actions = [...bulkActions];
    
    if (exportFileName) {
      actions.push({
        label: 'Export Selected',
        icon: <Download className="h-4 w-4" />,
        action: (selectedIds) => {
          const selectedRows = filteredData.filter(row => selectedIds.includes(row.id));
          exportToCSV(selectedRows, columns, exportFileName);
        }
      });
    }
    
    return actions;
  }, [bulkActions, exportFileName, filteredData, columns]);

  const exportToCSV = (rows: ComparisonTableRow[], cols: ComparisonColumn<ComparisonTableRow>[], fileName: string) => {
    const headers = [];
    const csvRows = [];
    
    // Generate headers
    cols.forEach(col => {
      headers.push(col.header);
      if (showComparisonColumns && col.showComparison) {
        headers.push(`${col.header} (Previous)`);
      }
      if (showVarianceColumns && col.showVariance) {
        headers.push(`${col.header} (Change)`);
        headers.push(`${col.header} (% Change)`);
      }
    });
    
    csvRows.push(headers.join(','));
    
    // Generate data rows
    rows.forEach(row => {
      const csvRow = [];
      
      cols.forEach(col => {
        // Current value
        let value = '';
        if (col.accessor) {
          // For complex accessors, try to extract the raw value
          const rawValue = (row as any)[col.key];
          value = rawValue?.toString() || '';
        } else {
          value = ((row as any)[col.key] || '').toString();
        }
        csvRow.push(`"${value}"`);
        
        // Comparison value
        if (showComparisonColumns && col.showComparison) {
          const comparisonValue = row._comparison?.[col.key as string] || '';
          csvRow.push(`"${comparisonValue}"`);
        }
        
        // Variance values
        if (showVarianceColumns && col.showVariance) {
          const variance = row._variance?.[col.key as string] || '';
          const percentageChange = row._percentageChange?.[col.key as string] || '';
          csvRow.push(`"${variance}"`);
          csvRow.push(`"${percentageChange}%"`);
        }
      });
      
      csvRows.push(csvRow.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Table Controls */}
      <div className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3">
        <div className="flex items-center gap-3">
          {/* Column Visibility Toggle */}
          <button
            onClick={() => setShowAllColumns(!showAllColumns)}
            className="flex items-center gap-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
          >
            {showAllColumns ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showAllColumns ? 'Compact View' : 'Full View'}
          </button>
          
          {/* Variance Filter */}
          <select
            value={varianceFilter}
            onChange={(e) => setVarianceFilter(e.target.value as any)}
            className="px-3 py-1 bg-slate-700 text-white rounded-lg text-sm border border-slate-600"
          >
            <option value="all">All Changes</option>
            <option value="improvements">Improvements Only</option>
            <option value="declines">Declines Only</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          {exportFileName && (
            <button
              onClick={() => exportToCSV(filteredData, columns, exportFileName)}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              <Download className="h-4 w-4" />
              Export All
            </button>
          )}
        </div>
      </div>

      {/* Enhanced DataTable */}
      <DataTable
        data={filteredData}
        columns={enhancedColumns}
        bulkActions={enhancedBulkActions}
        onRowClick={enableDrillDown ? onRowClick : undefined}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        rowKey="id"
        className="comparison-table"
      />
      
      {/* Summary Statistics */}
      {filteredData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-white">Improvements</span>
            </div>
            <div className="text-lg font-bold text-emerald-400">
              {filteredData.filter(row => 
                Object.values(row._isImprovement || {}).some(val => val === true)
              ).length}
            </div>
          </div>
          
          <div className="bg-red-600/10 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-white">Declines</span>
            </div>
            <div className="text-lg font-bold text-red-400">
              {filteredData.filter(row => 
                Object.values(row._isImprovement || {}).some(val => val === false)
              ).length}
            </div>
          </div>
          
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-white">Total Shown</span>
            </div>
            <div className="text-lg font-bold text-white">
              {filteredData.length} / {data.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to transform data into comparison table format
export function transformToComparisonData(
  baseData: any[],
  comparisonData: any[],
  keyField: string,
  valueFields: Array<{
    field: string;
    type: 'revenue' | 'expense' | 'profit' | 'asset' | 'liability' | 'equity' | 'margin';
  }>
): ComparisonTableRow[] {
  return baseData.map(baseRow => {
    const comparisonRow = comparisonData.find(row => row[keyField] === baseRow[keyField]);
    
    const transformedRow: ComparisonTableRow = {
      ...baseRow,
      _comparison: {},
      _variance: {},
      _percentageChange: {},
      _trend: {},
      _isImprovement: {},
      _significance: {}
    };
    
    valueFields.forEach(({ field, type }) => {
      const currentValue = baseRow[field] || 0;
      const comparisonValue = comparisonRow?.[field] || 0;
      
      const variance = currentValue - comparisonValue;
      const percentageChange = comparisonValue !== 0 ? (variance / Math.abs(comparisonValue)) * 100 : 0;
      
      // Determine trend
      let trend: TrendDirection = 'flat';
      if (Math.abs(percentageChange) > 1) {
        trend = variance > 0 ? 'up' : 'down';
      }
      
      // Determine if it's an improvement
      let isImprovement = false;
      switch (type) {
        case 'revenue':
        case 'profit':
        case 'asset':
        case 'equity':
        case 'margin':
          isImprovement = variance > 0;
          break;
        case 'expense':
        case 'liability':
          isImprovement = variance < 0;
          break;
      }
      
      // Determine significance
      const absChange = Math.abs(percentageChange);
      const significance = absChange >= 20 ? 'high' : absChange >= 5 ? 'medium' : 'low';
      
      transformedRow._comparison![field] = comparisonValue;
      transformedRow._variance![field] = variance;
      transformedRow._percentageChange![field] = percentageChange;
      transformedRow._trend![field] = trend;
      transformedRow._isImprovement![field] = isImprovement;
      transformedRow._significance![field] = significance as any;
    });
    
    return transformedRow;
  });
}