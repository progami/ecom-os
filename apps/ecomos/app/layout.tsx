import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ecomOS Portal',
  description: 'Central authentication and app launcher for ecomOS',
  icons: {
    icon: [
      { url: '/favicon.ico' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const version = process.env.NEXT_PUBLIC_VERSION ?? '0.0.0'
  const explicitReleaseUrl = process.env.NEXT_PUBLIC_RELEASE_URL || undefined
  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA || undefined
  const commitUrl = commitSha ? `https://github.com/progami/ecom-os/commit/${commitSha}` : undefined
  const inferredReleaseUrl = `https://github.com/progami/ecom-os/releases/tag/v${version}`
  const versionHref = explicitReleaseUrl ?? commitUrl ?? inferredReleaseUrl

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        margin: 0,
        padding: 0,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}>
        {children}
        <a
          href={versionHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'fixed',
            right: 12,
            bottom: 12,
            zIndex: 50,
            fontSize: 12,
            lineHeight: 1.2,
            padding: '6px 10px',
            borderRadius: 9999,
            border: '1px solid rgba(15, 23, 42, 0.18)',
            background: 'rgba(255, 255, 255, 0.85)',
            color: 'rgba(15, 23, 42, 0.75)',
            textDecoration: 'none',
            backdropFilter: 'blur(8px)',
          }}
          aria-label={`Portal version v${version}`}
        >
          Portal v{version}
        </a>
      </body>
    </html>
  )
}
