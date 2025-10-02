import { PrismaClient } from './generated/client'

let prismaInstance: PrismaClient | null = (globalThis as typeof globalThis & { __centralAuthPrisma?: PrismaClient | null }).__centralAuthPrisma ?? null

export function getCentralAuthPrisma(): PrismaClient {
  if (!process.env.CENTRAL_DB_URL) {
    throw new Error('CENTRAL_DB_URL is not configured')
  }

  if (!prismaInstance) {
    prismaInstance = new PrismaClient()
    if (process.env.NODE_ENV !== 'production') {
      ;(globalThis as typeof globalThis & { __centralAuthPrisma?: PrismaClient | null }).__centralAuthPrisma = prismaInstance
    }
  }

  return prismaInstance
}

declare global {
  // eslint-disable-next-line no-var -- reuse prisma in dev hot reload
  var __centralAuthPrisma: PrismaClient | null | undefined
}
