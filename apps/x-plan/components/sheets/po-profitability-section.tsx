'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
import {
  SHEET_TOOLBAR_GROUP,
  SHEET_TOOLBAR_LABEL,
  SHEET_TOOLBAR_SELECT,
} from '@/components/sheet-toolbar';
import { usePersistentState } from '@/hooks/usePersistentState';

export type POStatus = 'PLANNED' | 'PRODUCTION' | 'IN_TRANSIT' | 'ARRIVED' | 'CLOSED' | 'CANCELLED';

// Each row represents a single product/batch within a PO
export interface POProfitabilityData {
  id: string;
  orderCode: string;
  batchCode: string | null;
  productId: string;
  productName: string;
  quantity: number;
  status: POStatus;
  sellingPrice: number;
  manufacturingCost: number;
  freightCost: number;
  tariffCost: number;
  landedUnitCost: number;
  supplierCostTotal: number;
  grossRevenue: number;
  fbaFee: number;
  amazonReferralRate: number;
  amazonFeesTotal: number;
  tacosPercent: number;
  ppcCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  netProfit: number;
  netMarginPercent: number;
  roi: number;
  productionStart: Date | null;
  availableDate: Date | null;
  totalLeadDays: number;
}

interface POProfitabilitySectionProps {
  data: POProfitabilityData[];
  title?: string;
  description?: string;
}

type StatusFilter = 'ALL' | POStatus;
type SortField = 'orderCode' | 'grossRevenue' | 'netProfit' | 'netMarginPercent' | 'roi';
type SortDirection = 'asc' | 'desc';
type MetricKey = 'grossMarginPercent' | 'netMarginPercent' | 'roi';

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
  PLANNED: 'Planned',
  PRODUCTION: 'Production',
  IN_TRANSIT: 'Transit',
  ARRIVED: 'Arrived',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

const statusFilters: StatusFilter[] = [
  'ALL',
  'PLANNED',
  'PRODUCTION',
  'IN_TRANSIT',
  'ARRIVED',
  'CLOSED',
];

type POProfitabilityFiltersContextValue = {
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
      statusFilter,
      setStatusFilter,
      focusSkuId,
      setFocusSkuId,
    }),
    [focusSkuId, setFocusSkuId, setStatusFilter, statusFilter],
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

  const { statusFilter, setStatusFilter, setFocusSkuId } = context;

  return (
    <>
      <div className={SHEET_TOOLBAR_GROUP}>
        <span className={SHEET_TOOLBAR_LABEL}>Status</span>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className={`${SHEET_TOOLBAR_SELECT} min-w-[8.5rem]`}
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
          <span className={SHEET_TOOLBAR_LABEL}>Focus SKU</span>
          <select
            value={focusSkuId}
            onChange={(event) => setFocusSkuId(event.target.value)}
            className={`${SHEET_TOOLBAR_SELECT} min-w-[10rem]`}
            aria-label="Focus on a single SKU"
          >
            <option value="ALL">Show all</option>
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
  data,
  title = 'PO Profitability Analysis',
  description = 'Compare purchase order performance and profitability metrics',
}: POProfitabilitySectionProps) {
  const filters = useContext(POProfitabilityFiltersContext);
  const statusFilter = filters?.statusFilter ?? 'ALL';
  const skuFilter = filters?.focusSkuId ?? 'ALL';
  const [enabledMetrics, setEnabledMetrics] = useState<MetricKey[]>([
    'grossMarginPercent',
    'netMarginPercent',
    'roi',
  ]);
  const [sortField, setSortField] = useState<SortField>('grossRevenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
        existing.quantity += row.quantity;
        existing.grossRevenue += row.grossRevenue;
        existing.supplierCostTotal += row.supplierCostTotal;
        existing.amazonFeesTotal += row.amazonFeesTotal;
        existing.ppcCost += row.ppcCost;
        existing.grossProfit += row.grossProfit;
        existing.netProfit += row.netProfit;
        // Recalculate percentages based on aggregated values
        existing.grossMarginPercent =
          existing.grossRevenue > 0 ? (existing.grossProfit / existing.grossRevenue) * 100 : 0;
        existing.netMarginPercent =
          existing.grossRevenue > 0 ? (existing.netProfit / existing.grossRevenue) * 100 : 0;
        existing.roi =
          existing.supplierCostTotal > 0
            ? (existing.netProfit / existing.supplierCostTotal) * 100
            : 0;
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
      name: skuFilter !== 'ALL' ? `${row.orderCode} - ${row.productName}` : row.orderCode,
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
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Summary stats
  const summary = useMemo(() => {
    if (filteredData.length === 0)
      return { totalRevenue: 0, totalProfit: 0, avgMargin: 0, avgROI: 0 };
    const totalRevenue = filteredData.reduce((sum, row) => sum + row.grossRevenue, 0);
    const totalProfit = filteredData.reduce((sum, row) => sum + row.netProfit, 0);
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgROI = filteredData.reduce((sum, row) => sum + row.roi, 0) / filteredData.length;
    return { totalRevenue, totalProfit, avgMargin, avgROI };
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

  return (
    <div className="space-y-4">
      {/* Chart Card */}
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
                  tick={{ fontSize: 11 }}
                  className="text-slate-500 dark:text-slate-400"
                  interval="preserveStartEnd"
                  dy={10}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
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

      {/* P&L Table */}
      <Card className="rounded-xl shadow-sm dark:border-white/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">P&L breakdown</CardTitle>
              <CardDescription>
                {skuFilter !== 'ALL' ? 'Filtered by SKU' : 'Aggregated by purchase order'}
              </CardDescription>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>
                Total Revenue:{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency(summary.totalRevenue)}
                </span>
              </div>
              <div>
                Total Profit:{' '}
                <span
                  className={`font-semibold ${summary.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-200' : 'text-red-600 dark:text-red-200'}`}
                >
                  {formatCurrency(summary.totalProfit)}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[180px] h-10 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
                  <SortButton
                    field="orderCode"
                    current={sortField}
                    direction={sortDirection}
                    onClick={handleSort}
                  >
                    PO Code
                  </SortButton>
                </TableHead>
                <TableHead className="w-[90px] h-10 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
                  Status
                </TableHead>
                <TableHead className="w-[80px] h-10 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
                  Units
                </TableHead>
                <TableHead className="w-[100px] h-10 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
                  <SortButton
                    field="grossRevenue"
                    current={sortField}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  >
                    Revenue
                  </SortButton>
                </TableHead>
                <TableHead className="w-[90px] h-10 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
                  COGS
                </TableHead>
                <TableHead className="w-[90px] h-10 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
                  Amz Fees
                </TableHead>
                <TableHead className="w-[80px] h-10 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
                  PPC
                </TableHead>
                <TableHead className="w-[100px] h-10 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
                  <SortButton
                    field="netProfit"
                    current={sortField}
                    direction={sortDirection}
                    onClick={handleSort}
                    align="right"
                  >
                    Net Profit
                  </SortButton>
                </TableHead>
                <TableHead className="w-[80px] h-10 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
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
                <TableHead className="w-[70px] h-10 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300/80">
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
                  <TableCell>
                    <div className="font-medium">{row.orderCode}</div>
                    <div
                      className="truncate text-xs text-muted-foreground max-w-[160px]"
                      title={row.productName}
                    >
                      {row.productName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.grossRevenue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(row.supplierCostTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(row.amazonFeesTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(row.ppcCost)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${row.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-200' : 'text-red-600 dark:text-red-200'}`}
                  >
                    {formatCurrency(row.netProfit)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${row.netMarginPercent < 0 ? 'text-red-600 dark:text-red-200' : ''}`}
                  >
                    {formatPercent(row.netMarginPercent)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${row.roi < 0 ? 'text-red-600 dark:text-red-200' : ''}`}
                  >
                    {formatPercent(row.roi)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total row */}
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold">
                  Total ({filteredData.length} {skuFilter !== 'ALL' ? 'batches' : 'POs'})
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums font-semibold">
                  {filteredData.reduce((sum, row) => sum + row.quantity, 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {formatCurrency(summary.totalRevenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(
                    filteredData.reduce((sum, row) => sum + row.supplierCostTotal, 0),
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(filteredData.reduce((sum, row) => sum + row.amazonFeesTotal, 0))}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCurrency(filteredData.reduce((sum, row) => sum + row.ppcCost, 0))}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums font-semibold ${summary.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-200' : 'text-red-600 dark:text-red-200'}`}
                >
                  {formatCurrency(summary.totalProfit)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums font-semibold ${summary.avgMargin < 0 ? 'text-red-600 dark:text-red-200' : ''}`}
                >
                  {formatPercent(summary.avgMargin)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums font-semibold ${summary.avgROI < 0 ? 'text-red-600 dark:text-red-200' : ''}`}
                >
                  {formatPercent(summary.avgROI)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
    ARRIVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-200',
    CLOSED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/35 dark:text-blue-200',
    IN_TRANSIT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/35 dark:text-sky-200',
    PRODUCTION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-200',
    PLANNED: 'bg-slate-100 text-slate-600 dark:bg-slate-700/35 dark:text-slate-200',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-200',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
