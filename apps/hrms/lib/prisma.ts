import { PrismaClient } from '@prisma/client'
import type { HRMSPrismaClient } from './hrms-prisma-types'

const globalForPrisma = globalThis as unknown as { prisma?: HRMSPrismaClient }

const client: HRMSPrismaClient =
  globalForPrisma.prisma ||
  (new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }) as HRMSPrismaClient)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = client
}

export const prisma = client

export default prisma
