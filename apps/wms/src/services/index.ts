export { BaseService } from './base.service'
export { WarehouseService } from './warehouse.service'
export { UserService } from './user.service'
export { FinanceService } from './finance.service'
export { ReportService } from './report.service'
export { DashboardService } from './dashboard.service'
export { SkuService } from './sku.service'

// Service factory functions for dependency injection
import { getTenantPrisma } from '@/lib/tenant/server'
import { Session } from 'next-auth'
import { WarehouseService } from './warehouse.service'
import { UserService } from './user.service'
import { FinanceService } from './finance.service'
import { ReportService } from './report.service'
import { DashboardService } from './dashboard.service'
import { SkuService } from './sku.service'

export async function createWarehouseService(session: Session) {
  const prisma = await getTenantPrisma()
  return new WarehouseService({ session, prisma })
}

export async function createUserService(session: Session) {
  const prisma = await getTenantPrisma()
  return new UserService({ session, prisma })
}

export async function createFinanceService(session: Session) {
  const prisma = await getTenantPrisma()
  return new FinanceService({ session, prisma })
}

export async function createReportService(session: Session) {
  const prisma = await getTenantPrisma()
  return new ReportService({ session, prisma })
}

export async function createDashboardService(session: Session) {
  const prisma = await getTenantPrisma()
  return new DashboardService({ session, prisma })
}

export async function createSkuService(session: Session) {
  const prisma = await getTenantPrisma()
  return new SkuService({ session, prisma })
}
