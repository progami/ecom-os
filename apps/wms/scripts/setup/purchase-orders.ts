#!/usr/bin/env npx tsx

/**
 * Setup script: sample purchase & sales orders
 * --------------------------------------------------
 * Usage:
 *   pnpm --filter @ecom-os/wms exec tsx scripts/setup/purchase-orders.ts [--skip-clean] [--verbose]
 */

import {
  SetupClient,
  type OrderSeed,
  type MovementNoteSeed,
  type TransactionSeed,
  type InvoiceSeed,
} from './api-client'

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const skipClean = args.includes('--skip-clean')

function log(message: string, data?: unknown) {
  console.log(`[setup][purchase-orders] ${message}`)
  if (verbose && data !== undefined) {
    console.log(JSON.stringify(data, null, 2))
  }
}

async function resolveWarehouse(client: SetupClient) {
  const preferredCodes = ['FMC', 'VGLOBAL']
  for (const code of preferredCodes) {
    const match = await client.findWarehouseByCode(code)
    if (match) return match
  }
  const warehouses = await client.listWarehouses(true)
  if (!warehouses.length) {
    throw new Error('No warehouses available. Run warehouse-configs script first.')
  }
  return warehouses[0]
}

async function resolveSkus(client: SetupClient, codes: string[]) {
  const map = new Map<string, any>()
  for (const code of codes) {
    const sku = await client.findSkuByCode(code)
    if (!sku) {
      throw new Error(`Required SKU ${code} not found. Run products setup first.`)
    }
    map.set(code, sku)
  }
  return map
}

async function createOrders(client: SetupClient, warehouse: any, skuMap: Map<string, any>) {
  const now = new Date()
  const toIso = (date: Date) => date.toISOString()

  const inboundExpected = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const reviewExpected = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

  const orders: OrderSeed[] = [
    {
      orderNumber: 'PO-SETUP-1001',
      warehouseCode: warehouse.code,
      type: 'purchase',
      status: 'SHIPPED',
      counterpartyName: 'CS Suppliers',
      expectedDate: toIso(inboundExpected),
      notes: 'In transit – seeded via setup script.',
      lines: [
        { skuCode: 'CS-008', quantity: 120, unitCost: 18, batchLot: '1001' },
        { skuCode: 'CS-010', quantity: 80, unitCost: 22, batchLot: '1002' },
      ],
    },
    {
      orderNumber: 'PO-SETUP-REVIEW',
      warehouseCode: warehouse.code,
      type: 'purchase',
      status: 'WAREHOUSE',
      counterpartyName: 'Vglobal Fulfilment',
      expectedDate: toIso(reviewExpected),
      notes: 'Delivery note approved – ready for reconciliation.',
      lines: [
        { skuCode: 'CS-007', quantity: 60, unitCost: 25, batchLot: '2001' },
        { skuCode: 'CS-011', quantity: 36, unitCost: 28, batchLot: '2002' },
      ],
    },
    {
      orderNumber: 'SO-SETUP-2001',
      warehouseCode: warehouse.code,
      type: 'sales',
      status: 'DRAFT',
      counterpartyName: 'Retail Outlet',
      expectedDate: toIso(now),
      notes: 'Draft outbound order for fulfilment scenario.',
      lines: [
        { skuCode: 'CS-008', quantity: 24, unitCost: 0, batchLot: '3001' },
      ],
    },
  ]

  const createdOrders = [] as any[]

  for (const order of orders) {
    const hasSkus = order.lines.every((line) => skuMap.has(line.skuCode))
    if (!hasSkus) {
      log(`Skipping ${order.orderNumber} – missing SKU references`)
      continue
    }

    try {
      const created = await client.createOrder(order)
      log(`Order created: ${order.orderNumber}`)
      createdOrders.push(created)
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) {
        const existing = await client.findPurchaseOrder(order.orderNumber, warehouse.code)
        if (existing) {
          log(`Order already exists, using existing record: ${order.orderNumber}`)
          createdOrders.push(existing)
          continue
        }
        log(`Order already exists but could not be retrieved: ${order.orderNumber}`)
        continue
      }
      throw error
    }
  }

  return createdOrders
}

async function seedInboundWorkflow(client: SetupClient, warehouse: any, orders: any[]) {
  let inboundOrder = orders.find((order) => order.orderNumber === 'PO-SETUP-1001')
  if (!inboundOrder) {
    inboundOrder = await client.findPurchaseOrder('PO-SETUP-1001', warehouse.code)
  }
  if (!inboundOrder) {
    log('Inbound order not found; skipping movement note + transactions')
    return
  }

  const orderDetails = await client.getOrder(inboundOrder.id)
  const firstLine = orderDetails.lines?.[0]
  if (!firstLine) {
    log('Inbound order has no lines; skipping movement note')
    return
  }

  const inboundBatchLot = /^[0-9]+$/.test(firstLine.batchLot ?? '')
    ? firstLine.batchLot!
    : '1001'

  const movementSeed: MovementNoteSeed = {
    purchaseOrderId: inboundOrder.id,
    referenceNumber: `${inboundOrder.orderNumber}-DN`,
    receivedAt: new Date().toISOString(),
    lines: [
      {
          purchaseOrderLineId: firstLine.id,
          quantity: firstLine.quantity,
          batchLot: inboundBatchLot,
        storageCartonsPerPallet: 20,
        shippingCartonsPerPallet: 20,
      },
    ],
  }

  const movementNote = await client.createMovementNote(movementSeed)
  log(`Movement note created: ${movementNote.referenceNumber ?? movementNote.id}`)
  await client.postMovementNote(movementNote.id)
  log('Movement note posted')

  const transactionSeed: TransactionSeed = {
    transactionType: 'RECEIVE',
    warehouseId: warehouse.id,
    referenceNumber: inboundOrder.orderNumber,
    transactionDate: new Date().toISOString(),
    supplier: inboundOrder.counterpartyName ?? 'Seed Supplier',
    items: [
      {
        skuCode: firstLine.skuCode,
        batchLot: inboundBatchLot,
        cartons: 40,
        storageCartonsPerPallet: 20,
        shippingCartonsPerPallet: 20,
      },
    ],
    costs: [
      { costType: 'storage', costName: 'Storage Fee', quantity: 40, unitRate: 2.5, totalCost: 100 },
      { costType: 'carton', costName: 'Inbound Handling', quantity: 40, unitRate: 1, totalCost: 40 },
    ],
  }

  await client.createTransaction(transactionSeed)
  log('Inbound transaction recorded (cost ledger + storage ledger will auto-update)')

  if (movementNote.lines?.[0]) {
    const invoiceSeed: InvoiceSeed = {
      invoiceNumber: `INV-${inboundOrder.orderNumber}-${Date.now()}`,
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
      warehouseId: warehouse.id,
      issuedAt: new Date().toISOString(),
      currency: 'USD',
      subtotal: 140,
      total: 140,
      lines: [
        {
          purchaseOrderId: inboundOrder.id,
          movementNoteLineId: movementNote.lines[0].id,
          chargeCode: 'STORAGE',
          description: 'Storage and handling',
          quantity: 1,
          unitRate: 140,
          total: 140,
        },
      ],
    }

    await client.createWarehouseInvoice(invoiceSeed)
    log('Warehouse invoice generated for inbound flow')
  }
}

async function main() {
  const client = new SetupClient({ verbose })

  try {
    if (!skipClean) {
      log('Existing orders are preserved (API does not support bulk delete). New orders will be added if missing.')
    }

    const warehouse = await resolveWarehouse(client)
    const skuMap = await resolveSkus(client, ['CS-007', 'CS-008', 'CS-010', 'CS-011'])

    const createdOrders = await createOrders(client, warehouse, skuMap)
    await seedInboundWorkflow(client, warehouse, createdOrders)

    log('Purchase & sales order setup complete')
  } catch (error) {
    console.error('[setup][purchase-orders] failed', error)
    process.exitCode = 1
  }
}

void main()

export {}
