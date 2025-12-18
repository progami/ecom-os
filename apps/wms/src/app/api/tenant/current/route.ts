import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import {
  TENANT_COOKIE_NAME,
  DEFAULT_TENANT,
  isValidTenantCode,
  getTenantConfig,
  getAllTenants,
} from '@/lib/tenant/constants'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tenant/current
 * Get the current tenant and available tenants for the user
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant from cookie
    const cookieStore = await cookies()
    const tenantCookie = cookieStore.get(TENANT_COOKIE_NAME)?.value

    // Validate and get tenant code
    const tenantCode = isValidTenantCode(tenantCookie) ? tenantCookie : DEFAULT_TENANT

    const current = getTenantConfig(tenantCode)

    // TODO: Filter available tenants based on user's access
    // For now, return all tenants
    const available = getAllTenants().map((t) => ({
      code: t.code,
      name: t.name,
      displayName: t.displayName,
      flag: t.flag,
    }))

    return NextResponse.json({
      current: {
        code: current.code,
        name: current.name,
        displayName: current.displayName,
        flag: current.flag,
        timezone: current.timezone,
        currency: current.currency,
      },
      available,
    })
  } catch (error) {
    console.error('[tenant/current] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get current tenant' },
      { status: 500 }
    )
  }
}
