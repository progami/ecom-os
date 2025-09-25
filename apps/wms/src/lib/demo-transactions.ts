/**
 * Create demo transactions
 * Uses direct database access but follows the same logic as the API
 * Creates cost ledger entries like the API trigger would
 */

import { Prisma } from '@prisma/client'
import { ensurePurchaseOrderForTransaction } from '@/lib/services/purchase-order-service'

interface Warehouse {
  id: string
  code: string
  name: string
  address: string
}

interface DemoSku {
  id: string
  skuCode: string
  description: string
  unitDimensionsCm: string | null
  unitWeightKg: Prisma.Decimal | number | null
  cartonDimensionsCm: string | null
  cartonWeightKg: Prisma.Decimal | number | null
  packagingType: string | null
  unitsPerCarton: number
}

interface DemoTransactionConfig {
  tx: Prisma.TransactionClient
  staffUserId: string
  warehouses: Warehouse[]
  skus: DemoSku[]
}

interface InventoryState {
  warehouse: Warehouse
  sku: DemoSku
  batchLot: string
  cartons: number
  storageCartonsPerPallet: number
  shippingCartonsPerPallet: number
}

interface ReceiveOrderPlan {
  warehouse: Warehouse
  orderNumber: string
  transactionDate: Date
  expectedDate: Date
  supplier: string
  lines: Array<{
    sku: DemoSku
    cartons: number
    batchLot: string
    storageCartonsPerPallet: number
    shippingCartonsPerPallet: number
  }>
}

interface ShipOrderPlan {
  warehouse: Warehouse
  orderNumber: string
  transactionDate: Date
  counterpartyName: string
  lines: Array<{
    sku: DemoSku
    cartons: number
    batchLot: string
    shippingCartonsPerPallet: number
  }>
}

const DAY_MS = 24 * 60 * 60 * 1000

const daysAgo = (days: number): Date => {
  const now = new Date()
  return new Date(now.getTime() - days * DAY_MS)
}

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

function sanitizeBatchLot(seed: string, fallbackIndex: number) {
  const digits = seed.replace(/\D/g, '')
  if (digits.length >= 6) {
    return digits.slice(0, 12)
  }
  return `${new Date().getFullYear()}${String(fallbackIndex + 10).padStart(2, '0')}01`
}

const buildRestockPlans = (warehouses: Warehouse[], skus: DemoSku[]): ReceiveOrderPlan[] => {
  const plans: ReceiveOrderPlan[] = []
  let sequence = 50

  warehouses.forEach((warehouse, warehouseIndex) => {
    const focusSkus = skus.slice(warehouseIndex, warehouseIndex + 2)
    if (focusSkus.length === 0) {
      return
    }

    const orderNumber = `${warehouse.code}-PO-${String(sequence).padStart(4, '0')}`
    sequence += 1
    const baseDate = daysAgo(warehouseIndex === 0 ? -1 : 0)
    const expectedDate = new Date(baseDate.getTime() + 2 * DAY_MS)

    const lines = focusSkus.map((sku, index) => {
      const cartons = randomInt(36, 84)
      const storageCartons = Math.max(18, Math.min(48, Math.round((sku.unitsPerCarton || 18) * 0.85)))
      const shippingCartons = Math.max(12, Math.min(32, Math.round((sku.unitsPerCarton || 18) * 0.75)))
      const batchSeed = `${orderNumber}-${sku.skuCode}-RESTOCK-${index}`
      const batchLot = sanitizeBatchLot(batchSeed, index)

      return {
        sku,
        cartons,
        batchLot,
        storageCartonsPerPallet: storageCartons,
        shippingCartonsPerPallet: shippingCartons,
      }
    })

    plans.push({
      warehouse,
      orderNumber,
      transactionDate: baseDate,
      expectedDate,
      supplier: 'Restock Supplier Co.',
      lines,
    })
  })

  return plans
}

export async function createDemoTransactions(config: DemoTransactionConfig) {
  const { tx, staffUserId, warehouses, skus } = config
  const createdTransactions: Record<string, unknown>[] = []

  const inventoryMap = new Map<string, InventoryState>()
  const inventoryList: InventoryState[] = []

  const addInventory = (state: InventoryState) => {
    const key = `${state.warehouse.code}-${state.sku.skuCode}-${state.batchLot}`
    const existing = inventoryMap.get(key)
    if (existing) {
      existing.cartons += state.cartons
    } else {
      inventoryMap.set(key, { ...state })
    }
    inventoryList.push({ ...state })
  }

  const decrementInventory = (warehouse: Warehouse, sku: DemoSku, batchLot: string, cartons: number) => {
    const key = `${warehouse.code}-${sku.skuCode}-${batchLot}`
    const existing = inventoryMap.get(key)
    if (existing) {
      existing.cartons = Math.max(0, existing.cartons - cartons)
    }
  }

  const buildReceivePlans = (): ReceiveOrderPlan[] => {
    const plans: ReceiveOrderPlan[] = []
    let orderSequence = 1

    for (const warehouse of warehouses) {
      const relevantSkus = skus.slice(0, Math.min(6, skus.length))
      if (relevantSkus.length === 0) {
        continue
      }

      const grouped = chunk(relevantSkus, 3)

      grouped.forEach((group, groupIndex) => {
        const orderNumber = `${warehouse.code}-PO-${String(orderSequence).padStart(4, '0')}`
        orderSequence += 1
        const baseDate = daysAgo(35 - groupIndex * 4)
        const expectedDate = new Date(baseDate.getTime() + 5 * DAY_MS)

        const lines = group.map((sku, lineIndex) => {
          const cartons = randomInt(80, 160)
          const storageCartons = Math.max(24, Math.min(60, Math.round((sku.unitsPerCarton || 20) * 0.8)))
          const shippingCartons = Math.max(16, Math.min(48, Math.round((sku.unitsPerCarton || 20) * 0.7)))
          const batchSeed = `${orderNumber}-${sku.skuCode}-${lineIndex}`
          const batchLot = sanitizeBatchLot(batchSeed, lineIndex + groupIndex)

          return {
            sku,
            cartons,
            batchLot,
            storageCartonsPerPallet: storageCartons,
            shippingCartonsPerPallet: shippingCartons,
          }
        })

        plans.push({
          warehouse,
          orderNumber,
          transactionDate: baseDate,
          expectedDate,
          supplier: 'Demo Supplier Co.',
          lines,
        })
      })
    }

    return plans
  }

  const buildShipPlans = (): ShipOrderPlan[] => {
    const plans: ShipOrderPlan[] = []
    const entriesByWarehouse = new Map<string, InventoryState[]>([])

    for (const entry of inventoryList) {
      const key = entry.warehouse.code
      const list = entriesByWarehouse.get(key) || []
      list.push({ ...entry })
      entriesByWarehouse.set(key, list)
    }

    for (const [code, entries] of entriesByWarehouse.entries()) {
      const warehouse = warehouses.find(w => w.code === code)
      if (!warehouse) continue

      let sequence = 1
      const copy = [...entries]

      while (copy.length > 0) {
        const lines = copy.splice(0, Math.min(2, copy.length))
        const orderNumber = `${warehouse.code}-SO-${String(sequence).padStart(4, '0')}`
        sequence += 1
        const transactionDate = daysAgo(14 - sequence * 2)

        const shipLines = lines.map(line => {
          const available = Math.max(0, line.cartons - 10)
          const cartons = Math.max(12, Math.min(available, Math.round(line.cartons * 0.5)))
          return {
            sku: line.sku,
            cartons,
            batchLot: line.batchLot,
            shippingCartonsPerPallet: Math.max(12, line.shippingCartonsPerPallet),
          }
        }).filter(line => line.cartons > 0)

        if (shipLines.length > 0) {
          plans.push({
            warehouse,
            orderNumber,
            transactionDate,
            counterpartyName: 'Demo Fulfillment Partner',
            lines: shipLines,
          })
        }
      }
    }

    return plans
  }

  try {
    const receivePlans = buildReceivePlans()

    for (const plan of receivePlans) {
      const orderTransactions: { transactionId: string; cartons: number }[] = []

      for (const line of plan.lines) {
        const { sku, cartons, batchLot, storageCartonsPerPallet, shippingCartonsPerPallet } = line

        const poDetails = await ensurePurchaseOrderForTransaction(tx, {
          orderNumber: plan.orderNumber,
          transactionType: 'RECEIVE',
          warehouseCode: plan.warehouse.code,
          warehouseName: plan.warehouse.name,
          counterpartyName: plan.supplier,
          transactionDate: plan.transactionDate,
          expectedDate: plan.expectedDate,
          skuCode: sku.skuCode,
          skuDescription: sku.description,
          batchLot,
          quantity: cartons,
          unitsPerCarton: sku.unitsPerCarton || 1,
          createdById: staffUserId,
          createdByName: 'Demo Staff',
          notes: null,
        })

        const normalizedBatchLot = poDetails.batchLot

        const transaction = await tx.inventoryTransaction.create({
          data: {
            warehouseCode: plan.warehouse.code,
            warehouseName: plan.warehouse.name,
            warehouseAddress: plan.warehouse.address,
            skuCode: sku.skuCode,
            skuDescription: sku.description,
            unitDimensionsCm: sku.unitDimensionsCm,
            unitWeightKg: sku.unitWeightKg,
            cartonDimensionsCm: sku.cartonDimensionsCm,
            cartonWeightKg: sku.cartonWeightKg,
            packagingType: sku.packagingType,
            unitsPerCarton: sku.unitsPerCarton,
            batchLot: normalizedBatchLot,
            transactionType: 'RECEIVE',
            referenceId: plan.orderNumber,
            cartonsIn: cartons,
            cartonsOut: 0,
            storagePalletsIn: Math.ceil(cartons / Math.max(1, storageCartonsPerPallet)),
            shippingPalletsOut: 0,
            storageCartonsPerPallet,
            shippingCartonsPerPallet,
            transactionDate: plan.transactionDate,
            pickupDate: plan.transactionDate,
            supplier: plan.supplier,
            createdById: staffUserId,
            createdByName: 'Demo Staff',
            purchaseOrderId: poDetails.purchaseOrderId,
            purchaseOrderLineId: poDetails.purchaseOrderLineId,
          },
        })

        createdTransactions.push(transaction)
        orderTransactions.push({ transactionId: transaction.id, cartons })

        addInventory({
          warehouse: plan.warehouse,
          sku,
          batchLot: normalizedBatchLot,
          cartons,
          storageCartonsPerPallet,
          shippingCartonsPerPallet,
        })

        await new Promise(resolve => setTimeout(resolve, 10))
      }

      const costTransactionId = orderTransactions[0]?.transactionId
      if (costTransactionId) {
        const baseCartons = orderTransactions[0].cartons
        const costs = {
          handling: 95,
          storage: 140,
          container: 180,
          pallet: 45,
        }

        const costEntries = []

        costEntries.push({
          transactionId: costTransactionId,
          costCategory: 'Carton' as const,
          costName: 'Inbound Handling',
          quantity: baseCartons,
          unitRate: costs.handling / baseCartons,
          totalCost: costs.handling,
          warehouseCode: plan.warehouse.code,
          warehouseName: plan.warehouse.name,
          createdByName: 'Demo Administrator',
          createdAt: plan.transactionDate,
        })

        costEntries.push({
          transactionId: costTransactionId,
          costCategory: 'Storage' as const,
          costName: 'Storage Fee',
          quantity: baseCartons,
          unitRate: costs.storage / baseCartons,
          totalCost: costs.storage,
          warehouseCode: plan.warehouse.code,
          warehouseName: plan.warehouse.name,
          createdByName: 'Demo Administrator',
          createdAt: plan.transactionDate,
        })

        costEntries.push({
          transactionId: costTransactionId,
          costCategory: 'Container' as const,
          costName: 'Container Handling',
          quantity: 1,
          unitRate: costs.container,
          totalCost: costs.container,
          warehouseCode: plan.warehouse.code,
          warehouseName: plan.warehouse.name,
          createdByName: 'Demo Administrator',
          createdAt: plan.transactionDate,
        })

        costEntries.push({
          transactionId: costTransactionId,
          costCategory: 'Pallet' as const,
          costName: 'Palletisation',
          quantity: Math.ceil(baseCartons / 40),
          unitRate: costs.pallet / Math.max(1, Math.ceil(baseCartons / 40)),
          totalCost: costs.pallet,
          warehouseCode: plan.warehouse.code,
          warehouseName: plan.warehouse.name,
          createdByName: 'Demo Administrator',
          createdAt: plan.transactionDate,
        })

        for (const entry of costEntries) {
          await tx.costLedger.create({ data: entry })
        }
      }
    }

    const shipPlans = buildShipPlans()

    for (const plan of shipPlans) {
      for (const line of plan.lines) {
        const available = inventoryMap.get(`${plan.warehouse.code}-${line.sku.skuCode}-${line.batchLot}`)
        if (!available || available.cartons <= 0) {
          continue
        }

        const poDetails = await ensurePurchaseOrderForTransaction(tx, {
          orderNumber: plan.orderNumber,
          transactionType: 'SHIP',
          warehouseCode: plan.warehouse.code,
          warehouseName: plan.warehouse.name,
          counterpartyName: plan.counterpartyName,
          transactionDate: plan.transactionDate,
          expectedDate: plan.transactionDate,
          skuCode: line.sku.skuCode,
          skuDescription: line.sku.description,
          batchLot: line.batchLot,
          quantity: line.cartons,
          unitsPerCarton: line.sku.unitsPerCarton || 1,
          createdById: staffUserId,
          createdByName: 'Demo Staff',
          notes: null,
        })

        const normalizedBatchLot = poDetails.batchLot

        const transaction = await tx.inventoryTransaction.create({
          data: {
            warehouseCode: plan.warehouse.code,
            warehouseName: plan.warehouse.name,
            warehouseAddress: plan.warehouse.address,
            skuCode: line.sku.skuCode,
            skuDescription: line.sku.description,
            unitDimensionsCm: line.sku.unitDimensionsCm,
            unitWeightKg: line.sku.unitWeightKg,
            cartonDimensionsCm: line.sku.cartonDimensionsCm,
            cartonWeightKg: line.sku.cartonWeightKg,
            packagingType: line.sku.packagingType,
            unitsPerCarton: line.sku.unitsPerCarton,
            batchLot: normalizedBatchLot,
            transactionType: 'SHIP',
            referenceId: plan.orderNumber,
            cartonsIn: 0,
            cartonsOut: line.cartons,
            storagePalletsIn: 0,
            shippingPalletsOut: Math.ceil(line.cartons / Math.max(1, line.shippingCartonsPerPallet)),
            storageCartonsPerPallet: null,
            shippingCartonsPerPallet: line.shippingCartonsPerPallet,
            transactionDate: plan.transactionDate,
            pickupDate: plan.transactionDate,
            shipName: plan.counterpartyName,
            trackingNumber: `TRK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
            createdById: staffUserId,
            createdByName: 'Demo Staff',
            purchaseOrderId: poDetails.purchaseOrderId,
            purchaseOrderLineId: poDetails.purchaseOrderLineId,
          },
        })

        createdTransactions.push(transaction)
        decrementInventory(plan.warehouse, line.sku, normalizedBatchLot, line.cartons)

        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    const restockPlans = buildRestockPlans(warehouses, skus)

    for (const plan of restockPlans) {
      for (const line of plan.lines) {
        const poDetails = await ensurePurchaseOrderForTransaction(tx, {
          orderNumber: plan.orderNumber,
          transactionType: 'RECEIVE',
          warehouseCode: plan.warehouse.code,
          warehouseName: plan.warehouse.name,
          counterpartyName: plan.supplier,
          transactionDate: plan.transactionDate,
          expectedDate: plan.expectedDate,
          skuCode: line.sku.skuCode,
          skuDescription: line.sku.description,
          batchLot: line.batchLot,
          quantity: line.cartons,
          unitsPerCarton: line.sku.unitsPerCarton || 1,
          createdById: staffUserId,
          createdByName: 'Demo Staff',
          notes: null,
        })

        const normalizedBatchLot = poDetails.batchLot

        const transaction = await tx.inventoryTransaction.create({
          data: {
            warehouseCode: plan.warehouse.code,
            warehouseName: plan.warehouse.name,
            warehouseAddress: plan.warehouse.address,
            skuCode: line.sku.skuCode,
            skuDescription: line.sku.description,
            unitDimensionsCm: line.sku.unitDimensionsCm,
            unitWeightKg: line.sku.unitWeightKg,
            cartonDimensionsCm: line.sku.cartonDimensionsCm,
            cartonWeightKg: line.sku.cartonWeightKg,
            packagingType: line.sku.packagingType,
            unitsPerCarton: line.sku.unitsPerCarton,
            batchLot: normalizedBatchLot,
            transactionType: 'RECEIVE',
            referenceId: plan.orderNumber,
            cartonsIn: line.cartons,
            cartonsOut: 0,
            storagePalletsIn: Math.ceil(line.cartons / Math.max(1, line.storageCartonsPerPallet)),
            shippingPalletsOut: 0,
            storageCartonsPerPallet: line.storageCartonsPerPallet,
            shippingCartonsPerPallet: line.shippingCartonsPerPallet,
            transactionDate: plan.transactionDate,
            pickupDate: plan.transactionDate,
            supplier: plan.supplier,
            createdById: staffUserId,
            createdByName: 'Demo Staff',
            purchaseOrderId: poDetails.purchaseOrderId,
            purchaseOrderLineId: poDetails.purchaseOrderLineId,
          },
        })

        createdTransactions.push(transaction)
        addInventory({
          warehouse: plan.warehouse,
          sku: line.sku,
          batchLot: normalizedBatchLot,
          cartons: line.cartons,
          storageCartonsPerPallet: line.storageCartonsPerPallet,
          shippingCartonsPerPallet: line.shippingCartonsPerPallet,
        })

        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    return {
      success: true,
      transactions: createdTransactions,
      inventorySummary: Array.from(inventoryMap.entries()).map(([key, state]) => ({
        key,
        cartons: state.cartons,
      })),
    }
  } catch (_error: unknown) {
    throw _error
  }
}
