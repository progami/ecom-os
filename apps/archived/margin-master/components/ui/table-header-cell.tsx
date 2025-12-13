'use client';

import * as React from 'react';
import { TableHead } from '@/components/ui/table';
import { SortableTableHead, SortState } from './sortable-table-head';
import { FilterableTableHead, FilterState, FilterType } from './filterable-table-head';
import { cn } from '@/lib/utils';

interface BaseTableHeaderCellProps {
  column: string;
  children: React.ReactNode;
  className?: string;
  sortable?: boolean;
  filterable?: boolean;
  sortState?: SortState;
  filterState?: FilterState;
  onSort?: (column: string) => void;
  onFilter?: (column: string, value: any) => void;
  onClearFilter?: (column: string) => void;
}

interface TextFilterHeaderProps extends BaseTableHeaderCellProps {
  filterType: 'text';
  filterPlaceholder?: string;
}

interface NumberFilterHeaderProps extends BaseTableHeaderCellProps {
  filterType: 'number';
  filterMin?: number;
  filterMax?: number;
  filterStep?: number;
  filterPlaceholder?: string;
}

interface SelectFilterHeaderProps extends BaseTableHeaderCellProps {
  filterType: 'select';
  filterOptions: { value: string; label: string }[];
  filterMultiple?: boolean;
  filterPlaceholder?: string;
}

interface RangeFilterHeaderProps extends BaseTableHeaderCellProps {
  filterType: 'range';
  filterMin?: number;
  filterMax?: number;
  filterStep?: number;
  filterFormatLabel?: (value: number) => string;
}

interface NoFilterHeaderProps extends BaseTableHeaderCellProps {
  filterType?: never;
}

type TableHeaderCellProps = 
  | TextFilterHeaderProps 
  | NumberFilterHeaderProps 
  | SelectFilterHeaderProps 
  | RangeFilterHeaderProps
  | NoFilterHeaderProps;

export function TableHeaderCell(props: TableHeaderCellProps) {
  const {
    column,
    children,
    className,
    sortable = false,
    filterable = true,
    sortState,
    filterState,
    onSort,
    onFilter,
    onClearFilter,
    ...filterProps
  } = props;

  return (
    <TableHead className={cn('relative', className)}>
      <div className="flex items-center justify-between gap-2">
        <SortableTableHead
          column={column}
          sortState={sortState}
          onSort={onSort}
          sortable={sortable}
          className="flex-1"
        >
          {children}
        </SortableTableHead>
        {filterable && filterProps.filterType && (
          <>
            {filterProps.filterType === 'text' && (
              <FilterableTableHead
                column={column}
                type="text"
                filterState={filterState}
                onFilter={onFilter}
                onClear={onClearFilter}
                placeholder={filterProps.filterPlaceholder}
              />
            )}
            {filterProps.filterType === 'number' && (
              <FilterableTableHead
                column={column}
                type="number"
                filterState={filterState}
                onFilter={onFilter}
                onClear={onClearFilter}
                min={filterProps.filterMin}
                max={filterProps.filterMax}
                step={filterProps.filterStep}
                placeholder={filterProps.filterPlaceholder}
              />
            )}
            {filterProps.filterType === 'select' && (
              <FilterableTableHead
                column={column}
                type="select"
                filterState={filterState}
                onFilter={onFilter}
                onClear={onClearFilter}
                options={filterProps.filterOptions}
                multiple={filterProps.filterMultiple}
                placeholder={filterProps.filterPlaceholder}
              />
            )}
            {filterProps.filterType === 'range' && (
              <FilterableTableHead
                column={column}
                type="range"
                filterState={filterState}
                onFilter={onFilter}
                onClear={onClearFilter}
                min={filterProps.filterMin}
                max={filterProps.filterMax}
                step={filterProps.filterStep}
                formatLabel={filterProps.filterFormatLabel}
              />
            )}
          </>
        )}
      </div>
    </TableHead>
  );
}