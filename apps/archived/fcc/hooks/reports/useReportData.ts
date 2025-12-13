import { useState, useEffect, useCallback } from 'react';
import { fetchReportData } from '@/lib/safe-fetch';
import { ZodSchema } from 'zod';
import { structuredLogger } from '@/lib/client-safe-logger';

interface UseReportDataOptions<T> {
  url: string;
  schema: ZodSchema<T>;
  enabled?: boolean;
  initialData?: T | null;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  timeout?: number;
  retries?: number;
}

interface UseReportDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
  fetchData: (forceRefresh?: boolean) => Promise<void>;
}

export function useReportData<T>({
  url,
  schema,
  enabled = true,
  initialData = null,
  onSuccess,
  onError,
  timeout = 30000,
  retries = 2,
}: UseReportDataOptions<T>): UseReportDataReturn<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    const isRefresh = !!data || forceRefresh;
    
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);

    try {
      const requestUrl = forceRefresh ? `${url}${url.includes('?') ? '&' : '?'}refresh=true` : url;
      
      structuredLogger.info('[useReportData] Fetching data', { url: requestUrl });
      
      const result = await fetchReportData<T>(
        requestUrl,
        schema,
        { timeout, retries }
      );

      if (result.success && result.data) {
        setData(result.data);
        onSuccess?.(result.data);
        structuredLogger.info('[useReportData] Data fetched successfully', { url });
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      onError?.(error);
      structuredLogger.error('[useReportData] Error fetching data', { url, error: error.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [url, schema, enabled, data, timeout, retries, onSuccess, onError]);

  useEffect(() => {
    if (enabled && !data) {
      fetchData();
    }
  }, [enabled, fetchData]);

  return {
    data,
    loading,
    error,
    refreshing,
    fetchData,
  };
}