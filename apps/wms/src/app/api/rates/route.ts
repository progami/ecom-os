import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@ecom-os/prisma-wms'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

// Validation schemas
const COST_CATEGORY_OPTIONS = ['Inbound', 'Storage', 'Outbound', 'Forwarding'] as const

const createRateSchema = z.object({
 warehouseId: z.string().uuid(),
 costCategory: z.enum(COST_CATEGORY_OPTIONS),
 costValue: z.number().positive(),
 unitOfMeasure: z.string().min(1),
 effectiveDate: z.string().datetime(),
 endDate: z.string().datetime().optional(),
 costName: z.string().min(1).max(100).optional()
})

const updateRateSchema = z.object({
 costValue: z.number().positive().optional(),
 unitOfMeasure: z.string().min(1).optional(),
 endDate: z.string().datetime().optional().nullable(),
 costName: z.string().min(1).max(100).optional()
})

// GET /api/rates - List cost rates
export async function GET(req: NextRequest) {
 try {
 const session = await auth()
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const searchParams = req.nextUrl.searchParams
 const warehouseId = searchParams.get('warehouseId')
 const costCategory = searchParams.get('costCategory')
 const activeOnly = searchParams.get('activeOnly') === 'true'

 const where: Prisma.CostRateWhereInput = {}
 
 if (warehouseId) {
 where.warehouseId = warehouseId
 }
 
 if (costCategory && COST_CATEGORY_OPTIONS.includes(costCategory as typeof COST_CATEGORY_OPTIONS[number])) {
 const normalizedCategory = costCategory as typeof COST_CATEGORY_OPTIONS[number]
 where.costCategory = normalizedCategory
 }
 
 if (activeOnly) {
 const now = new Date()
 where.effectiveDate = { lte: now }
 where.OR = [
 { endDate: null },
 { endDate: { gte: now } }
 ]
 }

 const rates = await prisma.costRate.findMany({
 where,
 include: {
 warehouse: {
 select: {
 id: true,
 code: true,
 name: true
 }
 },
 createdBy: {
 select: {
 id: true,
 fullName: true,
 email: true
 }
 }
 },
 orderBy: [
 { warehouse: { name: 'asc' } },
 { costCategory: 'asc' },
 { effectiveDate: 'desc' }
 ]
 })

 return NextResponse.json(rates)
 } catch (_error) {
 // console.error('Error fetching rates:', error)
 return NextResponse.json(
 { error: 'Failed to fetch rates' },
 { status: 500 }
 )
 }
}

// POST /api/rates - Create new rate
export async function POST(req: NextRequest) {
 try {
 const session = await auth()
 if (!session || !['admin', 'staff'].includes(session.user.role)) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const body = await req.json()
 const validatedData = createRateSchema.parse(body)
 const rawCostName =
  typeof validatedData.costName === 'string' ? validatedData.costName.trim() : ''
 const sanitizedCostName = sanitizeForDisplay(
  rawCostName.length > 0 ? rawCostName : validatedData.costCategory
 )
 const effectiveDate = new Date(validatedData.effectiveDate)

 // Enforce a single rate per name/effective date combination
 const duplicateRate = await prisma.costRate.findFirst({
 where: {
  warehouseId: validatedData.warehouseId,
  costName: sanitizedCostName,
  effectiveDate
 }
 })

 if (duplicateRate) {
 return NextResponse.json(
  {
   error: `A rate named "${sanitizedCostName}" already exists for this warehouse on ${effectiveDate.toISOString().slice(0, 10)}.`
  },
 { status: 400 }
 )
 }

 const rate = await prisma.costRate.create({
 data: {
  warehouseId: validatedData.warehouseId,
  costCategory: validatedData.costCategory,
  costName: sanitizedCostName,
  costValue: validatedData.costValue,
  unitOfMeasure: validatedData.unitOfMeasure,
  effectiveDate,
  endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
  createdById: session.user.id
 },
 include: {
 warehouse: true,
 createdBy: {
 select: {
 id: true,
 fullName: true,
 email: true
 }
 }
 }
 })

 return NextResponse.json(rate, { status: 201 })
 } catch (_error) {
 if (_error instanceof z.ZodError) {
 return NextResponse.json(
 { error: 'Invalid data', details: _error.issues },
 { status: 400 }
 )
 }
 // console.error('Error creating rate:', error)
 return NextResponse.json(
 { error: 'Failed to create rate' },
 { status: 500 }
 )
 }
}

// PATCH /api/rates - Update rate
export async function PATCH(req: NextRequest) {
 try {
 const session = await auth()
 if (!session || !['admin', 'staff'].includes(session.user.role)) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const searchParams = req.nextUrl.searchParams
 const rateId = searchParams.get('id')
 
 if (!rateId) {
 return NextResponse.json(
 { error: 'Rate ID is required' },
 { status: 400 }
 )
 }

 const body = await req.json()
 const validatedData = updateRateSchema.parse(body)

 // Check if rate exists
 const rate = await prisma.costRate.findUnique({
 where: { id: rateId }
 })

 if (!rate) {
 return NextResponse.json(
 { error: 'Rate not found' },
 { status: 404 }
 )
 }

 const sanitizedCostNameInput =
  typeof validatedData.costName === 'string'
   ? sanitizeForDisplay(validatedData.costName.trim())
   : undefined
 const sanitizedCostName =
  sanitizedCostNameInput && sanitizedCostNameInput.length > 0
   ? sanitizedCostNameInput
   : undefined

 if (sanitizedCostName && sanitizedCostName !== rate.costName) {
 const duplicateRate = await prisma.costRate.findFirst({
 where: {
  warehouseId: rate.warehouseId,
  costName: sanitizedCostName,
  effectiveDate: rate.effectiveDate,
  id: { not: rateId }
 }
 })

 if (duplicateRate) {
  return NextResponse.json(
   { error: `Another rate named "${sanitizedCostName}" already exists for this warehouse on ${rate.effectiveDate.toISOString().slice(0, 10)}.` },
   { status: 400 }
  )
 }
 }

 const updateData: Prisma.CostRateUpdateInput = {
 updatedAt: new Date()
 }

 if (validatedData.costValue !== undefined) {
 updateData.costValue = validatedData.costValue
 }

 if (validatedData.unitOfMeasure !== undefined) {
 updateData.unitOfMeasure = validatedData.unitOfMeasure
 }

 if (validatedData.endDate !== undefined) {
 updateData.endDate = validatedData.endDate
  ? new Date(validatedData.endDate)
  : null
 }

 if (sanitizedCostName) {
 updateData.costName = sanitizedCostName
 }

 const updatedRate = await prisma.costRate.update({
 where: { id: rateId },
 data: updateData,
 include: {
 warehouse: true,
 createdBy: {
 select: {
 id: true,
 fullName: true,
 email: true
 }
 }
 }
 })

 return NextResponse.json(updatedRate)
 } catch (_error) {
 if (_error instanceof z.ZodError) {
 return NextResponse.json(
 { error: 'Invalid data', details: _error.issues },
 { status: 400 }
 )
 }
 // console.error('Error updating rate:', error)
 return NextResponse.json(
 { error: 'Failed to update rate' },
 { status: 500 }
 )
 }
}

// DELETE /api/rates - Delete rate
export async function DELETE(req: NextRequest) {
 try {
 const session = await auth()
 if (!session || session.user.role !== 'admin') {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const searchParams = req.nextUrl.searchParams
 const rateId = searchParams.get('id')
 
 if (!rateId) {
 return NextResponse.json(
 { error: 'Rate ID is required' },
 { status: 400 }
 )
 }

 // Check if rate exists
 const rate = await prisma.costRate.findUnique({
 where: { id: rateId }
 })

 if (!rate) {
 return NextResponse.json(
 { error: 'Rate not found' },
 { status: 404 }
 )
 }

 // Delete the rate
 await prisma.costRate.delete({
 where: { id: rateId }
 })

 return NextResponse.json({
 message: 'Rate deleted successfully'
 })
 } catch (_error) {
 // console.error('Error deleting rate:', error)
 return NextResponse.json(
 { error: 'Failed to delete rate' },
 { status: 500 }
 )
 }
}
