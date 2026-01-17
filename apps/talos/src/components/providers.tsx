'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { CSRFProvider } from '@/components/providers/csrf-provider'
// import { ErrorBoundary } from './error-boundary'
// import { logErrorToService } from '@/lib/logger/client'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <CSRFProvider>{children}</CSRFProvider>
    </QueryClientProvider>
  )
}

export default Providers
