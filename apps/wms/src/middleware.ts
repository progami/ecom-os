import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
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

  // Skip auth check for public routes and static assets
  if (isPublicRoute || normalizedPath.startsWith('/_next') || normalizedPath === '/favicon.ico') {
    return NextResponse.next()
  }

  // Check for session
  let token = null
  try {
    const namesToTry = [
      process.env.NODE_ENV === 'production'
        ? '__Secure-wms.next-auth.session-token'
        : 'wms.next-auth.session-token',
      process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
    ]

    for (const name of namesToTry) {
      token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName: name,
      })
      if (token) break
    }
  } catch (_error) {
    // Continue without token - will redirect if needed
  }

  // If no token and trying to access protected route, redirect to login
  if (!token && !normalizedPath.startsWith('/auth/')) {
    const url = request.nextUrl.clone()
    url.pathname = withBasePath('/auth/login')
    url.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
