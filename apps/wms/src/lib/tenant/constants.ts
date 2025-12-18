/**
 * Multi-tenant configuration for WMS regions.
 * Each tenant operates as a completely isolated instance with its own database.
 */

export type TenantCode = 'US' | 'UK'

export interface TenantConfig {
  code: TenantCode
  name: string
  displayName: string
  flag: string
  coordinates: [number, number] // [longitude, latitude]
  timezone: string
  currency: string
  color: string
  envKey: string // Environment variable key for database URL
}

export const TENANTS: Record<TenantCode, TenantConfig> = {
  US: {
    code: 'US',
    name: 'United States',
    displayName: 'US West',
    flag: '🇺🇸',
    coordinates: [-118.2437, 34.0522], // Los Angeles
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    color: '#3B82F6', // Blue
    envKey: 'DATABASE_URL_US',
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    displayName: 'Europe',
    flag: '🇬🇧',
    coordinates: [-0.1278, 51.5074], // London
    timezone: 'Europe/London',
    currency: 'GBP',
    color: '#10B981', // Green
    envKey: 'DATABASE_URL_UK',
  },
} as const

export const TENANT_CODES = Object.keys(TENANTS) as TenantCode[]

export const DEFAULT_TENANT: TenantCode = 'US'

export const TENANT_COOKIE_NAME = 'wms-tenant'
export const TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/**
 * Validate if a string is a valid tenant code
 */
export function isValidTenantCode(code: string | undefined | null): code is TenantCode {
  return !!code && code in TENANTS
}

/**
 * Get tenant config by code
 */
export function getTenantConfig(code: TenantCode): TenantConfig {
  return TENANTS[code]
}

/**
 * Get all tenant configs as array
 */
export function getAllTenants(): TenantConfig[] {
  return Object.values(TENANTS)
}
