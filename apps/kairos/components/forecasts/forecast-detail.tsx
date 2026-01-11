'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { Download, Loader2, Play, RefreshCw, Trash2, TrendingUp, X } from 'lucide-react';
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
import type { ForecastDetail, ForecastModel, ForecastOutput, ForecastOutputPoint, ForecastStatus } from '@/types/kairos';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

function modelFromParams(value: unknown): ForecastModel | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  return rec.model === 'PROPHET' || rec.model === 'ETS' ? rec.model : null;
}

export function ForecastDetailView({ forecastId }: { forecastId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [runAsOpen, setRunAsOpen] = useState(false);
  const [runAsModel, setRunAsModel] = useState<ForecastModel>('PROPHET');

  const [runAsProphetIntervalWidth, setRunAsProphetIntervalWidth] = useState('0.8');
  const [runAsProphetUncertaintySamples, setRunAsProphetUncertaintySamples] = useState('200');

  const [runAsEtsSeasonLength, setRunAsEtsSeasonLength] = useState('7');
  const [runAsEtsIntervalLevel, setRunAsEtsIntervalLevel] = useState('0.8');
  const [runAsEtsSpec, setRunAsEtsSpec] = useState('');

  const forecastQuery = useQuery({
    queryKey: FORECAST_DETAIL_KEY(forecastId),
    queryFn: async () => fetchJson<ForecastDetailResponse>(`/api/v1/forecasts/${forecastId}`),
    refetchInterval: (query) => {
      const data = query.state.data as ForecastDetailResponse | undefined;
      return data?.forecast?.status === 'RUNNING' ? 2000 : false;
    },
    refetchIntervalInBackground: true,
  });

  type RunForecastInput = { model?: ForecastModel; config?: unknown };

  const runMutation = useMutation({
    mutationFn: async (payload: RunForecastInput) =>
      fetchJson<RunForecastResponse>(`/api/v1/forecasts/${forecastId}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
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
      setRunAsOpen(false);
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

  const deleteMutation = useMutation({
    mutationFn: async () => fetchJson(`/api/v1/forecasts/${forecastId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Forecast deleted');
      setDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: FORECASTS_QUERY_KEY });
      router.push('/forecasts');
    },
    onError: (error) => {
      toast.error('Delete failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const forecast = forecastQuery.data?.forecast ?? null;
  const runs = useMemo(() => forecast?.runs ?? [], [forecast?.runs]);
  const latestRun = forecast?.latestRun ?? null;
  const latestSuccessfulRun = forecast?.latestSuccessfulRun ?? null;

  useEffect(() => {
    if (!forecast) {
      setSelectedRunId(null);
      return;
    }

    if (selectedRunId && runs.some((run) => run.id === selectedRunId)) {
      return;
    }

    if (latestSuccessfulRun) {
      setSelectedRunId(latestSuccessfulRun.id);
      return;
    }

    if (latestRun) {
      setSelectedRunId(latestRun.id);
      return;
    }

    setSelectedRunId(null);
  }, [forecast, latestRun, latestSuccessfulRun, runs, selectedRunId]);

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null;
    return runs.find((run) => run.id === selectedRunId) ?? null;
  }, [runs, selectedRunId]);

  const chartOutput = selectedRun?.status === 'SUCCESS' ? selectedRun.output : null;
  const outputParsed = useMemo(() => parseForecastOutput(chartOutput), [chartOutput]);

  useEffect(() => {
    if (!forecast || !runAsOpen) return;

    setRunAsModel(forecast.model);
    setRunAsProphetIntervalWidth('0.8');
    setRunAsProphetUncertaintySamples('200');
    setRunAsEtsIntervalLevel('0.8');
    setRunAsEtsSpec('');
    setRunAsEtsSeasonLength(forecast.series.granularity === 'WEEKLY' ? '52' : '7');
  }, [forecast, runAsOpen]);

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

  const runDate = selectedRun?.ranAt ? new Date(selectedRun.ranAt) : null;
  const selectedRunLabel =
    runDate && !Number.isNaN(runDate.getTime())
      ? formatDistanceToNowStrict(runDate, { addSuffix: true })
      : null;

  const outputMeta = outputParsed?.meta ?? null;
  const viewedModel = outputParsed?.model ?? modelFromParams(selectedRun?.params);

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="text-section-header">Forecast Detail</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h1">{forecast.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Default: {forecast.model}</Badge>
              {viewedModel && viewedModel !== forecast.model ? (
                <Badge variant="outline">Viewing: {viewedModel}</Badge>
              ) : null}
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
          <Button asChild variant="outline" className="gap-2">
            <a
              href={withAppBasePath(`/api/v1/forecasts/${encodeURIComponent(forecast.id)}/export`)}
              download
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </a>
          </Button>

          <Dialog open={runAsOpen} onOpenChange={setRunAsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                disabled={forecast.status === 'RUNNING'}
                className="gap-2"
              >
                <Play className="h-4 w-4" aria-hidden />
                Run model…
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Run model</DialogTitle>
                <DialogDescription>
                  Run a different model on the same series + horizon. This does not change the default model.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Model</div>
                  <Select value={runAsModel} onValueChange={(value) => setRunAsModel(value as ForecastModel)}>
                    <SelectTrigger aria-label="Forecast model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROPHET">PROPHET</SelectItem>
                      <SelectItem value="ETS">ETS (Auto)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {runAsModel === 'PROPHET' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Interval width</div>
                      <Input
                        value={runAsProphetIntervalWidth}
                        onChange={(event) => setRunAsProphetIntervalWidth(event.target.value)}
                        type="number"
                        step="0.05"
                        min={0.5}
                        max={0.99}
                        aria-label="Prophet interval width"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Uncertainty samples</div>
                      <Input
                        value={runAsProphetUncertaintySamples}
                        onChange={(event) => setRunAsProphetUncertaintySamples(event.target.value)}
                        type="number"
                        step={1}
                        min={0}
                        max={2000}
                        aria-label="Prophet uncertainty samples"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Season length</div>
                      <Input
                        value={runAsEtsSeasonLength}
                        onChange={(event) => setRunAsEtsSeasonLength(event.target.value)}
                        type="number"
                        step={1}
                        min={1}
                        max={365}
                        aria-label="ETS season length"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Interval level</div>
                      <Input
                        value={runAsEtsIntervalLevel}
                        onChange={(event) => setRunAsEtsIntervalLevel(event.target.value)}
                        type="number"
                        step="0.05"
                        min={0.5}
                        max={0.99}
                        aria-label="ETS interval level"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Spec</div>
                      <Input value={runAsEtsSpec} onChange={(event) => setRunAsEtsSpec(event.target.value)} aria-label="ETS spec" />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => setRunAsOpen(false)} disabled={runMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const config =
                      runAsModel === 'ETS'
                        ? {
                            seasonLength: parseOptionalInt(runAsEtsSeasonLength) ?? undefined,
                            spec: runAsEtsSpec.trim() || undefined,
                            intervalLevel:
                              runAsEtsIntervalLevel.trim() === ''
                                ? null
                                : (parseInterval(runAsEtsIntervalLevel) ?? undefined),
                          }
                        : {
                            intervalWidth: parseInterval(runAsProphetIntervalWidth) ?? undefined,
                            uncertaintySamples: parseOptionalInt(runAsProphetUncertaintySamples) ?? undefined,
                          };

                    const configCleaned = Object.fromEntries(
                      Object.entries(config).filter(([, value]) => value !== undefined),
                    );

                    void runMutation.mutateAsync({
                      model: runAsModel,
                      config: Object.keys(configCleaned).length > 0 ? configCleaned : undefined,
                    });
                  }}
                  disabled={runMutation.isPending || forecast.status === 'RUNNING'}
                  className="gap-2"
                >
                  {runMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden />
                  )}
                  Run
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            onClick={() => void runMutation.mutateAsync({})}
            disabled={runMutation.isPending || forecast.status === 'RUNNING'}
            className="gap-2"
          >
            {runMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            Run default
          </Button>

          {forecast.status === 'RUNNING' ? (
            <Button
              variant="destructive"
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
          ) : null}

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                disabled={deleteMutation.isPending || forecast.status === 'RUNNING'}
                className="gap-2 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete forecast?</DialogTitle>
                <DialogDescription>
                  This permanently deletes <span className="font-medium">{forecast.name}</span> and its run history.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void deleteMutation.mutateAsync()}
                  disabled={deleteMutation.isPending}
                  className="gap-2"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                  Delete forecast
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
            <CardTitle>Selected Run</CardTitle>
            <CardDescription>Pick a run below to compare models.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground">Latest run</div>
              <div className="text-xs text-muted-foreground">{lastRunLabel}</div>
            </div>
            {selectedRun ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground">Run status</div>
                  <Badge variant={selectedRun.status === 'FAILED' ? 'destructive' : 'secondary'}>
                    {selectedRun.status}
                  </Badge>
                </div>
                {selectedRunLabel ? (
                  <div className="flex items-center justify-between">
                    <div className="text-muted-foreground">Ran</div>
                    <div className="text-xs text-muted-foreground">{selectedRunLabel}</div>
                  </div>
                ) : null}
                {selectedRun.errorMessage ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100">
                    {selectedRun.errorMessage}
                  </div>
                ) : null}
                {outputMeta ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div>
                      Model meta: horizon {outputMeta.horizon}, history {outputMeta.historyCount}
                      {outputMeta.intervalLevel ? `, interval ${(outputMeta.intervalLevel * 100).toFixed(0)}%` : ''}
                    </div>
                    {outputMeta.timings ? (
                      <div>
                        Timings: load {formatDurationMs(outputMeta.timings.loadMs)}, model{' '}
                        {formatDurationMs(outputMeta.timings.modelMs)}, save {formatDurationMs(outputMeta.timings.saveMs)}, total{' '}
                        {formatDurationMs(outputMeta.timings.totalMs)}
                      </div>
                    ) : null}
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
        <CardHeader>
          <CardTitle className="text-base">Run History</CardTitle>
          <CardDescription>Select a run to view its output and compare models.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.length > 0 ? (
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ran</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const model = modelFromParams(run.params);
                    const ranAt = new Date(run.ranAt);
                    const ranLabel = Number.isNaN(ranAt.getTime())
                      ? formatIsoDate(run.ranAt)
                      : formatDistanceToNowStrict(ranAt, { addSuffix: true });

                    const statusVariant =
                      run.status === 'SUCCESS' ? 'success' : run.status === 'FAILED' ? 'destructive' : 'secondary';

                    return (
                      <TableRow
                        key={run.id}
                        className={cn(
                          selectedRunId === run.id && 'bg-slate-50/80 dark:bg-white/5 hover:bg-slate-50/80 dark:hover:bg-white/5',
                        )}
                      >
                        <TableCell className="font-medium">{model ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant}>{run.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ranLabel}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRunId(run.id)}
                            disabled={selectedRunId === run.id}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No runs yet.</div>
          )}

          {selectedRun && selectedRun.status !== 'SUCCESS' ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Selected run has no forecast output yet.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Forecast Visualization Chart */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forecast Visualization</CardTitle>
            <CardDescription>
              Time series with model predictions and{' '}
              {outputMeta?.intervalLevel
                ? `${(outputMeta.intervalLevel * 100).toFixed(0)}% prediction interval`
                : 'no prediction interval'}
              .
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
