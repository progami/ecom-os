import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import {
  TenantCode,
  isValidTenantCode,
  TENANT_COOKIE_NAME,
  TENANT_COOKIE_MAX_AGE,
  getTenantConfig,
} from '@/lib/tenant/constants'

export const dynamic = 'force-dynamic'

/**
 * POST /api/tenant/select
 * Set the current tenant for the user session
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tenant } = body as { tenant: string }

    // Validate tenant code
    if (!isValidTenantCode(tenant)) {
      return NextResponse.json(
        { error: `Invalid tenant code: ${tenant}` },
        { status: 400 }
      )
    }

    const tenantCode = tenant as TenantCode

    // Validate user has access to this tenant based on their region
    const userRegion = session.user?.region
    if (userRegion !== tenantCode) {
      return NextResponse.json(
        { error: `Access denied: Your account is not authorized for the ${tenantCode} region` },
        { status: 403 }
      )
    }

    // Set tenant cookie
    const cookieStore = await cookies()
    cookieStore.set(TENANT_COOKIE_NAME, tenantCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TENANT_COOKIE_MAX_AGE,
      path: '/',
    })

    const config = getTenantConfig(tenantCode)

    return NextResponse.json({
      success: true,
      tenant: {
        code: config.code,
        name: config.name,
        displayName: config.displayName,
      },
    })
  } catch (error) {
    console.error('[tenant/select] Error:', error)
    return NextResponse.json(
      { error: 'Failed to select tenant' },
      { status: 500 }
    )
  }
}
