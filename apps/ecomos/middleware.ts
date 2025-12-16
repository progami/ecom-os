import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import type { Session } from 'next-auth'

// Extend NextRequest type for auth middleware
interface NextAuthRequest extends NextRequest {
  auth: Session | null
}

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.targonglobal.com'

// All known session token cookie names
const SESSION_COOKIES = [
  '__Secure-authjs.session-token',
  'authjs.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
  'ecomos.next-auth.session-token',
]

// All auth-related cookie names to clear
const AUTH_COOKIES = [
  '__Secure-next-auth.session-token',
  '__Secure-next-auth.callback-url',
  '__Secure-next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.session-token',
  'next-auth.callback-url',
  'next-auth.csrf-token',
  'ecomos.next-auth.session-token',
  'ecomos.next-auth.callback-url',
  'ecomos.next-auth.csrf-token',
  '__Secure-authjs.session-token',
  '__Secure-authjs.callback-url',
  '__Secure-authjs.csrf-token',
  'authjs.session-token',
  'authjs.callback-url',
  'authjs.csrf-token',
]

function hasSessionCookie(request: NextRequest): boolean {
  for (const name of SESSION_COOKIES) {
    const cookie = request.cookies.get(name)
    if (cookie?.value) {
      return true
    }
  }
  return false
}

function clearAllAuthCookies(response: NextResponse, request: NextRequest): void {
  // Clear all known cookies - both with domain and without (host-only)
  for (const name of AUTH_COOKIES) {
    // With domain
    response.cookies.set({
      name,
      value: '',
      domain: COOKIE_DOMAIN,
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      secure: true,
    })
    // Without domain (host-only)
    response.cookies.set({
      name,
      value: '',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      secure: true,
    })
    // Without secure flag (for non-__Secure- cookies)
    if (!name.startsWith('__Secure-') && !name.startsWith('__Host-')) {
      response.cookies.set({
        name,
        value: '',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      })
      response.cookies.set({
        name,
        value: '',
        domain: COOKIE_DOMAIN,
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      })
    }
  }

  // Also clear any cookies from the request that look auth-related
  const patterns = ['next-auth', 'authjs', 'csrf', 'session', 'callback', 'ecomos']
  request.cookies.getAll().forEach(cookie => {
    if (patterns.some(p => cookie.name.toLowerCase().includes(p))) {
      response.cookies.set({
        name: cookie.name,
        value: '',
        domain: COOKIE_DOMAIN,
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        secure: true,
      })
      response.cookies.set({
        name: cookie.name,
        value: '',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        secure: true,
      })
      response.cookies.set({
        name: cookie.name,
        value: '',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      })
    }
  })
}

export default auth(async function middleware(request: NextAuthRequest) {
  const { pathname } = request.nextUrl

  // Skip auth routes, login page, static files, etc.
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/logout') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if user has a session cookie
  const hasCookie = hasSessionCookie(request)

  // Get session (auth wrapper provides this)
  const session = request.auth

  // If has cookie but no valid session = corrupted/stale session
  // Clear all cookies and redirect to login
  if (hasCookie && !session) {
    console.log('[middleware] Session cookie exists but session is invalid - clearing cookies')
    const loginUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(loginUrl)
    clearAllAuthCookies(response, request)
    return response
  }

  // No session and no cookie = redirect to login (handled by pages)
  // Valid session = continue
  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|_next).*)',
  ],
}
