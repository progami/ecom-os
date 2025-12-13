'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Stale time: 5 minutes - data is considered fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Cache time: 10 minutes - data stays in cache for 10 minutes after becoming inactive
        gcTime: 10 * 60 * 1000,
        // Retry failed requests 3 times with exponential backoff
        retry: (failureCount, error: any) => {
          if (error?.status === 404 || error?.status === 401) return false;
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus in production
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
        // Don't refetch on reconnect by default
        refetchOnReconnect: 'always',
      },
      mutations: {
        onError: (error: any) => {
          toast.error(error?.message || 'An error occurred');
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // NOTE: Avoid useState when initializing the query client if you don't
  // have a suspense boundary between this and the code that may suspend because
  // React will throw away the client on the initial render if it suspends and
  // there is no boundary
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}