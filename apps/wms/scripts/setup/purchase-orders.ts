#!/usr/bin/env npx tsx

/**
 * Setup script: sample purchase orders
 * --------------------------------------------------
 * Usage:
 *   pnpm --filter @ecom-os/wms exec tsx scripts/setup/purchase-orders.ts [--skip-clean] [--verbose]
 */

import { PrismaClient, PurchaseOrderType, PurchaseOrderStatus, Prisma } from '@ecom-os/prisma-wms'

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const skipClean = args.includes('--skip-clean')
const verbose = args.includes('--verbose')

function log(message: string, data?: unknown) {
  console.log(`[setup][purchase-orders] ${message}`)
  if (verbose && data !== undefined) {
    console.log(JSON.stringify(data, null, 2))
  }
}

async function cleanPurchaseOrders() {
  if (skipClean) {
    log('Skipping purchase order clean up')
    return
  }

  await prisma.movementNoteLine.deleteMany()
  await prisma.movementNote.deleteMany()
  await prisma.inventoryTransaction.deleteMany()
  await prisma.purchaseOrderLine.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  log('Removed existing purchase orders')
}

type SampleOrder = {
  orderNumber: string
  type: PurchaseOrderType
  status: PurchaseOrderStatus
  counterpartyName: string
  expectedInDays: number
  notes: string
  posted?: boolean
  lines: Array<{ skuIndex: number; quantity: number; unitCost: number; batchSuffix?: number }>
}

async function createPurchaseOrders() {
  const warehouse = await prisma.warehouse.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!warehouse) {
    log('No warehouse available; run warehouse setup first')
    return
  }

  const skus = await prisma.sku.findMany({ orderBy: { skuCode: 'asc' } })
  if (skus.length === 0) {
    log('No SKUs available; run product setup first')
    return
  }

  const now = new Date()
  const samples: SampleOrder[] = [
    {
      orderNumber: 'PO-1001',
      type: PurchaseOrderType.PURCHASE,
      status: PurchaseOrderStatus.DRAFT,
      counterpartyName: 'CS Suppliers',
      expectedInDays: 7,
      notes: 'Draft order staged for initial inventory build.',
      lines: [
        { skuIndex: 0, quantity: 120, unitCost: 18 },
        { skuIndex: 1, quantity: 80, unitCost: 22 },
      ],
    },
    {
      orderNumber: 'PO-1002',
      type: PurchaseOrderType.PURCHASE,
      status: PurchaseOrderStatus.AWAITING_PROOF,
      counterpartyName: 'FMC Manufacturing',
      expectedInDays: 3,
      notes: 'Awaiting proof of delivery – vendor confirmed shipment left dock.',
      lines: [
        { skuIndex: 2, quantity: 60, unitCost: 25 },
        { skuIndex: 3, quantity: 42, unitCost: 28 },
      ],
    },
    {
      orderNumber: 'PO-1003',
      type: PurchaseOrderType.PURCHASE,
      status: PurchaseOrderStatus.REVIEW,
      counterpartyName: 'Vglobal Fulfilment',
      expectedInDays: -2,
      notes: 'Ready for final approval after document review.',
      lines: [
        { skuIndex: 4, quantity: 90, unitCost: 30 },
        { skuIndex: 5, quantity: 36, unitCost: 34 },
      ],
    },
    {
      orderNumber: 'PO-1004',
      type: PurchaseOrderType.PURCHASE,
      status: PurchaseOrderStatus.POSTED,
      counterpartyName: 'West Coast Retail',
      expectedInDays: -5,
      notes: 'Fully reconciled and posted to the ledger.',
      posted: true,
      lines: [
        { skuIndex: 0, quantity: 40, unitCost: 18, batchSuffix: 7 },
        { skuIndex: 2, quantity: 24, unitCost: 25, batchSuffix: 8 },
      ],
    },
  ]

  for (const sample of samples) {
    const expectedDate = new Date(now.getTime() + sample.expectedInDays * 24 * 60 * 60 * 1000)
    const postedAt = sample.posted ? expectedDate : null

    const lines = sample.lines
      .map(({ skuIndex, quantity, unitCost, batchSuffix }, index) => {
        const sku = skus[skuIndex]
        if (!sku) return null
        return {
          skuCode: sku.skuCode,
          skuDescription: sku.description,
          batchLot: `LOT-${batchSuffix ?? index + 1}`,
          quantity,
          unitCost: new Prisma.Decimal(unitCost),
        }
      })
      .filter((line): line is NonNullable<typeof line> => Boolean(line))

    if (lines.length === 0) {
      log(`Skipping ${sample.orderNumber} – no valid SKUs found`)
      continue
    }

    await prisma.purchaseOrder.upsert({
      where: {
        orderNumber: sample.orderNumber,
      },
      update: {
        type: sample.type,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        counterpartyName: sample.counterpartyName,
        expectedDate,
        notes: sample.notes,
        status: sample.status,
        postedAt,
        lines: {
          deleteMany: {},
          create: lines,
        },
      },
      create: {
        orderNumber: sample.orderNumber,
        type: sample.type,
        status: sample.status,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        counterpartyName: sample.counterpartyName,
        expectedDate,
        postedAt,
        notes: sample.notes,
        lines: {
          create: lines,
        },
      },
    })
    log(`Purchase order ready: ${sample.orderNumber} (${sample.status})`)
  }
}

async function main() {
  try {
    await cleanPurchaseOrders()
    await createPurchaseOrders()
    log('Purchase order setup complete')
  } catch (error) {
    console.error('[setup][purchase-orders] failed', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()

export {}
