import type { Metadata } from "next"
import { Montserrat } from "next/font/google"
import "./globals.css"
import SiteHeader from "@/components/site-header"
import SiteFooter from "@/components/site-footer"
import ResponsiveWrapper from "@/components/responsive-wrapper"

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "Targon Global – Everyday, Done Better",
  description:
    "America's leading sustainable drop cloth manufacturer—now optimized for every screen size. GRS certified, Climate Pledge Friendly.",
  keywords: "Targon Global, drop cloths, sustainable, painting supplies, GRS certified",
  authors: [{ name: "Targon Global" }],
  openGraph: {
    title: "Targon Global – Professional Drop Cloths",
    description: "Simple, sustainable protection at unbeatable prices—designed for any device.",
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
    <html lang="en" className={montserrat.variable}>
      <body className={`${montserrat.className} antialiased overflow-x-hidden`} style={{ backgroundColor: '#021b2b' }}>
        <ResponsiveWrapper>
          <SiteHeader />
          {children}
          <SiteFooter />
        </ResponsiveWrapper>
      </body>
    </html>
  )
}
