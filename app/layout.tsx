import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: "Ecom OS - Unified E-commerce Platform",
  description: "Your unified platform for warehouse management and financial operations",
  keywords: "warehouse management, bookkeeping, inventory, e-commerce, operations",
  authors: [{ name: "Ecom OS Team" }],
  openGraph: {
    title: "Ecom OS",
    description: "Your unified platform for e-commerce operations",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}