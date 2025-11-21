import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || ''

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'HRMS',
  description: 'Human Resource Management System',
  icons: {
    icon: `${appBasePath || ''}/favicon.ico`,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  )
}

