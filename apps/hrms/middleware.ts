import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCandidateSessionCookieNames, decodePortalSession, getAppEntitlement } from '@ecom-os/auth'
import { portalUrl } from '@/lib/portal'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  // Use same default as next.config.js for consistency
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || '/hrms'
  const normalizedPath = basePath && pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || '/'
    : pathname

  // Public routes - only specific endpoints, NOT all /api/ routes
  // Security: Removed '/' and '/api/setup/departments' from public routes
  const PUBLIC_PREFIXES = ['/_next', '/favicon.ico']
  const PUBLIC_ROUTES = ['/health', '/api/health', '/no-access']
  const isPublic =
    PUBLIC_ROUTES.includes(normalizedPath) ||
    PUBLIC_PREFIXES.some((p) => normalizedPath.startsWith(p))

  if (!isPublic) {
    const debug = process.env.NODE_ENV !== 'production'
    const cookieNames = Array.from(new Set([
      ...getCandidateSessionCookieNames('ecomos'),
      ...getCandidateSessionCookieNames('hrms'),
    ]))
    const cookieHeader = request.headers.get('cookie')
    const sharedSecret = process.env.PORTAL_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

    const decoded = await decodePortalSession({
      cookieHeader,
      cookieNames,
      secret: sharedSecret,
      debug,
    })

    const hasSession = !!decoded
    const hrmsEntitlement = decoded ? getAppEntitlement(decoded.roles, 'hrms') : undefined
    const hasAccess = hasSession && !!hrmsEntitlement

    if (!hasAccess) {
      // For API routes, return 401/403 instead of redirect
      if (normalizedPath.startsWith('/api/')) {
        const errorMsg = hasSession ? 'No access to HRMS' : 'Authentication required'
        return NextResponse.json(
          { error: errorMsg },
          { status: hasSession ? 403 : 401 }
        )
      }

      // User has session but no HRMS access - redirect to no-access page
      if (hasSession && !hrmsEntitlement) {
        const url = request.nextUrl.clone()
        url.pathname = basePath ? `${basePath}/no-access` : '/no-access'
        url.search = ''
        return NextResponse.redirect(url)
      }

      // No session at all
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
