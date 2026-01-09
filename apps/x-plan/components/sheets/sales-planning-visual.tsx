'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSalesPlanningFocus } from '@/components/sheets/sales-planning-grid';
import { SHEET_TOOLBAR_GROUP } from '@/components/sheet-toolbar';

type SalesRow = {
  weekNumber: string;
  weekLabel: string;
  weekDate: string;
  arrivalDetail?: string;
  [key: string]: string | undefined;
};

type ColumnMeta = Record<string, { productId: string; field: string }>;

interface SalesPlanningVisualProps {
  rows: SalesRow[];
  columnMeta: ColumnMeta;
  columnKeys: string[];
  productOptions: Array<{ id: string; name: string }>;
}

type ShipmentMarker = {
  weekNumber: number;
  weekDate: string;
  arrivalDetail: string;
};

export function SalesPlanningVisual({
  rows,
  columnMeta,
  columnKeys,
  productOptions,
}: SalesPlanningVisualProps) {
  const searchParams = useSearchParams();
  const productSetupHref = searchParams
    ? `/2-product-setup?${searchParams.toString()}`
    : '/2-product-setup';
  const defaultProductId = productOptions[0]?.id ?? '';

  const focusContext = useSalesPlanningFocus();
  const contextProductId = focusContext?.focusProductId;

  const selectedProductId =
    contextProductId && contextProductId !== 'ALL' ? contextProductId : defaultProductId;

  const [showShipments, setShowShipments] = useState(true);
  const [showStockLine, setShowStockLine] = useState(true);

  // Actual vs Forecast chart state
  const [forecastViewMode, setForecastViewMode] = useState<'individual' | 'cumulative'>(
    'individual',
  );
  const [forecastSelectedProductId, setForecastSelectedProductId] = useState<string | 'ALL'>('ALL');
  const [showActualLine, setShowActualLine] = useState(true);
  const [showForecastLine, setShowForecastLine] = useState(true);
  const [showErrorBars, setShowErrorBars] = useState(true);

  const weekLabelByWeekNumber = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row) => {
      const week = Number(row.weekNumber);
      if (!Number.isFinite(week)) return;
      map.set(week, row.weekLabel ?? row.weekNumber);
    });
    return map;
  }, [rows]);

  const stockDataPoints = useMemo(() => {
    if (!selectedProductId) return [];

    const productColumnKey = columnKeys.find(
      (key) =>
        columnMeta[key]?.productId === selectedProductId && columnMeta[key]?.field === 'stockEnd',
    );

    if (!productColumnKey) return [];

    return rows
      .map((row) => {
        const stockValue = row[productColumnKey];
        const weekNumber = Number(row.weekNumber);
        return {
          weekNumber,
          weekLabel: String(weekLabelByWeekNumber.get(weekNumber) ?? weekNumber),
          weekDate: row.weekDate,
          stockEnd: stockValue ? Number(stockValue) : 0,
        };
      })
      .filter((point) => Number.isFinite(point.weekNumber) && Number.isFinite(point.stockEnd));
  }, [selectedProductId, rows, columnKeys, columnMeta, weekLabelByWeekNumber]);

  const shipmentMarkers = useMemo(() => {
    return rows
      .filter((row) => row.arrivalDetail && row.arrivalDetail.trim().length > 0)
      .map((row) => ({
        weekNumber: Number(row.weekNumber),
        weekDate: row.weekDate,
        arrivalDetail: row.arrivalDetail || '',
      }))
      .filter((marker) => Number.isFinite(marker.weekNumber));
  }, [rows]);

  const shipmentByWeek = useMemo(() => {
    const map = new Map<number, ShipmentMarker>();
    shipmentMarkers.forEach((marker) => {
      if (!map.has(marker.weekNumber)) {
        map.set(marker.weekNumber, marker);
      }
    });
    return map;
  }, [shipmentMarkers]);

  // Transform for Recharts
  const chartData = useMemo(() => {
    return stockDataPoints.map((point) => ({
      ...point,
      hasShipment: shipmentByWeek.has(point.weekNumber),
    }));
  }, [stockDataPoints, shipmentByWeek]);

  // Calculate Y-axis bounds and zero offset for split gradients (red below 0)
  const yAxisBounds = useMemo(() => {
    const allValues = stockDataPoints.map((p) => p.stockEnd).filter(Number.isFinite);
    if (allValues.length === 0)
      return { min: 0, max: 0, zeroOffset: 0.5, hasNegative: false, allNegative: false };
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);

    // Extend Y-axis to include 0 for context when data is all negative or all positive
    // Add padding below zero to ensure the zero line is clearly visible
    const rawMin = Math.min(dataMin, 0);
    const rawMax = Math.max(dataMax, 0);
    const range = rawMax - rawMin;

    // Add 10% padding below zero line for visibility
    const padding = range > 0 ? range * 0.1 : 100;
    const min = rawMin < 0 ? rawMin - padding * 0.5 : -padding * 0.15;
    const max = rawMax;
    const adjustedRange = max - min;

    // zeroOffset is where 0 falls as a percentage from top (max) to bottom (min)
    const zeroOffset = adjustedRange > 0 ? max / adjustedRange : 0.5;
    const hasNegative = dataMin < 0;
    const allNegative = dataMax <= 0;

    return { min, max, zeroOffset: Math.max(0, Math.min(1, zeroOffset)), hasNegative, allNegative };
  }, [stockDataPoints]);

  // Actual vs Forecast data processing
  const forecastChartData = useMemo(() => {
    const targetProductIds =
      forecastSelectedProductId === 'ALL'
        ? productOptions.map((p) => p.id)
        : [forecastSelectedProductId];

    // Get column keys for each product's actual and forecast
    const productColumnsByField = new Map<string, Map<string, string>>();
    targetProductIds.forEach((productId) => {
      const fieldMap = new Map<string, string>();
      columnKeys.forEach((key) => {
        const meta = columnMeta[key];
        if (meta?.productId === productId) {
          fieldMap.set(meta.field, key);
        }
      });
      productColumnsByField.set(productId, fieldMap);
    });

    return rows
      .map((row) => {
        const weekNumber = Number(row.weekNumber);
        let actual = 0;
        let forecast = 0;

        targetProductIds.forEach((productId) => {
          const fieldMap = productColumnsByField.get(productId);
          if (!fieldMap) return;

          const actualKey = fieldMap.get('actualSales');
          const forecastKey = fieldMap.get('forecastSales');

          if (actualKey && row[actualKey]) {
            actual += Number(row[actualKey]) || 0;
          }
          if (forecastKey && row[forecastKey]) {
            forecast += Number(row[forecastKey]) || 0;
          }
        });

        // Calculate error percentage (actual vs forecast)
        const error = forecast > 0 ? ((actual - forecast) / forecast) * 100 : 0;

        return {
          weekNumber,
          weekLabel: String(weekLabelByWeekNumber.get(weekNumber) ?? weekNumber),
          weekDate: row.weekDate,
          actual,
          forecast,
          error: Number.isFinite(error) ? error : 0,
        };
      })
      .filter((point) => Number.isFinite(point.weekNumber));
  }, [
    rows,
    columnKeys,
    columnMeta,
    productOptions,
    forecastSelectedProductId,
    weekLabelByWeekNumber,
  ]);

  // Cumulative version of forecast chart data
  const forecastChartDataCumulative = useMemo(() => {
    let cumulativeActual = 0;
    let cumulativeForecast = 0;

    return forecastChartData.map((point) => {
      cumulativeActual += point.actual;
      cumulativeForecast += point.forecast;

      const error =
        cumulativeForecast > 0
          ? ((cumulativeActual - cumulativeForecast) / cumulativeForecast) * 100
          : 0;

      return {
        ...point,
        actual: cumulativeActual,
        forecast: cumulativeForecast,
        error: Number.isFinite(error) ? error : 0,
      };
    });
  }, [forecastChartData]);

  const activeForecastData =
    forecastViewMode === 'cumulative' ? forecastChartDataCumulative : forecastChartData;

  // Y-axis bounds for forecast chart
  const forecastYAxisBounds = useMemo(() => {
    const allValues = activeForecastData
      .flatMap((p) => [p.actual, p.forecast])
      .filter(Number.isFinite);
    if (allValues.length === 0) return { min: 0, max: 0 };
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    const min = Math.min(dataMin, 0);
    const max = Math.max(dataMax, 0);
    return { min, max };
  }, [activeForecastData]);

  if (productOptions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-lg font-semibold mb-2">No Products Available</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Set up your first product in the Product Setup sheet to start tracking stock levels.
          </p>
          <Link
            href={productSetupHref}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Product Setup →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stock Level Over Time</CardTitle>
          <CardDescription>Tracking inventory levels with shipment arrival markers</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <defs>
                  {/* Stock gradient (teal) */}
                  <linearGradient id="stockPositiveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  className="dark:stroke-slate-700"
                />
                <XAxis
                  dataKey="weekLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  interval={3}
                  label={{
                    value: 'Week',
                    position: 'bottom',
                    offset: 10,
                    fontSize: 12,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) =>
                    Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString()
                  }
                  width={60}
                  domain={[yAxisBounds.min, yAxisBounds.max]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="text-xs font-medium">
                          Week {data.weekLabel} · {data.weekDate}
                        </p>
                        <p
                          className={`text-xs ${
                            data.stockEnd < 0
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          Stock: {Math.round(data.stockEnd).toLocaleString()} units
                        </p>
                        {data.hasShipment && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-200">
                            Shipment arrives
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                {/* Shipment reference lines */}
                {showShipments &&
                  shipmentMarkers.map((marker) => {
                    const dataIndex = chartData.findIndex(
                      (d) => d.weekNumber === marker.weekNumber,
                    );
                    if (dataIndex === -1) return null;
                    return (
                      <ReferenceLine
                        key={marker.weekNumber}
                        x={chartData[dataIndex]?.weekLabel}
                        stroke="hsl(var(--chart-2))"
                        strokeDasharray="4 4"
                        strokeWidth={2}
                      />
                    );
                  })}
                {/* Red danger zone below zero */}
                {yAxisBounds.hasNegative && (
                  <ReferenceArea
                    y1={0}
                    y2={yAxisBounds.min}
                    fill="#dc2626"
                    fillOpacity={0.15}
                    stroke="#dc2626"
                    strokeOpacity={0.3}
                  />
                )}
                {/* Zero reference line - always visible for context */}
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={1.5} />
                {/* Main stock line with teal fill */}
                {showStockLine && (
                  <Area
                    type="monotone"
                    dataKey="stockEnd"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#stockPositiveGradient)"
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t border-slate-200/60 pt-4 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => setShowStockLine(!showStockLine)}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-200 ${
                showStockLine
                  ? 'bg-slate-100/80 dark:bg-slate-800/50'
                  : 'opacity-50 hover:opacity-75'
              }`}
            >
              <div className="relative">
                <div
                  className={`h-3 w-3 rounded-full transition-transform duration-200 ${
                    showStockLine ? 'scale-100' : 'scale-75'
                  }`}
                  style={{ backgroundColor: 'hsl(var(--chart-1))' }}
                />
                {showStockLine && (
                  <div
                    className="absolute inset-0 animate-pulse rounded-full opacity-40 blur-sm"
                    style={{ backgroundColor: 'hsl(var(--chart-1))' }}
                  />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  showStockLine
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Stock Level
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowShipments(!showShipments)}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-200 ${
                showShipments
                  ? 'bg-slate-100/80 dark:bg-slate-800/50'
                  : 'opacity-50 hover:opacity-75'
              }`}
            >
              <div className="relative">
                <div
                  className={`h-3 w-3 rounded-full border-2 border-dashed transition-transform duration-200 ${
                    showShipments ? 'scale-100' : 'scale-75'
                  }`}
                  style={{ borderColor: 'hsl(var(--chart-2))' }}
                />
                {showShipments && (
                  <div
                    className="absolute inset-0 animate-pulse rounded-full opacity-40 blur-sm"
                    style={{ backgroundColor: 'hsl(var(--chart-2))' }}
                  />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  showShipments
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Shipment Arrival
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Actual vs Forecast Comparison Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Actual vs Forecast Sales</CardTitle>
              <CardDescription>
                Compare actual sales performance against forecasts with variance tracking
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* SKU Selector */}
              <div className={SHEET_TOOLBAR_GROUP}>
                <span className="text-xs font-medium text-muted-foreground">SKU</span>
                <select
                  value={forecastSelectedProductId}
                  onChange={(e) => setForecastSelectedProductId(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="ALL">All Products</option>
                  {productOptions.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* View Mode Toggle */}
              <div className={SHEET_TOOLBAR_GROUP}>
                <span className="text-xs font-medium text-muted-foreground">View</span>
                {(['individual', 'cumulative'] as const).map((mode) => {
                  const isActive = mode === forecastViewMode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setForecastViewMode(mode)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {isActive && <Check className="h-3 w-3" />}
                      {mode === 'individual' ? 'Weekly' : 'Cumulative'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Chart */}
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={activeForecastData}
                margin={{ top: 10, right: 60, left: 0, bottom: 25 }}
              >
                <defs>
                  <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  className="dark:stroke-slate-700"
                />
                <XAxis
                  dataKey="weekLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  interval={3}
                  label={{
                    value: 'Week',
                    position: 'bottom',
                    offset: 10,
                    fontSize: 12,
                    fill: 'hsl(var(--muted-foreground))',
                  }}
                />
                <YAxis
                  yAxisId="sales"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) =>
                    Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toString()
                  }
                  width={60}
                  domain={[forecastYAxisBounds.min, forecastYAxisBounds.max]}
                />
                <YAxis
                  yAxisId="error"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  width={50}
                  domain={[-100, 100]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="text-xs font-medium">
                          Week {data.weekLabel} · {data.weekDate}
                        </p>
                        <p className="text-xs" style={{ color: 'hsl(var(--chart-2))' }}>
                          Actual: {Math.round(data.actual).toLocaleString()} units
                        </p>
                        <p className="text-xs" style={{ color: 'hsl(var(--chart-3))' }}>
                          Forecast: {Math.round(data.forecast).toLocaleString()} units
                        </p>
                        <p
                          className={`text-xs font-medium ${
                            data.error > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : data.error < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-muted-foreground'
                          }`}
                        >
                          Variance: {data.error > 0 ? '+' : ''}
                          {data.error.toFixed(1)}%
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine yAxisId="error" y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                {showActualLine && (
                  <Area
                    yAxisId="sales"
                    type="monotone"
                    dataKey="actual"
                    stroke="hsl(var(--chart-2))"
                    fill="url(#actualGradient)"
                    strokeWidth={2}
                  />
                )}
                {showForecastLine && (
                  <Area
                    yAxisId="sales"
                    type="monotone"
                    dataKey="forecast"
                    stroke="hsl(var(--chart-3))"
                    fill="url(#forecastGradient)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                )}
                {showErrorBars && (
                  <Line
                    yAxisId="error"
                    type="monotone"
                    dataKey="error"
                    stroke="hsl(var(--chart-4))"
                    strokeWidth={2}
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t border-slate-200/60 pt-4 dark:border-slate-700/50">
            <button
              type="button"
              onClick={() => setShowActualLine(!showActualLine)}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-200 ${
                showActualLine
                  ? 'bg-slate-100/80 dark:bg-slate-800/50'
                  : 'opacity-50 hover:opacity-75'
              }`}
            >
              <div className="relative">
                <div
                  className={`h-3 w-3 rounded-full transition-transform duration-200 ${
                    showActualLine ? 'scale-100' : 'scale-75'
                  }`}
                  style={{ backgroundColor: 'hsl(var(--chart-2))' }}
                />
                {showActualLine && (
                  <div
                    className="absolute inset-0 animate-pulse rounded-full opacity-40 blur-sm"
                    style={{ backgroundColor: 'hsl(var(--chart-2))' }}
                  />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  showActualLine
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Actual Sales
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowForecastLine(!showForecastLine)}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-200 ${
                showForecastLine
                  ? 'bg-slate-100/80 dark:bg-slate-800/50'
                  : 'opacity-50 hover:opacity-75'
              }`}
            >
              <div className="relative">
                <div
                  className={`h-3 w-3 rounded-full border-2 border-dashed transition-transform duration-200 ${
                    showForecastLine ? 'scale-100' : 'scale-75'
                  }`}
                  style={{ borderColor: 'hsl(var(--chart-3))' }}
                />
                {showForecastLine && (
                  <div
                    className="absolute inset-0 animate-pulse rounded-full opacity-40 blur-sm"
                    style={{ backgroundColor: 'hsl(var(--chart-3))' }}
                  />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  showForecastLine
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                Forecast
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowErrorBars(!showErrorBars)}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-1.5 transition-all duration-200 ${
                showErrorBars
                  ? 'bg-slate-100/80 dark:bg-slate-800/50'
                  : 'opacity-50 hover:opacity-75'
              }`}
            >
              <div className="relative">
                <div
                  className={`h-0.5 w-3 rounded-full transition-transform duration-200 ${
                    showErrorBars ? 'scale-100' : 'scale-75'
                  }`}
                  style={{ backgroundColor: 'hsl(var(--chart-4))' }}
                />
                {showErrorBars && (
                  <div
                    className="absolute inset-0 animate-pulse rounded-full opacity-40 blur-sm"
                    style={{ backgroundColor: 'hsl(var(--chart-4))' }}
                  />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors duration-200 ${
                  showErrorBars
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                % Variance
              </span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
