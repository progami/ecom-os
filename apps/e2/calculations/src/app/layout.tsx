import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { APP_CONFIG } from '@/config/environment.client'
import { Providers } from '@/components/providers'
import { NavigationProgress } from '@/components/NavigationProgress'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: APP_CONFIG.title,
  description: APP_CONFIG.description,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NavigationProgress />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}