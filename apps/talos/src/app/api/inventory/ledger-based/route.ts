import { withAuth, ApiResponses } from '@/lib/api'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@ecom-os/prisma-talos'
import { aggregateInventoryTransactions } from '@ecom-os/ledger'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (req, session) => {
 const prisma = await getTenantPrisma()
 const searchParams = req.nextUrl.searchParams
 const warehouseId = searchParams.get('warehouseId') || session.user.warehouseId
 const skuCode = searchParams.get('skuCode')

 const where: Prisma.InventoryTransactionWhereInput = {}

 if (warehouseId) {
 const warehouse = await prisma.warehouse.findUnique({
 where: { id: warehouseId },
 select: { code: true }
 })
 if (warehouse) {
 where.warehouseCode = warehouse.code
 }
 }

 if (skuCode) {
 where.skuCode = skuCode
 }

 const transactions = await prisma.inventoryTransaction.findMany({
 where,
 orderBy: { transactionDate: 'asc' }
 })

 const aggregated = aggregateInventoryTransactions(transactions, {
 includeZeroStock: true
 })

 const results = aggregated.balances.map(item => ({
 skuCode: item.skuCode,
 skuDescription: item.skuDescription,
 batchLot: item.batchLot,
 currentCartons: item.currentCartons,
 currentUnits: item.currentUnits,
 unitsPerCarton: item.unitsPerCarton,
 warehouseName: item.warehouseName,
 warehouseCode: item.warehouseCode,
 lastTransactionDate: item.lastTransactionDate,
 firstReceiveDate: item.firstReceive?.transactionDate ?? null,
 storageCartonsPerPallet: item.storageCartonsPerPallet,
 shippingCartonsPerPallet: item.shippingCartonsPerPallet,
 inventoryStatus: item.currentCartons > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'
 }))

 return ApiResponses.success({
 data: results,
 summary: aggregated.summary
 })
})
