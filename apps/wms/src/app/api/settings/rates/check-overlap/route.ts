import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
 try {
 const session = await getServerSession(authOptions)
 
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const body = await request.json()
  const { rateId, warehouseId, costName, effectiveDate } = body

  if (!warehouseId || !costName || !effectiveDate) {
  return NextResponse.json(
  { error: 'Missing warehouse, rate name, or effective date' },
  { status: 400 }
  )
  }

 const sanitizedCostName = sanitizeForDisplay(String(costName).trim())
 const effectiveOn = new Date(effectiveDate)
  if (!sanitizedCostName) {
  return NextResponse.json(
   { error: 'Rate name must be provided' },
   { status: 400 }
  )
  }

  if (Number.isNaN(effectiveOn.getTime())) {
  return NextResponse.json(
   { error: 'Effective date is invalid' },
   { status: 400 }
  )
  }

  const duplicateRate = await prisma.costRate.findFirst({
  where: {
  warehouseId,
  costName: sanitizedCostName,
  effectiveDate: effectiveOn,
  ...(rateId ? { NOT: { id: rateId } } : {})
  }
  })

  if (duplicateRate) {
  return NextResponse.json({
  hasOverlap: true,
  message: `A rate named "${sanitizedCostName}" already exists for this warehouse on ${effectiveOn.toISOString().slice(0, 10)}.`
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
