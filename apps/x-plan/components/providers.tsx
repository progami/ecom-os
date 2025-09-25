'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider as NextThemeProvider } from 'next-themes'
import { useState, type ComponentProps, type ReactNode } from 'react'

type ProvidersProps = {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient())
  const providerChildren = children as ComponentProps<typeof QueryClientProvider>['children']

  return (
    <NextThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>{providerChildren}</QueryClientProvider>
    </NextThemeProvider>
  )
}
