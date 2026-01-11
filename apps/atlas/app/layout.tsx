import type { Metadata } from 'next'
import './globals.css'

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || ''

export const metadata: Metadata = {
  title: 'Atlas',
  description: 'Atlas — Human Resource Management',
  icons: {
    icon: [
      { url: `${appBasePath}/favicon.ico`, sizes: '48x48' },
      { url: `${appBasePath}/favicon.svg`, type: 'image/svg+xml' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  )
}
