'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpDown, Download, Loader2, Plus } from 'lucide-react';
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
import type { TimeSeriesListItem } from '@/types/chronos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type TimeSeriesResponse = {
  series: TimeSeriesListItem[];
};

type GoogleTrendsImportResponse = {
  series: TimeSeriesListItem;
};

type GoogleTrendsImportInput = {
  keyword: string;
  geo: string;
  startDate: string;
  endDate: string;
  name: string;
};

const SERIES_QUERY_KEY = ['chronos', 'time-series'] as const;

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function defaultStartDateInput() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 2);
  return date.toISOString().slice(0, 10);
}

export function GoogleTrendsPanel() {
  const queryClient = useQueryClient();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const [keyword, setKeyword] = useState('');
  const [geo, setGeo] = useState('');
  const [startDate, setStartDate] = useState(defaultStartDateInput);
  const [endDate, setEndDate] = useState(todayDateInput);
  const [name, setName] = useState('');

  const seriesQuery = useQuery({
    queryKey: SERIES_QUERY_KEY,
    queryFn: async () => fetchJson<TimeSeriesResponse>('/api/v1/time-series'),
  });

  const importMutation = useMutation({
    mutationFn: async (payload: GoogleTrendsImportInput) => {
      return fetchJson<GoogleTrendsImportResponse>('/api/v1/time-series/google-trends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          keyword: payload.keyword,
          geo: payload.geo || null,
          startDate: payload.startDate,
          endDate: payload.endDate || null,
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google Trends</CardTitle>
          <CardDescription>
            Import interest-over-time data for a keyword. Chronos stores the resulting time series in its own database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Keyword</div>
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="e.g. collagen peptides"
                aria-label="Google Trends keyword"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Geo (optional)</div>
              <Input
                value={geo}
                onChange={(event) => setGeo(event.target.value)}
                placeholder="e.g. US"
                aria-label="Google Trends geo"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Start date</div>
              <Input
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                aria-label="Google Trends start date"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">End date</div>
              <Input
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                aria-label="Google Trends end date"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">Name (optional)</div>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Leave blank to auto-name"
                aria-label="Time series name"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void seriesQuery.refetch();
              }}
              disabled={isBusy}
              className="gap-2"
            >
              {seriesQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              Refresh
            </Button>
            <Button
              onClick={() => {
                void importMutation.mutateAsync({
                  keyword,
                  geo,
                  startDate,
                  endDate,
                  name,
                });
              }}
              disabled={!keyword.trim() || !startDate || importMutation.isPending}
              className="gap-2"
            >
              {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              Import
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Imported Series</CardTitle>
            <CardDescription>Use an imported series to create a Prophet forecast.</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Input
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search series…"
              aria-label="Search time series"
            />
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
                      No Google Trends series yet.
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
    </div>
  );
}

