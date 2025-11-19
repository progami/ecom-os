import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
export const dynamic = 'force-dynamic'

export async function GET(
 request: NextRequest,
 { params }: { params: Promise<{ id: string }> }
) {
 try {
 const { id: rateId } = await params
 const session = await getServerSession(authOptions)
 
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

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
 const session = await getServerSession(authOptions)
 
 if (!session || session.user.role !== 'admin') {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const body = await request.json()
 const { costValue, unitOfMeasure, endDate, costName: rawCostName } = body

// Validate required fields
 if (costValue === undefined || !unitOfMeasure) {
 return NextResponse.json(
 { error: 'Missing required fields' },
 { status: 400 }
 )
 }

 // Get existing rate to check category
 const existingRate = await prisma.costRate.findUnique({
 where: { id: rateId }
})

 if (!existingRate) {
 return NextResponse.json({ error: 'Rate not found' }, { status: 404 })
 }

 // Special validation for Storage category
 if (existingRate.costCategory === 'Storage' && unitOfMeasure !== 'pallet/week') {
 return NextResponse.json(
 { error: 'Storage rates must use "pallet/week" as the unit of measure' },
 { status: 400 }
 )
 }

 const sanitizedCostName =
 typeof rawCostName === 'string' && rawCostName.trim().length > 0
  ? sanitizeForDisplay(rawCostName.trim())
  : existingRate.costName

 if (sanitizedCostName !== existingRate.costName) {
  const existingName = await prisma.costRate.findFirst({
   where: {
    warehouseId: existingRate.warehouseId,
    costName: sanitizedCostName,
    effectiveDate: existingRate.effectiveDate,
    id: { not: rateId }
   }
  })

  if (existingName) {
   return NextResponse.json(
    {
     error: `Another rate named "${sanitizedCostName}" already exists for this warehouse on ${existingRate.effectiveDate.toISOString().slice(0, 10)}.`
    },
    { status: 400 }
   )
  }
 }

 const updatedRate = await prisma.costRate.update({
 where: { id: rateId },
 data: {
  costName: sanitizedCostName,
  unitOfMeasure,
  costValue,
 endDate: endDate ? new Date(endDate) : null,
 updatedAt: new Date()
 },
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

 const formattedRate = {
 id: updatedRate.id,
 warehouseId: updatedRate.warehouseId,
 warehouse: updatedRate.warehouse,
 costCategory: updatedRate.costCategory,
 costName: updatedRate.costName,
 costValue: parseFloat(updatedRate.costValue.toString()),
 unitOfMeasure: updatedRate.unitOfMeasure,
 effectiveDate: updatedRate.effectiveDate.toISOString(),
 endDate: updatedRate.endDate?.toISOString() || null
 }

 return NextResponse.json(formattedRate)
 } catch (_error) {
 // console.error('Error updating rate:', error)
 return NextResponse.json(
 { error: 'Failed to update rate' },
 { status: 500 }
 )
 }
}

export async function DELETE(
 request: NextRequest,
 { params }: { params: Promise<{ id: string }> }
) {
 try {
 const { id: rateId } = await params
 const session = await getServerSession(authOptions)
 
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 // Check if user has permission to delete rates
 if (session.user.role !== 'admin') {
 return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 }

 await prisma.$transaction(async tx => {
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
 // console.error('Error deleting rate:', error)
 return NextResponse.json(
 { error: 'Failed to delete rate' },
 { status: 500 }
 )
 }
}
