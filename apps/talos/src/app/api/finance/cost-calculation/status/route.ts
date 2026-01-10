import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/auth-wrapper'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limiter'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@ecom-os/prisma-talos'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export const GET = withAuth(async (request, session) => {
 try {
 // Rate limiting
 const rateLimitResponse = await checkRateLimit(request, rateLimitConfigs.api)
 if (rateLimitResponse) return rateLimitResponse

 const prisma = await getTenantPrisma()
 const searchParams = request.nextUrl.searchParams
 const days = parseInt(searchParams.get('days') || '7')
 const warehouseId = searchParams.get('warehouseId')

 // Check warehouse access for staff users
 if (session.user.role === 'staff' && session.user.warehouseId) {
 if (warehouseId && warehouseId !== session.user.warehouseId) {
 return NextResponse.json({ error: 'Access denied' }, { status: 403 })
 }
 }

 const startDate = startOfDay(subDays(new Date(), days))
 const endDate = endOfDay(new Date())

 let scopedWarehouseId: string | undefined = warehouseId || undefined
 if (!scopedWarehouseId && session.user.role === 'staff') {
 scopedWarehouseId = session.user.warehouseId || undefined
 }

 let warehouseCode: string | undefined
 if (scopedWarehouseId) {
 const warehouse = await prisma.warehouse.findUnique({
 where: { id: scopedWarehouseId },
 select: { code: true }
 })

 if (!warehouse) {
 return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
 }

 warehouseCode = warehouse.code
 }

 const costWhere: Prisma.CostLedgerWhereInput = {
 createdAt: {
 gte: startDate,
 lte: endDate
 },
 ...(warehouseCode ? { warehouseCode } : {})
 }

 const storageWhere: Prisma.StorageLedgerWhereInput = {
 createdAt: {
 gte: startDate,
 lte: endDate
 },
 ...(warehouseCode ? { warehouseCode } : {})
 }

 const [
 costByCategory,
 recentCosts,
 storageAggregate,
 storageByWeek
 ] = await Promise.all([
 prisma.costLedger.groupBy({
 by: ['costCategory'],
 where: costWhere,
 _count: { id: true },
 _sum: { totalCost: true, quantity: true }
 }),
 prisma.costLedger.findMany({
 where: costWhere,
 orderBy: { createdAt: 'desc' },
 take: 10,
 select: {
 id: true,
 transactionId: true,
 warehouseCode: true,
 warehouseName: true,
 costCategory: true,
 quantity: true,
 unitRate: true,
 totalCost: true,
 createdAt: true,
 createdByName: true
 }
 }),
 prisma.storageLedger.aggregate({
 where: storageWhere,
 _count: { id: true },
 _sum: {
 totalStorageCost: true,
 palletDays: true
 }
 }),
 prisma.storageLedger.groupBy({
 by: ['weekEndingDate'],
 where: storageWhere,
 _sum: { totalStorageCost: true },
 orderBy: { weekEndingDate: 'desc' },
 take: 6
 })
 ])

 const totalCalculations = costByCategory.reduce((sum, item) => sum + item._count.id, 0)
 const totalCostAmount = costByCategory.reduce((sum, item) => sum + Number(item._sum.totalCost || 0), 0)
 const pendingCount = 0

 const transactionCosts = costByCategory.map(item => ({
 type: item.costCategory,
 count: item._count.id,
 totalCost: Number(item._sum.totalCost || 0)
 }))

 const averageWeeklyCost = storageByWeek.length
 ? storageByWeek.reduce((sum, week) => sum + Number(week._sum.totalStorageCost || 0), 0) / storageByWeek.length
 : 0

 const stats = {
 period: {
 start: startDate.toISOString(),
 end: endDate.toISOString(),
 days
 },
 summary: {
 totalCalculations,
 pendingCalculations: pendingCount,
 totalCostAmount
 },
 transactionCosts,
 storageCosts: {
 count: storageAggregate._count.id,
 totalCost: Number(storageAggregate._sum.totalStorageCost || 0),
 ledgerEntries: storageAggregate._count.id,
 totalPalletDaysCharged: Number(storageAggregate._sum.palletDays || 0),
 totalWeeklyCost: averageWeeklyCost
 },
 recentCalculations: recentCosts.map(cost => ({
 id: cost.id,
 calculatedCostId: cost.transactionId,
 transactionType: cost.costCategory,
 warehouse: cost.warehouseName,
 sku: null,
 costCategory: cost.costCategory,
 quantity: Number(cost.quantity || 0),
 rate: Number(cost.unitRate || 0),
 cost: Number(cost.totalCost || 0),
 createdAt: cost.createdAt,
 createdBy: cost.createdByName
 }))
 }

 return NextResponse.json(stats)
 } catch (_error) {
 // console.error('Error fetching cost calculation status:', error)
 return NextResponse.json(
 { error: 'Failed to fetch cost calculation status' },
 { status: 500 }
 )
 }
})
