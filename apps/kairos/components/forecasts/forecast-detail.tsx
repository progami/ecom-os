'use client';

import Link from 'next/link';
import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { Loader2, Play, RefreshCw, TrendingUp } from 'lucide-react';
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
import { useState } from 'react';

import { fetchJson } from '@/lib/api/client';
import type { ForecastDetail, ForecastStatus, ProphetOutput } from '@/types/kairos';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

type ForecastPointRow = {
  t: string;
  actual: number | null;
  yhat: number | null;
  yhatLower: number | null;
  yhatUpper: number | null;
  isFuture: boolean | null;
};

function isProphetOutput(value: unknown): value is ProphetOutput {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  if (rec.model !== 'PROPHET') return false;
  return Array.isArray(rec.points);
}

export function ForecastDetailView({ forecastId }: { forecastId: string }) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const forecastQuery = useQuery({
    queryKey: FORECAST_DETAIL_KEY(forecastId),
    queryFn: async () => fetchJson<ForecastDetailResponse>(`/api/v1/forecasts/${forecastId}`),
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

  const forecast = forecastQuery.data?.forecast ?? null;
  const latestRun = forecast?.latestRun ?? null;
  const output = latestRun?.output;

  const rows = useMemo<ForecastPointRow[]>(() => {
    if (!forecast) return [];

    const actualMap = new Map<string, number>();
    for (const point of forecast.points) {
      const iso = new Date(point.t).toISOString();
      actualMap.set(iso, point.value);
    }

    if (!isProphetOutput(output)) {
      return forecast.points.map((point) => ({
        t: point.t,
        actual: point.value,
        yhat: null,
        yhatLower: null,
        yhatUpper: null,
        isFuture: null,
      }));
    }

    return output.points
      .map((p) => ({
        t: p.t,
        actual: actualMap.get(p.t) ?? null,
        yhat: p.yhat,
        yhatLower: p.yhatLower,
        yhatUpper: p.yhatUpper,
        isFuture: p.isFuture,
      }))
      .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  }, [forecast, output]);

  const columns = useMemo<ColumnDef<ForecastPointRow>[]>(
    () => [
      {
        accessorKey: 't',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(row.original.t).toLocaleDateString()}
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
      <div className="space-y-8 animate-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-8 w-64 rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-4 w-48 rounded bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-2" />
          <SkeletonCard />
        </div>
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
      : '—';

  const runDate = latestRun?.ranAt ? new Date(latestRun.ranAt) : null;
  const runLabel =
    runDate && !Number.isNaN(runDate.getTime())
      ? formatDistanceToNowStrict(runDate, { addSuffix: true })
      : null;

  const outputMeta = isProphetOutput(output) ? output.meta : null;

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="text-section-header">Forecast Detail</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h1">{forecast.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{forecast.model}</Badge>
              <StatusBadge status={forecast.status} />
            </div>
          </div>
          <p className="text-body">
            <span className="font-medium text-slate-700 dark:text-slate-300">Horizon:</span> {forecast.horizon} periods
            <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">Series:</span> {forecast.series.name}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/forecasts">Back</Link>
          </Button>
          <Button
            onClick={() => void runMutation.mutateAsync()}
            disabled={runMutation.isPending || forecast.status === 'RUNNING'}
            className="gap-2"
          >
            {runMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            Run now
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Time Series</CardTitle>
            <CardDescription>Source data powering this forecast.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{forecast.series.source}</Badge>
              <Badge variant="outline">{forecast.series.granularity}</Badge>
              {forecast.series.geo ? <Badge variant="outline">{forecast.series.geo}</Badge> : null}
            </div>
            <div className="text-muted-foreground">Query: {forecast.series.query}</div>
            <div className="text-muted-foreground">Observations: {forecast.points.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest Run</CardTitle>
            <CardDescription>Run status and metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Last run</div>
              <div className="text-xs text-muted-foreground">{lastRunLabel}</div>
            </div>
            {latestRun ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground">Run status</div>
                  <Badge variant={latestRun.status === 'FAILED' ? 'destructive' : 'secondary'}>
                    {latestRun.status}
                  </Badge>
                </div>
                {runLabel ? (
                  <div className="flex items-center justify-between">
                    <div className="text-muted-foreground">Ran</div>
                    <div className="text-xs text-muted-foreground">{runLabel}</div>
                  </div>
                ) : null}
                {latestRun.errorMessage ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100">
                    {latestRun.errorMessage}
                  </div>
                ) : null}
                {outputMeta ? (
                  <div className="text-xs text-muted-foreground">
                    Prophet meta: horizon {outputMeta.horizon}, history {outputMeta.historyCount}
                    {outputMeta.intervalLevel ? `, interval ${(outputMeta.intervalLevel * 100).toFixed(0)}%` : ''}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No runs yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Forecast Visualization Chart */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forecast Visualization</CardTitle>
            <CardDescription>
              Time series with Prophet predictions and {outputMeta?.intervalLevel ? `${(outputMeta.intervalLevel * 100).toFixed(0)}%` : '80%'} confidence interval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ForecastChart
              data={rows}
              granularity={forecast.series.granularity}
              intervalLevel={outputMeta?.intervalLevel ?? 0.8}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Forecast Output</CardTitle>
            <CardDescription>
              Combined actuals and Prophet predictions (including historical fit + future horizon).
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Input
                value={globalFilter ?? ''}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder="Search dates…"
                aria-label="Search forecast output"
              />
            </div>
            <Button
              variant="outline"
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
    </div>
  );
}
