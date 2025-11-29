import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import type { Session } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@ecom-os/prisma-wms'
export const dynamic = 'force-dynamic'

const PLACEHOLDER_PASSWORD =
 process.env.WMS_SSO_PLACEHOLDER_PASSWORD || 'sso-only-password'
const PLACEHOLDER_PASSWORD_HASH = bcrypt.hashSync(PLACEHOLDER_PASSWORD, 10)

const normalizeRole = (role?: unknown): UserRole => {
 const allowed: UserRole[] = ['admin', 'staff']
 if (typeof role === 'string' && allowed.includes(role as UserRole)) {
  return role as UserRole
 }
 return 'staff'
}

const ensureWmsUser = async (session: Session) => {
 const id = session.user?.id
 const email = session.user?.email

 if (!id || !email) {
  throw new Error('Missing session user identifier')
 }

 const usernameSource = email || id
 const fullName = session.user?.name || email
 const role = normalizeRole((session.user as { role?: string })?.role)

 const user = await prisma.user.upsert({
  where: { id },
  update: {
   email,
   fullName,
   role,
   isActive: true,
  },
  create: {
   id,
   email,
   username: usernameSource,
   passwordHash: PLACEHOLDER_PASSWORD_HASH,
   fullName,
   role,
   isActive: true,
  },
  select: { id: true },
 })

 return user
}

export async function GET(_request: NextRequest) {
 try {
 const session = await getServerSession(authOptions)
 
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 // All authenticated users can view rates

 const rates = await prisma.costRate.findMany({
 include: {
 warehouse: {
 select: {
 id: true,
 name: true,
 code: true
 }
 }
 },
 orderBy: [
 { warehouse: { name: 'asc' } },
 { costCategory: 'asc' },
 { effectiveDate: 'desc' }
 ]
 })

 // Return the data in the correct format
 const formattedRates = rates.map(rate => ({
 id: rate.id,
 warehouseId: rate.warehouseId,
 warehouse: rate.warehouse,
 costCategory: rate.costCategory,
 costName: rate.costName,
 costValue: parseFloat(rate.costValue.toString()),
 unitOfMeasure: rate.unitOfMeasure,
 effectiveDate: rate.effectiveDate.toISOString(),
 endDate: rate.endDate?.toISOString() || null
 }))

 return NextResponse.json(formattedRates)
 } catch (_error) {
 // console.error('Error fetching rates:', error)
 return NextResponse.json(
 { error: 'Failed to fetch rates' },
 { status: 500 }
 )
 }
}

export async function POST(request: NextRequest) {
 try {
 const session = await getServerSession(authOptions)
 
 if (!session || session.user.role !== 'admin') {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const body = await request.json()
 const {
  warehouseId,
  costCategory,
  costValue,
  unitOfMeasure,
  effectiveDate,
  endDate,
 costName: rawCostName
 } = body

// Validate required fields
 if (!warehouseId || !costCategory || costValue === undefined || !unitOfMeasure || !effectiveDate) {
 return NextResponse.json(
 { error: 'Missing required fields' },
 { status: 400 }
 )
}

 // Don't HTML-encode costName - just trim and validate
 const costName = typeof rawCostName === 'string' && rawCostName.trim().length > 0
   ? rawCostName.trim()
   : costCategory
 const effectiveOn = new Date(effectiveDate)

 const wmsUser = await ensureWmsUser(session)

 const newRate = await prisma.costRate.create({
 data: {
  warehouseId,
 costCategory,
 costName,
 costValue,
 unitOfMeasure,
  effectiveDate: effectiveOn,
  endDate: endDate ? new Date(endDate) : null,
  createdById: wmsUser.id
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
 id: newRate.id,
 warehouseId: newRate.warehouseId,
 warehouse: newRate.warehouse,
 costCategory: newRate.costCategory,
 costName: newRate.costName,
 costValue: parseFloat(newRate.costValue.toString()),
 unitOfMeasure: newRate.unitOfMeasure,
 effectiveDate: newRate.effectiveDate.toISOString(),
 endDate: newRate.endDate?.toISOString() || null
 }

 return NextResponse.json(formattedRate)
 } catch (error) {
 console.error('Error creating rate:', error)
 return NextResponse.json(
 { error: error instanceof Error ? error.message : 'Failed to create rate' },
 { status: 500 }
 )
}
}
