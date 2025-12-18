import { cookies, headers } from 'next/headers'
import {
  TenantCode,
  TENANT_COOKIE_NAME,
  DEFAULT_TENANT,
  isValidTenantCode,
  getTenantConfig,
  TenantConfig,
} from './constants'
import { getTenantPrismaClient } from './prisma-factory'
import { PrismaClient } from '@ecom-os/prisma-wms'

/**
 * Get the current tenant code from cookies or headers (server-side)
 */
export async function getCurrentTenantCode(): Promise<TenantCode> {
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

  // Default tenant
  return DEFAULT_TENANT
}

/**
 * Get the current tenant config (server-side)
 */
export async function getCurrentTenant(): Promise<TenantConfig> {
  const code = await getCurrentTenantCode()
  return getTenantConfig(code)
}

/**
 * Get Prisma client for the current tenant (server-side)
 * Use this in Server Components and API routes
 */
export async function getTenantPrisma(): Promise<PrismaClient> {
  const tenantCode = await getCurrentTenantCode()
  return getTenantPrismaClient(tenantCode)
}

/**
 * Check if a tenant cookie is set
 */
export async function hasTenantSelected(): Promise<boolean> {
  const cookieStore = await cookies()
  const cookieTenant = cookieStore.get(TENANT_COOKIE_NAME)?.value
  return isValidTenantCode(cookieTenant)
}
