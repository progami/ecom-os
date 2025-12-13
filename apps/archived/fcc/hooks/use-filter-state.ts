'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FilterValues, FilterValue, DateRange } from '@/components/reports/filter-panel';

export interface UseFilterStateOptions {
  defaultValues?: FilterValues;
  debounceMs?: number;
  persistInUrl?: boolean;
  onFiltersChange?: (filters: FilterValues) => void;
}

export interface UseFilterStateResult {
  filters: FilterValues;
  setFilter: (key: string, value: FilterValue) => void;
  setFilters: (filters: FilterValues) => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;
  isLoading: boolean;
  hasActiveFilters: boolean;
  serializedFilters: string;
}

// Utility functions for serialization
function serializeFilterValue(value: FilterValue): string {
  const parts: string[] = [];
  
  if (value.dateRange) {
    parts.push(`dr:${value.dateRange.from.toISOString()},${value.dateRange.to.toISOString()}`);
  }
  
  if (value.select) {
    parts.push(`s:${encodeURIComponent(value.select)}`);
  }
  
  if (value.multiSelect && value.multiSelect.length > 0) {
    parts.push(`ms:${value.multiSelect.map(v => encodeURIComponent(v)).join('|')}`);
  }
  
  if (value.numberRange) {
    const { min, max } = value.numberRange;
    if (min !== undefined || max !== undefined) {
      parts.push(`nr:${min ?? ''},${max ?? ''}`);
    }
  }
  
  if (value.text) {
    parts.push(`t:${encodeURIComponent(value.text)}`);
  }
  
  if (value.month) {
    parts.push(`m:${value.month.toISOString()}`);
  }
  
  return parts.join(';');
}

function deserializeFilterValue(serialized: string): FilterValue {
  const value: FilterValue = {};
  const parts = serialized.split(';');
  
  for (const part of parts) {
    const [type, data] = part.split(':', 2);
    
    switch (type) {
      case 'dr': // date range
        const [fromStr, toStr] = data.split(',');
        if (fromStr && toStr) {
          try {
            value.dateRange = {
              from: new Date(fromStr),
              to: new Date(toStr)
            };
          } catch (e) {
            // Invalid date, skip
          }
        }
        break;
        
      case 's': // select
        try {
          value.select = decodeURIComponent(data);
        } catch (e) {
          value.select = data;
        }
        break;
        
      case 'ms': // multi-select
        try {
          value.multiSelect = data.split('|').map(v => decodeURIComponent(v));
        } catch (e) {
          value.multiSelect = data.split('|');
        }
        break;
        
      case 'nr': // number range
        const [minStr, maxStr] = data.split(',');
        value.numberRange = {};
        if (minStr) value.numberRange.min = parseFloat(minStr);
        if (maxStr) value.numberRange.max = parseFloat(maxStr);
        break;
        
      case 't': // text
        try {
          value.text = decodeURIComponent(data);
        } catch (e) {
          value.text = data;
        }
        break;
        
      case 'm': // month
        try {
          value.month = new Date(data);
        } catch (e) {
          // Invalid date, skip
        }
        break;
    }
  }
  
  return value;
}

function serializeFilters(filters: FilterValues): string {
  const entries = Object.entries(filters)
    .filter(([_, value]) => value && Object.keys(value).length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(serializeFilterValue(value))}`)
    .join('&');
  
  return entries;
}

function deserializeFilters(serialized: string): FilterValues {
  if (!serialized) return {};
  
  const filters: FilterValues = {};
  const params = new URLSearchParams(serialized);
  
  for (const [key, value] of params.entries()) {
    try {
      const decodedKey = decodeURIComponent(key);
      const decodedValue = decodeURIComponent(value);
      filters[decodedKey] = deserializeFilterValue(decodedValue);
    } catch (e) {
      // Skip invalid entries
      console.warn('Failed to deserialize filter:', key, value, e);
    }
  }
  
  return filters;
}

export function useFilterState({
  defaultValues = {},
  debounceMs = 300,
  persistInUrl = true,
  onFiltersChange
}: UseFilterStateOptions = {}): UseFilterStateResult {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedFilters, setDebouncedFilters] = useState<FilterValues>({});

  // Initialize filters from URL or defaults
  const initialFilters = useMemo(() => {
    if (persistInUrl) {
      const urlFilters = searchParams.get('filters');
      if (urlFilters) {
        try {
          const parsed = deserializeFilters(urlFilters);
          return { ...defaultValues, ...parsed };
        } catch (e) {
          console.warn('Failed to parse URL filters:', e);
        }
      }
    }
    return defaultValues;
  }, [searchParams, defaultValues, persistInUrl]);

  const [filters, setFiltersState] = useState<FilterValues>(initialFilters);

  // Debounced effect for URL updates and callbacks
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedFilters(filters);
      setIsLoading(false);
    }, debounceMs);

    setIsLoading(true);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [filters, debounceMs]);

  // Update URL when debounced filters change
  useEffect(() => {
    if (persistInUrl) {
      const serialized = serializeFilters(debouncedFilters);
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      
      if (serialized) {
        current.set('filters', serialized);
      } else {
        current.delete('filters');
      }
      
      const search = current.toString();
      const query = search ? `?${search}` : '';
      
      // Only update if the URL actually changed
      if (window.location.search !== query) {
        router.replace(`${window.location.pathname}${query}`, { scroll: false });
      }
    }
    
    // Call the change callback
    onFiltersChange?.(debouncedFilters);
  }, [debouncedFilters, router, searchParams, persistInUrl, onFiltersChange]);

  const setFilter = useCallback((key: string, value: FilterValue) => {
    setFiltersState(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const setFilters = useCallback((newFilters: FilterValues) => {
    setFiltersState(newFilters);
  }, []);

  const removeFilter = useCallback((key: string) => {
    setFiltersState(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  const hasActiveFilters = useMemo(() => {
    return Object.keys(filters).some(key => {
      const value = filters[key];
      if (!value) return false;
      
      // Check if any filter type has a value
      return !!(
        value.dateRange ||
        value.select ||
        (value.multiSelect && value.multiSelect.length > 0) ||
        (value.numberRange && (value.numberRange.min !== undefined || value.numberRange.max !== undefined)) ||
        (value.text && value.text.trim()) ||
        value.month
      );
    });
  }, [filters]);

  const serializedFilters = useMemo(() => {
    return serializeFilters(filters);
  }, [filters]);

  return {
    filters,
    setFilter,
    setFilters,
    removeFilter,
    clearFilters,
    isLoading,
    hasActiveFilters,
    serializedFilters
  };
}