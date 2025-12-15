import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE_PATTERNS = ['authjs', 'next-auth', '__Secure-', '__Host-', 'csrf', 'pkce', 'callback-url', 'ecomos', 'session']

function hasAuthCookies(cookies: { name: string }[]): boolean {
  return cookies.some(c =>
    AUTH_COOKIE_PATTERNS.some(p => c.name.toLowerCase().includes(p.toLowerCase()))
  )
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Skip the reset route itself to avoid infinite loops
  if (pathname === '/api/auth/reset') {
    return NextResponse.next()
  }

  // On signin initiation, if there are existing auth cookies, redirect to reset first
  // This ensures we start with a clean state - middleware can only modify RESPONSE cookies,
  // but the REQUEST already has cookies that NextAuth will try to use and fail
  if (pathname.startsWith('/api/auth/signin')) {
    // Skip if we're coming back from reset (indicated by clean param)
    if (searchParams.has('clean')) {
      // Remove the clean param and continue
      const cleanUrl = new URL(request.url)
      cleanUrl.searchParams.delete('clean')
      return NextResponse.rewrite(cleanUrl)
    }

    const cookies = request.cookies.getAll()
    if (hasAuthCookies(cookies)) {
      // Redirect to reset route to clear cookies before signin
      const resetUrl = new URL('/api/auth/reset', request.url)
      resetUrl.searchParams.set('next', pathname + request.nextUrl.search)
      return NextResponse.redirect(resetUrl)
    }
  }

  // On callback from OAuth, if there are session cookies (not just CSRF), reset
  // This handles the case where old session cookies interfere with new login
  if (pathname.startsWith('/api/auth/callback')) {
    const cookies = request.cookies.getAll()
    const hasSessionCookie = cookies.some(c =>
      c.name.toLowerCase().includes('session') ||
      c.name.toLowerCase().includes('jwt')
    )

    if (hasSessionCookie) {
      // Old session exists - clear and restart
      const resetUrl = new URL('/api/auth/reset', request.url)
      return NextResponse.redirect(resetUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/auth/:path*'],
}
