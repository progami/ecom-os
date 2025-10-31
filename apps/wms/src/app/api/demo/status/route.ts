import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
 try {
 // Check authentication
 const session = await getServerSession(authOptions)
 if (!session || !session.user) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 // Check if demo data exists by looking for demo warehouses
 const demoWarehouse = await prisma.warehouse.findFirst({
 where: {
 OR: [
 { code: 'LON-01' },
 { code: 'MAN-01' }
 ]
 }
 })

 return NextResponse.json({
 isDemoMode: !!demoWarehouse
 })
 } catch (_error) {
 // console.error('Error checking demo status:', error)
 return NextResponse.json(
 { error: 'Failed to check demo status' },
 { status: 500 }
 )
 }
}