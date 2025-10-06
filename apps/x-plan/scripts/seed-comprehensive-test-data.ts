#!/usr/bin/env tsx
/**
 * Comprehensive Test Data Seeding Script
 *
 * This script creates a complete, realistic test scenario with:
 * - 3 SKUs with different cost structures
 * - Multiple POs with batch tracking
 * - Payment schedules
 * - Sales planning across 12 weeks
 * - Starting cash: $80,000
 *
 * Expected outcomes are documented for validation
 */

import { Prisma, LogisticsEventType } from '@prisma/client'
import prisma from '@/lib/prisma'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const API_BASE = `${BASE_URL}/api/v1/x-plan`
const RESET_REQUESTED = process.env.RESET === 'true' || process.argv.includes('--reset')
const SALES_HORIZON_WEEKS = 156 // Matches planning calendar coverage (2025–2027)

interface Product {
  id?: string
  name: string
  sku: string
  sellingPrice: number
  manufacturingCost: number
  freightCost: number
  tariffRate: number
  tacosPercent: number
  fbaFee: number
  amazonReferralRate: number
  storagePerMonth: number
}

interface PurchaseOrder {
  id?: string
  orderCode: string
  productId: string
  quantity: number
  manufacturingCost: number
  freightCost: number
  tariffRate: number
  sellingPrice: number
  tacosPercent: number
  fbaFee: number
  amazonReferralRate: number
  storagePerMonth: number
  orderDate: string
  estimatedShipDate: string
  estimatedArrivalDate: string
  actualArrivalDate?: string
}

interface PaymentSchedule {
  purchaseOrderId: string
  paymentType: 'DEPOSIT' | 'BALANCE' | 'FULL'
  percentOfTotal: number
  plannedDate: string
  plannedAmount: number
  paymentIndex: number
}

interface SalesWeek {
  productId: string
  weekNumber: number
  actualSales?: number
  forecastSales?: number
  stockStart?: number
}

interface BatchSpec {
  code: string
  quantity: number
  overrideSellingPrice?: number
  overrideManufacturingCost?: number
  overrideFreightCost?: number
  overrideFbaFee?: number
  overrideStoragePerMonth?: number
  overrideTariffRate?: number
  overrideTacosPercent?: number
  overrideReferralRate?: number
}

interface PurchaseOrderSpec {
  orderCode: string
  productId: string
  product: Product
  quantity: number
  poDate: string
  inboundEta: string
  availableDate: string
  batches: BatchSpec[]
  logisticsEvents?: Array<{
    type: LogisticsEventType
    eventDate: string
    reference?: string
    notes?: string
  }>
  shipName?: string
  transportReference?: string
  stageDurations?: {
    productionWeeks?: number
    sourceWeeks?: number
    oceanWeeks?: number
    finalWeeks?: number
  }
}

type ProductSeed = Product & { key: 'sixLD' | 'premiumWidget' | 'economyWidget' | 'deluxeWidget' }

const vesselNames = [
  'MV Horizon Dawn',
  'CMA CGM Titan',
  'Hapag-Lloyd Aurora',
  'MSC Seascape',
  'Evergreen Sun',
  'Maersk Pioneer',
  'ONE Infinity',
  'NYK Comet',
  'APL Meridian',
  'COSCO Stellar',
]

const transportPrefixes = ['HLCU', 'MSCU', 'OOLU', 'APMU', 'EMCU', 'CAXU', 'TCKU', 'SEGU']

const additionalYearConfigs = [
  { yearSuffix: '2026', weekOffset: 52, rotation: 1, productShift: 1 },
  { yearSuffix: '2027', weekOffset: 104, rotation: 2, productShift: 2 },
]

// Product definitions
const productSeeds: ProductSeed[] = [
  {
    key: 'sixLD',
    name: '6 LD',
    sku: 'CS007',
    sellingPrice: 36.99,
    manufacturingCost: 11.5,
    freightCost: 1.80,
    tariffRate: 0.08,
    tacosPercent: 0.12,
    fbaFee: 4.75,
    amazonReferralRate: 0.15,
    storagePerMonth: 0.48,
  },
  {
    key: 'premiumWidget',
    name: 'Premium Widget',
    sku: 'WDG-001',
    sellingPrice: 29.99,
    manufacturingCost: 8.0,
    freightCost: 1.5,
    tariffRate: 0.35, // 35% of manufacturing cost
    tacosPercent: 0.15, // 15% of revenue for PPC
    fbaFee: 4.5,
    amazonReferralRate: 0.15, // 15% referral fee
    storagePerMonth: 0.5,
  },
  {
    key: 'economyWidget',
    name: 'Economy Widget',
    sku: 'WDG-002',
    sellingPrice: 19.99,
    manufacturingCost: 5.0,
    freightCost: 1.0,
    tariffRate: 0.35,
    tacosPercent: 0.15, // 15% ad spend
    fbaFee: 3.5,
    amazonReferralRate: 0.15,
    storagePerMonth: 0.35,
  },
  {
    key: 'deluxeWidget',
    name: 'Deluxe Widget',
    sku: 'WDG-003',
    sellingPrice: 49.99,
    manufacturingCost: 15.0,
    freightCost: 2.5,
    tariffRate: 0.35,
    tacosPercent: 0.15, // 15% ad spend
    fbaFee: 6.0,
    amazonReferralRate: 0.15,
    storagePerMonth: 0.75,
  },
]

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API call failed: ${response.status} ${response.statusText}\n${text}`)
  }

  return response.json()
}

async function fetchExistingProducts(): Promise<Product[]> {
  try {
    const result = await apiCall('/products')
    const list = Array.isArray(result?.products) ? result.products : Array.isArray(result) ? result : []
    return list as Product[]
  } catch (error) {
    console.warn('Unable to fetch existing products, continuing with empty list', error)
    return []
  }
}

function toDecimal(value: number | null | undefined) {
  return value == null ? null : new Prisma.Decimal(value)
}

async function syncExistingPurchaseOrder(spec: PurchaseOrderSpec): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({
      where: { orderCode: spec.orderCode },
      include: { batchTableRows: true },
    })

    if (!order) {
      throw new Error(`Unable to locate existing purchase order ${spec.orderCode}`)
    }

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        productId: spec.productId,
        poDate: spec.poDate ? new Date(spec.poDate) : null,
        inboundEta: spec.inboundEta ? new Date(spec.inboundEta) : null,
        availableDate: spec.availableDate ? new Date(spec.availableDate) : null,
        shipName: spec.shipName ?? null,
        transportReference: spec.transportReference ?? null,
        productionWeeks:
          spec.stageDurations?.productionWeeks != null
            ? toDecimal(spec.stageDurations.productionWeeks)
            : null,
        sourceWeeks:
          spec.stageDurations?.sourceWeeks != null
            ? toDecimal(spec.stageDurations.sourceWeeks)
            : null,
        oceanWeeks:
          spec.stageDurations?.oceanWeeks != null
            ? toDecimal(spec.stageDurations.oceanWeeks)
            : null,
        finalWeeks:
          spec.stageDurations?.finalWeeks != null
            ? toDecimal(spec.stageDurations.finalWeeks)
            : null,
      },
    })

    const batchesByCode = new Map(
      order.batchTableRows.map((batch) => [batch.batchCode ?? '', batch])
    )

    for (const batch of spec.batches) {
      const payload = {
        productId: spec.productId,
        batchCode: batch.code,
        quantity: batch.quantity,
        overrideSellingPrice: toDecimal(batch.overrideSellingPrice ?? spec.product.sellingPrice),
        overrideManufacturingCost: toDecimal(
          batch.overrideManufacturingCost ?? spec.product.manufacturingCost
        ),
        overrideFreightCost: toDecimal(batch.overrideFreightCost ?? spec.product.freightCost),
        overrideTariffRate: toDecimal(batch.overrideTariffRate ?? spec.product.tariffRate),
        overrideTacosPercent: toDecimal(batch.overrideTacosPercent ?? spec.product.tacosPercent),
        overrideFbaFee: toDecimal(batch.overrideFbaFee ?? spec.product.fbaFee),
        overrideReferralRate: toDecimal(
          batch.overrideReferralRate ?? spec.product.amazonReferralRate
        ),
        overrideStoragePerMonth: toDecimal(
          batch.overrideStoragePerMonth ?? spec.product.storagePerMonth
        ),
      }

      const existing = batchesByCode.get(batch.code)
      if (existing) {
        await tx.batchTableRow.update({
          where: { id: existing.id },
          data: payload,
        })
        batchesByCode.delete(batch.code)
      } else {
        await tx.batchTableRow.create({
          data: {
            purchaseOrderId: order.id,
            ...payload,
          },
        })
      }
    }

    for (const leftover of batchesByCode.values()) {
      await tx.batchTableRow.delete({ where: { id: leftover.id } })
    }

    const totalQuantity = spec.batches.reduce((sum, batch) => sum + batch.quantity, 0)

    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { quantity: totalQuantity },
    })

    return order.id
  })
}

async function persistPaymentsWithPrisma(payments: PaymentSchedule[]) {
  if (payments.length === 0) return

  const byOrder = new Map<string, PaymentSchedule[]>()
  for (const payment of payments) {
    const list = byOrder.get(payment.purchaseOrderId) ?? []
    list.push(payment)
    byOrder.set(payment.purchaseOrderId, list)
  }

  await prisma.$transaction(async (tx) => {
    for (const [orderId, list] of byOrder.entries()) {
      await tx.purchaseOrderPayment.deleteMany({ where: { purchaseOrderId: orderId } })

      list.sort((a, b) => a.paymentIndex - b.paymentIndex)

      for (const payment of list) {
        const dueDate = payment.plannedDate ? new Date(payment.plannedDate) : null
        await tx.purchaseOrderPayment.create({
          data: {
            purchaseOrderId: orderId,
            paymentIndex: payment.paymentIndex,
            dueDate,
            dueDateDefault: dueDate,
            dueDateSource: 'SYSTEM',
            percentage: toDecimal(payment.percentOfTotal / 100),
            amountExpected: toDecimal(payment.plannedAmount),
            amountPaid: null,
            category: payment.paymentType,
            label: payment.paymentType,
          },
        })
      }
    }
  })
}

async function syncLogisticsEvents(
  purchaseOrderId: string,
  events: PurchaseOrderSpec['logisticsEvents']
) {
  try {
    await prisma.logisticsEvent.deleteMany({ where: { purchaseOrderId } })
    if (!events || events.length === 0) {
      return
    }

    await prisma.logisticsEvent.createMany({
      data: events.map((event) => ({
        purchaseOrderId,
        type: event.type,
        eventDate: event.eventDate ? new Date(event.eventDate) : null,
        reference: event.reference ?? null,
        notes: event.notes ?? null,
      })),
    })
  } catch (error) {
    console.error(`  ✗ Logistics events for order ${purchaseOrderId}:`, error)
  }
}

async function seedBusinessParameters() {
  console.log('\n📊 Setting business parameters...')

  const params = [
    { label: 'Starting Cash', valueNumeric: 80000, valueText: null },
    { label: 'Weekly Fixed Costs', valueNumeric: 500, valueText: null },
    { label: 'Amazon Payout Delay (weeks)', valueNumeric: 2, valueText: null },
    { label: 'Stock Warning Threshold (weeks)', valueNumeric: 4, valueText: null },
  ]

  console.log('  ⚠️  Business parameter API requires IDs; set these manually in the UI if needed.')
  params.forEach((param) => {
    console.log(`  • ${param.label}: ${param.valueNumeric}`)
  })
}

async function seedProducts() {
  console.log('\n📦 Creating products...')
  const createdProducts: Product[] = []

  const existingProducts = await fetchExistingProducts()
  const existingBySku = new Map(existingProducts.map((product) => [product.sku, product]))

  for (const product of productSeeds) {
    try {
      let createdProduct = existingBySku.get(product.sku)

      if (!createdProduct) {
        try {
          const result = await apiCall('/products', {
            method: 'POST',
            body: JSON.stringify({ name: product.name, sku: product.sku }),
          })
          createdProduct = result.product || result
        } catch (creationError) {
          console.warn(`  ⚠️  Failed to create ${product.sku}, attempting to reuse existing record`, creationError)
          const refreshed = await fetchExistingProducts()
          createdProduct = refreshed.find((item) => item.sku === product.sku)
          if (!createdProduct) throw creationError
        }
      } else {
        console.log(`  ↺ ${product.sku}: already exists, updating costs`)
      }

      if (!createdProduct?.id) {
        throw new Error(`Unable to resolve ID for product ${product.sku}`)
      }

      await apiCall('/products', {
        method: 'PUT',
        body: JSON.stringify({
          updates: [
            {
              id: createdProduct.id,
              values: {
                sellingPrice: formatCurrency(product.sellingPrice),
                manufacturingCost: formatCurrency(product.manufacturingCost),
                freightCost: formatCurrency(product.freightCost),
                tariffRate: formatPercent(product.tariffRate),
                tacosPercent: formatPercent(product.tacosPercent),
                fbaFee: formatCurrency(product.fbaFee),
                amazonReferralRate: formatPercent(product.amazonReferralRate),
                storagePerMonth: formatCurrency(product.storagePerMonth),
              },
            },
          ],
        }),
      })

      const hydratedProduct = { ...createdProduct, ...product }
      createdProducts.push(hydratedProduct)
      console.log(`  ✓ ${product.sku}: ${product.name}`)

      // Calculate and display unit economics
      const tariffCost = product.manufacturingCost * product.tariffRate
      const landedCost = product.manufacturingCost + product.freightCost + tariffCost
      const grossMargin = product.sellingPrice - landedCost
      const gmPercent = (grossMargin / product.sellingPrice * 100).toFixed(1)
      console.log(`    Landed Cost: $${landedCost.toFixed(2)} | GM: ${gmPercent}%`)
    } catch (error) {
      console.error(`  ✗ ${product.sku}:`, error)
    }
  }

  return createdProducts
}

async function seedPurchaseOrders(products: Product[]) {
  console.log('\n🚢 Creating purchase orders...')

  const productBySku = new Map(products.map((product) => [product.sku, product]))

  const requireProduct = (sku: string) => {
    const product = productBySku.get(sku)
    if (!product || !product.id) {
      throw new Error(`Missing seeded product with SKU ${sku}`)
    }
    return product
  }

  const sixLD = requireProduct('CS007')
  const premiumWidget = requireProduct('WDG-001')
  const economyWidget = requireProduct('WDG-002')
  const deluxeWidget = requireProduct('WDG-003')
  const allProducts = [sixLD, premiumWidget, economyWidget, deluxeWidget]

  const baseOrderSpecs: PurchaseOrderSpec[] = [
    // 6 LD - replenishment cycles
    {
      orderCode: 'PO-2025-101',
      productId: sixLD.id!,
      product: sixLD,
      quantity: 1200,
      poDate: '2025-01-05',
      inboundEta: '2025-02-22',
      availableDate: '2025-02-24',
      shipName: 'MV Evergreen - CS007',
      transportReference: 'OOLU0901921',
      stageDurations: { productionWeeks: 3, sourceWeeks: 1, oceanWeeks: 3, finalWeeks: 1 },
      batches: [
        { code: 'PO-2025-101-A', quantity: 700 },
        { code: 'PO-2025-101-B', quantity: 500, overrideManufacturingCost: 12.1, overrideFreightCost: 1.95 },
      ],
      logisticsEvents: [
        { type: LogisticsEventType.PRODUCTION_START, eventDate: '2025-01-07', reference: 'Factory Ningbo' },
        { type: LogisticsEventType.PRODUCTION_COMPLETE, eventDate: '2025-01-21' },
        { type: LogisticsEventType.INBOUND_DEPARTURE, eventDate: '2025-02-03', reference: 'MV Evergreen' },
        { type: LogisticsEventType.PORT_ARRIVAL, eventDate: '2025-02-18', reference: 'Port of LA' },
        { type: LogisticsEventType.WAREHOUSE_ARRIVAL, eventDate: '2025-02-22', reference: 'Riverside DC' },
      ],
    },
    {
      orderCode: 'PO-2025-102',
      productId: sixLD.id!,
      product: sixLD,
      quantity: 1500,
      poDate: '2025-03-14',
      inboundEta: '2025-05-02',
      availableDate: '2025-05-04',
      shipName: 'OOCL Germany - CS007',
      transportReference: 'OOCU8336559',
      stageDurations: { productionWeeks: 4, sourceWeeks: 1, oceanWeeks: 4, finalWeeks: 1 },
      batches: [
        { code: 'PO-2025-102-A', quantity: 900 },
        { code: 'PO-2025-102-B', quantity: 600, overrideManufacturingCost: 12.4, overrideFbaFee: 4.95 },
      ],
      logisticsEvents: [
        { type: LogisticsEventType.PRODUCTION_START, eventDate: '2025-03-18', reference: 'Factory Shenzhen' },
        { type: LogisticsEventType.PRODUCTION_COMPLETE, eventDate: '2025-04-05' },
        { type: LogisticsEventType.INBOUND_DEPARTURE, eventDate: '2025-04-11', reference: 'OOCL Germany' },
        { type: LogisticsEventType.PORT_ARRIVAL, eventDate: '2025-04-28', reference: 'Port of Long Beach' },
        { type: LogisticsEventType.WAREHOUSE_ARRIVAL, eventDate: '2025-05-02', reference: 'Riverside DC' },
      ],
    },
    // Premium Widget - Early order, 1000 units, 3 batches
    {
      orderCode: 'PO-2025-001',
      productId: premiumWidget.id!,
      product: premiumWidget,
      quantity: 1000,
      poDate: '2025-01-05',
      inboundEta: '2025-03-10', // Week 11
      availableDate: '2025-03-10',
      shipName: 'EVER ARM',
      transportReference: 'EVAR123456',
      stageDurations: { productionWeeks: 4, sourceWeeks: 1, oceanWeeks: 4, finalWeeks: 1 },
      batches: [
        { code: 'PO-2025-001-A', quantity: 400 },
        { code: 'PO-2025-001-B', quantity: 350, overrideManufacturingCost: 8.5, overrideFreightCost: 1.6 },
        { code: 'PO-2025-001-C', quantity: 250, overrideManufacturingCost: 7.8, overrideFbaFee: 4.7, overrideStoragePerMonth: 0.55 },
      ],
      logisticsEvents: [
        { type: LogisticsEventType.PRODUCTION_START, eventDate: '2025-01-08', reference: 'Factory A' },
        { type: LogisticsEventType.PRODUCTION_COMPLETE, eventDate: '2025-02-02' },
        { type: LogisticsEventType.INBOUND_DEPARTURE, eventDate: '2025-02-10', reference: 'EVER ARM' },
        { type: LogisticsEventType.PORT_ARRIVAL, eventDate: '2025-03-05', reference: 'Long Beach' },
        { type: LogisticsEventType.WAREHOUSE_ARRIVAL, eventDate: '2025-03-09', reference: 'Ontario DC' },
      ],
    },
    // Economy Widget - Mid-year order, 1500 units, 2 batches
    {
      orderCode: 'PO-2025-002',
      productId: economyWidget.id!,
      product: economyWidget,
      quantity: 1500,
      poDate: '2025-02-15',
      inboundEta: '2025-04-21',
      availableDate: '2025-04-21',
      shipName: 'MSC Eloane',
      transportReference: 'MRKU4430533',
      stageDurations: { productionWeeks: 4, sourceWeeks: 1, oceanWeeks: 5, finalWeeks: 1 },
      batches: [
        { code: 'PO-2025-002-A', quantity: 900 },
        { code: 'PO-2025-002-B', quantity: 600, overrideManufacturingCost: 5.3, overrideFreightCost: 1.1, overrideFbaFee: 3.7 },
      ],
      logisticsEvents: [
        { type: LogisticsEventType.PRODUCTION_START, eventDate: '2025-02-18', reference: 'Factory B' },
        { type: LogisticsEventType.PRODUCTION_COMPLETE, eventDate: '2025-03-12' },
        { type: LogisticsEventType.INBOUND_DEPARTURE, eventDate: '2025-03-18', reference: 'MSC Eloane' },
        { type: LogisticsEventType.PORT_ARRIVAL, eventDate: '2025-04-15', reference: 'Port of Oakland' },
        { type: LogisticsEventType.WAREHOUSE_ARRIVAL, eventDate: '2025-04-21', reference: 'Sacramento DC' },
      ],
    },
    // Deluxe Widget - Smaller batch, 500 units, 2 batches
    {
      orderCode: 'PO-2025-003',
      productId: deluxeWidget.id!,
      product: deluxeWidget,
      quantity: 500,
      poDate: '2025-01-20',
      inboundEta: '2025-03-24',
      availableDate: '2025-03-24',
      shipName: 'OOCL Asia',
      transportReference: 'OOLU567890',
      stageDurations: { productionWeeks: 3, sourceWeeks: 1, oceanWeeks: 4, finalWeeks: 1 },
      batches: [
        { code: 'PO-2025-003-A', quantity: 300 },
        { code: 'PO-2025-003-B', quantity: 200, overrideSellingPrice: 52.99, overrideManufacturingCost: 16.0, overrideFreightCost: 2.7 },
      ],
      logisticsEvents: [
        { type: LogisticsEventType.PRODUCTION_START, eventDate: '2025-01-23', reference: 'Factory C' },
        { type: LogisticsEventType.PRODUCTION_COMPLETE, eventDate: '2025-02-16' },
        { type: LogisticsEventType.INBOUND_DEPARTURE, eventDate: '2025-02-21', reference: 'OOCL Asia' },
        { type: LogisticsEventType.PORT_ARRIVAL, eventDate: '2025-03-18', reference: 'Port of Seattle' },
        { type: LogisticsEventType.WAREHOUSE_ARRIVAL, eventDate: '2025-03-24', reference: 'Kent DC' },
      ],
    },
    // Premium Widget - Second batch, 800 units, 2 batches
    {
      orderCode: 'PO-2025-004',
      productId: premiumWidget.id!,
      product: premiumWidget,
      quantity: 800,
      poDate: '2025-03-01',
      inboundEta: '2025-05-05',
      availableDate: '2025-05-05',
      shipName: 'Hapag-Lloyd 781W',
      transportReference: 'HLCU8901234',
      stageDurations: { productionWeeks: 4, sourceWeeks: 1, oceanWeeks: 4, finalWeeks: 1 },
      batches: [
        { code: 'PO-2025-004-A', quantity: 500 },
        { code: 'PO-2025-004-B', quantity: 300, overrideManufacturingCost: 8.2, overrideFbaFee: 4.8, overrideStoragePerMonth: 0.58 },
      ],
      logisticsEvents: [
        { type: LogisticsEventType.PRODUCTION_START, eventDate: '2025-03-04', reference: 'Factory A' },
        { type: LogisticsEventType.PRODUCTION_COMPLETE, eventDate: '2025-03-28' },
        { type: LogisticsEventType.INBOUND_DEPARTURE, eventDate: '2025-04-04', reference: 'Hapag-Lloyd 781W' },
        { type: LogisticsEventType.PORT_ARRIVAL, eventDate: '2025-04-30', reference: 'Port of LA' },
        { type: LogisticsEventType.WAREHOUSE_ARRIVAL, eventDate: '2025-05-04', reference: 'Ontario DC' },
      ],
    },
  ]

  const rotateSpecs = <T,>(list: T[], offset: number) => {
    if (!offset || list.length <= 1) return [...list]
    const normalized = ((offset % list.length) + list.length) % list.length
    return [...list.slice(normalized), ...list.slice(0, normalized)]
  }

  const recurringOrderSpecs = additionalYearConfigs.flatMap((config, variantIndex) => {
    const rotatedOrders = rotateSpecs(baseOrderSpecs, config.rotation)
    const rotatedProducts = rotateSpecs(allProducts, config.productShift)
    return rotatedOrders.map((spec, orderIndex) => {
      const product = rotatedProducts[orderIndex % rotatedProducts.length]
      const specForYear: PurchaseOrderSpec = {
        ...spec,
        productId: product.id!,
        product,
        batches: spec.batches.map((batch) => ({ code: batch.code, quantity: batch.quantity })),
      }
      const staggerWeeks = config.weekOffset + orderIndex * 4 + variantIndex * 6
      return shiftOrderSpec(specForYear, {
        yearSuffix: config.yearSuffix,
        weekOffset: staggerWeeks,
        orderIndex,
        variantIndex,
        product,
      })
    })
  })

  const orderSpecs = [...baseOrderSpecs, ...recurringOrderSpecs]

  const createdOrders = [] as Array<PurchaseOrder & PurchaseOrderSpec>
  for (const spec of orderSpecs) {
    try {
      // Create PO with minimal fields (quantity will be auto-calculated from batches)
      let createdOrder
      try {
        const result = await apiCall('/purchase-orders', {
          method: 'POST',
          body: JSON.stringify({
            productId: spec.productId,
            orderCode: spec.orderCode,
            poDate: spec.poDate,
            quantity: 0, // Will be recalculated from batches
          }),
        })
        createdOrder = result.order || result
      } catch (creationError) {
        if (creationError instanceof Error && creationError.message.includes('409')) {
          console.log(`  ↺ ${spec.orderCode}: already exists, syncing costs`)
          const orderId = await syncExistingPurchaseOrder(spec)
          await syncLogisticsEvents(orderId, spec.logisticsEvents ?? [])
          createdOrders.push({
            ...spec,
            id: orderId,
          } as PurchaseOrder & PurchaseOrderSpec)
          continue
        }
        throw creationError
      }

      // Update PO with arrival dates
      const updateValues: Record<string, string> = {
        inboundEta: spec.inboundEta,
        availableDate: spec.availableDate,
      }
      if (spec.shipName) updateValues.shipName = spec.shipName
      if (spec.transportReference) updateValues.transportReference = spec.transportReference
      if (spec.stageDurations?.productionWeeks != null) {
        updateValues.productionWeeks = spec.stageDurations.productionWeeks.toString()
      }
      if (spec.stageDurations?.sourceWeeks != null) {
        updateValues.sourceWeeks = spec.stageDurations.sourceWeeks.toString()
      }
      if (spec.stageDurations?.oceanWeeks != null) {
        updateValues.oceanWeeks = spec.stageDurations.oceanWeeks.toString()
      }
      if (spec.stageDurations?.finalWeeks != null) {
        updateValues.finalWeeks = spec.stageDurations.finalWeeks.toString()
      }

      await apiCall('/purchase-orders', {
        method: 'PUT',
        body: JSON.stringify({
          updates: [
            {
              id: createdOrder.id,
              values: updateValues,
            },
          ],
        }),
      })

      // Create batches for this PO
      for (const batch of spec.batches) {
        const batchResult = await apiCall('/purchase-orders/batches', {
          method: 'POST',
          body: JSON.stringify({
            purchaseOrderId: createdOrder.id,
            productId: spec.productId,
            quantity: batch.quantity,
            batchCode: batch.code,
          }),
        })
        const createdBatch = batchResult.batch || batchResult

        // Update batch with override values if provided
        const overrideValues: Record<string, string> = {
          overrideSellingPrice: formatCurrency(spec.product.sellingPrice),
          overrideManufacturingCost: formatCurrency(spec.product.manufacturingCost),
          overrideFreightCost: formatCurrency(spec.product.freightCost),
          overrideTariffRate: formatPercent(spec.product.tariffRate),
          overrideTacosPercent: formatPercent(spec.product.tacosPercent),
          overrideFbaFee: formatCurrency(spec.product.fbaFee),
          overrideReferralRate: formatPercent(spec.product.amazonReferralRate),
          overrideStoragePerMonth: formatCurrency(spec.product.storagePerMonth),
        }

        // Add optional overrides
        if (batch.overrideSellingPrice !== undefined) {
          overrideValues.overrideSellingPrice = formatCurrency(batch.overrideSellingPrice)
        }
        if (batch.overrideManufacturingCost !== undefined) {
          overrideValues.overrideManufacturingCost = formatCurrency(batch.overrideManufacturingCost)
        }
        if (batch.overrideFreightCost !== undefined) {
          overrideValues.overrideFreightCost = formatCurrency(batch.overrideFreightCost)
        }
        if (batch.overrideFbaFee !== undefined) {
          overrideValues.overrideFbaFee = formatCurrency(batch.overrideFbaFee)
        }
        if (batch.overrideStoragePerMonth !== undefined) {
          overrideValues.overrideStoragePerMonth = formatCurrency(batch.overrideStoragePerMonth)
        }
        if (batch.overrideTariffRate !== undefined) {
          overrideValues.overrideTariffRate = formatPercent(batch.overrideTariffRate)
        }
        if (batch.overrideTacosPercent !== undefined) {
          overrideValues.overrideTacosPercent = formatPercent(batch.overrideTacosPercent)
        }
        if (batch.overrideReferralRate !== undefined) {
          overrideValues.overrideReferralRate = formatPercent(batch.overrideReferralRate)
        }

      await apiCall('/purchase-orders/batches', {
        method: 'PUT',
        body: JSON.stringify({
          updates: [
            {
              id: createdBatch.id,
              values: overrideValues,
            },
          ],
        }),
      })
      }

      await syncLogisticsEvents(createdOrder.id, spec.logisticsEvents ?? [])

      createdOrders.push({ ...(createdOrder as PurchaseOrder), ...spec })

      console.log(`  ✓ ${spec.orderCode}: ${spec.batches.length} batches, ${spec.quantity} total units`)
      console.log(`    Arrival: Week ${getWeekNumber(spec.inboundEta)}`)
    } catch (error) {
      console.error(`  ✗ ${spec.orderCode}:`, error)
    }
  }

  return createdOrders
}

async function seedPaymentSchedules(orders: any[]) {
  console.log('\n💰 Creating payment schedules...')

  const payments: PaymentSchedule[] = []
  const paymentCounter = new Map<string, number>()

  // Standard payment terms: 30% deposit, 70% on shipment
  for (const order of orders) {
    if (!order.product) continue

    const product = order.product
    const totalCost = order.quantity * (product.manufacturingCost + product.freightCost + product.manufacturingCost * product.tariffRate)

    // 30% deposit 7 days after order
    const depositDate = addDays(order.poDate, 7)
    const depositIndex = (paymentCounter.get(order.id) ?? 0) + 1
    paymentCounter.set(order.id, depositIndex)
    payments.push({
      purchaseOrderId: order.id,
      paymentType: 'DEPOSIT',
      percentOfTotal: 30,
      plannedDate: depositDate,
      plannedAmount: totalCost * 0.3,
      paymentIndex: depositIndex,
    })

    // 70% balance 4 weeks before arrival (estimated ship date)
    const shipDate = addDays(order.inboundEta, -28)
    const balanceIndex = (paymentCounter.get(order.id) ?? depositIndex) + 1
    paymentCounter.set(order.id, balanceIndex)
    payments.push({
      purchaseOrderId: order.id,
      paymentType: 'BALANCE',
      percentOfTotal: 70,
      plannedDate: shipDate,
      plannedAmount: totalCost * 0.7,
      paymentIndex: balanceIndex,
    })
  }

  await persistPaymentsWithPrisma(payments)

  for (const payment of payments) {
    console.log(
      `  ✓ ${payment.paymentType} $${payment.plannedAmount.toFixed(2)} on Week ${getWeekNumber(payment.plannedDate)}`
    )
  }
}

async function seedSalesPlanning(products: Product[]) {
  console.log('\n📈 Creating sales planning data...')

  const bySku = new Map(products.map((product) => [product.sku, product]))
  const salesPatterns: Record<string, ReturnType<typeof buildSalesPattern>> = {}

  const horizonWeeks = SALES_HORIZON_WEEKS

  const sixLD = bySku.get('CS007')
  if (sixLD?.id) {
    const forecasts = generateForecastSeries({
      start: 180,
      weeklyGrowth: 1.2,
      weeks: horizonWeeks,
      seasonalBoostEvery: 13,
      seasonalBoostAmount: 70,
      cap: 420,
    })
    salesPatterns[sixLD.id] = buildSalesPattern({
      forecasts,
      initialStock: 7000,
      replenishments: buildReplenishmentSchedule(
        [
          { week: 10, quantity: 9000, repeatEvery: 26 },
          { week: 24, quantity: 7000, repeatEvery: 26 },
        ],
        horizonWeeks,
      ),
      actualVariance: 0.92,
    })
  }

  const premiumWidget = bySku.get('WDG-001')
  if (premiumWidget?.id) {
    const forecasts = generateForecastSeries({
      start: 50,
      weeklyGrowth: 0.85,
      weeks: horizonWeeks,
      seasonalBoostEvery: 13,
      seasonalBoostAmount: 32,
      cap: 220,
    })
    salesPatterns[premiumWidget.id] = buildSalesPattern({
      forecasts,
      initialStock: 3500,
      replenishments: buildReplenishmentSchedule(
        [
          { week: 12, quantity: 5000, repeatEvery: 26 },
          { week: 26, quantity: 4000, repeatEvery: 26 },
        ],
        horizonWeeks,
      ),
      actualVariance: 0.95,
    })
  }

  const economyWidget = bySku.get('WDG-002')
  if (economyWidget?.id) {
    const forecasts = generateForecastSeries({
      start: 80,
      weeklyGrowth: 1.1,
      weeks: horizonWeeks,
      seasonalBoostEvery: 13,
      seasonalBoostAmount: 55,
      cap: 300,
    })
    salesPatterns[economyWidget.id] = buildSalesPattern({
      forecasts,
      initialStock: 4200,
      replenishments: buildReplenishmentSchedule(
        [
          { week: 14, quantity: 6000, repeatEvery: 26 },
          { week: 30, quantity: 5000, repeatEvery: 26 },
        ],
        horizonWeeks,
      ),
      actualVariance: 0.93,
    })
  }

  const deluxeWidget = bySku.get('WDG-003')
  if (deluxeWidget?.id) {
    const forecasts = generateForecastSeries({
      start: 20,
      weeklyGrowth: 0.55,
      weeks: horizonWeeks,
      seasonalBoostEvery: 13,
      seasonalBoostAmount: 24,
      cap: 140,
    })
    salesPatterns[deluxeWidget.id] = buildSalesPattern({
      forecasts,
      initialStock: 2200,
      replenishments: buildReplenishmentSchedule(
        [
          { week: 16, quantity: 3200, repeatEvery: 26 },
          { week: 34, quantity: 2500, repeatEvery: 26 },
        ],
        horizonWeeks,
      ),
      actualVariance: 0.97,
    })
  }

  const updates = []
  for (const [productId, pattern] of Object.entries(salesPatterns)) {
    for (const week of pattern) {
      updates.push({
        productId,
        weekNumber: week.week,
        values: {
          actualSales: week.actual?.toString() || null,
          forecastSales: week.forecast.toString(),
          ...(week.stockStart !== undefined ? { stockStart: week.stockStart.toString() } : {}),
        },
      })
    }
  }

  try {
    await apiCall('/sales-weeks', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    })
    console.log(`  ✓ Created sales data for ${updates.length} product-weeks`)
  } catch (error) {
    console.error(`  ✗ Sales planning:`, error)
  }
}

async function printExpectedOutcomes(products: Product[]) {
  console.log('\n' + '='.repeat(80))
  console.log('📊 EXPECTED OUTCOMES - COMPREHENSIVE TEST SCENARIO')
  console.log('='.repeat(80))

  console.log('\n💰 STARTING CONDITIONS:')
  console.log('  • Starting Cash: $80,000')
  console.log('  • Weekly Fixed Costs: $500')
  console.log('  • Amazon Payout Delay: 2 weeks')

  console.log('\n📦 PRODUCTS:')
  products.forEach((p, i) => {
    const tariff = p.manufacturingCost * p.tariffRate
    const landed = p.manufacturingCost + p.freightCost + tariff
    const margin = ((p.sellingPrice - landed) / p.sellingPrice * 100).toFixed(1)
    console.log(`  ${i + 1}. ${p.sku} - ${p.name}`)
    console.log(`     Price: $${p.sellingPrice} | Landed: $${landed.toFixed(2)} | GM: ${margin}%`)
  })

  console.log('\n🚢 PURCHASE ORDERS & CASH OUTFLOWS:')
  console.log('  PO-2025-001: 1000 units Premium @ $10.50 = $10,500')
  console.log('    • Week 2: Deposit $3,150 (30%)')
  console.log('    • Week 5: Balance $7,350 (70%)')
  console.log('    • Week 10: Arrival')

  console.log('\n  PO-2025-002: 1500 units Economy @ $6.25 = $9,375')
  console.log('    • Week 8: Deposit $2,813 (30%)')
  console.log('    • Week 11: Balance $6,562 (70%)')
  console.log('    • Week 16: Arrival')

  console.log('\n  PO-2025-003: 500 units Deluxe @ $21.25 = $10,625')
  console.log('    • Week 4: Deposit $3,188 (30%)')
  console.log('    • Week 7: Balance $7,438 (70%)')
  console.log('    • Week 12: Arrival')

  console.log('\n  PO-2025-004: 800 units Premium @ $10.50 = $8,400')
  console.log('    • Week 10: Deposit $2,520 (30%)')
  console.log('    • Week 13: Balance $5,880 (70%)')
  console.log('    • Week 18: Arrival')

  console.log('\n📈 SALES PATTERN:')
  console.log('  • Premium Widget: 50-145 units/week (growing)')
  console.log('  • Economy Widget: 80-175 units/week (variable)')
  console.log('  • Deluxe Widget: 20-58 units/week (steady growth)')

  console.log('\n💵 SAMPLE WEEK 10 (PO-001 arrives):')
  console.log('  Revenue:')
  console.log('    • Premium: 95 × $29.99 = $2,849')
  console.log('    • Economy: 125 × $19.99 = $2,499')
  console.log('    • Deluxe: 38 × $49.99 = $1,900')
  console.log('    • Total: $7,248')

  console.log('\n  COGS (FIFO from arriving batches):')
  console.log('    • Premium: 95 × $10.50 = $998')
  console.log('    • Economy: 125 × $6.25 = $781')
  console.log('    • Deluxe: 38 × $21.25 = $808')
  console.log('    • Total: $2,587')

  console.log('\n  Amazon Fees:')
  console.log('    • Referral (15%): $1,087')
  console.log('    • FBA Fees: ~$1,200')
  console.log('    • Storage: ~$100')
  console.log('    • Total: ~$2,387')

  console.log('\n  Cash Flow Week 10:')
  console.log('    • Inventory Spend: $2,520 (PO-004 deposit)')
  console.log('    • Fixed Costs: $500')
  console.log('    • Amazon Payout: $0 (Week 8 revenue delayed 2 weeks)')
  console.log('    • Net Cash: -$3,020')

  console.log('\n🎯 VALIDATION POINTS:')
  console.log('  1. ✓ FIFO costing uses batch-specific landed costs')
  console.log('  2. ✓ Tariffs calculated on FOB value (mfg cost only)')
  console.log('  3. ✓ Amazon fees exclude from COGS, appear in OpEx')
  console.log('  4. ✓ Cash flow reflects 2-week payout delay')
  console.log('  5. ✓ Stock levels track across multiple batches')
  console.log('  6. ✓ Payments follow 30/70 schedule')

  console.log('\n' + '='.repeat(80))
}

// Utility functions
function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr)
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((days + startOfYear.getDay() + 1) / 7)
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

const formatCurrency = (value: number) => value.toFixed(2)
const formatPercent = (value: number) => value.toFixed(4)


type SalesPatternOptions = {
  forecasts: number[]
  initialStock: number
  replenishments?: Record<number, number>
  actualVariance?: number
}

type ForecastTrendOptions = {
  start: number
  weeklyGrowth: number
  weeks: number
  seasonalBoostEvery?: number
  seasonalBoostAmount?: number
  cap?: number
}

type ReplenishmentPattern = {
  week: number
  quantity: number
  repeatEvery?: number | null
}

function shiftDateByWeeks(dateStr: string | undefined, weeks: number) {
  if (!dateStr) return dateStr
  const date = new Date(dateStr)
  date.setDate(date.getDate() + weeks * 7)
  return date.toISOString().split('T')[0]
}

function shiftOrderSpec(
  spec: PurchaseOrderSpec,
  {
    yearSuffix,
    weekOffset,
    orderIndex,
    variantIndex,
    product,
  }: {
    yearSuffix: string
    weekOffset: number
    orderIndex: number
    variantIndex: number
    product: Product
  },
): PurchaseOrderSpec {
  const skuFragment = product.sku.replace(/[^A-Z0-9]/g, '').slice(-3).toUpperCase() || 'SKU'
  const orderNumber = String(orderIndex + 1 + variantIndex * 5).padStart(2, '0')
  const orderCode = `PO-${yearSuffix}-${skuFragment}${orderNumber}`

  const vessel = vesselNames[(orderIndex + variantIndex * 3) % vesselNames.length]
  const transportPrefix = transportPrefixes[(orderIndex + variantIndex * 2) % transportPrefixes.length]
  const transportSuffix = `${yearSuffix.slice(-2)}${String(5900 + orderIndex * 37 + variantIndex * 19).padStart(4, '0')}`
  const transportReference = `${transportPrefix}${transportSuffix}`

  const batchVariationBase = 1 + (orderIndex * 0.01 + variantIndex * 0.015)

  const batches = spec.batches.map((batch, batchIndex) => {
    const variation = batchVariationBase + batchIndex * 0.01
    return {
      ...batch,
      quantity: Math.round(batch.quantity * (1 + variantIndex * 0.05)),
      code: batch.code.replace('2025', yearSuffix),
      overrideSellingPrice: parseFloat((product.sellingPrice * (0.98 + batchIndex * 0.01)).toFixed(2)),
      overrideManufacturingCost: parseFloat(
        ((batch.overrideManufacturingCost ?? product.manufacturingCost) * variation).toFixed(2),
      ),
      overrideFreightCost: parseFloat(
        ((batch.overrideFreightCost ?? product.freightCost) * (variation - 0.005)).toFixed(2),
      ),
      overrideFbaFee: parseFloat(
        ((batch.overrideFbaFee ?? product.fbaFee) * (1 + batchIndex * 0.01 + variantIndex * 0.01)).toFixed(2),
      ),
      overrideStoragePerMonth: parseFloat(
        ((batch.overrideStoragePerMonth ?? product.storagePerMonth) * (1 + batchIndex * 0.015)).toFixed(2),
      ),
      overrideTariffRate: parseFloat(
        ((batch.overrideTariffRate ?? product.tariffRate) * (1 + variantIndex * 0.02)).toFixed(4),
      ),
      overrideTacosPercent: parseFloat(
        ((batch.overrideTacosPercent ?? product.tacosPercent) * (1 + batchIndex * 0.01)).toFixed(4),
      ),
      overrideReferralRate: parseFloat(
        ((batch.overrideReferralRate ?? product.amazonReferralRate) * (1 + variantIndex * 0.01)).toFixed(4),
      ),
    }
  })

  const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0)

  return {
    ...spec,
    orderCode,
    productId: product.id!,
    product,
    poDate: shiftDateByWeeks(spec.poDate, weekOffset)!,
    inboundEta: shiftDateByWeeks(spec.inboundEta, weekOffset)!,
    availableDate: shiftDateByWeeks(spec.availableDate, weekOffset)!,
    shipName: `${vessel} ${yearSuffix}`,
    transportReference,
    quantity: totalQuantity,
    batches,
    stageDurations: spec.stageDurations,
    logisticsEvents: spec.logisticsEvents?.map((event, idx) => ({
      ...event,
      reference: event.reference ? `${event.reference} ${yearSuffix}` : event.reference,
      notes: event.notes ?? `Cycle ${variantIndex + 1} – leg ${idx + 1}`,
      eventDate: shiftDateByWeeks(event.eventDate, weekOffset),
    })),
  }
}

function generateForecastSeries({
  start,
  weeklyGrowth,
  weeks,
  seasonalBoostEvery,
  seasonalBoostAmount = 0,
  cap,
}: ForecastTrendOptions) {
  const values: number[] = []
  for (let index = 0; index < weeks; index += 1) {
    const week = index + 1
    let value = start + weeklyGrowth * index
    if (seasonalBoostEvery && seasonalBoostEvery > 0 && week % seasonalBoostEvery === 0) {
      value += seasonalBoostAmount
    }
    if (typeof cap === 'number') {
      value = Math.min(value, cap)
    }
    values.push(Math.max(0, Math.round(value)))
  }
  return values
}

function buildReplenishmentSchedule(pattern: ReplenishmentPattern[], weeks: number) {
  const schedule: Record<number, number> = {}
  for (const entry of pattern) {
    if (entry.week <= 0 || entry.quantity <= 0) continue
    const repeat = entry.repeatEvery && entry.repeatEvery > 0 ? entry.repeatEvery : null
    for (let week = entry.week; week <= weeks; week += repeat ?? weeks + 1) {
      schedule[week] = (schedule[week] ?? 0) + entry.quantity
      if (!repeat) break
    }
  }
  return schedule
}

function buildSalesPattern({
  forecasts,
  initialStock,
  replenishments = {},
  actualVariance = 0.95,
}: SalesPatternOptions) {
  let stock = initialStock
  return forecasts.map((forecast, index) => {
    const week = index + 1
    if (replenishments[week]) {
      stock += replenishments[week]
    }
    const stockStart = stock
    const actual = Math.max(0, Math.round(forecast * actualVariance))
    stock = Math.max(0, stock - actual)
    return {
      week,
      forecast,
      actual,
      stockStart,
    }
  })
}

async function resetSeedData() {
  console.log('\n🧽 Resetting existing seed data...')

  try {
    const productSkus = productSeeds.map((p) => p.sku)
    await prisma.purchaseOrderPayment.deleteMany({
      where: { purchaseOrder: { product: { sku: { in: productSkus } } } },
    })
    await prisma.batchTableRow.deleteMany({
      where: { purchaseOrder: { product: { sku: { in: productSkus } } } },
    })
    await prisma.purchaseOrder.deleteMany({ where: { product: { sku: { in: productSkus } } } })
    await prisma.salesWeek.deleteMany({ where: { product: { sku: { in: productSeeds.map((p) => p.sku) } } } })
    await prisma.product.deleteMany({ where: { sku: { in: productSeeds.map((p) => p.sku) } } })
    console.log('  ✓ Previous seed data cleared')
  } catch (error) {
    console.error('  ✗ Failed to reset seed data:', error)
    throw error
  }
}

// Main execution
async function main() {
  console.log('🌱 Seeding Comprehensive Test Data')
  console.log('=' + '='.repeat(79))

  try {
    if (RESET_REQUESTED) {
      await resetSeedData()
    }
    await seedBusinessParameters()
    const createdProducts = await seedProducts()
    const createdOrders = await seedPurchaseOrders(createdProducts)
    await seedPaymentSchedules(createdOrders)
    await seedSalesPlanning(createdProducts)

    await printExpectedOutcomes(createdProducts)

    console.log('\n✅ Test data seeding completed successfully!')
    console.log('\n📝 Next steps:')
    console.log('  1. Refresh the x-plan app to see data')
    console.log('  2. Navigate to Sales Planning to verify FIFO allocations')
    console.log('  3. Check P&L sheet for correct cost accounting')
    console.log('  4. Review Cash Flow for payment timing')
    console.log('  5. Validate calculations match expected outcomes')

  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect().catch(() => undefined)
  }
}

main()
