'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpDown, ExternalLink, Loader2, Play, Plus, RefreshCw } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ForecastListItem, ForecastModel, ForecastStatus, TimeSeriesListItem } from '@/types/kairos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const FORECASTS_QUERY_KEY = ['kairos', 'forecasts'] as const;
const SERIES_QUERY_KEY = ['kairos', 'time-series'] as const;

type ForecastsResponse = {
  forecasts: ForecastListItem[];
};

type TimeSeriesResponse = {
  series: TimeSeriesListItem[];
};

type CreateForecastResponse = {
  forecast: ForecastListItem;
  run?: unknown;
};

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

function parseHorizon(value: string) {
  const horizon = Number(value);
  if (!Number.isFinite(horizon) || !Number.isInteger(horizon)) {
    return null;
  }
  if (horizon < 1 || horizon > 3650) {
    return null;
  }
  return horizon;
}

function parseInterval(value: string) {
  const interval = Number(value);
  if (!Number.isFinite(interval)) {
    return null;
  }
  if (interval <= 0 || interval >= 1) {
    return null;
  }
  return interval;
}

function parseOptionalInt(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

function RunForecastButton({ forecast }: { forecast: ForecastListItem }) {
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: async () =>
      fetchJson<{ run: { status: string; errorMessage: string | null } }>(
        `/api/v1/forecasts/${forecast.id}/run`,
        { method: 'POST' },
      ),
    onSuccess: async (data) => {
      const status = String(data.run.status).toUpperCase();
      if (status === 'FAILED') {
        toast.error('Forecast run failed', { description: data.run.errorMessage ?? undefined });
      } else if (status === 'RUNNING') {
        toast.success('Forecast run started', { description: forecast.name });
      } else {
        toast.success('Forecast run complete', { description: forecast.name });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: FORECASTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['kairos', 'forecast', forecast.id] }),
      ]);
    },
    onError: (error) => {
      toast.error('Run failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  return (
    <Button
      size="sm"
      onClick={() => void runMutation.mutateAsync()}
      disabled={forecast.status === 'RUNNING' || runMutation.isPending}
      className="gap-2"
    >
      {runMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Play className="h-4 w-4" aria-hidden />
      )}
      Run
    </Button>
  );
}

export function ForecastsTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSeriesId, setCreateSeriesId] = useState('');
  const [createHorizon, setCreateHorizon] = useState('26');
  const [createModel, setCreateModel] = useState<ForecastModel>('PROPHET');

  const [prophetIntervalWidth, setProphetIntervalWidth] = useState('0.8');
  const [prophetUncertaintySamples, setProphetUncertaintySamples] = useState('200');

  const [etsSeasonLength, setEtsSeasonLength] = useState('7');
  const [etsSpec, setEtsSpec] = useState('ZZZ');
  const [etsIntervalLevel, setEtsIntervalLevel] = useState('0.8');

  useEffect(() => {
    const seriesId = searchParams.get('seriesId');
    if (!seriesId) return;
    setCreateSeriesId(seriesId);
    setCreateOpen(true);
  }, [searchParams]);

  const seriesQuery = useQuery({
    queryKey: SERIES_QUERY_KEY,
    queryFn: async () => fetchJson<TimeSeriesResponse>('/api/v1/time-series'),
  });

  const forecastsQuery = useQuery({
    queryKey: FORECASTS_QUERY_KEY,
    queryFn: async () => fetchJson<ForecastsResponse>('/api/v1/forecasts'),
    refetchInterval: (query) => {
      const data = query.state.data as ForecastsResponse | undefined;
      return data?.forecasts?.some((forecast) => forecast.status === 'RUNNING') ? 2000 : false;
    },
    refetchIntervalInBackground: true,
  });

  const selectedSeries = useMemo(() => {
    const series = seriesQuery.data?.series ?? [];
    return series.find((s) => s.id === createSeriesId) ?? null;
  }, [seriesQuery.data, createSeriesId]);

  useEffect(() => {
    if (!selectedSeries) return;
    if (selectedSeries.granularity === 'WEEKLY') {
      setEtsSeasonLength('52');
    } else {
      setEtsSeasonLength('7');
    }
  }, [selectedSeries]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const horizon = parseHorizon(createHorizon);
      if (!horizon) {
        throw new Error('Horizon must be an integer between 1 and 3650.');
      }

      const name =
        createName.trim() ||
        (selectedSeries ? `${selectedSeries.name} (${createModel})` : `${createModel} Forecast`);

      const config =
        createModel === 'ETS'
          ? {
              seasonLength: parseOptionalInt(etsSeasonLength) ?? undefined,
              spec: etsSpec.trim() || undefined,
              intervalLevel: etsIntervalLevel.trim() === '' ? null : (parseInterval(etsIntervalLevel) ?? undefined),
            }
          : {
              intervalWidth: parseInterval(prophetIntervalWidth) ?? undefined,
              uncertaintySamples: parseOptionalInt(prophetUncertaintySamples) ?? undefined,
            };

      const configCleaned = Object.fromEntries(
        Object.entries(config).filter(([, value]) => value !== undefined),
      );

      return fetchJson<CreateForecastResponse>('/api/v1/forecasts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          seriesId: createSeriesId,
          model: createModel,
          horizon,
          runNow: true,
          config: Object.keys(configCleaned).length > 0 ? configCleaned : undefined,
        }),
      });
    },
    onSuccess: async (data) => {
      toast.success('Forecast created', { description: data.forecast.name });
      setCreateOpen(false);
      setCreateName('');
      setCreateHorizon('26');
      setCreateModel('PROPHET');
      setProphetIntervalWidth('0.8');
      setProphetUncertaintySamples('200');
      await queryClient.invalidateQueries({ queryKey: FORECASTS_QUERY_KEY });
      router.push(`/forecasts/${data.forecast.id}`);
    },
    onError: (error) => {
      toast.error('Create failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const data = forecastsQuery.data?.forecasts ?? [];

  const columns = useMemo<ColumnDef<ForecastListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Forecast
            <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900 dark:text-slate-100">
              {row.original.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{row.original.series.name}</span>
              <span>•</span>
              <span>{row.original.series.granularity}</span>
              <span>•</span>
              <span>{row.original.horizon} horizon</span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'model',
        header: 'Model',
        cell: ({ row }) => <span className="text-sm">{row.original.model}</span>,
      },
      {
        accessorKey: 'lastRunAt',
        header: 'Last run',
        cell: ({ row }) => {
          const value = row.original.lastRunAt;
          if (!value) return <span className="text-xs text-muted-foreground">—</span>;
          const date = new Date(value);
          return (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNowStrict(date, { addSuffix: true })}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant="outline" className={cn('capitalize', statusTone(row.original.status))}>
            {row.original.status.toLowerCase()}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/forecasts/${row.original.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                Open
              </Link>
            </Button>
            <RunForecastButton forecast={row.original} />
          </div>
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
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

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Forecasts</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Input
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search forecasts…"
              aria-label="Search forecasts"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void forecastsQuery.refetch()}
              disabled={forecastsQuery.isFetching}
              className="gap-2"
            >
              {forecastsQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" aria-hidden />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Forecast</DialogTitle>
                  <DialogDescription>
                    Create a forecast from an existing time series.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Time series</div>
                    <Select value={createSeriesId} onValueChange={setCreateSeriesId}>
                      <SelectTrigger aria-label="Select a time series">
                        <SelectValue placeholder="Select a series" />
                      </SelectTrigger>
                      <SelectContent>
                        {(seriesQuery.data?.series ?? []).map((series) => (
                          <SelectItem key={series.id} value={series.id}>
                            {series.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {seriesQuery.isLoading ? (
                      <div className="text-xs text-muted-foreground">Loading series…</div>
                    ) : (seriesQuery.data?.series?.length ?? 0) === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        No time series yet. Import one from{' '}
                        <Link href="/sources" className="underline underline-offset-4">
                          Data Sources
                        </Link>
                        .
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Name (optional)</div>
                    <Input
                      value={createName}
                      onChange={(event) => setCreateName(event.target.value)}
                      placeholder={selectedSeries ? `${selectedSeries.name} (${createModel})` : `${createModel} Forecast`}
                      aria-label="Forecast name"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Model</div>
                      <Select value={createModel} onValueChange={(value) => setCreateModel(value as ForecastModel)}>
                        <SelectTrigger aria-label="Forecast model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PROPHET">PROPHET</SelectItem>
                          <SelectItem value="ETS">ETS (Auto)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Horizon (periods)</div>
                      <Input
                        value={createHorizon}
                        onChange={(event) => setCreateHorizon(event.target.value)}
                        type="number"
                        min={1}
                        max={3650}
                        step={1}
                        aria-label="Forecast horizon"
                      />
                      <div className="text-xs text-muted-foreground">
                        Horizon is measured in series periods ({selectedSeries?.granularity ?? 'DAILY'}).
                      </div>
                    </div>
                  </div>

                  {createModel === 'PROPHET' ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Interval width</div>
                        <Input
                          value={prophetIntervalWidth}
                          onChange={(event) => setProphetIntervalWidth(event.target.value)}
                          type="number"
                          step="0.05"
                          min={0.5}
                          max={0.99}
                          aria-label="Prophet interval width"
                        />
                        <div className="text-xs text-muted-foreground">Common values: 0.8, 0.9, 0.95.</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Uncertainty samples</div>
                        <Input
                          value={prophetUncertaintySamples}
                          onChange={(event) => setProphetUncertaintySamples(event.target.value)}
                          type="number"
                          step={1}
                          min={0}
                          max={2000}
                          aria-label="Prophet uncertainty samples"
                        />
                        <div className="text-xs text-muted-foreground">Set to 0 to disable intervals.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Season length</div>
                        <Input
                          value={etsSeasonLength}
                          onChange={(event) => setEtsSeasonLength(event.target.value)}
                          type="number"
                          step={1}
                          min={1}
                          max={365}
                          aria-label="ETS season length"
                        />
                        <div className="text-xs text-muted-foreground">
                          Defaults to 7 for daily series, 52 for weekly.
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Interval level</div>
                        <Input
                          value={etsIntervalLevel}
                          onChange={(event) => setEtsIntervalLevel(event.target.value)}
                          type="number"
                          step="0.05"
                          min={0.5}
                          max={0.99}
                          aria-label="ETS interval level"
                        />
                        <div className="text-xs text-muted-foreground">Common values: 0.8, 0.9, 0.95.</div>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Spec</div>
                        <Input
                          value={etsSpec}
                          onChange={(event) => setEtsSpec(event.target.value)}
                          aria-label="ETS spec"
                        />
                        <div className="text-xs text-muted-foreground">Use ZZZ for full auto selection.</div>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    disabled={createMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void createMutation.mutateAsync()}
                    disabled={
                      createMutation.isPending ||
                      !createSeriesId ||
                      !parseHorizon(createHorizon)
                    }
                    className="gap-2"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden />
                    )}
                    Create & Run
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
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
              {forecastsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length ? (
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
                    No forecasts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <div className="text-xs text-muted-foreground">
            {table.getFilteredRowModel().rows.length} forecast(s)
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
  );
}
