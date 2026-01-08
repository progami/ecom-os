'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpDown, ExternalLink, Play, Upload } from 'lucide-react';
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

import type { ForecastProject, ForecastProjectStatus } from '@/types/forecast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

function statusTone(status: ForecastProjectStatus) {
  switch (status) {
    case 'draft':
      return 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300';
    case 'ready':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100';
    case 'running':
      return 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-100';
    case 'failed':
      return 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100';
  }
}

export function ForecastsTable({ data }: { data: ForecastProject[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<ForecastProject>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Project
            <ArrowUpDown className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900 dark:text-slate-100">
              {row.original.name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{row.original.marketplace}</span>
              <span>•</span>
              <span>{row.original.frequency}</span>
              <span>•</span>
              <span>{row.original.horizonWeeks}w</span>
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
        accessorKey: 'sources',
        header: 'Signals',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.sources.slice(0, 2).map((source) => (
              <Badge key={source} variant="outline" className="text-[11px]">
                {source}
              </Badge>
            ))}
            {row.original.sources.length > 2 ? (
              <Badge variant="outline" className="text-[11px]">
                +{row.original.sources.length - 2}
              </Badge>
            ) : null}
          </div>
        ),
        enableSorting: false,
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
            {row.original.status}
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
            <Button
              size="sm"
              onClick={() => toast.success('Run queued (stub)', { description: row.original.name })}
            >
              <Play className="mr-2 h-4 w-4" aria-hidden />
              Run
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

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Forecast Projects</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Input
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search projects…"
              aria-label="Search forecast projects"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => toast.info('Import from X-Plan (stub)')}
              className="gap-2"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Import
            </Button>
            <Button onClick={() => toast.info('Create forecast (stub)')} className="gap-2">
              <Play className="h-4 w-4" aria-hidden />
              New
            </Button>
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
                    No projects found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <div className="text-xs text-muted-foreground">
            {table.getFilteredRowModel().rows.length} project(s)
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

