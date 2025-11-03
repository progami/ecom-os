import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { clsx } from 'clsx'

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || ''

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'X-Plan | Ecom OS',
  description:
    'Collaborative demand, supply, and finance planning that mirrors the X-Plan workbook experience while staying web-first.',
  icons: {
    icon: `${appBasePath || ''}/favicon.ico`,
  },
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
