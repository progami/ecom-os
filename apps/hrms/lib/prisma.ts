import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import type { HRMSPrismaClient } from './hrms-prisma-types'

type GlobalPrisma = {
  prisma?: HRMSPrismaClient
  pgPool?: Pool
}

const globalForPrisma = globalThis as unknown as GlobalPrisma

const connectionString =
  process.env.DATABASE_URL || 'postgresql://hrms:hrms@localhost:5432/hrms?schema=public'

const url = new URL(connectionString)
const schema = url.searchParams.get('schema') || undefined
const sslMode = (url.searchParams.get('sslmode') || '').toLowerCase()

const ssl =
  sslMode === 'disable'
    ? undefined
    : {
        rejectUnauthorized: sslMode !== 'no-verify',
      }

const pgPool =
  globalForPrisma.pgPool ||
  new Pool({
    connectionString,
    ssl,
  })

if (schema) {
  pgPool.on('connect', (client) => {
    client.query(`set search_path to "${schema}", public`).catch((err) => {
      console.error('[hrms] failed to set search_path', err)
    })
  })
}

const client: HRMSPrismaClient =
  globalForPrisma.prisma ||
  (new PrismaClient({
    adapter: new PrismaPg(pgPool, schema ? { schema } : undefined),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }) as HRMSPrismaClient)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.pgPool = pgPool
  globalForPrisma.prisma = client
}

export const prisma = client

export default prisma
