'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  Compass,
  Database,
  Download,
  Leaf,
  Loader2,
  Plus,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ============================================================================
// Types
// ============================================================================

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

type DataSourceType = 'google-trends' | 'brand-analytics' | 'marketplace-guidance' | 'jungle-scout';

type DataSource = {
  id: DataSourceType;
  name: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  color: string;
  bgLight: string;
  bgDark: string;
};

// ============================================================================
// Constants
// ============================================================================

const SERIES_QUERY_KEY = ['kairos', 'time-series'] as const;

const GOOGLE_TRENDS_TIME_RANGE_OPTIONS: Array<{ value: GoogleTrendsTimeRange; label: string }> = [
  { value: 'PAST_12_MONTHS', label: 'Past 12 months' },
  { value: 'PAST_2_YEARS', label: 'Past 2 years' },
  { value: 'PAST_5_YEARS', label: 'Past 5 years' },
  { value: 'ALL_TIME', label: 'All time (2004-present)' },
];

const DATA_SOURCES: DataSource[] = [
  {
    id: 'google-trends',
    name: 'Google Trends',
    description: 'Search interest over time for any keyword',
    icon: <TrendingUp className="h-5 w-5" />,
    available: true,
    color: 'text-brand-teal-600 dark:text-brand-cyan',
    bgLight: 'bg-brand-teal-500/10',
    bgDark: 'dark:bg-brand-cyan/10',
  },
  {
    id: 'brand-analytics',
    name: 'Brand Analytics',
    description: 'Amazon search frequency and conversion data',
    icon: <BarChart3 className="h-5 w-5" />,
    available: false,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-500/10',
    bgDark: 'dark:bg-amber-500/10',
  },
  {
    id: 'marketplace-guidance',
    name: 'Marketplace Guidance',
    description: 'Category trends and opportunity signals',
    icon: <Compass className="h-5 w-5" />,
    available: false,
    color: 'text-violet-600 dark:text-violet-400',
    bgLight: 'bg-violet-500/10',
    bgDark: 'dark:bg-violet-500/10',
  },
  {
    id: 'jungle-scout',
    name: 'Jungle Scout',
    description: 'Product research and sales estimates',
    icon: <Leaf className="h-5 w-5" />,
    available: false,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-500/10',
    bgDark: 'dark:bg-emerald-500/10',
  },
];

// ============================================================================
// Utilities
// ============================================================================

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

// ============================================================================
// Source Selection Component
// ============================================================================

function SourceCard({
  source,
  onSelect,
}: {
  source: DataSource;
  onSelect: (id: DataSourceType) => void;
}) {
  return (
    <button
      onClick={() => source.available && onSelect(source.id)}
      disabled={!source.available}
      className={`
        group relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all
        ${source.available
          ? 'border-slate-200 bg-white hover:border-brand-teal-300 hover:shadow-soft dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-brand-cyan/30 dark:hover:bg-white/[0.04]'
          : 'cursor-not-allowed border-slate-100 bg-slate-50/50 opacity-60 dark:border-white/5 dark:bg-white/[0.01]'
        }
      `}
    >
      {/* Icon */}
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${source.bgLight} ${source.bgDark}`}>
        <span className={source.color}>{source.icon}</span>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 dark:text-white">{source.name}</span>
          {!source.available && (
            <Badge variant="secondary" className="text-[10px]">
              Coming Soon
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{source.description}</p>
      </div>

      {/* Hover indicator */}
      {source.available && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 scale-x-0 bg-gradient-to-r from-brand-teal-500 to-brand-cyan transition-transform group-hover:scale-x-100 dark:from-brand-cyan dark:to-brand-teal-400" />
      )}
    </button>
  );
}

// ============================================================================
// Google Trends Form Component
// ============================================================================

function GoogleTrendsForm({
  onSubmit,
  onBack,
  isPending,
}: {
  onSubmit: (data: GoogleTrendsImportInput) => void;
  onBack: () => void;
  isPending: boolean;
}) {
  const [keyword, setKeyword] = useState('');
  const [geo, setGeo] = useState('');
  const [timeRange, setTimeRange] = useState<GoogleTrendsTimeRange>('PAST_2_YEARS');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSubmit({ keyword, geo, timeRange, name });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal-500/10 dark:bg-brand-cyan/10">
            <TrendingUp className="h-4 w-4 text-brand-teal-600 dark:text-brand-cyan" />
          </div>
          <span className="font-medium text-slate-900 dark:text-white">Google Trends</span>
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Search Keyword
          </label>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. collagen peptides, vitamin d3"
            className="h-10"
            autoFocus
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Enter the search term to track interest over time
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Region <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <Input
              value={geo}
              onChange={(e) => setGeo(e.target.value)}
              placeholder="e.g. US, GB, DE"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Time Range
            </label>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as GoogleTrendsTimeRange)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOOGLE_TRENDS_TIME_RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Series Name <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Auto-generated from keyword if blank"
            className="h-10"
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-white/5">
        <Button type="button" variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button type="submit" disabled={!keyword.trim() || isPending} className="gap-2">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Import Series
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Import Modal Component
// ============================================================================

function ImportModal({
  open,
  onOpenChange,
  onImport,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: GoogleTrendsImportInput) => Promise<void>;
  isPending: boolean;
}) {
  const [selectedSource, setSelectedSource] = useState<DataSourceType | null>(null);

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => setSelectedSource(null), 200);
  };

  const handleImport = async (data: GoogleTrendsImportInput) => {
    await onImport(data);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        {selectedSource === null ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-brand-teal-500 dark:text-brand-cyan" />
                Import Data Source
              </DialogTitle>
              <DialogDescription>
                Select a data source to import time series for forecasting
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              {DATA_SOURCES.map((source) => (
                <SourceCard key={source.id} source={source} onSelect={setSelectedSource} />
              ))}
            </div>
          </>
        ) : selectedSource === 'google-trends' ? (
          <GoogleTrendsForm
            onSubmit={handleImport}
            onBack={() => setSelectedSource(null)}
            isPending={isPending}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DataSourcesPanel() {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Query
  const seriesQuery = useQuery({
    queryKey: SERIES_QUERY_KEY,
    queryFn: async () => fetchJson<TimeSeriesResponse>('/api/v1/time-series'),
  });

  // Mutation
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
      toast.success('Data source imported', {
        description: data.series.name,
      });
      await queryClient.invalidateQueries({ queryKey: SERIES_QUERY_KEY });
    },
    onError: (error) => {
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Data
  const data = useMemo(() => seriesQuery.data?.series ?? [], [seriesQuery.data]);

  // Columns
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
              <Badge variant="outline" className="text-[10px]">
                {row.original.source === 'GOOGLE_TRENDS' ? 'Google Trends' : row.original.source}
              </Badge>
              {row.original.query && <span>{row.original.query}</span>}
              {row.original.geo && (
                <>
                  <span>-</span>
                  <span>{row.original.geo}</span>
                </>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'granularity',
        header: 'Granularity',
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-[11px]">
            {row.original.granularity}
          </Badge>
        ),
      },
      {
        accessorKey: 'pointsCount',
        header: 'Points',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
            {row.original.pointsCount}
          </span>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => {
          const value = row.original.updatedAt;
          const date = value ? new Date(value) : null;
          if (!date || Number.isNaN(date.getTime())) {
            return <span className="text-xs text-muted-foreground">-</span>;
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
          <div className="flex justify-end">
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

  // Table
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

  const handleImport = async (data: GoogleTrendsImportInput) => {
    await importMutation.mutateAsync(data);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Imported Series</CardTitle>
            <CardDescription>
              Time series data from external sources for Prophet forecasting
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search..."
              className="h-9 w-40"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void seriesQuery.refetch()}
              disabled={seriesQuery.isFetching}
              className="h-9 w-9 p-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${seriesQuery.isFetching ? 'animate-spin' : ''}`}
                aria-hidden
              />
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)} className="h-9 gap-2">
              <Plus className="h-4 w-4" aria-hidden />
              Import Data Source
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
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center text-sm text-muted-foreground"
                    >
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-teal-500" />
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
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center text-sm text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Database className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <span>No data sources imported yet</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsModalOpen(true)}
                          className="mt-2 gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Import your first data source
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {table.getFilteredRowModel().rows.length > 0 && (
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
          )}
        </CardContent>
      </Card>

      <ImportModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onImport={handleImport}
        isPending={importMutation.isPending}
      />
    </>
  );
}
