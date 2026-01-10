'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronUp, Download, Loader2, Plus } from 'lucide-react';
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

import { fetchJson } from '@/lib/api/client';
import type { TimeSeriesListItem } from '@/types/kairos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type TimeSeriesResponse = {
  series: TimeSeriesListItem[];
};

type GoogleTrendsImportResponse = {
  series: TimeSeriesListItem;
};

type GoogleTrendsTimeRange = 'PAST_12_MONTHS' | 'PAST_2_YEARS' | 'PAST_5_YEARS' | 'ALL_TIME';

type GoogleTrendsImportInput = {
  keyword: string;
  geo: string;
  timeRange: GoogleTrendsTimeRange;
  name: string;
};

const SERIES_QUERY_KEY = ['kairos', 'time-series'] as const;

const GOOGLE_TRENDS_TIME_RANGE_OPTIONS: Array<{ value: GoogleTrendsTimeRange; label: string }> = [
  { value: 'PAST_12_MONTHS', label: 'Past 12 months' },
  { value: 'PAST_2_YEARS', label: 'Past 2 years' },
  { value: 'PAST_5_YEARS', label: 'Past 5 years' },
  { value: 'ALL_TIME', label: 'All time (2004–present)' },
];

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolveStartDate(timeRange: GoogleTrendsTimeRange, now: Date) {
  if (timeRange === 'ALL_TIME') {
    return new Date('2004-01-01T00:00:00.000Z');
  }

  const start = new Date(now);
  switch (timeRange) {
    case 'PAST_12_MONTHS':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'PAST_2_YEARS':
      start.setFullYear(start.getFullYear() - 2);
      break;
    case 'PAST_5_YEARS':
      start.setFullYear(start.getFullYear() - 5);
      break;
    default:
      break;
  }
  return start;
}

export function GoogleTrendsPanel() {
  const queryClient = useQueryClient();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const [keyword, setKeyword] = useState('');
  const [geo, setGeo] = useState('');
  const [timeRange, setTimeRange] = useState<GoogleTrendsTimeRange>('PAST_2_YEARS');
  const [name, setName] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const seriesQuery = useQuery({
    queryKey: SERIES_QUERY_KEY,
    queryFn: async () => fetchJson<TimeSeriesResponse>('/api/v1/time-series'),
  });

  const importMutation = useMutation({
    mutationFn: async (payload: GoogleTrendsImportInput) => {
      const now = new Date();
      const startDate = toDateInput(resolveStartDate(payload.timeRange, now));

      return fetchJson<GoogleTrendsImportResponse>('/api/v1/time-series/google-trends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          keyword: payload.keyword,
          geo: payload.geo || null,
          startDate,
          endDate: null,
          name: payload.name || undefined,
        }),
      });
    },
    onSuccess: async (data) => {
      toast.success('Google Trends imported', {
        description: data.series.name,
      });
      setKeyword('');
      setGeo('');
      setName('');
      await queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEY });
    },
    onError: (error) => {
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const data = useMemo(() => {
    const rows = seriesQuery.data?.series ?? [];
    return rows.filter((row) => row.source === 'GOOGLE_TRENDS');
  }, [seriesQuery.data]);

  const columns = useMemo<ColumnDef<TimeSeriesListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Series
            <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900 dark:text-slate-100">
              {row.original.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{row.original.query}</span>
              {row.original.geo ? (
                <>
                  <span>•</span>
                  <span>{row.original.geo}</span>
                </>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'granularity',
        header: 'Granularity',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[11px]">
            {row.original.granularity}
          </Badge>
        ),
      },
      {
        accessorKey: 'pointsCount',
        header: 'Points',
        cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.pointsCount}</span>,
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => {
          const value = row.original.updatedAt;
          const date = value ? new Date(value) : null;
          if (!date || Number.isNaN(date.getTime())) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNowStrict(date, { addSuffix: true })}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/forecasts?seriesId=${encodeURIComponent(row.original.id)}`}>
                Create forecast
              </Link>
            </Button>
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

  const isBusy = seriesQuery.isFetching || importMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Imported Series - Primary content */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Imported Series</CardTitle>
            <CardDescription>Use an imported series to create a Prophet forecast.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Input
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search series…"
              aria-label="Search time series"
              className="w-48"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void seriesQuery.refetch();
              }}
              disabled={isBusy}
            >
              {seriesQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            </Button>
            <Button
              size="sm"
              onClick={() => setIsImportOpen(!isImportOpen)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Import
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
                {seriesQuery.isLoading ? (
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
                      No series imported yet. Click Import to add Google Trends data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <div className="text-xs text-muted-foreground">
              {table.getFilteredRowModel().rows.length} series
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

      {/* Google Trends Import - Collapsible */}
      {isImportOpen && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal-500/10 dark:bg-brand-cyan/10">
                  <Download className="h-4 w-4 text-brand-teal-600 dark:text-brand-cyan" aria-hidden />
                </div>
                <CardTitle className="text-sm">Import from Google Trends</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsImportOpen(false)}
                className="h-8 w-8 p-0"
              >
                <ChevronUp className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Keyword
                </label>
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="e.g. collagen peptides"
                  aria-label="Google Trends keyword"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Geo <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Input
                  value={geo}
                  onChange={(event) => setGeo(event.target.value)}
                  placeholder="e.g. US"
                  aria-label="Google Trends geo"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Time range
                </label>
                <Select value={timeRange} onValueChange={(value) => setTimeRange(value as GoogleTrendsTimeRange)}>
                  <SelectTrigger aria-label="Google Trends time range" className="h-9">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    {GOOGLE_TRENDS_TIME_RANGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Auto-generated if blank"
                  aria-label="Time series name"
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  void importMutation.mutateAsync({
                    keyword,
                    geo,
                    timeRange,
                    name,
                  });
                }}
                disabled={!keyword.trim() || importMutation.isPending}
                className="gap-2"
                size="sm"
              >
                {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                Import Series
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
