// Client-side exports
export {
  TenantProvider,
  useTenant,
  useTenantCode,
} from './context'

// Constants and types
export {
  type TenantCode,
  type TenantConfig,
  TENANTS,
  TENANT_CODES,
  DEFAULT_TENANT,
  TENANT_COOKIE_NAME,
  isValidTenantCode,
  getTenantConfig,
  getAllTenants,
} from './constants'

// Prisma factory
export {
  getTenantPrismaClient,
  disconnectAllTenants,
  checkTenantConnection,
} from './prisma-factory'
