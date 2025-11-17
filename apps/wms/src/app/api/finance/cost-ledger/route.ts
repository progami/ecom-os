import { withAuth, ApiResponses } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@ecom-os/prisma-wms'
import { aggregateCostLedger } from '@ecom-os/ledger'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request, _session) => {
 const searchParams = request.nextUrl.searchParams
 const groupBy = (searchParams.get('groupBy') as 'week' | 'month') || 'week'
 const warehouseCode = searchParams.get('warehouseCode')

 const startDateStr =
 searchParams.get('startDate') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
 const endDateStr = searchParams.get('endDate') || new Date().toISOString().split('T')[0]

 const startDate = new Date(startDateStr)
 startDate.setUTCHours(0, 0, 0, 0)

 const endDate = new Date(endDateStr)
 endDate.setUTCHours(23, 59, 59, 999)

 const where: Prisma.CostLedgerWhereInput = {
 createdAt: {
 gte: startDate,
 lte: endDate
 }
 }

 if (warehouseCode) {
 where.warehouseCode = warehouseCode
 }

 const costEntries = await prisma.costLedger.findMany({
 where,
 include: {
 transaction: {
 select: {
 transactionType: true,
 warehouseCode: true,
 warehouseName: true,
 skuCode: true,
 skuDescription: true,
 batchLot: true
 }
 }
 },
 orderBy: { createdAt: 'asc' }
 })

 const aggregated = aggregateCostLedger(
 costEntries.map(entry => ({
 id: entry.id,
 transactionId: entry.transactionId,
 costCategory: entry.costCategory,
 quantity: entry.quantity as unknown as number | string | null,
 unitRate: entry.unitRate as unknown as number | string | null,
 totalCost: entry.totalCost as unknown as number | string | null,
 createdAt: entry.createdAt,
 warehouseCode: entry.warehouseCode,
 context: {
 transactionType: entry.transaction?.transactionType,
 warehouseCode: entry.transaction?.warehouseCode,
 warehouseName: entry.transaction?.warehouseName,
 skuCode: entry.transaction?.skuCode,
 skuDescription: entry.transaction?.skuDescription,
 batchLot: entry.transaction?.batchLot
 }
 })),
 { groupBy }
 )

 return ApiResponses.success({
 groups: aggregated.groups,
 totals: aggregated.totals,
 groupBy
 })
})
