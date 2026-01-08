import type { Metadata } from 'next'
import './globals.css'

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || ''

export const metadata: Metadata = {
  title: 'Atlas',
  description: 'Atlas — Human Resource Management',
  icons: {
    icon: `${appBasePath || ''}/favicon.ico`,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  )
}
