import { PrismaClient } from '@prisma/client'

type GlobalWithPrisma = typeof globalThis & {
  __crossPlanPrisma?: PrismaClient
}

const globalForPrisma = globalThis as GlobalWithPrisma

export const prisma =
  globalForPrisma.__crossPlanPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__crossPlanPrisma = prisma
}

export default prisma

