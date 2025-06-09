import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { authOptionsMock } from '@/lib/auth-mock'

// Use mock auth if database is not configured
const isDevelopment = process.env.NODE_ENV === 'development'
const hasDatabase = !!process.env.DATABASE_URL

const handler = NextAuth(hasDatabase ? authOptions : authOptionsMock)

export { handler as GET, handler as POST }