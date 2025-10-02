import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasCentralSession } from '@ecom-os/auth'
import { withBasePath, withoutBasePath } from '@/lib/utils/base-path'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const normalizedPath = withoutBasePath(pathname)

  // Redirect /operations to /operations/inventory (base-path aware)
  if (normalizedPath === '/operations') {
    const url = request.nextUrl.clone()
    url.pathname = withBasePath('/operations/inventory')
    return NextResponse.redirect(url)
  }

  // Public routes that don't require authentication
  // Use exact matches or proper prefix matching to prevent auth bypass
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/error',
    '/api/health',
    '/api/logs',
    '/api/demo/setup',
  ]

  // Routes that should be prefix-matched
  const publicPrefixes = [
    '/api/auth/', // NextAuth internal routes
  ]

  // Check if the route is public using exact match
  const isExactPublicRoute = publicRoutes.includes(normalizedPath)

  // Check if the route matches a public prefix
  const isPublicPrefix = publicPrefixes.some(prefix => normalizedPath.startsWith(prefix))

  // Combine both checks
  const isPublicRoute = isExactPublicRoute || isPublicPrefix

  const bypassAuthEnv = process.env.BYPASS_AUTH === 'true'
  const bypassAuthHeader = request.headers.get('x-bypass-auth') === 'true'

  // Skip auth check for public routes, static assets, or when bypass flag is set
  if (
    isPublicRoute ||
    normalizedPath.startsWith('/_next') ||
    normalizedPath === '/favicon.ico' ||
    bypassAuthEnv ||
    bypassAuthHeader
  ) {
    return NextResponse.next()
  }

  // Check for session
  const cookieNames = process.env.NODE_ENV === 'production'
    ? ['__Secure-next-auth.session-token', '__Secure-wms.next-auth.session-token']
    : ['next-auth.session-token', 'ecomos.next-auth.session-token', 'wms.next-auth.session-token']

  const hasSession = await hasCentralSession({
    request,
    cookieNames,
    centralUrl: process.env.CENTRAL_AUTH_URL,
    debug: process.env.NODE_ENV !== 'production',
  })

  // If no token and trying to access protected route, redirect to central login
  if (!hasSession && !normalizedPath.startsWith('/auth/')) {
    const defaultCentral = process.env.NODE_ENV === 'production'
      ? 'https://ecomos.targonglobal.com'
      : 'http://localhost:3000'
    const central = process.env.CENTRAL_AUTH_URL || defaultCentral
    const redirect = new URL('/login', central)

    // Build callback URL from forwarded headers (from Nginx proxy) instead of request.nextUrl
    // request.nextUrl gives us localhost:3001, but we need the public-facing URL
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'http'
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
    // Next.js strips basePath before middleware, so we need to manually prepend it
    const basePath = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || ''
    const callbackUrl = `${forwardedProto}://${forwardedHost}${basePath}${pathname}${request.nextUrl.search}`

    redirect.searchParams.set('callbackUrl', callbackUrl)
    return NextResponse.redirect(redirect)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
