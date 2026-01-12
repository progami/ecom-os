'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowRight, BarChart3, Download, Loader2, RefreshCw, Table as TableIcon, TrendingUp } from 'lucide-react';
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
import type { ForecastModel, ForecastStatus, TimeSeriesGranularity, TimeSeriesSource } from '@/types/kairos';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';

type TimeSeriesPoint = {
  t: string;
  value: number;
};

type ForecastSummary = {
  id: string;
  name: string;
  model: ForecastModel;
  status: ForecastStatus;
};

type TimeSeriesDetail = {
  id: string;
  name: string;
  source: TimeSeriesSource;
  granularity: TimeSeriesGranularity;
  query: string | null;
  geo: string | null;
  sourceMeta: unknown;
  createdAt: string;
  updatedAt: string;
  points: TimeSeriesPoint[];
  forecasts: ForecastSummary[];
};

type TimeSeriesDetailResponse = {
  series: TimeSeriesDetail;
};

const SERIES_DETAIL_KEY = (seriesId: string) => ['kairos', 'time-series', seriesId] as const;

function formatIsoDate(value: string) {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

export function DataSourceDetail({ seriesId }: { seriesId: string }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const seriesQuery = useQuery({
    queryKey: SERIES_DETAIL_KEY(seriesId),
    queryFn: async () => fetchJson<TimeSeriesDetailResponse>(`/api/v1/time-series/${seriesId}`),
  });

  const series = seriesQuery.data?.series ?? null;

  const columns = useMemo<ColumnDef<TimeSeriesPoint>[]>(
    () => [
      {
        accessorKey: 't',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">{formatIsoDate(row.original.t)}</span>
        ),
      },
      {
        accessorKey: 'value',
        header: 'Value',
        cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.value}</span>,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: series?.points ?? [],
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

  if (seriesQuery.isLoading) {
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

  if (!series) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">Data source not found.</div>
        <Button asChild variant="outline">
          <Link href="/sources">Back</Link>
        </Button>
      </div>
    );
  }

  const updatedDate = new Date(series.updatedAt);
  const updatedLabel = !Number.isNaN(updatedDate.getTime())
    ? formatDistanceToNowStrict(updatedDate, { addSuffix: true })
    : null;

  const dateRange = series.points.length > 0
    ? `${formatIsoDate(series.points[0].t)} to ${formatIsoDate(series.points[series.points.length - 1].t)}`
    : 'No data';

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{series.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{series.source === 'GOOGLE_TRENDS' ? 'Google Trends' : series.source === 'CSV_UPLOAD' ? 'CSV' : series.source}</Badge>
              <Badge variant="outline">{series.granularity}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {series.query && (
              <span>
                <span className="font-medium text-slate-600 dark:text-slate-400">Query:</span> {series.query}
              </span>
            )}
            {series.geo && (
              <span>
                <span className="font-medium text-slate-600 dark:text-slate-400">Region:</span> {series.geo}
              </span>
            )}
            <span>
              <span className="font-medium text-slate-600 dark:text-slate-400">Points:</span> {series.points.length}
            </span>
            {updatedLabel && (
              <span>
                <span className="font-medium text-slate-600 dark:text-slate-400">Updated:</span> {updatedLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/sources">Back</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={withAppBasePath(`/api/v1/time-series/${encodeURIComponent(series.id)}/export`)} download>
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </a>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link href={`/forecasts?seriesId=${series.id}`}>
              <ArrowRight className="h-4 w-4" aria-hidden />
              Create Forecast
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chart" className="w-full">
        <TabsList>
          <TabsTrigger value="chart" className="gap-2">
            <TrendingUp className="h-4 w-4" aria-hidden />
            Chart
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-2">
            <TableIcon className="h-4 w-4" aria-hidden />
            Data
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-2">
            <BarChart3 className="h-4 w-4" aria-hidden />
            Info
          </TabsTrigger>
        </TabsList>

        {/* Chart Tab */}
        <TabsContent value="chart">
          {series.points.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.02]">
              <TimeSeriesChart data={series.points} granularity={series.granularity} />
            </div>
          ) : (
            <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10">
              <div className="text-center text-sm text-muted-foreground">
                <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No data points in this series.</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="table">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">Time Series Data</CardTitle>
                <CardDescription>{dateRange}</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Input
                    value={globalFilter ?? ''}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    placeholder="Search dates..."
                    aria-label="Search data points"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void seriesQuery.refetch()}
                  disabled={seriesQuery.isFetching}
                  className="gap-2"
                >
                  {seriesQuery.isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-0 sm:px-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                          No data points.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-0">
                <div className="text-xs text-muted-foreground">{table.getFilteredRowModel().rows.length} point(s)</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info">
          <div className="space-y-6">
            {/* Statistics */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Statistics</h3>
              <div className="grid gap-4 sm:grid-cols-4">
                <StatCard label="Points" value={series.points.length} />
                <StatCard
                  label="Min"
                  value={series.points.length > 0 ? Math.min(...series.points.map((p) => p.value)).toFixed(1) : '—'}
                />
                <StatCard
                  label="Max"
                  value={series.points.length > 0 ? Math.max(...series.points.map((p) => p.value)).toFixed(1) : '—'}
                />
                <StatCard
                  label="Average"
                  value={
                    series.points.length > 0
                      ? (series.points.reduce((sum, p) => sum + p.value, 0) / series.points.length).toFixed(1)
                      : '—'
                  }
                />
              </div>
            </div>

            {/* Used in Forecasts */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Used in Forecasts</h3>
              {series.forecasts.length > 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      {series.forecasts.map((forecast) => (
                        <Link
                          key={forecast.id}
                          href={`/forecasts/${forecast.id}`}
                          className="flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{forecast.name}</span>
                            <Badge variant="secondary">{forecast.model}</Badge>
                          </div>
                          <StatusBadge status={forecast.status} />
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-white/10">
                  <p className="text-sm text-muted-foreground">This data source is not used in any forecasts yet.</p>
                  <Button asChild size="sm" className="mt-3 gap-2">
                    <Link href={`/forecasts?seriesId=${series.id}`}>
                      <ArrowRight className="h-4 w-4" aria-hidden />
                      Create Forecast
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Source Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Source Details</h3>
              <Card>
                <CardContent className="pt-6">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Source</dt>
                      <dd className="mt-1">
                        <Badge variant="outline">{series.source === 'GOOGLE_TRENDS' ? 'Google Trends' : series.source}</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Granularity</dt>
                      <dd className="mt-1">
                        <Badge variant="outline">{series.granularity}</Badge>
                      </dd>
                    </div>
                    {series.query && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-medium text-muted-foreground">Query</dt>
                        <dd className="mt-1 text-sm">{series.query}</dd>
                      </div>
                    )}
                    {series.geo && (
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground">Region</dt>
                        <dd className="mt-1 text-sm">{series.geo}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Date Range</dt>
                      <dd className="mt-1 text-sm">{dateRange}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Created</dt>
                      <dd className="mt-1 text-sm">{formatIsoDate(series.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Updated</dt>
                      <dd className="mt-1 text-sm">{updatedLabel ?? formatIsoDate(series.updatedAt)}</dd>
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
