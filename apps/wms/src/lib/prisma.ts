import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as {
 prisma: PrismaClient | undefined
}

// Create PrismaClient with proper connection pool settings
const createPrismaClient = () => {
  const baseUrl = process.env.DATABASE_URL
  const schema = process.env.PRISMA_SCHEMA

  const datasourceUrl = (() => {
    if (!baseUrl) return baseUrl
    if (!schema) return baseUrl

    try {
      const url = new URL(baseUrl)
      url.searchParams.set('schema', schema)
      return url.toString()
    } catch (_error) {
      // Fallback to appending manually if URL parsing fails
      const separator = baseUrl.includes('?') ? '&' : '?'
      return `${baseUrl}${separator}schema=${schema}`
    }
  })()

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  })
}

// Use singleton pattern to prevent multiple instances
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
 globalForPrisma.prisma = prisma
}

export default prisma
