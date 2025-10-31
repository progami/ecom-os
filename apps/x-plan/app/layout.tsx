import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { clsx } from 'clsx'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'X-Plan | Ecom OS',
  description:
    'Collaborative demand, supply, and finance planning that mirrors the X-Plan workbook experience while staying web-first.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={clsx('min-h-screen bg-slate-50 font-sans antialiased', inter.variable)}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
