'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { useMemo, useState } from 'react'
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

 const sessionBasePath = useMemo(() => {
 const portalAuthUrl = process.env.NEXT_PUBLIC_PORTAL_AUTH_URL || process.env.PORTAL_AUTH_URL
 if (!portalAuthUrl) return undefined
 const normalized = portalAuthUrl.replace(/\/$/, '')
 return `${normalized}/api/auth`
 }, [])

  return (
    <SessionProvider basePath={sessionBasePath}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  )
}

export default Providers
