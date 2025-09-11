import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || ''
  const url = req.nextUrl.clone()

  // Map ecomos subdomain to the hub route without changing the URL path
  if (host.startsWith('ecomos.')) {
    if (url.pathname === '/') {
      url.pathname = '/ecomos'
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/']
}

