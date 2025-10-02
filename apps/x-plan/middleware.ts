import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasCentralSession } from '@ecom-os/auth'

const PUBLIC_PREFIXES = ['/api/auth/', '/_next', '/favicon.ico', '/health']
const PUBLIC_ROUTES = ['/', '/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (!isPublicRoute) {
    const debug = process.env.NODE_ENV !== 'production'
    const hasSession = await hasCentralSession({
      request,
      appId: 'x-plan',
      centralUrl: process.env.CENTRAL_AUTH_URL,
      debug,
    })

    if (!hasSession) {
      const defaultCentral = process.env.NODE_ENV === 'production' ? 'https://ecomos.targonglobal.com' : 'http://localhost:3000'
      const central = process.env.CENTRAL_AUTH_URL || defaultCentral
      const login = new URL('/login', central)
      if (debug) {
        console.log('[x-plan middleware] no session, redirecting to central login', login.toString())
      }
      login.searchParams.set('callbackUrl', request.nextUrl.toString())
      return NextResponse.redirect(login)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
