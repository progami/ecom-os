'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { Download, Loader2, Play, RefreshCw } from 'lucide-react';
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
import { withAppBasePath } from '@/lib/base-path';
import type { ForecastDetail, ForecastOutput, ForecastOutputPoint, ForecastStatus } from '@/types/kairos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

function statusTone(status: ForecastStatus) {
  switch (status) {
    case 'DRAFT':
      return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400';
    case 'READY':
      return 'border-transparent bg-success-100 text-success-700 dark:bg-success-950 dark:text-success-400';
    case 'RUNNING':
      return 'border-transparent bg-brand-teal-100 text-brand-teal-700 dark:bg-brand-cyan/15 dark:text-brand-cyan';
    case 'FAILED':
      return 'border-transparent bg-danger-100 text-danger-700 dark:bg-danger-950 dark:text-danger-400';
  }
}

function formatIsoDate(value: string) {
  return value.length >= 10 ? value.slice(0, 10) : value;
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

  const forecast = forecastQuery.data?.forecast ?? null;
  const latestRun = forecast?.latestRun ?? null;
  const output = latestRun?.output;
  const outputParsed = useMemo(() => parseForecastOutput(output), [output]);

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
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">Loading forecast…</div>
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

  const outputMeta = outputParsed?.meta ?? null;

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="text-section-header">Forecast Detail</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h1">{forecast.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{forecast.model}</Badge>
              <Badge variant="outline" className={cn('capitalize', statusTone(forecast.status))}>
                {forecast.status.toLowerCase()}
              </Badge>
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
          <Button asChild variant="outline" className="gap-2">
            <a
              href={withAppBasePath(`/api/v1/forecasts/${encodeURIComponent(forecast.id)}/export`)}
              download
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </a>
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
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>
                      Model meta: horizon {outputMeta.horizon}, history {outputMeta.historyCount}
                      {outputMeta.intervalLevel ? `, interval ${(outputMeta.intervalLevel * 100).toFixed(0)}%` : ''}
                    </div>
                    {outputMeta.metrics?.sampleCount ? (
                      <div>
                        Metrics (history): MAE {outputMeta.metrics.mae?.toFixed(4) ?? '—'}, RMSE{' '}
                        {outputMeta.metrics.rmse?.toFixed(4) ?? '—'}
                        {outputMeta.metrics.mape !== null && outputMeta.metrics.mape !== undefined
                          ? `, MAPE ${(outputMeta.metrics.mape * 100).toFixed(2)}%`
                          : ''}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-xs text-muted-foreground">No runs yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Forecast Output</CardTitle>
            <CardDescription>
              Combined actuals and model predictions (including historical fit + future horizon when available).
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
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
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
