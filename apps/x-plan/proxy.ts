import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCandidateSessionCookieNames, decodePortalSession, getAppEntitlement } from '@ecom-os/auth'
import { portalUrl } from '@/lib/portal'

const PUBLIC_PREFIXES = ['/api/auth/', '/_next', '/favicon.ico', '/health']
const PUBLIC_ROUTES = ['/', '/login', '/no-access']

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
  const forwardedProto = (request.headers.get('x-forwarded-proto') || request.nextUrl.protocol || 'http').replace(/:$/, '')
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const normalizeBasePath = (value?: string | null) => {
    if (!value) return ''
    const trimmed = value.trim()
    if (!trimmed) return ''
    const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    return withLeading.length > 1 && withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading
  }

  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH)
  const normalizedPath = basePath && pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || '/'
    : pathname

  const isPublicRoute =
    PUBLIC_ROUTES.includes(normalizedPath) ||
    PUBLIC_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))

  if (!isPublicRoute) {
    const debug = process.env.NODE_ENV !== 'production'
    const cookieNames = Array.from(new Set([
      ...getCandidateSessionCookieNames('ecomos'),
      ...getCandidateSessionCookieNames('x-plan'),
    ]))
    const cookieHeader = request.headers.get('cookie')
    const sharedSecret = process.env.PORTAL_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
    if (!sharedSecret) {
      console.error('[x-plan middleware] Missing PORTAL_AUTH_SECRET/NEXTAUTH_SECRET')
      return normalizedPath.startsWith('/api/')
        ? NextResponse.json({ error: 'Authentication misconfigured' }, { status: 500 })
        : new NextResponse('Authentication misconfigured', { status: 500 })
    }

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
      if (normalizedPath.startsWith('/api/')) {
        const errorMsg = hasSession ? 'No access to X-Plan' : 'Authentication required'
        return NextResponse.json(
          { error: errorMsg },
          { status: hasSession ? 403 : 401 }
        )
      }

      // User has session but no X-Plan access - redirect to no-access page
      if (hasSession && !xplanEntitlement) {
        const url = request.nextUrl.clone()
        url.pathname = basePath ? `${basePath}/no-access` : '/no-access'
        url.search = ''
        return NextResponse.redirect(url)
      }

      // No session at all
      const login = portalUrl('/login', request)
      if (debug) {
        console.log('[x-plan proxy] no session, redirecting to portal login', login.toString())
      }
      const callbackOrigin = resolveAppOrigin(request)
      const callbackPathname = (() => {
        if (!basePath) return request.nextUrl.pathname
        if (request.nextUrl.pathname.startsWith(basePath)) return request.nextUrl.pathname
        return request.nextUrl.pathname === '/' ? basePath : `${basePath}${request.nextUrl.pathname}`
      })()
      const callbackUrl = new URL(
        callbackPathname + request.nextUrl.search + request.nextUrl.hash,
        callbackOrigin
      )
      login.searchParams.set('callbackUrl', callbackUrl.toString())
      return NextResponse.redirect(login)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
