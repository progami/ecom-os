import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      tenantId?: string
      tenantName?: string
    } & DefaultSession['user']
  }
  interface User {
    id: string
    email: string
    name?: string
    tenantId?: string
    tenantName?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId?: string
    tenantName?: string
  }
}

