'use client'

import * as React from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from './table'
import { ChevronUpIcon, ChevronDownIcon } from './Icons'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  skeletonRows?: number
  emptyState?: React.ReactNode
  onRowClick?: (row: TData) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  skeletonRows = 6,
  emptyState,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} hoverable={false}>
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort()
              const sorted = header.column.getIsSorted()
              const align = (header.column.columnDef.meta as { align?: 'left' | 'center' | 'right' })?.align

              return (
                <TableHead
                  key={header.id}
                  align={align}
                  className={cn(canSort && 'cursor-pointer select-none')}
                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                >
                  <div className={cn('flex items-center gap-1', align === 'right' && 'justify-end')}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {canSort && (
                      <span className="ml-1">
                        {sorted === 'asc' ? (
                          <ChevronUpIcon className="h-3.5 w-3.5" />
                        ) : sorted === 'desc' ? (
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                        ) : (
                          <span className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50">
                            <ChevronUpIcon className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableSkeleton rows={skeletonRows} columns={columns.length} />
        ) : table.getRowModel().rows.length === 0 ? (
          emptyState ? (
            <TableRow hoverable={false}>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {emptyState}
              </TableCell>
            </TableRow>
          ) : null
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              hoverable={Boolean(onRowClick)}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              data-state={row.getIsSelected() && 'selected'}
            >
              {row.getVisibleCells().map((cell) => {
                const align = (cell.column.columnDef.meta as { align?: 'left' | 'center' | 'right' })?.align

                return (
                  <TableCell key={cell.id} align={align}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
