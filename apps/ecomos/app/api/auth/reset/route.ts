import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const AUTH_COOKIE_PATTERNS = ['authjs', 'next-auth', '__Secure-', '__Host-', 'csrf', 'pkce', 'callback', 'ecomos', 'session']

export async function GET(request: NextRequest) {
  const cookieDomain = process.env.COOKIE_DOMAIN || '.targonglobal.com'
  const baseUrl = process.env.NEXTAUTH_URL || 'https://ecomos.targonglobal.com'

  // Get provider and callbackUrl for direct signin flow
  const provider = request.nextUrl.searchParams.get('provider')
  const callbackUrl = request.nextUrl.searchParams.get('callbackUrl') || '/'

  let redirectUrl: URL

  if (provider) {
    // Redirect directly to signin endpoint after clearing cookies
    redirectUrl = new URL(`/api/auth/signin/${provider}`, baseUrl)
    redirectUrl.searchParams.set('callbackUrl', callbackUrl)
  } else {
    // Default to login page
    redirectUrl = new URL('/login', baseUrl)
  }

  const response = NextResponse.redirect(redirectUrl)

  // Clear ALL auth-related cookies
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
