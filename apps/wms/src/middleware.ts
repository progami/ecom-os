import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Redirect /operations to /operations/inventory
  if (pathname === '/operations') {
    const url = request.nextUrl.clone()
    url.pathname = '/operations/inventory'
    return NextResponse.redirect(url)
  }
  
  // Public routes that don't require authentication
  // Use exact matches or proper prefix matching to prevent auth bypass
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/error',
    '/api/health',
    '/api/demo',
    '/api/logs',
  ]
  
  // Routes that should be prefix-matched
  const publicPrefixes = [
    '/api/auth/', // NextAuth internal routes
  ]
  
  // Check if the route is public using exact match
  const isExactPublicRoute = publicRoutes.includes(pathname)
  
  // Check if the route matches a public prefix
  const isPublicPrefix = publicPrefixes.some(prefix => pathname.startsWith(prefix))
  
  // Combine both checks
  const isPublicRoute = isExactPublicRoute || isPublicPrefix
  
  // Skip auth check for public routes, static files, and API routes
  // Note: _next and favicon.ico checks use startsWith for safety
  if (isPublicRoute || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }
  
  
  // Check for session
  let token = null
  try {
    token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET,
    })
  } catch (_error) {
    // console.error('Error getting token in middleware:', _error)
    // Continue without token - will redirect if needed
  }
  
  // If no token and trying to access protected route, redirect to login
  if (!token && !pathname.startsWith('/auth/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
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