import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatFiltersForAPI } from '@/lib/report-filters';
import { useEffect } from 'react';

// Query key factory for consistent key generation
export const reportKeys = {
  all: ['reports'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...reportKeys.lists(), filters] as const,
  details: () => [...reportKeys.all, 'detail'] as const,
  detail: (type: string, filters?: Record<string, any>) => [...reportKeys.details(), type, filters] as const,
  profitLoss: (filters?: Record<string, any>) => reportKeys.detail('profit-loss', filters),
  balanceSheet: (filters?: Record<string, any>) => reportKeys.detail('balance-sheet', filters),
  cashFlow: (filters?: Record<string, any>) => reportKeys.detail('cash-flow', filters),
  trialBalance: (filters?: Record<string, any>) => reportKeys.detail('trial-balance', filters),
  agedReceivables: (filters?: Record<string, any>) => reportKeys.detail('aged-receivables', filters),
  agedPayables: (filters?: Record<string, any>) => reportKeys.detail('aged-payables', filters),
  generalLedger: (filters?: Record<string, any>) => reportKeys.detail('general-ledger', filters),
};

// Enhanced fetch function with caching headers
async function fetchWithCache(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'Cache-Control': 'max-age=300', // 5 minutes browser cache
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch data' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  // Store ETag for future conditional requests
  const etag = response.headers.get('ETag');
  if (etag) {
    sessionStorage.setItem(`etag-${url}`, etag);
  }

  return response.json();
}

// Hook for profit & loss report
export function useProfitLossReport(filters?: Record<string, any>) {
  const apiFilters = filters ? formatFiltersForAPI(filters) : {};
  const queryParams = new URLSearchParams();
  
  Object.entries(apiFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  });
  
  const url = `/api/v1/xero/reports/profit-loss${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  return useQuery({
    queryKey: reportKeys.profitLoss(filters),
    queryFn: () => fetchWithCache(url),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook for balance sheet report
export function useBalanceSheetReport(filters?: Record<string, any>) {
  const apiFilters = filters ? formatFiltersForAPI(filters) : {};
  const queryParams = new URLSearchParams();
  
  Object.entries(apiFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  });
  
  const url = `/api/v1/xero/reports/balance-sheet${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  return useQuery({
    queryKey: reportKeys.balanceSheet(filters),
    queryFn: () => fetchWithCache(url),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook for cash flow report
export function useCashFlowReport(filters?: Record<string, any>) {
  const apiFilters = filters ? formatFiltersForAPI(filters) : {};
  const queryParams = new URLSearchParams();
  
  Object.entries(apiFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  });
  
  const url = `/api/v1/xero/reports/cash-flow${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  return useQuery({
    queryKey: reportKeys.cashFlow(filters),
    queryFn: () => fetchWithCache(url),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook for trial balance report
export function useTrialBalanceReport(filters?: Record<string, any>) {
  const apiFilters = filters ? formatFiltersForAPI(filters) : {};
  const queryParams = new URLSearchParams();
  
  Object.entries(apiFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  });
  
  const url = `/api/v1/xero/reports/trial-balance${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  return useQuery({
    queryKey: reportKeys.trialBalance(filters),
    queryFn: () => fetchWithCache(url),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook for aged receivables report
export function useAgedReceivablesReport(filters?: Record<string, any>) {
  const apiFilters = filters ? formatFiltersForAPI(filters) : {};
  const queryParams = new URLSearchParams();
  
  Object.entries(apiFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  });
  
  const url = `/api/v1/xero/reports/aged-receivables${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  return useQuery({
    queryKey: reportKeys.agedReceivables(filters),
    queryFn: () => fetchWithCache(url),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook for aged payables report
export function useAgedPayablesReport(filters?: Record<string, any>) {
  const apiFilters = filters ? formatFiltersForAPI(filters) : {};
  const queryParams = new URLSearchParams();
  
  Object.entries(apiFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  });
  
  const url = `/api/v1/xero/reports/aged-payables${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  return useQuery({
    queryKey: reportKeys.agedPayables(filters),
    queryFn: () => fetchWithCache(url),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Hook for general ledger report
export function useGeneralLedgerReport(filters?: Record<string, any>) {
  const apiFilters = filters ? formatFiltersForAPI(filters) : {};
  const queryParams = new URLSearchParams();
  
  Object.entries(apiFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  });
  
  const url = `/api/v1/xero/reports/general-ledger${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  return useQuery({
    queryKey: reportKeys.generalLedger(filters),
    queryFn: () => fetchWithCache(url),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}


// Hook for refreshing report data
export function useRefreshReport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ type, filters }: { type: string; filters?: Record<string, any> }) => {
      const apiFilters = filters ? formatFiltersForAPI(filters) : {};
      const queryParams = new URLSearchParams();
      queryParams.set('refresh', 'true');
      
      Object.entries(apiFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.set(key, String(value));
        }
      });
      
      const url = `/api/v1/xero/reports/${type}?${queryParams.toString()}`;
      return fetchWithCache(url);
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch the specific report
      const queryKey = reportKeys.detail(variables.type, variables.filters);
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Hook for prefetching report data (for navigation)
export function usePrefetchReport() {
  const queryClient = useQueryClient();
  
  return (type: string, filters?: Record<string, any>) => {
    const apiFilters = filters ? formatFiltersForAPI(filters) : {};
    const queryParams = new URLSearchParams();
    
    Object.entries(apiFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.set(key, String(value));
      }
    });
    
    const url = `/api/v1/xero/reports/${type}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    return queryClient.prefetchQuery({
      queryKey: reportKeys.detail(type, filters),
      queryFn: () => fetchWithCache(url),
      staleTime: 5 * 60 * 1000,
    });
  };
}

// Hook for background refetching
export function useBackgroundRefetch(type: string, filters?: Record<string, any>, enabled = true) {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!enabled) return;
    
    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: reportKeys.detail(type, filters),
        exact: true,
      });
    }, 5 * 60 * 1000); // Refetch every 5 minutes
    
    return () => clearInterval(interval);
  }, [queryClient, type, filters, enabled]);
}