import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasPortalSession } from '@ecom-os/auth'
import { portalUrl } from '@/lib/portal'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const basePath = process.env.BASE_PATH || ''
  const normalizedPath = basePath && pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || '/'
    : pathname

  // Public routes
  const PUBLIC_PREFIXES = ['/api/', '/api/auth/', '/_next', '/favicon.ico']
  const PUBLIC_ROUTES = ['/', '/health']
  const isPublic =
    PUBLIC_ROUTES.includes(normalizedPath) ||
    PUBLIC_PREFIXES.some((p) => normalizedPath.startsWith(p))

  if (!isPublic) {
    const debug = process.env.NODE_ENV !== 'production'
    const hasSession = await hasPortalSession({
      request,
      appId: 'hrms',
      portalUrl: process.env.PORTAL_AUTH_URL,
      debug,
    })

    if (!hasSession) {
      const login = portalUrl('/login', request)
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
