import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const { pathname } = request.nextUrl

  // Allow access to public routes and API routes
  if (
    pathname.startsWith('/wms/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/test') ||  // Allow test pages
    pathname.startsWith('/diagnostic') ||  // Allow diagnostic page
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next()
  }

  // Redirect to login if not authenticated
  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/wms/auth/login'
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  // Role-based access control - simplified to 2 roles
  const userRole = token.role as string
  const isAdmin = userRole === 'admin'

  // Only restrict truly admin-only routes
  const adminOnlyRoutes = [
    '/wms/admin/users',
    '/wms/admin/settings/security',
    '/wms/admin/settings/database',
    '/wms/admin/settings/general',
    '/wms/admin/settings/notifications'
  ]
  
  if (adminOnlyRoutes.some(route => pathname === route || pathname.startsWith(route + '/')) && !isAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = '/wms/unauthorized'
    return NextResponse.redirect(url)
  }

  // All other routes (finance, warehouse, reports, etc) are accessible by everyone

  // Redirect authenticated users from login page
  if (pathname === '/wms/auth/login' && token) {
    const url = request.nextUrl.clone()
    url.pathname = '/wms/dashboard'
    return NextResponse.redirect(url)
  }

  // Redirect root to WMS dashboard
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/wms/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}