import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { clsx } from 'clsx'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Cross Plan | Ecom OS',
  description:
    'Collaborative demand and supply planning that mirrors the Cross Plan workbook experience for ops, sales, and finance.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={clsx('min-h-screen bg-slate-50 font-sans antialiased dark:bg-slate-950', inter.variable)}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
