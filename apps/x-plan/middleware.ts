import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCandidateSessionCookieNames, decodePortalSession, getAppEntitlement } from '@ecom-os/auth'
import { portalUrl } from '@/lib/portal'

const PUBLIC_PREFIXES = ['/api/auth/', '/api/v1/', '/_next', '/favicon.ico', '/health']
const PUBLIC_ROUTES = ['/', '/login']

function resolveAppOrigin(request: NextRequest): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BASE_URL,
    process.env.NEXTAUTH_URL,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return new URL(candidate).origin
    } catch {
      continue
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol
  if (forwardedHost) {
    const host = forwardedHost.split(',')[0]?.trim()
    if (host) {
      return `${forwardedProto}://${host}`
    }
  }

  const hostHeader = request.headers.get('host')
  if (hostHeader) {
    return `${forwardedProto}://${hostHeader}`
  }

  return request.nextUrl.origin
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!isPublicRoute) {
    const debug = process.env.NODE_ENV !== 'production'
    const cookieNames = getCandidateSessionCookieNames('x-plan')
    const cookieHeader = request.headers.get('cookie')
    const sharedSecret = process.env.PORTAL_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

    const decoded = await decodePortalSession({
      cookieHeader,
      cookieNames,
      secret: sharedSecret,
      debug,
    })

    const hasSession = !!decoded
    const xplanEntitlement = decoded ? getAppEntitlement(decoded.roles, 'x-plan') : undefined
    const hasAccess = hasSession && !!xplanEntitlement

    if (!hasAccess) {
      // User has session but no X-Plan access
      if (hasSession && !xplanEntitlement) {
        const redirect = portalUrl('/', request)
        redirect.searchParams.set('error', 'no_access')
        redirect.searchParams.set('app', 'x-plan')
        return NextResponse.redirect(redirect)
      }

      // No session at all
      const login = portalUrl('/login', request)
      if (debug) {
        console.log('[x-plan middleware] no session, redirecting to portal login', login.toString())
      }
      const callbackOrigin = resolveAppOrigin(request)
      const basePath = process.env.BASE_PATH || ''
      const callbackUrl = new URL(basePath + request.nextUrl.pathname + request.nextUrl.search + request.nextUrl.hash, callbackOrigin)
      login.searchParams.set('callbackUrl', callbackUrl.toString())
      return NextResponse.redirect(login)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
