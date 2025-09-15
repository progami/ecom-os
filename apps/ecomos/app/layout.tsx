export const metadata = {
  title: 'ecomOS Portal',
  description: 'Central authentication and app launcher for ecomOS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"' }}>
        {children}
      </body>
    </html>
  )
}

