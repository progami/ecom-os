import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { decodePortalSession, getCandidateSessionCookieNames } from '@ecom-os/auth'
import { auth } from '@/lib/auth'
import { getCurrentTenantCode, getTenantPrisma } from '@/lib/tenant/server'
import { TENANT_COOKIE_NAME } from '@/lib/tenant/constants'

/**
 * Debug endpoint to trace the entire auth flow
 * This helps identify where authentication fails
 *
 * DO NOT USE IN PRODUCTION - remove after debugging
 */
export async function GET(request: NextRequest) {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    steps: [],
  }

  const addStep = (name: string, data: unknown) => {
    (debug.steps as unknown[]).push({ name, data })
  }

  try {
    // Step 1: Check environment
    addStep('1. Environment', {
      NODE_ENV: process.env.NODE_ENV,
      hasPortalAuthSecret: !!process.env.PORTAL_AUTH_SECRET,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      secretsMatch: process.env.PORTAL_AUTH_SECRET === process.env.NEXTAUTH_SECRET,
      portalAuthSecretPrefix: process.env.PORTAL_AUTH_SECRET?.slice(0, 10) + '...',
      cookieDomain: process.env.COOKIE_DOMAIN,
    })

    // Step 2: Check cookies
    const cookieStore = await cookies()
    const allCookieNames = cookieStore.getAll().map(c => c.name)
    const tenantCookie = cookieStore.get(TENANT_COOKIE_NAME)?.value
    addStep('2. Cookies', {
      allCookieNames,
      tenantCookie,
      hasTenantCookie: !!tenantCookie,
    })

    // Step 3: Check headers
    const headersList = await headers()
    const xTenant = headersList.get('x-tenant')
    addStep('3. Headers', {
      xTenant,
      cookie: headersList.get('cookie')?.slice(0, 100) + '...',
    })

    // Step 4: Decode portal session (same as middleware)
    const cookieHeader = request.headers.get('cookie')
    const cookieNames = Array.from(new Set([
      ...getCandidateSessionCookieNames('ecomos'),
      ...getCandidateSessionCookieNames('wms'),
    ]))
    const sharedSecret = process.env.PORTAL_AUTH_SECRET ?? 'dev_portal_auth_secret_2025'

    const decoded = await decodePortalSession({
      cookieHeader,
      cookieNames,
      secret: sharedSecret,
      debug: true,
    })

    addStep('4. Portal Session Decode', {
      success: !!decoded,
      decoded: decoded ? {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        hasRoles: !!decoded.roles,
        hasApps: !!decoded.apps,
        exp: decoded.exp,
        expDate: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
      } : null,
      triedCookieNames: cookieNames,
    })

    // Step 5: Get tenant code
    const tenantCode = await getCurrentTenantCode()
    addStep('5. Tenant Code', {
      tenantCode,
      source: xTenant ? 'header' : tenantCookie ? 'cookie' : 'default',
    })

    // Step 6: Call auth() - this is what API routes use
    const session = await auth()
    addStep('6. NextAuth Session', {
      hasSession: !!session,
      session: session ? {
        userId: session.user?.id,
        email: session.user?.email,
        name: session.user?.name,
        role: (session.user as any)?.role,
        region: (session.user as any)?.region,
        warehouseId: (session.user as any)?.warehouseId,
      } : null,
    })

    // Step 7: Check if user exists in tenant DB
    if (decoded?.email) {
      try {
        const prisma = await getTenantPrisma()
        const user = await prisma.user.findUnique({
          where: { email: decoded.email as string },
          select: { id: true, email: true, role: true, region: true, warehouseId: true },
        })
        addStep('7. User in Tenant DB', {
          found: !!user,
          user,
          queriedEmail: decoded.email,
          queriedTenant: tenantCode,
        })
      } catch (dbError) {
        addStep('7. User in Tenant DB', {
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
        })
      }
    } else {
      addStep('7. User in Tenant DB', {
        skipped: true,
        reason: 'No email in decoded token',
      })
    }

    // Step 8: Tenant access check
    const userRegion = (session?.user as any)?.region
    addStep('8. Tenant Access Check', {
      userRegion,
      currentTenant: tenantCode,
      wouldPass: userRegion === tenantCode,
      failReason: userRegion !== tenantCode
        ? `Region '${userRegion ?? 'undefined'}' !== Tenant '${tenantCode}'`
        : null,
    })

    debug.summary = {
      middlewareWouldPass: !!decoded,
      authWouldPass: !!session,
      tenantGuardWouldPass: userRegion === tenantCode,
      overallWouldPass: !!decoded && !!session && userRegion === tenantCode,
    }

    return NextResponse.json(debug, { status: 200 })
  } catch (error) {
    debug.error = error instanceof Error ? error.message : 'Unknown error'
    debug.stack = error instanceof Error ? error.stack : null
    return NextResponse.json(debug, { status: 500 })
  }
}
