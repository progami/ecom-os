import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { AppLayout } from '@/components/layouts/app-layout'
import { ClientLoggerInit } from '@/components/client-logger-init'
import { ErrorBoundary } from '@/components/error-boundary'
import { DevLogPanel } from '@/components/dev-log-panel'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'
import { PerformanceDashboard } from '@/components/performance-dashboard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bookkeeping',
  description: 'Automated bookkeeping and financial categorization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Initialize logger IMMEDIATELY to capture ALL browser logs */}
        {process.env.NODE_ENV === 'development' && (
          <script
            async
            src="/init-logger.js"
            data-no-duplicate="true"
          />
        )}
        {/* Clear stale sync data on load */}
        <script
          async
          src="/clear-stale-sync.js"
          data-no-duplicate="true"
        />
        {/* Handle auth state on load */}
        <script
          async
          src="/clear-auth-state.js"
          data-no-duplicate="true"
        />
        {/* Ensure auth state refreshes after OAuth */}
        <script
          async
          src="/auth-state-refresh.js"
          data-no-duplicate="true"
        />
      </head>
      <body className={inter.className}>
        <ClientLoggerInit />
        <ErrorBoundary>
          <Providers>
            <ServiceWorkerRegistration />
            {children}
          </Providers>
        </ErrorBoundary>
        {process.env.NODE_ENV === 'development' && (
          <>
            <DevLogPanel />
            <PerformanceDashboard />
          </>
        )}
      </body>
    </html>
  )
}