import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limiter'
import { validateCSRFToken } from '@/lib/security/csrf-protection'
import { auditLog } from '@/lib/security/audit-logger'
import { endOfWeek } from 'date-fns'
import { z } from 'zod'
import { ensureWeeklyStorageEntries, recalculateStorageCosts } from '@/services/storageCost.service'

const weeklyCalculationSchema = z.object({
 weekEndingDate: z.string().datetime().optional(),
 warehouseId: z.string().uuid().optional(),
 warehouseCode: z.string().optional(),
 forceRecalculate: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
 let session: Session | null = null
 
 try {
 // Rate limiting
 const rateLimitResponse = await checkRateLimit(request, rateLimitConfigs.api)
 if (rateLimitResponse) return rateLimitResponse

 // CSRF protection
 const csrfValid = await validateCSRFToken(request)
 if (!csrfValid) {
 return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
 }

 session = await auth()
 if (!session?.user) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 // Only admin users can trigger weekly calculations
 if (session.user.role !== 'admin') {
 await auditLog({
 entityType: 'StorageCalculation',
 entityId: 'WEEKLY',
 action: 'UNAUTHORIZED_ACCESS',
 userId: session.user.id,
 data: { role: session.user.role }
 })
 return NextResponse.json({ error: 'Access denied' }, { status: 403 })
 }

 const body = await request.json()
 
 // Validate input
 const validationResult = weeklyCalculationSchema.safeParse(body)
 if (!validationResult.success) {
 return NextResponse.json(
 { error: 'Invalid input', details: validationResult.error.issues },
 { status: 400 }
 )
 }

 const data = validationResult.data

 // Determine week ending date (default to current week)
 const weekEndingDate = data.weekEndingDate 
 ? endOfWeek(new Date(data.weekEndingDate), { weekStartsOn: 1 })
 : endOfWeek(new Date(), { weekStartsOn: 1 })

 // Check warehouse access for staff users
 const warehouseId = data.warehouseId

 // Get warehouse code if warehouse ID was provided
 let warehouseCode = data.warehouseCode
 if (warehouseId && !warehouseCode) {
 const warehouse = await prisma.warehouse.findUnique({
 where: { id: warehouseId },
 select: { code: true }
 })
 warehouseCode = warehouse?.code
 }

 // Process weekly storage calculation
 let result
 if (data.forceRecalculate) {
 // Recalculate costs for existing entries
 result = await recalculateStorageCosts(weekEndingDate, warehouseCode)
 } else {
 // Normal weekly calculation
 result = await ensureWeeklyStorageEntries(weekEndingDate)
 }
 
 // Log the calculation attempt
 await auditLog({
 entityType: 'StorageCalculation',
 entityId: 'WEEKLY',
 action: 'TRIGGER',
 userId: session.user.id,
 data: { 
 weekEndingDate: weekEndingDate.toISOString(),
 warehouseId,
 warehouseCode,
 forceRecalculate: data.forceRecalculate,
 ...result
 }
 })

 return NextResponse.json({
 success: true,
 weekEndingDate: weekEndingDate.toISOString(),
 calculationType: data.forceRecalculate ? 'recalculation' : 'weekly_entries',
 ...result,
 message: data.forceRecalculate 
 ? `Recalculated ${result.recalculated} storage cost entries`
 : `Processed ${result.processed} storage entries, ${result.costCalculated} with costs calculated`
 })
 } catch (error: unknown) {
 // console.error('Weekly storage calculation error:', error)
 
 await auditLog({
 entityType: 'StorageCalculation',
 entityId: 'WEEKLY',
 action: 'ERROR',
 userId: session?.user?.id || 'SYSTEM',
 data: { error: error instanceof Error ? error.message : String(error) }
 })
 
 return NextResponse.json(
 { error: 'Failed to calculate weekly storage costs' },
 { status: 500 }
 )
 }
}

export async function GET(request: NextRequest) {
 try {
 // Rate limiting
 const rateLimitResponse = await checkRateLimit(request, rateLimitConfigs.api)
 if (rateLimitResponse) return rateLimitResponse

 const session = await auth()
 if (!session?.user) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 // Only admin users can view calculation status
 if (session.user.role !== 'admin') {
 return NextResponse.json({ error: 'Access denied' }, { status: 403 })
 }

 // This would typically check the status of scheduled calculations
 // For now, return basic info
 const currentWeekEnding = endOfWeek(new Date(), { weekStartsOn: 1 })
 
 return NextResponse.json({
 currentWeekEnding: currentWeekEnding.toISOString(),
 message: 'Use POST to trigger weekly storage calculation',
 nextScheduledRun: 'Every Monday at 2:00 AM UTC',
 })
 } catch (_error) {
 // console.error('Error fetching calculation status:', error)
 return NextResponse.json(
 { error: 'Failed to fetch calculation status' },
 { status: 500 }
 )
 }
}
