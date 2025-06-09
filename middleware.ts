import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Routes that don't require authentication
const publicRoutes = [
  '/auth/login',
  '/auth/error',
  '/api/auth',
]

// Permission mapping for routes
// For now, both admin and staff have same access except for admin panel
const routePermissions: Record<string, string[]> = {
  '/wms': ['staff'], // Both admin and staff can access
  '/bookkeeping': ['staff'], // Both admin and staff can access
  '/admin': ['admin'], // Only admin can access (for future use)
  '/api/v1/wms': ['staff'],
  '/api/v1/bookkeeping': ['staff'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if route is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  if (isPublicRoute) {
    // If user is authenticated and trying to access login, redirect to app-selector
    const token = await getToken({ req: request })
    if (token && pathname === '/auth/login') {
      return NextResponse.redirect(new URL('/app-selector', request.url))
    }
    return NextResponse.next()
  }

  // Get the token
  const token = await getToken({ req: request })

  // If no token, redirect to login
  if (!token) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check if token is expired
  if (token.exp && Date.now() >= token.exp * 1000) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check permissions for protected routes
  const userPermissions = token.permissions as string[] || []
  
  // Find which permission is required for this route
  const requiredPermissions = Object.entries(routePermissions).find(([route]) => 
    pathname.startsWith(route)
  )?.[1]

  if (requiredPermissions) {
    const hasPermission = requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    )

    if (!hasPermission) {
      // For API routes, return 403
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { 
            status: 403,
            headers: { 'content-type': 'application/json' }
          }
        )
      }
      
      // For pages, redirect to unauthorized
      return NextResponse.redirect(new URL('/wms/unauthorized', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}