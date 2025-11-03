export { BaseService } from './base.service'
export { WarehouseService } from './warehouse.service'
export { UserService } from './user.service'
export { FinanceService } from './finance.service'
export { ReportService } from './report.service'
export { DashboardService } from './dashboard.service'
export { SkuService } from './sku.service'

// Service factory functions for dependency injection
import { prisma } from '@/lib/prisma'
import { Session } from 'next-auth'
import { WarehouseService } from './warehouse.service'
import { UserService } from './user.service'
import { FinanceService } from './finance.service'
import { ReportService } from './report.service'
import { DashboardService } from './dashboard.service'
import { SkuService } from './sku.service'

export function createWarehouseService(session: Session) {
 return new WarehouseService({ session, prisma })
}

export function createUserService(session: Session) {
 return new UserService({ session, prisma })
}

export function createFinanceService(session: Session) {
 return new FinanceService({ session: session, prisma })
}

export function createReportService(session: Session) {
 return new ReportService({ session, prisma })
}

export function createDashboardService(session: Session) {
 return new DashboardService({ session, prisma })
}

export function createSkuService(session: Session) {
 return new SkuService({ session, prisma })
}
