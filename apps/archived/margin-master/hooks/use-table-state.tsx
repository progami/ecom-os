'use client';

import { useState, useCallback, useMemo } from 'react';
import { SortState, SortDirection } from '@/components/ui/sortable-table-head';
import { FilterState, FilterType } from '@/components/ui/filterable-table-head';

// Helper function to determine filter type from value
function getFilterTypeFromValue(value: any): FilterType {
  if (typeof value === 'number') {
    return 'number';
  }
  if (Array.isArray(value)) {
    return 'select';
  }
  if (typeof value === 'object' && value !== null && 'min' in value && 'max' in value) {
    return 'range';
  }
  return 'text';
}

export interface TableState {
  sort: SortState | null;
  filters: FilterState[];
  page: number;
  pageSize: number;
}

interface UseTableStateOptions {
  defaultSort?: SortState;
  defaultFilters?: FilterState[];
  defaultPage?: number;
  defaultPageSize?: number;
}

export function useTableState(options: UseTableStateOptions = {}) {
  const {
    defaultSort = null,
    defaultFilters = [],
    defaultPage = 1,
    defaultPageSize = 50,
  } = options;

  const [sort, setSort] = useState<SortState | null>(defaultSort);
  const [filters, setFilters] = useState<FilterState[]>(defaultFilters);
  const [page, setPage] = useState(defaultPage);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Sorting handlers
  const handleSort = useCallback((column: string) => {
    setSort((prevSort) => {
      if (!prevSort || prevSort.column !== column) {
        return { column, direction: 'asc' };
      }
      
      if (prevSort.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      
      if (prevSort.direction === 'desc') {
        return null;
      }
      
      return prevSort;
    });
    
    // Reset to first page when sorting changes
    setPage(1);
  }, []);

  // Filter handlers
  const handleFilter = useCallback((column: string, value: any) => {
    setFilters((prevFilters) => {
      const existingFilterIndex = prevFilters.findIndex(f => f.column === column);
      
      if (value === null || value === undefined || value === '' || 
          (Array.isArray(value) && value.length === 0)) {
        // Remove filter if value is empty
        return prevFilters.filter(f => f.column !== column);
      }
      
      const newFilter: FilterState = {
        column,
        type: getFilterTypeFromValue(value),
        value,
      };
      
      if (existingFilterIndex >= 0) {
        // Update existing filter
        const newFilters = [...prevFilters];
        newFilters[existingFilterIndex] = newFilter;
        return newFilters;
      } else {
        // Add new filter
        return [...prevFilters, newFilter];
      }
    });
    
    // Reset to first page when filters change
    setPage(1);
  }, []);

  const handleClearFilter = useCallback((column: string) => {
    setFilters((prevFilters) => prevFilters.filter(f => f.column !== column));
    setPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters([]);
    setPage(1);
  }, []);

  // Pagination handlers
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  // Reset everything
  const reset = useCallback(() => {
    setSort(defaultSort);
    setFilters(defaultFilters);
    setPage(defaultPage);
    setPageSize(defaultPageSize);
  }, [defaultSort, defaultFilters, defaultPage, defaultPageSize]);

  // Helper to get filter state for a specific column
  const getFilterState = useCallback((column: string): FilterState | undefined => {
    return filters.find(f => f.column === column);
  }, [filters]);

  // Apply sorting to data
  const applySorting = useCallback(<T extends Record<string, any>,>(
    data: T[],
    customComparators?: Record<string, (a: T, b: T) => number>
  ): T[] => {
    if (!sort) return data;
    
    return [...data].sort((a, b) => {
      const { column, direction } = sort;
      
      // Use custom comparator if provided
      if (customComparators && customComparators[column]) {
        const result = customComparators[column](a, b);
        return direction === 'asc' ? result : -result;
      }
      
      // Default comparison
      const aValue = a[column];
      const bValue = b[column];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      let result = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        result = aValue - bValue;
      } else {
        result = String(aValue).localeCompare(String(bValue));
      }
      
      return direction === 'asc' ? result : -result;
    });
  }, [sort]);

  // Apply filtering to data
  const applyFiltering = useCallback(<T extends Record<string, any>,>(
    data: T[],
    customFilters?: Record<string, (item: T, filterValue: any) => boolean>
  ): T[] => {
    if (filters.length === 0) return data;
    
    return data.filter(item => {
      return filters.every(filter => {
        const { column, value } = filter;
        
        // Use custom filter if provided
        if (customFilters && customFilters[column]) {
          return customFilters[column](item, value);
        }
        
        const itemValue = item[column];
        
        // Text filter
        if (typeof value === 'string') {
          return String(itemValue).toLowerCase().includes(value.toLowerCase());
        }
        
        // Array filter (for multi-select)
        if (Array.isArray(value) && value.length > 0) {
          if (typeof value[0] === 'string') {
            return value.includes(itemValue);
          }
          
          // Range filter [min, max]
          if (value.length === 2 && typeof value[0] === 'number') {
            const [min, max] = value;
            const numValue = Number(itemValue);
            return numValue >= min && numValue <= max;
          }
        }
        
        return true;
      });
    });
  }, [filters]);

  // Apply pagination to data
  const applyPagination = useCallback(<T,>(data: T[]): T[] => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }, [page, pageSize]);

  // Combined data processing
  const processData = useCallback(<T extends Record<string, any>,>(
    data: T[],
    options?: {
      customComparators?: Record<string, (a: T, b: T) => number>;
      customFilters?: Record<string, (item: T, filterValue: any) => boolean>;
      skipPagination?: boolean;
    }
  ): { data: T[]; totalCount: number; pageCount: number } => {
    let processed = data;
    
    // Apply filters first
    processed = applyFiltering(processed, options?.customFilters);
    const totalCount = processed.length;
    
    // Then sort
    processed = applySorting(processed, options?.customComparators);
    
    // Finally paginate (unless skipped)
    if (!options?.skipPagination) {
      processed = applyPagination(processed);
    }
    
    const pageCount = Math.ceil(totalCount / pageSize);
    
    return { data: processed, totalCount, pageCount };
  }, [applyFiltering, applySorting, applyPagination, pageSize]);

  return {
    // State
    sort,
    filters,
    page,
    pageSize,
    
    // Handlers
    handleSort,
    handleFilter,
    handleClearFilter,
    clearAllFilters,
    handlePageChange,
    handlePageSizeChange,
    reset,
    
    // Utilities
    getFilterState,
    applySorting,
    applyFiltering,
    applyPagination,
    processData,
  };
}