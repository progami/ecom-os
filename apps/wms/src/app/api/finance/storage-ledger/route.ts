import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limiter'
import { getWarehouseFilter } from '@/lib/auth-utils'
import { Prisma, PurchaseOrderStatus } from '@ecom-os/prisma-wms'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
 try {
 // Rate limiting
 const rateLimitResponse = await checkRateLimit(request, rateLimitConfigs.api)
 if (rateLimitResponse) return rateLimitResponse

 const session = await auth()
 if (!session?.user) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 // Only staff and admin can access storage ledger
 if (!['staff', 'admin'].includes(session.user.role)) {
 return NextResponse.json({ error: 'Access denied' }, { status: 403 })
 }

 const { searchParams } = request.nextUrl
 const warehouseCode = searchParams.get('warehouseCode')
 const startDate = searchParams.get('startDate')
 const endDate = searchParams.get('endDate')
 const includeCosts = searchParams.get('includeCosts') === 'true'
 const page = parseInt(searchParams.get('page') || '1')
 const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
 const search = searchParams.get('search')

 // Apply warehouse filter based on user role
 const warehouseFilter = getWarehouseFilter(session, undefined)
 const where: Prisma.StorageLedgerWhereInput = {}
 let scopedWarehouseCode: string | undefined

 if (warehouseFilter?.warehouseId) {
 // Staff user - filter to their warehouse
 const warehouse = await prisma.warehouse.findUnique({
 where: { id: warehouseFilter.warehouseId },
 select: { code: true }
 })
 if (warehouse) {
 where.warehouseCode = warehouse.code
 scopedWarehouseCode = warehouse.code
 }
 } else if (warehouseCode) {
 // Admin user with warehouse filter
 where.warehouseCode = warehouseCode
 scopedWarehouseCode = warehouseCode
 }

 // Date range filter
 if (startDate && endDate) {
 where.weekEndingDate = {
 gte: new Date(startDate),
 lte: new Date(endDate)
 }
 }

 // Search filter
 if (search) {
 where.OR = [
 { skuCode: { contains: search, mode: 'insensitive' } },
 { skuDescription: { contains: search, mode: 'insensitive' } },
 { batchLot: { contains: search, mode: 'insensitive' } },
 { warehouseName: { contains: search, mode: 'insensitive' } }
 ]
 }

 // Get paginated results
 const entries = await prisma.storageLedger.findMany({
 where,
 select: {
 id: true,
 warehouseCode: true,
 warehouseName: true,
 skuCode: true,
 skuDescription: true,
 batchLot: true,
 weekEndingDate: true,
 closingBalance: true,
 averageBalance: true,
 createdAt: true,
 ...(includeCosts && {
 storageRatePerCarton: true,
 totalStorageCost: true,
 isCostCalculated: true,
 rateEffectiveDate: true,
 costRateId: true
 })
 },
 orderBy: [
 { weekEndingDate: 'desc' },
 { warehouseCode: 'asc' },
 { skuCode: 'asc' }
 ],
 skip: (page - 1) * limit,
 take: limit
 })

 // Only keep entries where at least one transaction is from a finalized or PO-less source
 const validTransactionCombos = await prisma.inventoryTransaction.groupBy({
 by: ['warehouseCode', 'skuCode', 'batchLot'],
 where: {
 ...(scopedWarehouseCode ? { warehouseCode: scopedWarehouseCode } : {}),
 OR: [
 { purchaseOrderId: null },
 { purchaseOrder: { status: { in: [PurchaseOrderStatus.POSTED, PurchaseOrderStatus.CLOSED] } } }
 ],
 },
 })
 const validKey = new Set(
 validTransactionCombos.map(
 (combo) => `${combo.warehouseCode}::${combo.skuCode}::${combo.batchLot}`
 )
 )

 const filteredEntries = entries.filter((entry) =>
 validKey.has(`${entry.warehouseCode}::${entry.skuCode}::${entry.batchLot}`)
 )

 // Build summary from the filtered set
 let summary = null
 if (includeCosts) {
 const totalEntries = filteredEntries.length
 const entriesWithCosts = filteredEntries.filter((e) => e.totalStorageCost != null).length
 const totalCartons = filteredEntries.reduce((sum, entry) => sum + Number(entry.closingBalance || 0), 0)
 const totalStorageCost = filteredEntries.reduce(
 (sum, entry) => sum + Number(entry.totalStorageCost || 0),
 0
 )
 const costCalculationRate =
 totalEntries > 0 ? ((entriesWithCosts / totalEntries) * 100).toFixed(1) : '0'

 summary = {
 totalEntries,
 entriesWithCosts,
 totalCartons,
 totalStorageCost,
 costCalculationRate,
 }
 }

 const response = {
 entries: filteredEntries,
 pagination: {
 page,
 limit,
 totalCount: filteredEntries.length,
 totalPages: Math.ceil(filteredEntries.length / limit),
 hasNext: filteredEntries.length > limit,
 hasPrev: page > 1
 },
 ...(summary && { summary })
 }

 return NextResponse.json(response)
 } catch (error) {
 console.error('Storage ledger API error:', error)
 return NextResponse.json(
 { error: 'Failed to fetch storage ledger' },
 { status: 500 }
 )
 }
}
