import {
  SetupClient,
  type OrderSeed,
  type MovementNoteSeed,
  type TransactionSeed,
  type InvoiceSeed,
} from './setup-client'

interface WarehouseRecord {
  id: string
  code: string
  name: string
}

interface SkuRecord {
  skuCode: string
  description?: string | null
  unitsPerCarton?: number | null
}

interface PurchaseOrderSummary {
  id: string
  orderNumber: string
  warehouseCode?: string | null
}

interface PurchaseOrderLineSummary {
  id: string
  skuCode: string
  quantity: number
  batchLot?: string | null
}

interface PurchaseOrderDetail extends PurchaseOrderSummary {
  lines?: PurchaseOrderLineSummary[]
}

interface MovementNoteResponse {
  id: string
  referenceNumber?: string | null
  lines?: Array<{ id: string }>
}

const isWarehouseRecord = (value: unknown): value is WarehouseRecord => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.code === 'string'
}

const toWarehouseRecord = (value: unknown): WarehouseRecord => {
  if (!isWarehouseRecord(value)) {
    throw new Error('Warehouse response missing required fields')
  }
  const record = value as Record<string, unknown>
  return {
    id: record.id as string,
    code: record.code as string,
    name: typeof record.name === 'string' ? (record.name as string) : (record.code as string),
  }
}

const toSkuRecord = (value: unknown): SkuRecord => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('SKU response missing required fields')
  }
  const record = value as Record<string, unknown>
  if (typeof record.skuCode !== 'string') {
    throw new Error('SKU response missing skuCode')
  }
  return {
    skuCode: record.skuCode,
    description: typeof record.description === 'string' ? record.description : undefined,
    unitsPerCarton: typeof record.unitsPerCarton === 'number' ? record.unitsPerCarton : undefined,
  }
}

const toPurchaseOrderSummary = (value: unknown): PurchaseOrderSummary => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Purchase order response missing required fields')
  }
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.orderNumber !== 'string') {
    throw new Error('Purchase order response missing id or orderNumber')
  }
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    warehouseCode: typeof record.warehouseCode === 'string' ? record.warehouseCode : undefined,
  }
}

const toPurchaseOrderDetail = (value: unknown): PurchaseOrderDetail => {
  const summary = toPurchaseOrderSummary(value)
  const record = value as Record<string, unknown>
  const lines = Array.isArray(record.lines)
    ? record.lines
        .map((line) => {
          if (typeof line !== 'object' || line === null) {
            return null
          }
          const lineRecord = line as Record<string, unknown>
          if (
            typeof lineRecord.id === 'string' &&
            typeof lineRecord.skuCode === 'string' &&
            typeof lineRecord.quantity === 'number'
          ) {
            return {
              id: lineRecord.id,
              skuCode: lineRecord.skuCode,
              quantity: lineRecord.quantity,
              batchLot:
                typeof lineRecord.batchLot === 'string' || lineRecord.batchLot === null
                  ? (lineRecord.batchLot as string | null)
                  : undefined,
            }
          }
          return null
        })
        .filter((line): line is PurchaseOrderLineSummary => line !== null)
    : undefined

  return {
    ...summary,
    lines,
  }
}

const toMovementNoteResponse = (value: unknown): MovementNoteResponse => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Movement note response missing required fields')
  }
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string') {
    throw new Error('Movement note response missing id')
  }
  const lines = Array.isArray(record.lines)
    ? record.lines
        .map((line) =>
          typeof line === 'object' && line !== null && typeof (line as Record<string, unknown>).id === 'string'
            ? { id: (line as Record<string, unknown>).id as string }
            : null
        )
        .filter((line): line is { id: string } => line !== null)
    : undefined

  return {
    id: record.id,
    referenceNumber: typeof record.referenceNumber === 'string' ? record.referenceNumber : undefined,
    lines,
  }
}

export interface SeedPurchaseOrderOptions {
  logger?: (message: string) => void
  verboseLogger?: (message: string, data?: unknown) => void
  preferredWarehouseCodes?: string[]
}

export interface SeedPurchaseOrderResult {
  warehouseId: string
  warehouseCode: string
  purchaseOrdersCreated: number
  inboundTransactionCreated: boolean
  invoiceCreated: boolean
}

async function resolveWarehouse(
  client: SetupClient,
  preferred: string[]
): Promise<WarehouseRecord> {
  for (const code of preferred) {
    const match = await client.findWarehouseByCode(code)
    if (match) return toWarehouseRecord(match)
  }
  const warehouses = await client.listWarehouses(true)
  if (!warehouses.length) {
    throw new Error('No warehouses available. Run warehouse setup first.')
  }
  return toWarehouseRecord(warehouses[0])
}

async function resolveSkus(client: SetupClient, codes: string[]) {
  const map = new Map<string, SkuRecord>()
  for (const code of codes) {
    const sku = await client.findSkuByCode(code)
    if (!sku) {
      throw new Error(`Required SKU ${code} not found. Run product setup first.`)
    }
    map.set(code, toSkuRecord(sku))
  }
  return map
}

async function createOrders(
  client: SetupClient,
  warehouse: WarehouseRecord,
  skuMap: Map<string, SkuRecord>,
  log: (message: string) => void
) {
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

  const createdOrders: PurchaseOrderSummary[] = []

  for (const order of orders) {
    const hasSkus = order.lines.every((line) => skuMap.has(line.skuCode))
    if (!hasSkus) {
      log(`Skipping ${order.orderNumber} – missing SKU references`)
      continue
    }

    try {
      const created = await client.createOrder(order)
      log(`Order created: ${order.orderNumber}`)
      createdOrders.push(toPurchaseOrderSummary(created))
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) {
        const existing = await client.findPurchaseOrder(order.orderNumber, warehouse.code)
        if (existing) {
          log(`Order already exists: ${order.orderNumber}`)
          createdOrders.push(toPurchaseOrderSummary(existing))
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

async function seedInboundWorkflow(
  client: SetupClient,
  warehouse: WarehouseRecord,
  orders: PurchaseOrderSummary[],
  log: (message: string) => void
) {
  let inboundOrder = orders.find((order) => order.orderNumber === 'PO-SETUP-1001')
  if (!inboundOrder) {
    inboundOrder = await client.findPurchaseOrder('PO-SETUP-1001', warehouse.code)
    inboundOrder = inboundOrder ? toPurchaseOrderSummary(inboundOrder) : undefined
  }
  if (!inboundOrder) {
    log('Inbound order not found; skipping movement note + transactions')
    return { transaction: false, invoice: false }
  }

  const orderDetails = toPurchaseOrderDetail(await client.getOrder(inboundOrder.id))
  const enrichedLines = orderDetails.lines
    ?.map((line, index) => {
      if (!line?.id || typeof line.quantity !== 'number' || line.quantity <= 0 || typeof line.skuCode !== 'string') {
        return null
      }

      const fallbackBatch = String(1000 + index + 1)
      const normalizedBatchLot = /^[0-9]+$/.test(line.batchLot ?? '')
        ? (line.batchLot as string)
        : fallbackBatch

      return {
        purchaseOrderLineId: line.id,
        quantity: line.quantity,
        batchLot: normalizedBatchLot,
        skuCode: line.skuCode,
      }
    })
    .filter((line): line is { purchaseOrderLineId: string; quantity: number; batchLot: string; skuCode: string } => line !== null)

  if (!enrichedLines?.length) {
    log('Inbound order has no postable lines; skipping movement note')
    return { transaction: false, invoice: false }
  }

  const movementSeed: MovementNoteSeed = {
    purchaseOrderId: inboundOrder.id,
    referenceNumber: `${inboundOrder.orderNumber}-DN`,
    receivedAt: new Date().toISOString(),
    lines: enrichedLines.map((line) => ({
      purchaseOrderLineId: line.purchaseOrderLineId,
      quantity: line.quantity,
      batchLot: line.batchLot,
      storageCartonsPerPallet: 20,
      shippingCartonsPerPallet: 20,
    })),
  }

  const movementNote = toMovementNoteResponse(await client.createMovementNote(movementSeed))
  log(`Movement note created: ${movementNote.referenceNumber ?? movementNote.id}`)
  await client.postMovementNote(movementNote.id)
  log('Movement note posted')

  const transactionItems = enrichedLines.map((line) => ({
    skuCode: line.skuCode,
    batchLot: line.batchLot,
    cartons: line.quantity,
    storageCartonsPerPallet: 20,
    shippingCartonsPerPallet: 20,
  }))

  const totalCartons = transactionItems.reduce((sum, item) => sum + item.cartons, 0)

  const transactionSeed: TransactionSeed = {
    transactionType: 'RECEIVE',
    warehouseId: warehouse.id,
    referenceNumber: inboundOrder.orderNumber,
    transactionDate: new Date().toISOString(),
    supplier: inboundOrder.counterpartyName ?? 'Seed Supplier',
    items: transactionItems,
    costs: totalCartons
      ? [
          {
            costType: 'storage',
            costName: 'Storage Fee',
            quantity: totalCartons,
            unitRate: 2.5,
            totalCost: Number((totalCartons * 2.5).toFixed(2)),
          },
          {
            costType: 'carton',
            costName: 'Inbound Handling',
            quantity: totalCartons,
            unitRate: 1,
            totalCost: totalCartons,
          },
        ]
      : undefined,
  }

  await client.createTransaction(transactionSeed)
  log('Inbound transaction recorded')

  let invoiceCreated = false
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
    invoiceCreated = true
  }

  return { transaction: true, invoice: invoiceCreated }
}

export async function seedPurchaseOrders(
  client: SetupClient,
  options: SeedPurchaseOrderOptions = {}
): Promise<SeedPurchaseOrderResult> {
  const {
    logger,
    verboseLogger,
    preferredWarehouseCodes = ['FMC', 'VGLOBAL'],
  } = options

  const log = logger ?? (() => {})
  const verbose = verboseLogger ?? ((_message: string, _data?: unknown) => {})

  const warehouse = await resolveWarehouse(client, preferredWarehouseCodes)

  const skuMap = await resolveSkus(client, ['CS-007', 'CS-008', 'CS-010', 'CS-011'])

  const orders = await createOrders(client, warehouse, skuMap, log)
  verbose('Orders ensured', orders.map((order) => order.orderNumber))

  const inboundResult = await seedInboundWorkflow(client, warehouse, orders, log)

  return {
    warehouseId: warehouse.id,
    warehouseCode: warehouse.code,
    purchaseOrdersCreated: orders.length,
    inboundTransactionCreated: inboundResult.transaction,
    invoiceCreated: inboundResult.invoice,
  }
}
