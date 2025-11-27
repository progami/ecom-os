'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider as NextThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { useState, type ComponentProps, type ReactNode } from 'react'

type ProvidersProps = {
  // Accept any React tree so we can bridge the React 18/19 type mismatch in this workspace
  children?: ComponentProps<typeof QueryClientProvider>['children'] | ReactNode | null | undefined | any
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <NextThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </NextThemeProvider>
  )
}
