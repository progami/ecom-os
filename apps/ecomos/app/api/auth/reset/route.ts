import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE_PATTERNS = ['authjs', 'next-auth', '__Secure-', '__Host-', 'csrf', 'pkce', 'callback', 'ecomos', 'session']

export async function GET(request: NextRequest) {
  const cookieDomain = process.env.COOKIE_DOMAIN || '.targonglobal.com'
  const baseUrl = process.env.NEXTAUTH_URL || 'https://ecomos.targonglobal.com'

  // Get the next URL to redirect to after clearing cookies
  const nextPath = request.nextUrl.searchParams.get('next')
  let redirectUrl: URL

  if (nextPath && nextPath.startsWith('/api/auth/signin')) {
    // If redirecting back to signin, add clean param to skip middleware redirect
    redirectUrl = new URL(nextPath, baseUrl)
    redirectUrl.searchParams.set('clean', '1')
  } else {
    // Default to login page
    redirectUrl = new URL('/login', baseUrl)
  }

  const response = NextResponse.redirect(redirectUrl)

  // Get all cookies from request and clear auth-related ones
  const cookies = request.cookies.getAll()

  for (const cookie of cookies) {
    const nameLower = cookie.name.toLowerCase()
    if (AUTH_COOKIE_PATTERNS.some(p => nameLower.includes(p.toLowerCase()))) {
      // Clear with domain
      response.cookies.set({
        name: cookie.name,
        value: '',
        domain: cookieDomain,
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      })
      // Clear without domain (for localhost)
      response.cookies.set({
        name: cookie.name,
        value: '',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      })
    }
  }

  return response
}
