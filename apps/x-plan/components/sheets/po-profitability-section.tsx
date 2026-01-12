'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { SheetViewToggle, type SheetViewMode } from '@/components/sheet-view-toggle';
import {
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SELECT,
} from '@/components/sheet-toolbar';
import { usePersistentState } from '@/hooks/usePersistentState';

export type POStatus = 'DRAFT' | 'ISSUED' | 'MANUFACTURING' | 'OCEAN' | 'WAREHOUSE' | 'SHIPPED';

export type PoPnlMode = 'PROJECTED' | 'REAL';

export type PoPnlValueDisplay = 'ABSOLUTE' | 'PER_UNIT';

export interface PoPnlSummary {
  units: number;
  revenue: number;
  cogs: number;
  amazonFees: number;
  ppcSpend: number;
  fixedCosts: number;
  grossProfit: number;
  netProfit: number;
}

export interface POProfitabilityDataset {
  data: POProfitabilityData[];
  totals: PoPnlSummary;
  unattributed: PoPnlSummary;
}

export interface POProfitabilityData {
  id: string;
  orderCode: string;
  batchCode: string | null;
  productId: string;
  productName: string;
  status: POStatus;
  units: number;
  revenue: number;
  manufacturingCost: number;
  freightCost: number;
  tariffCost: number;
  cogs: number;
  cogsAdjustment: number;
  referralFees: number;
  fbaFees: number;
  storageFees: number;
  amazonFees: number;
  amazonFeesAdjustment: number;
  ppcSpend: number;
  fixedCosts: number;
  grossProfit: number;
  grossMarginPercent: number;
  netProfit: number;
  netMarginPercent: number;
  roi: number;
  productionStart: Date | null;
  availableDate: Date | null;
  totalLeadDays: number | null;
}

interface POProfitabilitySectionProps {
  datasets: { projected: POProfitabilityDataset; real: POProfitabilityDataset };
  productOptions?: Array<{ id: string; name: string }>;
  sheetSlug?: string;
  viewMode?: SheetViewMode;
  title?: string;
  description?: string;
  showChart?: boolean;
  showTable?: boolean;
}

type StatusFilter = 'ALL' | POStatus;
type SortField = 'orderCode' | 'revenue' | 'netProfit' | 'netMarginPercent' | 'roi';
type SortDirection = 'asc' | 'desc';
type MetricKey = 'grossMarginPercent' | 'netMarginPercent' | 'roi';
type ColumnGroup = 'cogs' | 'amzFees' | 'opex';

const metricConfig: Record<MetricKey, { label: string; color: string; gradientId: string }> = {
  grossMarginPercent: {
    label: 'Gross Margin %',
    color: 'hsl(var(--chart-1))',
    gradientId: 'gradientGrossMargin',
  },
  netMarginPercent: {
    label: 'Net Margin %',
    color: 'hsl(var(--chart-2))',
    gradientId: 'gradientNetMargin',
  },
  roi: { label: 'ROI %', color: 'hsl(var(--chart-3))', gradientId: 'gradientROI' },
};

const statusLabels: Record<POStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  MANUFACTURING: 'Manufacturing',
  OCEAN: 'Ocean',
  WAREHOUSE: 'Warehouse',
  SHIPPED: 'Shipped',
};

const modeLabels: Record<PoPnlMode, string> = {
  PROJECTED: 'Projected',
  REAL: 'Real',
};

const modeOptions: PoPnlMode[] = ['PROJECTED', 'REAL'];

const statusFilters: StatusFilter[] = [
  'ALL',
  'DRAFT',
  'ISSUED',
  'MANUFACTURING',
  'OCEAN',
  'WAREHOUSE',
  'SHIPPED',
];

type POProfitabilityFiltersContextValue = {
  mode: PoPnlMode;
  setMode: (value: PoPnlMode) => void;
  valueDisplay: PoPnlValueDisplay;
  setValueDisplay: (value: PoPnlValueDisplay) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  focusSkuId: string;
  setFocusSkuId: (value: string) => void;
};

const POProfitabilityFiltersContext = createContext<POProfitabilityFiltersContextValue | null>(
  null,
);

export function POProfitabilityFiltersProvider({
  children,
  strategyId,
}: {
  children: ReactNode;
  strategyId: string;
}) {
  const [mode, setMode] = usePersistentState<PoPnlMode>(
    `xplan:po-pnl:${strategyId}:mode`,
    'PROJECTED',
  );
  const [valueDisplay, setValueDisplay] = usePersistentState<PoPnlValueDisplay>(
    `xplan:po-pnl:${strategyId}:value-display`,
    'ABSOLUTE',
  );
  const [statusFilter, setStatusFilter] = usePersistentState<StatusFilter>(
    `xplan:po-profitability:${strategyId}:status-filter`,
    'ALL',
  );
  const [focusSkuId, setFocusSkuId] = usePersistentState<string>(
    `xplan:po-profitability:${strategyId}:focus-sku`,
    'ALL',
  );

  const value = useMemo(
    () => ({
      mode,
      setMode,
      valueDisplay,
      setValueDisplay,
      statusFilter,
      setStatusFilter,
      focusSkuId,
      setFocusSkuId,
    }),
    [
      focusSkuId,
      mode,
      setFocusSkuId,
      setMode,
      setStatusFilter,
      setValueDisplay,
      statusFilter,
      valueDisplay,
    ],
  );

  return (
    <POProfitabilityFiltersContext.Provider value={value}>
      {children}
    </POProfitabilityFiltersContext.Provider>
  );
}

export function POProfitabilityHeaderControls({
  productOptions,
}: {
  productOptions: Array<{ id: string; name: string }>;
}) {
  const context = useContext(POProfitabilityFiltersContext);
  const focusSkuId = context?.focusSkuId ?? 'ALL';

  useEffect(() => {
    if (!context) return;
    if (focusSkuId === 'ALL') return;
    if (!productOptions.some((option) => option.id === focusSkuId)) {
      context.setFocusSkuId('ALL');
    }
  }, [context, focusSkuId, productOptions]);

  if (!context) return null;

  const { mode, setMode, statusFilter, setStatusFilter, setFocusSkuId } = context;

  return (
    <>
      <div className={SHEET_TOOLBAR_GROUP}>
        <span className={SHEET_TOOLBAR_LABEL}>Mode</span>
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as PoPnlMode)}
          className={SHEET_TOOLBAR_SELECT}
          aria-label="Switch PO P&L mode"
        >
          {modeOptions.map((value) => (
            <option key={value} value={value}>
              {modeLabels[value]}
            </option>
          ))}
        </select>
      </div>

      <div className={SHEET_TOOLBAR_GROUP}>
        <span className={SHEET_TOOLBAR_LABEL}>Status</span>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className={SHEET_TOOLBAR_SELECT}
          aria-label="Filter by purchase order status"
        >
          {statusFilters.map((status) => (
            <option key={status} value={status}>
              {status === 'ALL' ? 'All' : statusLabels[status]}
            </option>
          ))}
        </select>
      </div>

      {productOptions.length > 0 ? (
        <div className={SHEET_TOOLBAR_GROUP}>
          <span className={SHEET_TOOLBAR_LABEL}>SKU</span>
          <select
            value={focusSkuId}
            onChange={(event) => setFocusSkuId(event.target.value)}
            className={`${SHEET_TOOLBAR_SELECT} max-w-[7rem]`}
            aria-label="Focus on a single SKU"
          >
            <option value="ALL">All</option>
            {productOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}

export function POProfitabilitySection({
  datasets,
  productOptions = [],
  sheetSlug,
  viewMode,
  title = 'PO P&L',
  description = 'FIFO-based PO-level P&L (Projected vs Real)',
  showChart = true,
  showTable = true,
}: POProfitabilitySectionProps) {
  const filters = useContext(POProfitabilityFiltersContext);
  const mode = filters?.mode ?? 'PROJECTED';
  const statusFilter = filters?.statusFilter ?? 'ALL';
  const skuFilter = filters?.focusSkuId ?? 'ALL';
  const valueDisplay = filters?.valueDisplay ?? 'ABSOLUTE';
  const dataset = mode === 'REAL' ? datasets.real : datasets.projected;
  const data = dataset.data;
  const [enabledMetrics, setEnabledMetrics] = useState<MetricKey[]>([
    'grossMarginPercent',
    'netMarginPercent',
    'roi',
  ]);
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedGroups, setExpandedGroups] = useState<Set<ColumnGroup>>(new Set());

  const toggleGroup = (group: ColumnGroup) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const isGroupExpanded = (group: ColumnGroup) => expandedGroups.has(group);

  // When "All SKUs" selected, aggregate to per-PO view
  // When specific SKU selected, show per-batch view filtered to that SKU
  const filteredData = useMemo(() => {
    let result = data;

    // Apply status filter first
    if (statusFilter !== 'ALL') {
      result = result.filter((row) => row.status === statusFilter);
    }

    // If specific SKU selected, filter to that SKU (per-batch view)
    if (skuFilter !== 'ALL') {
      result = result.filter((row) => row.productId === skuFilter);
      return [...result].sort((a, b) => {
        const dateA = a.availableDate ? new Date(a.availableDate).getTime() : 0;
        const dateB = b.availableDate ? new Date(b.availableDate).getTime() : 0;
        return dateA - dateB;
      });
    }

    // Aggregate to per-PO view when "All SKUs" selected
    const poMap = new Map<string, POProfitabilityData>();
    result.forEach((row) => {
      const existing = poMap.get(row.orderCode);
      if (existing) {
        // Aggregate values
        existing.units += row.units;
        existing.revenue += row.revenue;
        existing.manufacturingCost += row.manufacturingCost;
        existing.freightCost += row.freightCost;
        existing.tariffCost += row.tariffCost;
        existing.cogs += row.cogs;
        existing.referralFees += row.referralFees;
        existing.fbaFees += row.fbaFees;
        existing.storageFees += row.storageFees;
        existing.amazonFees += row.amazonFees;
        existing.ppcSpend += row.ppcSpend;
        existing.fixedCosts += row.fixedCosts;

        existing.cogsAdjustment =
          existing.cogs - existing.manufacturingCost - existing.freightCost - existing.tariffCost;
        existing.amazonFeesAdjustment =
          existing.amazonFees - existing.referralFees - existing.fbaFees - existing.storageFees;
        existing.grossProfit = existing.revenue - existing.cogs - existing.amazonFees;
        existing.netProfit = existing.grossProfit - existing.ppcSpend - existing.fixedCosts;

        existing.grossMarginPercent =
          existing.revenue > 0 ? (existing.grossProfit / existing.revenue) * 100 : 0;
        existing.netMarginPercent =
          existing.revenue > 0 ? (existing.netProfit / existing.revenue) * 100 : 0;
        existing.roi = existing.cogs > 0 ? (existing.netProfit / existing.cogs) * 100 : 0;
        // Combine product names
        if (!existing.productName.includes(row.productName)) {
          existing.productName = existing.productName + ', ' + row.productName;
        }
      } else {
        poMap.set(row.orderCode, { ...row });
      }
    });

    return Array.from(poMap.values()).sort((a, b) => {
      const dateA = a.availableDate ? new Date(a.availableDate).getTime() : 0;
      const dateB = b.availableDate ? new Date(b.availableDate).getTime() : 0;
      return dateA - dateB;
    });
  }, [data, statusFilter, skuFilter]);

  const tableSortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = typeof aVal === 'number' ? aVal : 0;
      const bNum = typeof bVal === 'number' ? bVal : 0;
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [filteredData, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Transform data for Recharts
  // filteredData is already aggregated by PO when "All SKUs" selected
  const chartData = useMemo(() => {
    return filteredData.map((row) => ({
      name:
        skuFilter !== 'ALL'
          ? `${row.orderCode}${row.batchCode ? ` (${row.batchCode})` : ''}`
          : row.orderCode,
      grossMarginPercent: row.grossMarginPercent,
      netMarginPercent: row.netMarginPercent,
      roi: row.roi,
    }));
  }, [filteredData, skuFilter]);

  const toggleMetric = (key: MetricKey) => {
    setEnabledMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: valueDisplay === 'PER_UNIT' ? 2 : 0,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatMoney = (value: number, units: number) => {
    if (valueDisplay === 'PER_UNIT') {
      if (!units) return formatCurrency(0);
      return formatCurrency(value / units);
    }
    return formatCurrency(value);
  };
  const showUnattributed =
    Math.abs(dataset.unattributed.revenue) > 0.01 ||
    Math.abs(dataset.unattributed.cogs) > 0.01 ||
    Math.abs(dataset.unattributed.netProfit) > 0.01 ||
    Math.abs(dataset.unattributed.fixedCosts) > 0.01;

  // Summary stats
  const summary = useMemo(() => {
    if (filteredData.length === 0)
      return {
        totalUnits: 0,
        totalRevenue: 0,
        totalGrossProfit: 0,
        totalProfit: 0,
        totalCogs: 0,
        netMargin: 0,
        roi: 0,
      };
    const totalUnits = filteredData.reduce((sum, row) => sum + row.units, 0);
    const totalRevenue = filteredData.reduce((sum, row) => sum + row.revenue, 0);
    const totalGrossProfit = filteredData.reduce((sum, row) => sum + row.grossProfit, 0);
    const totalProfit = filteredData.reduce((sum, row) => sum + row.netProfit, 0);
    const totalCogs = filteredData.reduce((sum, row) => sum + row.cogs, 0);
    const netMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const roi = totalCogs > 0 ? (totalProfit / totalCogs) * 100 : 0;
    return { totalUnits, totalRevenue, totalGrossProfit, totalProfit, totalCogs, netMargin, roi };
  }, [filteredData]);

  if (data.length === 0) {
    return (
      <Card className="rounded-xl shadow-sm dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No purchase orders available for analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Only show internal toolbar if productOptions provided or view toggle needed
  const showInternalToolbar = productOptions.length > 0 || (sheetSlug && viewMode);

  return (
    <div className="space-y-4">
      {showInternalToolbar ? (
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-end gap-3">
            <POProfitabilityHeaderControls productOptions={productOptions} />
          </div>
          {sheetSlug && viewMode ? <SheetViewToggle value={viewMode} slug={sheetSlug} /> : null}
        </div>
      ) : null}

      {showChart ? (
        <Card className="rounded-xl shadow-sm dark:border-white/10 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Margin trends</CardTitle>
            <CardDescription>Performance across purchase orders by arrival date</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  {/* Gradient definitions */}
                  <defs>
                    <linearGradient id="gradientGrossMargin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradientNetMargin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gradientROI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.05} />
                    </linearGradient>
                    {/* Glow filters for dark mode */}
                    <filter id="glow1" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-700/50"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    className="text-slate-500 dark:text-slate-400"
                    interval="preserveStartEnd"
                    dy={10}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    className="text-slate-500 dark:text-slate-400"
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    width={50}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      return (
                        <div className="rounded-xl border border-slate-200/50 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/95">
                          <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {label}
                          </p>
                          <div className="space-y-1.5">
                            {payload.map((entry) => (
                              <div
                                key={entry.dataKey}
                                className="flex items-center justify-between gap-6"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                  />
                                  <span className="text-xs text-slate-600 dark:text-slate-400">
                                    {metricConfig[entry.dataKey as MetricKey]?.label}
                                  </span>
                                </div>
                                <span
                                  className="text-xs font-semibold tabular-nums"
                                  style={{ color: entry.color }}
                                >
                                  {formatPercent(entry.value as number)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                    cursor={{
                      stroke: 'currentColor',
                      strokeWidth: 1,
                      strokeDasharray: '4 4',
                      className: 'text-slate-300 dark:text-slate-600',
                    }}
                  />
                  {enabledMetrics.includes('grossMarginPercent') && (
                    <Area
                      type="monotone"
                      dataKey="grossMarginPercent"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2.5}
                      fill="url(#gradientGrossMargin)"
                      dot={false}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: 'hsl(var(--chart-1))',
                        fill: 'white',
                        className: 'dark:fill-slate-900',
                      }}
                    />
                  )}
                  {enabledMetrics.includes('netMarginPercent') && (
                    <Area
                      type="monotone"
                      dataKey="netMarginPercent"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2.5}
                      fill="url(#gradientNetMargin)"
                      dot={false}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: 'hsl(var(--chart-2))',
                        fill: 'white',
                        className: 'dark:fill-slate-900',
                      }}
                    />
                  )}
                  {enabledMetrics.includes('roi') && (
                    <Area
                      type="monotone"
                      dataKey="roi"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2.5}
                      fill="url(#gradientROI)"
                      dot={false}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        stroke: 'hsl(var(--chart-3))',
                        fill: 'white',
                        className: 'dark:fill-slate-900',
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t border-slate-200/60 pt-4 dark:border-slate-700/50">
              {(Object.keys(metricConfig) as MetricKey[]).map((key) => {
                const isEnabled = enabledMetrics.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleMetric(key)}
                    className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-200 ${
                      isEnabled
                        ? 'bg-slate-100/80 dark:bg-slate-800/50'
                        : 'opacity-50 hover:opacity-75'
                    }`}
                  >
                    <div className="relative">
                      <div
                        className={`h-3 w-3 rounded-full transition-transform duration-200 ${
                          isEnabled ? 'scale-100' : 'scale-75'
                        }`}
                        style={{ backgroundColor: metricConfig[key].color }}
                      />
                      {isEnabled && (
                        <div
                          className="absolute inset-0 animate-pulse rounded-full opacity-40 blur-sm"
                          style={{ backgroundColor: metricConfig[key].color }}
                        />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium transition-colors duration-200 ${
                        isEnabled
                          ? 'text-slate-700 dark:text-slate-200'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {metricConfig[key].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showTable ? (
        <Card className="rounded-xl shadow-sm dark:border-white/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">P&L breakdown</CardTitle>
                <CardDescription>
                  {skuFilter !== 'ALL' ? 'Filtered by SKU' : 'Aggregated by purchase order'}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="inline-flex items-center rounded-lg border border-border/60 bg-background/40 p-0.5 shadow-sm">
                  <Button
                    type="button"
                    size="sm"
                    variant={valueDisplay === 'ABSOLUTE' ? 'secondary' : 'ghost'}
                    className="h-7 px-2 text-xs"
                    onClick={() => filters?.setValueDisplay('ABSOLUTE')}
                  >
                    Absolute
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={valueDisplay === 'PER_UNIT' ? 'secondary' : 'ghost'}
                    className="h-7 px-2 text-xs"
                    onClick={() => filters?.setValueDisplay('PER_UNIT')}
                  >
                    Per unit
                  </Button>
                </div>

                <div className="text-right text-xs text-muted-foreground">
                  <div>
                    Units:{' '}
                    <span className="font-semibold text-foreground">
                      {summary.totalUnits.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    {valueDisplay === 'PER_UNIT' ? 'Avg Sell:' : 'Total Revenue:'}{' '}
                    <span className="font-semibold text-foreground">
                      {formatMoney(summary.totalRevenue, summary.totalUnits)}
                    </span>
                  </div>
                  <div>
                    {valueDisplay === 'PER_UNIT' ? 'GP/unit:' : 'Total Gross Profit:'}{' '}
                    <span
                      className={`font-semibold ${summary.totalGrossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-200' : 'text-red-600 dark:text-red-200'}`}
                    >
                      {formatMoney(summary.totalGrossProfit, summary.totalUnits)}
                    </span>
                  </div>
                  <div>
                    {valueDisplay === 'PER_UNIT' ? 'NP/unit:' : 'Total Profit:'}{' '}
                    <span
                      className={`font-semibold ${summary.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-200' : 'text-red-600 dark:text-red-200'}`}
                    >
                      {formatMoney(summary.totalProfit, summary.totalUnits)}
                    </span>
                  </div>
                  {showUnattributed ? (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Unattributed totals:{' '}
                      <span className="font-medium text-foreground/80">
                        {formatCurrency(dataset.unattributed.revenue)}
                      </span>{' '}
                      rev ·{' '}
                      <span
                        className={`font-medium ${dataset.unattributed.netProfit >= 0 ? 'text-emerald-600/80 dark:text-emerald-200/80' : 'text-red-600/80 dark:text-red-200/80'}`}
                      >
                        {formatCurrency(dataset.unattributed.netProfit)}
                      </span>{' '}
                      profit
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead
                      rowSpan={2}
                      className="h-8 px-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80"
                    >
                      <SortButton
                        field="orderCode"
                        current={sortField}
                        direction={sortDirection}
                        onClick={handleSort}
                      >
                        PO Code
                      </SortButton>
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="h-8 px-2 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80"
                    >
                      Status
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80"
                    >
                      Units
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80"
                    >
                      <SortButton
                        field="revenue"
                        current={sortField}
                        direction={sortDirection}
                        onClick={handleSort}
                        align="right"
                      >
                        {valueDisplay === 'PER_UNIT' ? 'Sell $' : 'Revenue'}
                      </SortButton>
                    </TableHead>
                    <TableHead
                      colSpan={isGroupExpanded('cogs') ? 5 : 1}
                      className="h-8 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleGroup('cogs')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {isGroupExpanded('cogs') ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        COGS
                      </span>
                    </TableHead>
                    <TableHead
                      colSpan={isGroupExpanded('amzFees') ? 5 : 1}
                      className="h-8 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleGroup('amzFees')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {isGroupExpanded('amzFees') ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        Amz Fees
                      </span>
                    </TableHead>
                    <TableHead
                      colSpan={isGroupExpanded('opex') ? 2 : 1}
                      className="h-8 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleGroup('opex')}
                    >
                      <span className="inline-flex items-center gap-1">
                        {isGroupExpanded('opex') ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        Opex
                      </span>
                    </TableHead>
                    <TableHead
                      colSpan={4}
                      className="h-8 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80"
                    >
                      Profit
                    </TableHead>
                  </TableRow>

                  <TableRow className="hover:bg-transparent">
                    {/* COGS sub-columns */}
                    {isGroupExpanded('cogs') ? (
                      <>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Mfg
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Freight
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Tariff
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Adj
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Total
                        </TableHead>
                      </>
                    ) : (
                      <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                        Total
                      </TableHead>
                    )}

                    {/* AMZ FEES sub-columns */}
                    {isGroupExpanded('amzFees') ? (
                      <>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Ref
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          FBA
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Storage
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Adj
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Total
                        </TableHead>
                      </>
                    ) : (
                      <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                        Total
                      </TableHead>
                    )}

                    {/* OPEX sub-columns */}
                    {isGroupExpanded('opex') ? (
                      <>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          PPC
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                          Fixed
                        </TableHead>
                      </>
                    ) : (
                      <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                        Total
                      </TableHead>
                    )}

                    {/* PROFIT sub-columns - always expanded */}
                    <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                      GP
                    </TableHead>
                    <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                      <SortButton
                        field="netProfit"
                        current={sortField}
                        direction={sortDirection}
                        onClick={handleSort}
                        align="right"
                      >
                        Net
                      </SortButton>
                    </TableHead>
                    <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                      <SortButton
                        field="netMarginPercent"
                        current={sortField}
                        direction={sortDirection}
                        onClick={handleSort}
                        align="right"
                      >
                        Margin
                      </SortButton>
                    </TableHead>
                    <TableHead className="h-8 px-2 text-right text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/80">
                      <SortButton
                        field="roi"
                        current={sortField}
                        direction={sortDirection}
                        onClick={handleSort}
                        align="right"
                      >
                        ROI
                      </SortButton>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableSortedData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="px-2 py-1.5">
                        <div className="text-[11px] font-medium">{row.orderCode}</div>
                        {skuFilter !== 'ALL' && row.batchCode ? (
                          <div className="text-[10px] text-muted-foreground">
                            Batch: {row.batchCode}
                          </div>
                        ) : null}
                        <div
                          className="truncate text-[10px] text-muted-foreground max-w-[140px]"
                          title={row.productName}
                        >
                          {row.productName}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums">
                        {row.units.toLocaleString()}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums">
                        {formatMoney(row.revenue, row.units)}
                      </TableCell>

                      {/* COGS columns */}
                      {isGroupExpanded('cogs') ? (
                        <>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.manufacturingCost, row.units)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.freightCost, row.units)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.tariffCost, row.units)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.cogsAdjustment, row.units)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.cogs, row.units)}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(row.cogs, row.units)}
                        </TableCell>
                      )}

                      {/* AMZ FEES columns */}
                      {isGroupExpanded('amzFees') ? (
                        <>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.referralFees, row.units)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.fbaFees, row.units)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.storageFees, row.units)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.amazonFeesAdjustment, row.units)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.amazonFees, row.units)}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(row.amazonFees, row.units)}
                        </TableCell>
                      )}

                      {/* OPEX columns */}
                      {isGroupExpanded('opex') ? (
                        <>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.ppcSpend, row.units)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                            {formatMoney(row.fixedCosts, row.units)}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(row.ppcSpend + row.fixedCosts, row.units)}
                        </TableCell>
                      )}

                      {/* PROFIT columns - always expanded */}
                      <TableCell
                        className={`px-2 py-1.5 text-right text-[11px] tabular-nums font-medium ${row.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-200' : 'text-red-600 dark:text-red-200'}`}
                      >
                        {formatMoney(row.grossProfit, row.units)}
                      </TableCell>
                      <TableCell
                        className={`px-2 py-1.5 text-right text-[11px] tabular-nums font-medium ${row.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-200' : 'text-red-600 dark:text-red-200'}`}
                      >
                        {formatMoney(row.netProfit, row.units)}
                      </TableCell>
                      <TableCell
                        className={`px-2 py-1.5 text-right text-[11px] tabular-nums ${row.netMarginPercent < 0 ? 'text-red-600 dark:text-red-200' : ''}`}
                      >
                        {formatPercent(row.netMarginPercent)}
                      </TableCell>
                      <TableCell
                        className={`px-2 py-1.5 text-right text-[11px] tabular-nums font-medium ${row.roi < 0 ? 'text-red-600 dark:text-red-200' : ''}`}
                      >
                        {formatPercent(row.roi)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Total row */}
                  <TableRow className="bg-muted/50">
                    <TableCell className="px-2 py-1.5 text-[11px] font-semibold">
                      {valueDisplay === 'PER_UNIT' ? 'Avg' : 'Total'} ({filteredData.length}{' '}
                      {skuFilter !== 'ALL' ? 'batches' : 'POs'})
                    </TableCell>
                    <TableCell className="px-2 py-1.5" />
                    <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums font-semibold">
                      {summary.totalUnits.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums font-semibold">
                      {formatMoney(summary.totalRevenue, summary.totalUnits)}
                    </TableCell>

                    {/* COGS total columns */}
                    {isGroupExpanded('cogs') ? (
                      <>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.manufacturingCost, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.freightCost, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.tariffCost, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.cogsAdjustment, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.cogs, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                        {formatMoney(
                          filteredData.reduce((sum, row) => sum + row.cogs, 0),
                          summary.totalUnits,
                        )}
                      </TableCell>
                    )}

                    {/* AMZ FEES total columns */}
                    {isGroupExpanded('amzFees') ? (
                      <>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.referralFees, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.fbaFees, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.storageFees, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.amazonFeesAdjustment, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.amazonFees, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                        {formatMoney(
                          filteredData.reduce((sum, row) => sum + row.amazonFees, 0),
                          summary.totalUnits,
                        )}
                      </TableCell>
                    )}

                    {/* OPEX total columns */}
                    {isGroupExpanded('opex') ? (
                      <>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.ppcSpend, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {formatMoney(
                            filteredData.reduce((sum, row) => sum + row.fixedCosts, 0),
                            summary.totalUnits,
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                        {formatMoney(
                          filteredData.reduce((sum, row) => sum + row.ppcSpend + row.fixedCosts, 0),
                          summary.totalUnits,
                        )}
                      </TableCell>
                    )}

                    {/* PROFIT total columns - always expanded */}
                    <TableCell className="px-2 py-1.5 text-right text-[11px] tabular-nums font-semibold">
                      {formatMoney(
                        filteredData.reduce((sum, row) => sum + row.grossProfit, 0),
                        summary.totalUnits,
                      )}
                    </TableCell>
                    <TableCell
                      className={`px-2 py-1.5 text-right text-[11px] tabular-nums font-semibold ${summary.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-200' : 'text-red-600 dark:text-red-200'}`}
                    >
                      {formatMoney(summary.totalProfit, summary.totalUnits)}
                    </TableCell>
                    <TableCell
                      className={`px-2 py-1.5 text-right text-[11px] tabular-nums font-semibold ${summary.netMargin < 0 ? 'text-red-600 dark:text-red-200' : ''}`}
                    >
                      {formatPercent(summary.netMargin)}
                    </TableCell>
                    <TableCell
                      className={`px-2 py-1.5 text-right text-[11px] tabular-nums font-semibold ${summary.roi < 0 ? 'text-red-600 dark:text-red-200' : ''}`}
                    >
                      {formatPercent(summary.roi)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SortButton({
  field,
  current,
  direction,
  onClick,
  children,
  align = 'left',
}: {
  field: SortField;
  current: SortField;
  direction: SortDirection;
  onClick: (field: SortField) => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const isActive = current === field;
  return (
    <button
      type="button"
      onClick={() => onClick(field)}
      className={`inline-flex items-center gap-1 hover:text-foreground ${align === 'right' ? 'justify-end w-full' : ''}`}
    >
      {children}
      {isActive &&
        (direction === 'asc' ? (
          <ChevronUp className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ))}
    </button>
  );
}

function StatusBadge({ status }: { status: POStatus }) {
  const styles: Record<POStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-700/35 dark:text-slate-200',
    ISSUED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/35 dark:text-violet-200',
    MANUFACTURING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-200',
    OCEAN: 'bg-sky-100 text-sky-700 dark:bg-sky-900/35 dark:text-sky-200',
    WAREHOUSE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-200',
    SHIPPED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/35 dark:text-indigo-200',
  };
  return (
    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${styles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
