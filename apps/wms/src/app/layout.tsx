import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/providers'
import { Toaster } from 'react-hot-toast'
import '@/lib/utils/patch-fetch'
import FetchPatch from '@/components/fetch-patch'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WMS',
  description: 'Modern warehouse inventory and billing management',
  keywords: ['warehouse', 'inventory', 'billing', 'management', '3PL'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <FetchPatch />
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
