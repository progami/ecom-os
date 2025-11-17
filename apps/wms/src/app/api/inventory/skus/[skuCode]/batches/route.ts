import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@ecom-os/prisma-wms'
import { aggregateInventoryTransactions } from '@ecom-os/ledger'
import { resolvePortalSession } from '@/lib/portal-session'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface BatchDetail {
  batchLot: string
  batchCode: string | null
  description: string | null
  productionDate: Date | null
  expiryDate: Date | null
  currentUnits: number
  currentCartons: number
  currentPallets: number
  storageCartonsPerPallet: number | null
  shippingCartonsPerPallet: number | null
  firstReceiveDate: Date | null
  lastTransactionDate: Date | null
  transactions: Array<{
    id: string
    transactionType: string
    transactionDate: Date
    referenceId: string | null
    cartonsIn: number
    cartonsOut: number
    storagePalletsIn: number
    shippingPalletsOut: number
    createdByName: string
  }>
}

interface SkuBatchResponse {
  skuCode: string
  description: string
  asin: string | null
  unitsPerCarton: number
  unitDimensionsCm: string | null
  unitWeightKg: number | null
  cartonDimensionsCm: string | null
  cartonWeightKg: number | null
  packagingType: string | null
  batches: BatchDetail[]
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ skuCode: string }> }
) {
  try {
    const session = await resolvePortalSession(req) ?? await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { skuCode } = await params
    const searchParams = req.nextUrl.searchParams
    const warehouseId = searchParams.get('warehouseId')

    const sku = await prisma.sku.findUnique({
      where: { skuCode }
    })

    const skuBatches = await prisma.skuBatch.findMany({
      where: {
        skuId: sku?.id,
        isActive: true
      }
    })

    if (!sku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
    }

    const transactionWhere: Prisma.InventoryTransactionWhereInput = {
      skuCode: skuCode,
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
      includeZeroStock: true
    })

    const batchMap = new Map(skuBatches.map(b => [b.batchCode, b]))

    const batches: BatchDetail[] = aggregated.balances
      .filter(balance => balance.skuCode === skuCode)
      .map(balance => {
        const skuBatch = batchMap.get(balance.batchLot)

        const batchTransactions = transactions
          .filter(t => t.batchLot === balance.batchLot)
          .map(t => ({
            id: t.id,
            transactionType: t.transactionType,
            transactionDate: t.transactionDate,
            referenceId: t.referenceId,
            cartonsIn: t.cartonsIn,
            cartonsOut: t.cartonsOut,
            storagePalletsIn: t.storagePalletsIn,
            shippingPalletsOut: t.shippingPalletsOut,
            createdByName: t.createdByName
          }))

        return {
          batchLot: balance.batchLot,
          batchCode: skuBatch?.batchCode || null,
          description: skuBatch?.description || null,
          productionDate: skuBatch?.productionDate || null,
          expiryDate: skuBatch?.expiryDate || null,
          currentUnits: balance.currentUnits || 0,
          currentCartons: balance.currentCartons || 0,
          currentPallets: balance.currentPallets || 0,
          storageCartonsPerPallet: balance.storageCartonsPerPallet || null,
          shippingCartonsPerPallet: balance.shippingCartonsPerPallet || null,
          firstReceiveDate: balance.firstReceive?.transactionDate || null,
          lastTransactionDate: balance.lastTransactionDate || null,
          transactions: batchTransactions
        }
      })
      .sort((a, b) => {
        if (!a.firstReceiveDate) return 1
        if (!b.firstReceiveDate) return -1
        return b.firstReceiveDate.getTime() - a.firstReceiveDate.getTime()
      })

    const response: SkuBatchResponse = {
      skuCode: sku.skuCode,
      description: sku.description,
      asin: sku.asin,
      unitsPerCarton: sku.unitsPerCarton,
      unitDimensionsCm: sku.unitDimensionsCm,
      unitWeightKg: sku.unitWeightKg ? parseFloat(sku.unitWeightKg.toString()) : null,
      cartonDimensionsCm: sku.cartonDimensionsCm,
      cartonWeightKg: sku.cartonWeightKg ? parseFloat(sku.cartonWeightKg.toString()) : null,
      packagingType: sku.packagingType,
      batches
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch SKU batch details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
