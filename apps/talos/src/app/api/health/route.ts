import { NextResponse } from 'next/server'
import { TENANT_CODES, TENANTS, type TenantCode } from '@/lib/tenant/constants'
import { getTenantPrismaClient } from '@/lib/tenant/prisma-factory'

// Health check endpoint for monitoring and CI
export async function GET() {
  const tenantChecks = TENANT_CODES.reduce<Record<TenantCode, boolean>>(
    (acc, tenant) => ({ ...acc, [tenant]: false }),
    {} as Record<TenantCode, boolean>
  )

  const configuredTenants = TENANT_CODES.filter((tenant) => {
    const envKey = TENANTS[tenant].envKey
    return Boolean(process.env[envKey] || process.env.DATABASE_URL)
  })

  await Promise.all(
    configuredTenants.map(async (tenant) => {
      try {
        const prisma = await getTenantPrismaClient(tenant)
        await prisma.user.findFirst({ select: { id: true } })
        tenantChecks[tenant] = true
      } catch (error) {
        console.error(`[health] database check failed for ${tenant}`, error)
        tenantChecks[tenant] = false
      }
    })
  )

  const checks = {
    server: true,
    database: configuredTenants.length > 0 ? configuredTenants.every((tenant) => tenantChecks[tenant]) : false,
    redis: Boolean(process.env.REDIS_URL),
    tenants: tenantChecks,
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || 'unknown',
    checks,
  }

  const isHealthy = checks.server && (process.env.CI || checks.database)

  return NextResponse.json(health, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
