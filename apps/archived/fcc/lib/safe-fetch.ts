import { z } from 'zod';
import { validateApiResponse } from './schemas/report-schemas';

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export type SafeFetchResult<T> = 
  | {
      success: true;
      data: T;
      response: Response;
    }
  | {
      success: false;
      error: string;
      response?: Response;
    };

/**
 * Safe fetch function with validation, timeout, and retry logic
 */
export async function safeFetch<T>(
  url: string,
  schema: z.ZodTypeAny,
  options: FetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  let lastError: string = '';
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if response is ok
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch {
            const errorText = await response.text().catch(() => 'Unknown error');
            errorMessage = `HTTP ${response.status}: ${errorText}`;
          }
          
          lastError = errorMessage;
          
          // Don't retry on 4xx errors (client errors)
          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              error: lastError,
              response,
            };
          }
          
          // Retry on 5xx errors (server errors)
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
            continue;
          }
          
          return {
            success: false,
            error: lastError,
            response,
          };
        }

        // Parse JSON response
        let jsonData: unknown;
        try {
          jsonData = await response.json();
        } catch (error) {
          return {
            success: false,
            error: 'Failed to parse JSON response',
            response,
          };
        }

        // Validate response with schema
        const validation = validateApiResponse(schema, jsonData);
        if (!validation.success) {
          return {
            success: false,
            error: validation.error,
            response,
          };
        }

        return {
          success: true,
          data: validation.data,
          response,
        };

      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = `Request timeout after ${timeout}ms`;
          } else {
            lastError = error.message;
          }
        } else {
          lastError = 'Unknown network error';
        }
        
        // Retry on network errors
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
    }
  }

  return {
    success: false,
    error: lastError,
  };
}

/**
 * Specialized fetch function for report data
 */
export async function fetchReportData<T>(
  url: string,
  schema: z.ZodTypeAny,
  options: FetchOptions = {}
): Promise<SafeFetchResult<T>> {
  return safeFetch<T>(url, schema, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * React hook for safe API calls with loading states
 */
export function useSafeFetch<T>(
  url: string | null,
  schema: z.ZodTypeAny,
  options: FetchOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!url) return;

    try {
      if (forceRefresh) {
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      const result = await safeFetch<T>(url, schema, options);
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [url, schema, options]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
  };
}

// Helper for logging validation errors in development
export function logValidationError(error: string, data: unknown, schema: z.ZodTypeAny) {
  if (process.env.NODE_ENV === 'development') {
    console.group('🚨 API Response Validation Error');
    console.error('Validation Error:', error);
    console.log('Raw Data:', data);
    console.log('Expected Schema:', schema.description || schema._def);
    console.groupEnd();
    
    // Send to logging endpoint
    fetch('/api/v1/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        logs: [{
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          component: 'SafeFetch',
          message: 'API response validation failed',
          error: {
            message: error,
            rawData: data,
            schemaInfo: schema.description || 'Unknown schema',
          },
          url: window.location.href,
        }]
      }),
    }).catch(() => {
      console.warn('Failed to send validation error to logging endpoint');
    });
  }
}

// Import useState, useEffect, useCallback for the hook
import { useState, useEffect, useCallback } from 'react';