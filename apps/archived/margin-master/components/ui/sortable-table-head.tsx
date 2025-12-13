'use client';

import * as React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  column: string;
  direction: SortDirection;
}

interface SortableTableHeadProps {
  column: string;
  children: React.ReactNode;
  sortState?: SortState;
  onSort?: (column: string) => void;
  className?: string;
  sortable?: boolean;
}

export function SortableTableHead({
  column,
  children,
  sortState,
  onSort,
  className,
  sortable = true,
}: SortableTableHeadProps) {
  const isActive = sortState?.column === column;
  const direction = isActive ? sortState.direction : null;

  const handleClick = () => {
    if (sortable && onSort) {
      onSort(column);
    }
  };

  const getSortIcon = () => {
    if (!sortable) return null;

    if (!isActive || direction === null) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }

    if (direction === 'asc') {
      return <ArrowUp className="h-4 w-4" />;
    }

    return <ArrowDown className="h-4 w-4" />;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        sortable && 'cursor-pointer select-none hover:text-foreground',
        !sortable && 'cursor-default',
        isActive && 'text-foreground font-medium',
        className
      )}
      onClick={handleClick}
      role={sortable ? 'button' : undefined}
      tabIndex={sortable ? 0 : undefined}
      onKeyDown={
        sortable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      aria-sort={
        isActive
          ? direction === 'asc'
            ? 'ascending'
            : direction === 'desc'
            ? 'descending'
            : 'none'
          : undefined
      }
    >
      <span className="flex-1">{children}</span>
      {getSortIcon()}
    </div>
  );
}