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
  title: "Targon Global - Professional Drop Cloths at Unbeatable Prices",
  description: "America's leading sustainable drop cloth manufacturer. GRS certified, Amazon Climate Pledge Friendly. Save 25-30% with our direct-to-consumer model.",
  keywords: "drop cloth, plastic drop cloth, canvas drop cloth, painting supplies, contractor supplies, sustainable, recycled materials, GRS certified",
  authors: [{ name: "Targon Global" }],
  openGraph: {
    title: "Targon Global - Professional Drop Cloths",
    description: "America's leading sustainable drop cloth manufacturer. Save 25-30% with our direct-to-consumer model.",
    type: "website",
    url: "https://www.targonglobal.com",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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