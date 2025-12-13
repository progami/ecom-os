import { PrismaClient } from '@ecom-os/prisma-hrms'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const client: PrismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = client
}

export const prisma = client
export type { PrismaClient } from '@ecom-os/prisma-hrms'

export default prisma
