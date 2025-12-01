import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const databaseUrl = process.env.DATABASE_URL || 'postgresql://hrms:hrms@localhost:5432/hrms?schema=public'
const dbSchema = (() => {
  try {
    const u = new URL(databaseUrl)
    return u.searchParams.get('schema') || 'public'
  } catch {
    return 'public'
  }
})()

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
})
