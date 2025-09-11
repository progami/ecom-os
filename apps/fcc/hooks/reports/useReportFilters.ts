import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { structuredLogger } from '@/lib/client-safe-logger';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface ReportFilters {
  dateRange?: DateRange;
  dateType?: 'ytd' | 'point-in-time' | 'date-range';
  asAtDate?: Date;
  accountFilter?: string;
  categoryFilter?: string;
  statusFilter?: string;
  [key: string]: any;
}

interface UseReportFiltersOptions {
  defaultFilters?: ReportFilters;
  syncWithUrl?: boolean;
  onFilterChange?: (filters: ReportFilters) => void;
}

interface UseReportFiltersReturn {
  filters: ReportFilters;
  updateFilter: (key: string, value: any) => void;
  updateFilters: (updates: Partial<ReportFilters>) => void;
  resetFilters: () => void;
  getFilterQueryString: () => string;
}

export function useReportFilters({
  defaultFilters = {},
  syncWithUrl = true,
  onFilterChange,
}: UseReportFiltersOptions = {}): UseReportFiltersReturn {
  const searchParams = useSearchParams();
  
  // Initialize filters from URL or defaults
  const initializeFilters = (): ReportFilters => {
    if (!syncWithUrl) return defaultFilters;

    const filters: ReportFilters = { ...defaultFilters };
    
    // Parse URL parameters
    searchParams.forEach((value, key) => {
      if (key === 'from' || key === 'to' || key === 'asAtDate') {
        filters[key] = value ? new Date(value) : undefined;
      } else if (key === 'dateRange' && value) {
        try {
          const [from, to] = value.split(',');
          filters.dateRange = {
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined,
          };
        } catch {
          // Invalid date range format
        }
      } else {
        filters[key] = value;
      }
    });

    return filters;
  };

  const [filters, setFilters] = useState<ReportFilters>(initializeFilters);

  // Update URL when filters change
  useEffect(() => {
    if (!syncWithUrl) return;

    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      
      if (key === 'dateRange' && value) {
        const range = value as DateRange;
        if (range.from || range.to) {
          params.set(key, `${range.from?.toISOString() || ''},${range.to?.toISOString() || ''}`);
        }
      } else if (value instanceof Date) {
        params.set(key, value.toISOString());
      } else {
        params.set(key, String(value));
      }
    });

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [filters, syncWithUrl]);

  const updateFilter = useCallback((key: string, value: any) => {
    structuredLogger.info('[useReportFilters] Updating filter', { key, value });
    
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      onFilterChange?.(updated);
      return updated;
    });
  }, [onFilterChange]);

  const updateFilters = useCallback((updates: Partial<ReportFilters>) => {
    structuredLogger.info('[useReportFilters] Updating multiple filters', { updates });
    
    setFilters(prev => {
      const updated = { ...prev, ...updates };
      onFilterChange?.(updated);
      return updated;
    });
  }, [onFilterChange]);

  const resetFilters = useCallback(() => {
    structuredLogger.info('[useReportFilters] Resetting filters to defaults');
    
    setFilters(defaultFilters);
    onFilterChange?.(defaultFilters);
  }, [defaultFilters, onFilterChange]);

  const getFilterQueryString = useCallback(() => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      
      if (key === 'dateRange' && value) {
        const range = value as DateRange;
        if (range.from) params.append('from', range.from.toISOString());
        if (range.to) params.append('to', range.to.toISOString());
      } else if (value instanceof Date) {
        params.append(key, value.toISOString());
      } else {
        params.append(key, String(value));
      }
    });

    return params.toString();
  }, [filters]);

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    getFilterQueryString,
  };
}