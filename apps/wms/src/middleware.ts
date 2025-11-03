import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCandidateSessionCookieNames, hasPortalSession } from '@ecom-os/auth'
import { withBasePath, withoutBasePath } from '@/lib/utils/base-path'
import { portalUrl } from '@/lib/portal'

if (typeof process !== 'undefined' && process.env) {
 const devSecret = 'dev_portal_auth_secret_2025'
 if (!process.env.PORTAL_AUTH_SECRET) {
 process.env.PORTAL_AUTH_SECRET = devSecret
 }
 if (!process.env.NEXTAUTH_SECRET) {
 process.env.NEXTAUTH_SECRET = process.env.PORTAL_AUTH_SECRET ?? devSecret
 }
}

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
 '/api/demo/setup',
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

 const bypassAuthEnv = process.env.BYPASS_AUTH === 'true'
 const bypassAuthHeader = request.headers.get('x-bypass-auth') === 'true'

 // Skip auth check for public routes, static assets, or when bypass flag is set
 if (
 isPublicRoute ||
 normalizedPath.startsWith('/_next') ||
 normalizedPath === '/favicon.ico' ||
 bypassAuthEnv ||
 bypassAuthHeader
 ) {
 return NextResponse.next()
 }

 // Check for session using shared cookie naming scheme
const cookieNames = Array.from(new Set([
...getCandidateSessionCookieNames('ecomos'),
...getCandidateSessionCookieNames('wms'),
]))
const sharedSecret = process.env.PORTAL_AUTH_SECRET ?? 'dev_portal_auth_secret_2025'
if (process.env.NODE_ENV !== 'production') {
 // eslint-disable-next-line no-console
 console.log('[WMS middleware] using shared secret', sharedSecret ? sharedSecret.length : 0)
}
 const hasSession = await hasPortalSession({
 request,
 appId: 'ecomos',
 cookieNames,
secret: sharedSecret,
 portalUrl: process.env.PORTAL_AUTH_URL,
 debug: true, // Always debug for now
 })

 // If no token and trying to access protected route, redirect to portal login
 if (!hasSession && !normalizedPath.startsWith('/auth/')) {
 // Build callback URL from forwarded headers (from Nginx proxy) instead of request.nextUrl
 // request.nextUrl gives us localhost:3001, but we need the public-facing URL
 const forwardedProto = request.headers.get('x-forwarded-proto') || 'http'
 const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
 // Next.js strips basePath before middleware runs, so manually prepend it
 const basePath = process.env.BASE_PATH || ''
 const callbackUrl = `${forwardedProto}://${forwardedHost}${basePath}${pathname}${request.nextUrl.search}`

 const redirect = portalUrl('/login', request, `${forwardedProto}://${forwardedHost}`)
 redirect.searchParams.set('callbackUrl', callbackUrl)
 return NextResponse.redirect(redirect)
 }

 return NextResponse.next()
}

export const config = {
 matcher: [
 '/((?!_next/static|_next/image|favicon.ico).*)',
 ],
}
