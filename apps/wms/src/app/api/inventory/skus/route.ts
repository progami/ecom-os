import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@ecom-os/prisma-wms'
import { sanitizeSearchQuery } from '@/lib/security/input-sanitization'
import { aggregateInventoryTransactions } from '@ecom-os/ledger'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface SkuInventorySummary {
  skuCode: string
  description: string
  asin: string | null
  unitsPerCarton: number
  unitDimensionsCm: string | null
  cartonDimensionsCm: string | null
  isActive: boolean
  totalOnHand: number
  totalCartons: number
  totalPallets: number
  batchCount: number
  lastReceiveDate: Date | null
  avgUnitCost: number | null
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get('search')
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const warehouseId = searchParams.get('warehouseId')

    const skuWhere: Prisma.SkuWhereInput = {}

    if (!includeInactive) {
      skuWhere.isActive = true
    }

    if (search) {
      const escapedSearch = sanitizeSearchQuery(search)
      skuWhere.OR = [
        { skuCode: { contains: escapedSearch, mode: 'insensitive' } },
        { description: { contains: escapedSearch, mode: 'insensitive' } },
        { asin: { contains: escapedSearch, mode: 'insensitive' } }
      ]
    }

    const skus = await prisma.sku.findMany({
      where: skuWhere,
      orderBy: { skuCode: 'asc' }
    })

    const transactionWhere: Prisma.InventoryTransactionWhereInput = {
      transactionDate: { lte: new Date() }
    }

    if (session.user.role === 'staff' && session.user.warehouseId) {
      const staffWarehouse = await prisma.warehouse.findUnique({
        where: { id: session.user.warehouseId },
        select: { code: true }
      })
      if (staffWarehouse) {
        transactionWhere.warehouseCode = staffWarehouse.code
      }
    } else if (warehouseId) {
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { code: true }
      })
      if (warehouse) {
        transactionWhere.warehouseCode = warehouse.code
      }
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where: transactionWhere,
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    const ledgerTransactions = transactions.map(transaction => ({
      ...transaction,
      purchaseOrderNumber: null
    }))

    const aggregated = aggregateInventoryTransactions(ledgerTransactions, {
      includeZeroStock: false
    })

    const balancesBySkuCode = new Map<string, typeof aggregated.balances>()
    for (const balance of aggregated.balances) {
      if (!balancesBySkuCode.has(balance.skuCode)) {
        balancesBySkuCode.set(balance.skuCode, [])
      }
      balancesBySkuCode.get(balance.skuCode)!.push(balance)
    }

    const results: SkuInventorySummary[] = skus.map(sku => {
      const batches = balancesBySkuCode.get(sku.skuCode) || []

      const totalOnHand = batches.reduce((sum, b) => sum + (b.currentUnits || 0), 0)
      const totalCartons = batches.reduce((sum, b) => sum + (b.currentCartons || 0), 0)
      const totalPallets = batches.reduce((sum, b) => sum + (b.currentPallets || 0), 0)

      const lastReceiveDates = batches
        .map(b => b.firstReceive?.transactionDate)
        .filter((d): d is Date => d !== null && d !== undefined)
      const lastReceiveDate = lastReceiveDates.length > 0
        ? new Date(Math.max(...lastReceiveDates.map(d => d.getTime())))
        : null

      return {
        skuCode: sku.skuCode,
        description: sku.description,
        asin: sku.asin,
        unitsPerCarton: sku.unitsPerCarton,
        unitDimensionsCm: sku.unitDimensionsCm,
        cartonDimensionsCm: sku.cartonDimensionsCm,
        isActive: sku.isActive,
        totalOnHand,
        totalCartons,
        totalPallets,
        batchCount: batches.length,
        lastReceiveDate,
        avgUnitCost: null
      }
    })

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch SKU inventory summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
