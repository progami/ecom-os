import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasPortalSession } from '@ecom-os/auth'
import { portalUrl } from '@/lib/portal'

const PUBLIC_PREFIXES = ['/api/auth/', '/api/v1/', '/_next', '/favicon.ico', '/health']
const PUBLIC_ROUTES = ['/', '/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!isPublicRoute) {
    const debug = process.env.NODE_ENV !== 'production'
    const hasSession = await hasPortalSession({
      request,
      appId: 'x-plan',
      portalUrl: process.env.PORTAL_AUTH_URL,
      debug,
    })

    if (!hasSession) {
      const login = portalUrl('/login', request)
      if (debug) {
        console.log('[x-plan middleware] no session, redirecting to portal login', login.toString())
      }
      login.searchParams.set('callbackUrl', request.nextUrl.toString())
      return NextResponse.redirect(login)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
