import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCandidateSessionCookieNames, decodePortalSession, getAppEntitlement } from '@ecom-os/auth'
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
 const wmsEntitlement = decoded ? getAppEntitlement(decoded.roles, 'wms') : undefined
 const hasAccess = hasSession && !!wmsEntitlement

 // If no token or no WMS entitlement, redirect to portal
 if (!hasAccess && !normalizedPath.startsWith('/auth/')) {
   const forwardedProto = request.headers.get('x-forwarded-proto') || 'http'
   const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
   const basePath = process.env.BASE_PATH || ''
   const callbackUrl = `${forwardedProto}://${forwardedHost}${basePath}${pathname}${request.nextUrl.search}`

   // User has session but no WMS access - redirect to no-access page
   if (hasSession && !wmsEntitlement) {
     const url = request.nextUrl.clone()
     url.pathname = withBasePath('/no-access')
     url.search = ''
     return NextResponse.redirect(url)
   }

   // No session at all
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
