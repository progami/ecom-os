import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

// Validation schemas
const COST_CATEGORY_OPTIONS = ['Container', 'Carton', 'Pallet', 'Storage', 'Unit', 'transportation', 'Accessorial'] as const

const createRateSchema = z.object({
 warehouseId: z.string().uuid(),
 costCategory: z.enum(COST_CATEGORY_OPTIONS),
 costName: z.string().min(1),
 costValue: z.number().positive(),
 unitOfMeasure: z.string().min(1),
 effectiveDate: z.string().datetime(),
 endDate: z.string().datetime().optional()
})

const updateRateSchema = z.object({
 costValue: z.number().positive().optional(),
 unitOfMeasure: z.string().min(1).optional(),
 endDate: z.string().datetime().optional().nullable()
})

// GET /api/rates - List cost rates
export async function GET(req: NextRequest) {
 try {
 const session = await getServerSession(authOptions)
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
 { costName: 'asc' },
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
 const session = await getServerSession(authOptions)
 if (!session || !['admin', 'staff'].includes(session.user.role)) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const body = await req.json()
 const validatedData = createRateSchema.parse(body)

 // Check for overlapping rates
 const overlapping = await prisma.costRate.findFirst({
 where: {
 warehouseId: validatedData.warehouseId,
 costName: validatedData.costName,
 effectiveDate: { lte: new Date(validatedData.effectiveDate) },
 OR: [
 { endDate: null },
 { endDate: { gte: new Date(validatedData.effectiveDate) } }
 ]
 }
 })

 if (overlapping) {
 return NextResponse.json(
 { error: 'An active rate already exists for this cost name and period' },
 { status: 400 }
 )
 }

 const rate = await prisma.costRate.create({
 data: {
 warehouseId: validatedData.warehouseId,
 costCategory: validatedData.costCategory,
 costName: validatedData.costName,
 costValue: validatedData.costValue,
 unitOfMeasure: validatedData.unitOfMeasure,
 effectiveDate: new Date(validatedData.effectiveDate),
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
 const session = await getServerSession(authOptions)
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

 const updatedRate = await prisma.costRate.update({
 where: { id: rateId },
 data: {
 ...validatedData,
 endDate: validatedData.endDate !== undefined 
 ? validatedData.endDate ? new Date(validatedData.endDate) : null
 : undefined,
 updatedAt: new Date()
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
 const session = await getServerSession(authOptions)
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
