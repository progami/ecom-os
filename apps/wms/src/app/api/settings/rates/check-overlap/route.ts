import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
 try {
 const session = await getServerSession(authOptions)
 
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const body = await request.json()
  const { rateId, warehouseId, costCategory } = body

  if (!warehouseId || !costCategory) {
  return NextResponse.json(
  { error: 'Missing warehouse or cost category' },
  { status: 400 }
  )
  }

  const duplicateRate = await prisma.costRate.findFirst({
  where: {
  warehouseId,
  costCategory,
  ...(rateId ? { NOT: { id: rateId } } : {})
  }
  })

  if (duplicateRate) {
  return NextResponse.json({
  hasOverlap: true,
  message: `A ${costCategory} rate already exists for this warehouse.`
  })
  }

  return NextResponse.json({ hasOverlap: false })
 } catch (_error) {
 // console.error('Error checking rate overlap:', error)
 return NextResponse.json(
 { error: 'Failed to check overlap' },
 { status: 500 }
 )
 }
}
