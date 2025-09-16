import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes
  const PUBLIC_PREFIXES = ['/api/auth/', '/_next', '/favicon.ico']
  const PUBLIC_ROUTES = ['/', '/health']
  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  if (!isPublic) {
    // Check central SSO cookie
    let hasSession = false
    try {
      const candidateNames = [
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'ecomos.next-auth.session-token',
      ]
      for (const name of candidateNames) {
        const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET, cookieName: name })
        if (token) { hasSession = true; break }
      }
    } catch {}

    if (!hasSession) {
      const central = process.env.CENTRAL_AUTH_URL || 'https://ecomos.targonglobal.com'
      const login = new URL('/login', central)
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

