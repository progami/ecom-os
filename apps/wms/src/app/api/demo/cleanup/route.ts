import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(_request: NextRequest) {
 try {
 const session = await auth()
 
 if (!session || session.user.role !== 'admin') {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 // Delete demo transactions
 // Note: We no longer have a createdBy relation, need to find demo user IDs first
 const demoUsers = await prisma.user.findMany({
 where: { isDemo: true },
 select: { id: true }
 })
 const demoUserIds = demoUsers.map(u => u.id)
 
 const deletedTransactions = await prisma.inventoryTransaction.deleteMany({
 where: {
 createdById: {
 in: demoUserIds
 }
 }
 })

 // Delete demo users
 const deletedUsers = await prisma.user.deleteMany({
 where: {
 isDemo: true
 }
 })

 // Delete demo warehouses
 const deletedWarehouses = await prisma.warehouse.deleteMany({
 where: {
 code: {
 in: ['FMC', 'VGLOBAL']
 }
 }
 })

 return NextResponse.json({
 success: true,
 message: 'Demo data cleaned up successfully',
      deleted: {
        transactions: deletedTransactions.count,
        users: deletedUsers.count,
        warehouses: deletedWarehouses.count
      }
 })
 } catch (_error) {
 // console.error('Error cleaning up demo data:', _error)
 return NextResponse.json(
 { 
 error: 'Failed to clean up demo data',
 details: _error instanceof Error ? _error.message : 'Unknown error'
 },
 { status: 500 }
 )
 }
}
