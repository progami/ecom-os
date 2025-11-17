import { UserRole } from '@ecom-os/prisma-wms'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
 interface Session {
 user: {
 id: string
 role: UserRole
 warehouseId?: string
 sessionId?: string
 isDemo?: boolean
 departments?: string[]
 } & DefaultSession['user']
 }
 
 interface User {
 id: string
 email: string
 name: string
 role: UserRole
 warehouseId?: string
 sessionId?: string
 isDemo?: boolean
 }
}

declare module 'next-auth/jwt' {
 interface JWT {
 role: UserRole
 warehouseId?: string
 sessionId?: string
 isDemo?: boolean
 }
}
