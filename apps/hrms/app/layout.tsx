import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HRMS',
  description: 'Human Resource Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}

