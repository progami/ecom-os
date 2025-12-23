import { PrismaClient } from '@ecom-os/prisma-wms'
import { headers, cookies } from 'next/headers'
import { getTenantPrismaClient } from './tenant/prisma-factory'
import { TENANT_COOKIE_NAME, DEFAULT_TENANT, isValidTenantCode, TenantCode } from './tenant/constants'

const globalForPrisma = global as unknown as {
 prisma: PrismaClient | undefined
}

// Create PrismaClient with proper connection pool settings (legacy singleton)
const createPrismaClient = () => {
  const baseUrl = process.env.DATABASE_URL
  const schema = process.env.PRISMA_SCHEMA

  const datasourceUrl = (() => {
    if (!baseUrl) return baseUrl
    if (!schema) return baseUrl

    try {
      const url = new URL(baseUrl)
      url.searchParams.set('schema', schema)
      return url.toString()
    } catch (_error) {
      // Fallback to appending manually if URL parsing fails
      const separator = baseUrl.includes('?') ? '&' : '?'
      return `${baseUrl}${separator}schema=${schema}`
    }
  })()

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  })
}

// Legacy singleton - used when tenant context is not available
// Will be deprecated once full multi-tenancy is rolled out
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
 globalForPrisma.prisma = prisma
}

/**
 * Get the current tenant code from request context
 * Checks headers first (set by middleware), then cookies
 */
async function getCurrentTenantCode(): Promise<TenantCode> {
  try {
    // First check headers (set by middleware)
    const headersList = await headers()
    const headerTenant = headersList.get('x-tenant')
    if (isValidTenantCode(headerTenant)) {
      return headerTenant
    }

    // Fall back to cookie
    const cookieStore = await cookies()
    const cookieTenant = cookieStore.get(TENANT_COOKIE_NAME)?.value
    if (isValidTenantCode(cookieTenant)) {
      return cookieTenant
    }
  } catch {
    // Headers/cookies not available (e.g., in non-request context)
  }

  // Default tenant as fallback
  return DEFAULT_TENANT
}

/**
 * Get tenant-aware Prisma client for use in API routes and Server Components.
 * Automatically uses the correct database based on current tenant context.
 *
 * @example
 * // In API route or Server Component
 * const db = await getTenantPrisma()
 * const warehouses = await db.warehouse.findMany()
 */
export async function getTenantPrisma(): Promise<PrismaClient> {
  const tenantCode = await getCurrentTenantCode()
  return await getTenantPrismaClient(tenantCode)
}

/**
 * Get Prisma client for a specific tenant (when you know the tenant code)
 *
 * @example
 * const usDb = getPrismaForTenant('US')
 * const ukDb = getPrismaForTenant('UK')
 */
export async function getPrismaForTenant(tenantCode: TenantCode): Promise<PrismaClient> {
  return await getTenantPrismaClient(tenantCode)
}

export default prisma
