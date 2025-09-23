'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider as NextThemeProvider } from 'next-themes'
import { useState, type PropsWithChildren } from 'react'

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <NextThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NextThemeProvider>
  )
}
