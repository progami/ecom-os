import { UserRole, TenantCode } from '@ecom-os/prisma-talos'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
 interface Session {
 user: {
 id: string
 role: UserRole
 region: TenantCode
 warehouseId?: string
 sessionId?: string
 isDemo?: boolean
 } & DefaultSession['user']
 }

 interface User {
 id: string
 email: string
 name: string
 role: UserRole
 region: TenantCode
 warehouseId?: string
 sessionId?: string
 isDemo?: boolean
 }
}

declare module 'next-auth/jwt' {
 interface JWT {
 role: UserRole
 region: TenantCode
 warehouseId?: string
 sessionId?: string
 isDemo?: boolean
 }
}
