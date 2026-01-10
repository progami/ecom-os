import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/auth-wrapper'
import { getTenantPrisma } from '@/lib/tenant/server'

export const GET = withAuth(async (_request, session) => {
 try {
 const prisma = await getTenantPrisma()
 // Check if the user from session exists in database
 const user = await prisma.user.findUnique({
 where: { id: session.user.id },
 select: {
 id: true,
 email: true,
 username: true,
 role: true,
 warehouseId: true,
 warehouse: {
 select: {
 code: true,
 name: true
 }
 }
 }
 })

 return NextResponse.json({
 session: {
 userId: session.user.id,
 email: session.user.email,
 role: session.user.role,
 warehouseId: session.user.warehouseId
 },
 userExists: !!user,
 userData: user || null,
 message: user 
 ? 'User exists in database' 
 : 'User from session does not exist in database!'
 })
 } catch (_error) {
 return NextResponse.json({ 
 error: 'Failed to check session',
 details: _error instanceof Error ? _error.message : 'Unknown error'
 }, { status: 500 })
 }
})