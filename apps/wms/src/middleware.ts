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
    redirect.searchParams.set('callbackUrl', request.nextUrl.toString())
    return NextResponse.redirect(redirect)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
