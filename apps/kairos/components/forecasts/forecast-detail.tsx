'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { BarChart3, Download, Loader2, Play, RefreshCw, Table as TableIcon, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { fetchJson } from '@/lib/api/client';
import { withAppBasePath } from '@/lib/base-path';
import type { ForecastDetail, ForecastOutput, ForecastOutputPoint, ForecastStatus } from '@/types/kairos';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ForecastChart } from '@/components/charts/forecast-chart';
import { cn } from '@/lib/utils';

const FORECAST_DETAIL_KEY = (forecastId: string) => ['kairos', 'forecast', forecastId] as const;
const FORECASTS_QUERY_KEY = ['kairos', 'forecasts'] as const;

type ForecastDetailResponse = {
  forecast: ForecastDetail;
};

type RunForecastResponse = {
  forecast: { id: string; status: ForecastStatus; lastRunAt: string | null };
  run: { id: string; status: string; ranAt: string; output: unknown; errorMessage: string | null };
};

type CancelForecastResponse = {
  forecast: { id: string; status: ForecastStatus; lastRunAt: string | null };
  run: { id: string; status: string } | null;
};

type ForecastPointRow = {
  t: string;
  actual: number | null;
  yhat: number | null;
  yhatLower: number | null;
  yhatUpper: number | null;
  isFuture: boolean | null;
};

function isForecastOutputPoint(value: unknown): value is ForecastOutputPoint {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.t === 'string' &&
    typeof rec.yhat === 'number' &&
    (rec.yhatLower === null || typeof rec.yhatLower === 'number') &&
    (rec.yhatUpper === null || typeof rec.yhatUpper === 'number') &&
    typeof rec.isFuture === 'boolean'
  );
}

function parseForecastOutput(value: unknown): ForecastOutput | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;

  if (!Array.isArray(rec.points) || rec.points.length === 0) return null;

  const points = rec.points.filter(isForecastOutputPoint);
  if (points.length === 0) return null;

  return { ...(rec as ForecastOutput), points };
}

function formatIsoDate(value: string) {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function formatDurationMs(ms: number) {
  if (!Number.isFinite(ms)) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function MetricCard({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
        {value ?? '—'}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

export function ForecastDetailView({ forecastId }: { forecastId: string }) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const forecastQuery = useQuery({
    queryKey: FORECAST_DETAIL_KEY(forecastId),
    queryFn: async () => fetchJson<ForecastDetailResponse>(`/api/v1/forecasts/${forecastId}`),
    refetchInterval: (query) => {
      const data = query.state.data as ForecastDetailResponse | undefined;
      return data?.forecast?.status === 'RUNNING' ? 2000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const runMutation = useMutation({
    mutationFn: async () =>
      fetchJson<RunForecastResponse>(`/api/v1/forecasts/${forecastId}/run`, {
        method: 'POST',
      }),
    onSuccess: async (data) => {
      const runStatus = String(data.run.status).toUpperCase();
      if (runStatus === 'FAILED') {
        toast.error('Forecast run failed', { description: data.run.errorMessage ?? undefined });
      } else if (runStatus === 'RUNNING') {
        toast.success('Forecast run started');
      } else {
        toast.success('Forecast run complete');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: FORECAST_DETAIL_KEY(forecastId) }),
        queryClient.invalidateQueries({ queryKey: FORECASTS_QUERY_KEY }),
      ]);
    },
    onError: (error) => {
      toast.error('Run failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () =>
      fetchJson<CancelForecastResponse>(`/api/v1/forecasts/${forecastId}/cancel`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      toast.success('Forecast run cancelled');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: FORECAST_DETAIL_KEY(forecastId) }),
        queryClient.invalidateQueries({ queryKey: FORECASTS_QUERY_KEY }),
      ]);
    },
    onError: (error) => {
      toast.error('Cancel failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const forecast = forecastQuery.data?.forecast ?? null;
  const latestRun = forecast?.latestRun ?? null;
  const latestSuccessfulRun = forecast?.latestSuccessfulRun ?? null;
  const chartOutput =
    latestRun?.status === 'SUCCESS' ? latestRun.output : latestSuccessfulRun?.output ?? null;
  const outputParsed = useMemo(() => parseForecastOutput(chartOutput), [chartOutput]);

  const rows = useMemo<ForecastPointRow[]>(() => {
    if (!forecast) return [];

    const actualMap = new Map<string, number>();
    for (const point of forecast.points) {
      actualMap.set(point.t, point.value);
    }

    const outputMap = new Map<string, ForecastOutputPoint>();
    if (outputParsed) {
      for (const point of outputParsed.points) {
        outputMap.set(point.t, point);
      }
    }

    const timestamps = new Set<string>();
    for (const point of forecast.points) {
      timestamps.add(point.t);
    }
    for (const point of outputMap.values()) {
      timestamps.add(point.t);
    }

    return Array.from(timestamps)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((t) => {
        const predicted = outputMap.get(t) ?? null;
        const actual = actualMap.get(t) ?? null;

        return {
          t,
          actual,
          yhat: predicted?.yhat ?? null,
          yhatLower: predicted?.yhatLower ?? null,
          yhatUpper: predicted?.yhatUpper ?? null,
          isFuture: predicted?.isFuture ?? (actual !== null ? false : null),
        };
      });
  }, [forecast, outputParsed]);

  const columns = useMemo<ColumnDef<ForecastPointRow>[]>(
    () => [
      {
        accessorKey: 't',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatIsoDate(row.original.t)}
          </span>
        ),
      },
      {
        accessorKey: 'actual',
        header: 'Actual',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.actual ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'yhat',
        header: 'Forecast',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.yhat ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'yhatLower',
        header: 'Lower',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.yhatLower ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'yhatUpper',
        header: 'Upper',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.yhatUpper ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'isFuture',
        header: 'Window',
        cell: ({ row }) => {
          if (row.original.isFuture === null) {
            return <span className="text-xs text-muted-foreground">History</span>;
          }
          return row.original.isFuture ? (
            <Badge variant="outline" className="text-[11px]">
              Future
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[11px]">
              History
            </Badge>
          );
        },
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
  });

  if (forecastQuery.isLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-64 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-4 w-48 rounded bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-20 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-9 w-20 rounded bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
        <SkeletonCard className="h-[400px]" />
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">Forecast not found.</div>
        <Button asChild variant="outline">
          <Link href="/forecasts">Back</Link>
        </Button>
      </div>
    );
  }

  const lastRunDate = forecast.lastRunAt ? new Date(forecast.lastRunAt) : null;
  const lastRunLabel =
    lastRunDate && !Number.isNaN(lastRunDate.getTime())
      ? formatDistanceToNowStrict(lastRunDate, { addSuffix: true })
      : null;

  const outputMeta = outputParsed?.meta ?? null;

  return (
    <div className="space-y-6 animate-in">
      {/* Compact Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{forecast.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{forecast.model}</Badge>
              <StatusBadge status={forecast.status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-slate-600 dark:text-slate-400">Series:</span>{' '}
              {forecast.targetSeries.name}
            </span>
            <span>
              <span className="font-medium text-slate-600 dark:text-slate-400">Horizon:</span>{' '}
              {forecast.horizon} periods
            </span>
            {lastRunLabel && (
              <span>
                <span className="font-medium text-slate-600 dark:text-slate-400">Last run:</span>{' '}
                {lastRunLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/forecasts">Back</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a
              href={withAppBasePath(`/api/v1/forecasts/${encodeURIComponent(forecast.id)}/export`)}
              download
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </a>
          </Button>
          {forecast.status === 'RUNNING' ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void cancelMutation.mutateAsync()}
              disabled={cancelMutation.isPending}
              className="gap-2"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <X className="h-4 w-4" aria-hidden />
              )}
              Cancel
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => void runMutation.mutateAsync()}
              disabled={runMutation.isPending}
              className="gap-2"
            >
              {runMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              Run
            </Button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {latestRun?.errorMessage && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-900 dark:border-danger-800 dark:bg-danger-950 dark:text-danger-100">
          <span className="font-medium">Run failed:</span> {latestRun.errorMessage}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="chart" className="w-full">
        <TabsList>
          <TabsTrigger value="chart" className="gap-2">
            <TrendingUp className="h-4 w-4" aria-hidden />
            Chart
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-2">
            <TableIcon className="h-4 w-4" aria-hidden />
            Table
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Metrics
          </TabsTrigger>
        </TabsList>

        {/* Chart Tab */}
        <TabsContent value="chart">
          {rows.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.02]">
              <ForecastChart
                data={rows}
                granularity={forecast.targetSeries.granularity}
                intervalLevel={outputMeta?.intervalLevel ?? 0.8}
              />
            </div>
          ) : (
            <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10">
              <div className="text-center text-sm text-muted-foreground">
                <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No forecast data yet.</p>
                <p className="mt-1">Run the forecast to generate predictions.</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Table Tab */}
        <TabsContent value="table">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">Forecast Output</CardTitle>
                <CardDescription>
                  Actuals and predictions with {outputMeta?.intervalLevel ? `${(outputMeta.intervalLevel * 100).toFixed(0)}%` : '80%'} confidence interval.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Input
                    value={globalFilter ?? ''}
                    onChange={(event) => setGlobalFilter(event.target.value)}
                    placeholder="Search dates…"
                    aria-label="Search forecast output"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void forecastQuery.refetch()}
                  disabled={forecastQuery.isFetching}
                  className="gap-2"
                >
                  {forecastQuery.isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row, index) => {
                        const isFuture = row.original.isFuture === true;
                        const prevRow = table.getRowModel().rows[index - 1];
                        const isFirstFuture = isFuture && prevRow && prevRow.original.isFuture !== true;

                        return (
                          <React.Fragment key={row.id}>
                            {isFirstFuture && (
                              <TableRow key={`divider-${row.id}`} className="bg-slate-50/80 dark:bg-white/5 hover:bg-slate-50/80 dark:hover:bg-white/5">
                                <TableCell colSpan={columns.length} className="py-2">
                                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-teal-600 dark:text-brand-cyan">
                                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                                    Forecast Horizon
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow
                              key={row.id}
                              className={cn(
                                isFuture && 'bg-brand-teal-50/30 dark:bg-brand-cyan/5 border-l-2 border-l-brand-teal-500 dark:border-l-brand-cyan',
                              )}
                            >
                              {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                          No rows.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                <div className="text-xs text-muted-foreground">
                  {table.getFilteredRowModel().rows.length} row(s)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <div className="space-y-6">
            {/* Model Performance */}
            {outputMeta?.metrics?.sampleCount ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-900 dark:text-white">Model Performance</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <MetricCard
                    label="MAE (Mean Absolute Error)"
                    value={outputMeta.metrics.mae?.toFixed(2) ?? null}
                  />
                  <MetricCard
                    label="RMSE (Root Mean Square Error)"
                    value={outputMeta.metrics.rmse?.toFixed(2) ?? null}
                  />
                  <MetricCard
                    label="MAPE (Mean Absolute % Error)"
                    value={outputMeta.metrics.mape != null ? (outputMeta.metrics.mape * 100).toFixed(1) : null}
                    unit="%"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Metrics computed on {outputMeta.metrics.sampleCount} historical data points.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-white/10">
                <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No metrics available yet.</p>
                <p className="mt-1 text-xs text-muted-foreground">Run the forecast to compute performance metrics.</p>
              </div>
            )}

            {/* Run Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Run Details</h3>
              <Card>
                <CardContent className="pt-6">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                      <dd className="mt-1">
                        {latestRun ? (
                          <Badge variant={latestRun.status === 'FAILED' ? 'destructive' : 'secondary'}>
                            {latestRun.status}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">No runs yet</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Last Run</dt>
                      <dd className="mt-1 text-sm">{lastRunLabel ?? '—'}</dd>
                    </div>
                    {outputMeta && (
                      <>
                        <div>
                          <dt className="text-xs font-medium text-muted-foreground">Horizon</dt>
                          <dd className="mt-1 text-sm">{outputMeta.horizon} periods</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-muted-foreground">History Points</dt>
                          <dd className="mt-1 text-sm">{outputMeta.historyCount}</dd>
                        </div>
                        {outputMeta.intervalLevel && (
                          <div>
                            <dt className="text-xs font-medium text-muted-foreground">Confidence Interval</dt>
                            <dd className="mt-1 text-sm">{(outputMeta.intervalLevel * 100).toFixed(0)}%</dd>
                          </div>
                        )}
                      </>
                    )}
                  </dl>
                  {outputMeta?.timings && (
                    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
                      <dt className="text-xs font-medium text-muted-foreground">Timing Breakdown</dt>
                      <dd className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Load: {formatDurationMs(outputMeta.timings.loadMs)}</span>
                        <span>Model: {formatDurationMs(outputMeta.timings.modelMs)}</span>
                        <span>Save: {formatDurationMs(outputMeta.timings.saveMs)}</span>
                        <span className="font-medium text-slate-600 dark:text-slate-400">
                          Total: {formatDurationMs(outputMeta.timings.totalMs)}
                        </span>
                      </dd>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Series Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Data Source</h3>
              <Card>
                <CardContent className="pt-6">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Series Name</dt>
                      <dd className="mt-1 text-sm">{forecast.targetSeries.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Source</dt>
                      <dd className="mt-1">
                        <Badge variant="outline">{forecast.targetSeries.source}</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Granularity</dt>
                      <dd className="mt-1">
                        <Badge variant="outline">{forecast.targetSeries.granularity}</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Observations</dt>
                      <dd className="mt-1 text-sm">{forecast.points.length}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-medium text-muted-foreground">Query</dt>
                      <dd className="mt-1 text-sm text-muted-foreground">{forecast.targetSeries.query}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
