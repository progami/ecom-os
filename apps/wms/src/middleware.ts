import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCandidateSessionCookieNames, decodePortalSession } from '@ecom-os/auth'
import { withBasePath, withoutBasePath } from '@/lib/utils/base-path'
import { portalUrl } from '@/lib/portal'
import { TENANT_COOKIE_NAME, isValidTenantCode } from '@/lib/tenant/constants'

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
 if (process.env.NODE_ENV !== 'production') {
   const cookieHeader = request.headers.get('cookie')
   if (cookieHeader) {
     const names = cookieHeader.split(';').map((part) => part.split('=')[0]?.trim()).filter(Boolean)
     console.warn('[wms middleware] incoming cookies', names)
   } else {
     console.warn('[wms middleware] no cookies on request', normalizedPath)
   }
 }

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
 '/no-access',
 '/api/health',
 '/api/logs',
 ]

 // Routes that should be prefix-matched
 const publicPrefixes = [
 '/api/auth/', // NextAuth internal routes
 '/api/tenant/', // Tenant selection routes
 ]

 // Check if the route is public using exact match
 const isExactPublicRoute = publicRoutes.includes(normalizedPath)

 // Check if the route matches a public prefix
 const isPublicPrefix = publicPrefixes.some(prefix => normalizedPath.startsWith(prefix))

 // Combine both checks
 const isPublicRoute = isExactPublicRoute || isPublicPrefix

 // Skip auth check for public routes and static assets
 if (
 isPublicRoute ||
 normalizedPath.startsWith('/_next') ||
 normalizedPath === '/favicon.ico'
 ) {
 return NextResponse.next()
 }

 // Check for session and app entitlement
 const cookieNames = Array.from(new Set([
   ...getCandidateSessionCookieNames('ecomos'),
   ...getCandidateSessionCookieNames('wms'),
 ]))
 const sharedSecret = process.env.PORTAL_AUTH_SECRET ?? 'dev_portal_auth_secret_2025'
 const authDebugFlag =
   typeof process.env.NEXTAUTH_DEBUG === 'string' &&
   ['1', 'true', 'yes', 'on'].includes(process.env.NEXTAUTH_DEBUG.toLowerCase())

 const cookieHeader = request.headers.get('cookie')
 const decoded = await decodePortalSession({
   cookieHeader,
   cookieNames,
   secret: sharedSecret,
   debug: authDebugFlag,
 })

 const hasSession = !!decoded

 // If no session, redirect to portal login
 // Note: Region-based access control is handled by the tenant guard in API routes
 if (!hasSession && !normalizedPath.startsWith('/auth/')) {
   const forwardedProto = request.headers.get('x-forwarded-proto') || 'http'
   const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
   const basePath = process.env.BASE_PATH || ''
   const callbackUrl = `${forwardedProto}://${forwardedHost}${basePath}${pathname}${request.nextUrl.search}`

   const redirect = portalUrl('/login', request, `${forwardedProto}://${forwardedHost}`)
   redirect.searchParams.set('callbackUrl', callbackUrl)
   return NextResponse.redirect(redirect)
 }

 // Tenant handling for authenticated users
 const tenantCookie = request.cookies.get(TENANT_COOKIE_NAME)?.value
 const hasTenant = isValidTenantCode(tenantCookie)

 // If no tenant selected and not on world map, redirect to world map
 // Skip this for API routes - they should handle missing tenant themselves
 if (!hasTenant && !normalizedPath.startsWith('/api/')) {
   const url = request.nextUrl.clone()
   url.pathname = withBasePath('/')
   url.search = ''
   return NextResponse.redirect(url)
 }

 // Inject tenant into headers for API routes
 const response = NextResponse.next()
 if (hasTenant) {
   response.headers.set('x-tenant', tenantCookie)
 }

 return response
}

export const config = {
 matcher: [
 '/((?!_next/static|_next/image|favicon.ico).*)',
 ],
}
