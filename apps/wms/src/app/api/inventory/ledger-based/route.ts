import { withAuth, ApiResponses } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (req, session) => {

    const searchParams = req.nextUrl.searchParams
    const warehouseId = searchParams.get('warehouseId') || session.user.warehouseId
    const skuCode = searchParams.get('skuCode')

    // Build where clause for transactions
    const where: Prisma.InventoryTransactionWhereInput = {}
    
    if (warehouseId) {
      // Need to get warehouse code from ID
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

    // Fetch ALL transactions from the ledger
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      orderBy: { transactionDate: 'asc' }
    })

    // Calculate current balance for each SKU/Batch combination
    const balanceMap = new Map<string, {
      skuCode: string;
      skuDescription: string;
      batchLot: string;
      cartonsIn: number;
      cartonsOut: number;
      currentBalance: number;
      warehouses: Set<string>;
    }>()

    for (const transaction of transactions) {
      const key = `${transaction.skuCode}-${transaction.batchLot}`
      
      const current = balanceMap.get(key) || {
        skuCode: transaction.skuCode,
        skuDescription: transaction.skuDescription,
        batchLot: transaction.batchLot,
        currentCartons: 0,
        currentUnits: 0,
        unitsPerCarton: transaction.unitsPerCarton,
        warehouseName: transaction.warehouseName,
        warehouseCode: transaction.warehouseCode,
        lastTransactionDate: null,
        firstReceiveDate: null,
        storageCartonsPerPallet: null,
        shippingCartonsPerPallet: null
      }

      // Update quantities
      current.currentCartons += transaction.cartonsIn - transaction.cartonsOut
      current.currentUnits = current.currentCartons * (transaction.unitsPerCarton || 1)
      current.lastTransactionDate = transaction.transactionDate

      // Track first receive date
      if (transaction.transactionType === 'RECEIVE' && !current.firstReceiveDate) {
        current.firstReceiveDate = transaction.transactionDate
      }

      // Capture pallet configuration from RECEIVE transactions
      if (transaction.transactionType === 'RECEIVE') {
        if (transaction.storageCartonsPerPallet) {
          current.storageCartonsPerPallet = transaction.storageCartonsPerPallet
        }
        if (transaction.shippingCartonsPerPallet) {
          current.shippingCartonsPerPallet = transaction.shippingCartonsPerPallet
        }
      }

      balanceMap.set(key, current)
    }

    // Convert to array and include all batches (even with 0 inventory)
    const results = Array.from(balanceMap.values())

    // Sort by SKU code and batch
    results.sort((a, b) => {
      if (a.skuCode !== b.skuCode) return a.skuCode.localeCompare(b.skuCode)
      return a.batchLot.localeCompare(b.batchLot)
    })

    const batchesWithInventory = results.filter(r => r.currentCartons > 0).length

    return ApiResponses.success({
      data: results.map(item => ({
        ...item,
        inventoryStatus: item.currentCartons > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'
      })),
      summary: {
        totalSKUs: new Set(results.map(r => r.skuCode)).size,
        totalBatches: results.length,
        batchesWithInventory,
        batchesOutOfStock: results.length - batchesWithInventory
      }
    })
})