import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant/server'
export const dynamic = 'force-dynamic'

export async function GET(
 request: NextRequest,
 { params }: { params: Promise<{ id: string }> }
) {
 try {
 const { id: rateId } = await params
 const session = await auth()

 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const prisma = await getTenantPrisma()
 const rate = await prisma.costRate.findUnique({
 where: { id: rateId },
 include: {
 warehouse: {
 select: {
 id: true,
 name: true,
 code: true
 }
 }
 }
 })

 if (!rate) {
 return NextResponse.json({ error: 'Rate not found' }, { status: 404 })
 }

 const formattedRate = {
 id: rate.id,
 warehouseId: rate.warehouseId,
 warehouse: rate.warehouse,
 costCategory: rate.costCategory,
 costName: rate.costName,
 costValue: parseFloat(rate.costValue.toString()),
 unitOfMeasure: rate.unitOfMeasure,
 effectiveDate: rate.effectiveDate.toISOString(),
 endDate: rate.endDate?.toISOString() || null
 }

 return NextResponse.json(formattedRate)
 } catch (_error) {
 // console.error('Error fetching rate:', error)
 return NextResponse.json(
 { error: 'Failed to fetch rate' },
 { status: 500 }
 )
 }
}

export async function PUT(
 request: NextRequest,
 { params }: { params: Promise<{ id: string }> }
) {
 try {
  const { id: rateId } = await params
  const session = await auth()

  if (!session || session.user.role !== 'admin') {
   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prisma = await getTenantPrisma()
  const body = await request.json()
  const { costValue, endDate } = body as {
   costValue?: number
   endDate?: string | null
  }

  if (costValue === undefined && endDate === undefined) {
   return NextResponse.json({ error: 'Missing fields to update' }, { status: 400 })
  }

  if (costValue !== undefined && (typeof costValue !== 'number' || Number.isNaN(costValue) || costValue < 0)) {
   return NextResponse.json({ error: 'Invalid cost value' }, { status: 400 })
  }

  const existingRate = await prisma.costRate.findUnique({
   where: { id: rateId },
  })

  if (!existingRate) {
   return NextResponse.json({ error: 'Rate not found' }, { status: 404 })
  }

  const endOn = endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined
  if (endOn && Number.isNaN(endOn.getTime())) {
   return NextResponse.json({ error: 'Invalid end date' }, { status: 400 })
  }

  if (endOn && endOn < existingRate.effectiveDate) {
   return NextResponse.json({ error: 'End date must be on or after effective date' }, { status: 400 })
  }

  const updatedRate = await prisma.costRate.update({
   where: { id: rateId },
   data: {
    ...(costValue !== undefined ? { costValue } : {}),
    ...(endDate !== undefined ? { endDate: endOn } : {}),
   },
   include: {
    warehouse: {
     select: {
      id: true,
      name: true,
      code: true,
     },
    },
   },
  })

  const formattedRate = {
   id: updatedRate.id,
   warehouseId: updatedRate.warehouseId,
   warehouse: updatedRate.warehouse,
   costCategory: updatedRate.costCategory,
   costName: updatedRate.costName,
   costValue: parseFloat(updatedRate.costValue.toString()),
   unitOfMeasure: updatedRate.unitOfMeasure,
   effectiveDate: updatedRate.effectiveDate.toISOString(),
   endDate: updatedRate.endDate?.toISOString() || null,
  }

  return NextResponse.json(formattedRate)
 } catch (_error) {
  return NextResponse.json({ error: 'Failed to update rate' }, { status: 500 })
 }
}

export async function DELETE(
 request: NextRequest,
 { params }: { params: Promise<{ id: string }> }
) {
 try {
  const { id: rateId } = await params
  const session = await auth()

  if (!session) {
   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'admin') {
   return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const prisma = await getTenantPrisma()
  await prisma.$transaction(async (tx) => {
   await tx.storageLedger.updateMany({
    where: { costRateId: rateId },
    data: { costRateId: null },
   })

   await tx.costRate.delete({
    where: { id: rateId },
   })
  })

  return NextResponse.json({ success: true })
 } catch (_error) {
  return NextResponse.json({ error: 'Failed to delete rate' }, { status: 500 })
 }
}
