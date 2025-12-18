/**
 * Dynamic Prisma client factory for multi-tenant database connections.
 * Each tenant has its own isolated database with a separate Prisma client instance.
 */

import { PrismaClient } from '@ecom-os/prisma-wms'
import { TenantCode, TENANTS, isValidTenantCode } from './constants'

// Global cache for Prisma clients per tenant
const globalForPrisma = global as unknown as {
  tenantClients: Map<TenantCode, PrismaClient> | undefined
}

// Initialize client cache
if (!globalForPrisma.tenantClients) {
  globalForPrisma.tenantClients = new Map()
}

const clientCache = globalForPrisma.tenantClients

/**
 * Get the database URL for a specific tenant
 */
function getTenantDatabaseUrl(tenantCode: TenantCode): string {
  const tenant = TENANTS[tenantCode]
  const url = process.env[tenant.envKey]

  if (!url) {
    // In development, fall back to default DATABASE_URL if tenant-specific not set
    if (process.env.NODE_ENV !== 'production' && process.env.DATABASE_URL) {
      console.warn(`[tenant] ${tenant.envKey} not set, falling back to DATABASE_URL`)
      return process.env.DATABASE_URL
    }
    throw new Error(`Database URL not configured for tenant: ${tenantCode}. Set ${tenant.envKey} environment variable.`)
  }

  return url
}

/**
 * Create a new Prisma client for a tenant
 */
function createTenantClient(tenantCode: TenantCode): PrismaClient {
  const databaseUrl = getTenantDatabaseUrl(tenantCode)
  const schema = process.env.PRISMA_SCHEMA

  // Apply schema if specified
  const datasourceUrl = (() => {
    if (!schema) return databaseUrl

    try {
      const url = new URL(databaseUrl)
      url.searchParams.set('schema', schema)
      return url.toString()
    } catch {
      const separator = databaseUrl.includes('?') ? '&' : '?'
      return `${databaseUrl}${separator}schema=${schema}`
    }
  })()

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: { url: datasourceUrl },
    },
  })

  return client
}

/**
 * Get or create a Prisma client for a specific tenant.
 * Uses singleton pattern to prevent multiple instances per tenant.
 */
export function getTenantPrismaClient(tenantCode: TenantCode): PrismaClient {
  if (!isValidTenantCode(tenantCode)) {
    throw new Error(`Invalid tenant code: ${tenantCode}`)
  }

  const existing = clientCache.get(tenantCode)
  if (existing) {
    return existing
  }

  const client = createTenantClient(tenantCode)
  clientCache.set(tenantCode, client)

  return client
}

/**
 * Disconnect all tenant clients (for graceful shutdown)
 */
export async function disconnectAllTenants(): Promise<void> {
  const disconnectPromises: Promise<void>[] = []

  for (const [tenantCode, client] of clientCache.entries()) {
    console.log(`[tenant] Disconnecting ${tenantCode} database...`)
    disconnectPromises.push(client.$disconnect())
  }

  await Promise.all(disconnectPromises)
  clientCache.clear()
}

/**
 * Check if a tenant's database is accessible
 */
export async function checkTenantConnection(tenantCode: TenantCode): Promise<boolean> {
  try {
    const client = getTenantPrismaClient(tenantCode)
    await client.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error(`[tenant] Connection check failed for ${tenantCode}:`, error)
    return false
  }
}
