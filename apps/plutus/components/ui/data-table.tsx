'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { SkeletonTable } from './skeleton';

export interface ColumnMeta {
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  initialSorting?: SortingState;
  loading?: boolean;
  skeletonRows?: number;
  emptyState?: React.ReactNode;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  initialSorting,
  loading = false,
  skeletonRows = 8,
  emptyState,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(() => initialSorting ?? []);

  // Defer showing skeleton to prevent flash on quick loads
  const [showSkeleton, setShowSkeleton] = React.useState(false);
  React.useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowSkeleton(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowSkeleton(false);
    }
  }, [loading]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden dark:border-white/10 dark:bg-[#06182b]/85">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                const align = meta?.align;

                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      canSort && 'cursor-pointer select-none',
                      align === 'right' && 'text-right',
                      align === 'center' && 'text-center'
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-1',
                        align === 'right' && 'justify-end',
                        align === 'center' && 'justify-center'
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="ml-1 text-slate-400 dark:text-slate-500">
                          {sorted === 'asc' ? (
                            <ChevronUpIcon className="h-3.5 w-3.5" />
                          ) : sorted === 'desc' ? (
                            <ChevronDownIcon className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDownIcon className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {showSkeleton ? (
            <SkeletonTable rows={skeletonRows} columns={columns.length} />
          ) : loading ? (
            <>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="h-14" />
                </TableRow>
              ))}
            </>
          ) : table.getRowModel().rows.length === 0 ? (
            emptyState ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : null
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                data-state={row.getIsSelected() && 'selected'}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = (cell.column.columnDef.meta as ColumnMeta | undefined)?.align;

                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        align === 'right' && 'text-right',
                        align === 'center' && 'text-center'
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Icons
function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronsUpDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
    </svg>
  );
}
