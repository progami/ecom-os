import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasPortalSession } from '@ecom-os/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes
  const PUBLIC_PREFIXES = ['/api/auth/', '/_next', '/favicon.ico']
  const PUBLIC_ROUTES = ['/', '/health']
  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  if (!isPublic) {
    const debug = process.env.NODE_ENV !== 'production'
    const hasSession = await hasPortalSession({
      request,
      appId: 'ecomos',
      portalUrl: process.env.PORTAL_AUTH_URL,
      debug,
    })

    if (!hasSession) {
      const defaultPortal = process.env.NODE_ENV === 'production'
        ? 'https://ecomos.targonglobal.com'
        : 'http://localhost:3000'
      const portal = process.env.PORTAL_AUTH_URL || defaultPortal
      const login = new URL('/login', portal)
      if (debug) {
        console.log('[hrms middleware] missing session, redirecting to', login.toString())
      }
      login.searchParams.set('callbackUrl', request.nextUrl.toString())
      return NextResponse.redirect(login)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
