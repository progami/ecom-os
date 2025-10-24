import { test, expect } from '@playwright/test'
import { WmsApiClient, SkuSeed, WarehouseSeed, OrderSeed, TransactionSeed, InvoiceSeed } from '../utils/wmsApi'

const skuSeeds: SkuSeed[] = [
  {
    skuCode: 'CS-008',
    description: 'Pack of 3 - LD',
    asin: 'B0C7ZQ3VZL',
    packSize: 3,
    material: '7 Micron',
    unitDimensionsCm: '25×20.5×1.2',
    unitWeightKg: 0.16,
    unitsPerCarton: 60,
    cartonDimensionsCm: '40×28×29.5',
    cartonWeightKg: 10,
    packagingType: 'Poly bag',
  },
  {
    skuCode: 'CS-010',
    description: 'Pack of 3 - ST',
    asin: 'B0CR1GSBQ9',
    packSize: 3,
    material: '15 Micron',
    unitDimensionsCm: '25×20.5×2',
    unitWeightKg: 0.41,
    unitsPerCarton: 52,
    cartonDimensionsCm: '41×28×39.5',
    cartonWeightKg: 21,
    packagingType: 'Poly bag',
  },
]

const warehouseSeeds: WarehouseSeed[] = [
  {
    code: 'FMC',
    name: 'FMC Primary Warehouse',
    address: '123 Logistics Way, New Jersey, USA',
    isActive: true,
  },
]

const workflowState: {
  apiBaseUrl: string
  warehouse: { id: string; code: string; name: string } | null
  purchaseOrder: any
  salesOrder: any
  purchaseMovementNote: any
  invoice: any
  costCurrency: string
  outboundReference: string | null
} = {
  apiBaseUrl: process.env.WMS_BASE_URL ?? process.env.BASE_URL ?? 'http://localhost:3001',
  warehouse: null,
  purchaseOrder: null,
  salesOrder: null,
  purchaseMovementNote: null,
  invoice: null,
  costCurrency: '£0.00',
  outboundReference: null,
}

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
})

test.describe('Purchase/Sales order reconciliation workflow', () => {
  test.beforeAll(async ({ request }) => {
    const api = new WmsApiClient(request, workflowState.apiBaseUrl)

    for (const sku of skuSeeds) {
      await api.ensureSku(sku)
    }

    const warehouseRecords = [] as any[]
    for (const warehouse of warehouseSeeds) {
      const record = await api.ensureWarehouse(warehouse)
      warehouseRecords.push(record)
    }

    const primaryWarehouse = warehouseRecords[0]
    workflowState.warehouse = primaryWarehouse

    const effectiveDate = new Date().toISOString()
    await api.createRate({
      warehouseId: primaryWarehouse.id,
      costCategory: 'Storage',
      costName: 'Storage per pallet (monthly)',
      costValue: 18,
      unitOfMeasure: 'PALLET_MONTH',
      effectiveDate,
    })
    await api.createRate({
      warehouseId: primaryWarehouse.id,
      costCategory: 'Carton',
      costName: 'Inbound handling per pallet',
      costValue: 8,
      unitOfMeasure: 'PALLET',
      effectiveDate,
    })

    const timestamp = Date.now()
    const purchaseOrderNumber = `PO-E2E-${timestamp}`
    const salesOrderNumber = `SO-E2E-${timestamp}`

    const purchaseOrderSeed: OrderSeed = {
      orderNumber: purchaseOrderNumber,
      warehouseCode: primaryWarehouse.code,
      type: 'purchase',
      status: 'SHIPPED',
      counterpartyName: 'CS Suppliers',
      expectedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      lines: [
        { skuCode: skuSeeds[0].skuCode, quantity: 80, unitCost: 18, batchLot: '1001' },
        { skuCode: skuSeeds[1].skuCode, quantity: 50, unitCost: 22, batchLot: '1002' },
      ],
    }

    workflowState.purchaseOrder = await api.createOrder(purchaseOrderSeed)

    const salesOrderSeed: OrderSeed = {
      orderNumber: salesOrderNumber,
      warehouseCode: primaryWarehouse.code,
      type: 'sales',
      status: 'DRAFT',
      counterpartyName: 'Retail Outlet',
      expectedDate: new Date().toISOString(),
      lines: [
        { skuCode: skuSeeds[0].skuCode, quantity: 20, unitCost: 0, batchLot: '2001' },
      ],
    }

    workflowState.salesOrder = await api.createOrder(salesOrderSeed)

    const shipTransactionSeed: TransactionSeed = {
      transactionType: 'SHIP',
      warehouseId: primaryWarehouse.id,
      referenceNumber: salesOrderNumber,
      transactionDate: new Date().toISOString(),
      shipName: 'Outbound Carrier',
      trackingNumber: `TRK-${timestamp}`,
      notes: 'Seeded outbound shipment',
      items: [
        {
          skuCode: skuSeeds[0].skuCode,
          batchLot: '4001',
          cartons: 10,
          storageCartonsPerPallet: 10,
          shippingCartonsPerPallet: 10,
        },
      ],
      costs: [
        { costType: 'accessorial', costName: 'Outbound Handling', quantity: 10, unitRate: 1.25, totalCost: 12.5 },
      ],
    }

    await api.createTransaction(shipTransactionSeed)
    workflowState.outboundReference = salesOrderNumber

    const purchaseOrderDetails = await api.getOrder(workflowState.purchaseOrder.id)
    const purchaseLine = purchaseOrderDetails.lines[0]

    workflowState.purchaseMovementNote = await api.createMovementNote({
      purchaseOrderId: workflowState.purchaseOrder.id,
      referenceNumber: `${purchaseOrderNumber}-DN`,
      receivedAt: new Date().toISOString(),
      lines: [
        {
          purchaseOrderLineId: purchaseLine.id,
          quantity: purchaseLine.quantity,
          batchLot: purchaseLine.batchLot ?? '1001',
          storageCartonsPerPallet: 20,
          shippingCartonsPerPallet: 20,
        },
      ],
    })

    await api.postMovementNote(workflowState.purchaseMovementNote.id)

    const transactionSeed: TransactionSeed = {
      transactionType: 'RECEIVE',
      warehouseId: primaryWarehouse.id,
      referenceNumber: purchaseOrderNumber,
      transactionDate: new Date().toISOString(),
      supplier: 'CS Suppliers',
      items: [
        {
          skuCode: purchaseLine.skuCode,
          batchLot: '3001',
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

    await api.createTransaction(transactionSeed)

    workflowState.costCurrency = currencyFormatter.format(140)

    const invoiceSeed: InvoiceSeed = {
      invoiceNumber: `INV-${timestamp}`,
      warehouseCode: primaryWarehouse.code,
      warehouseName: primaryWarehouse.name,
      warehouseId: primaryWarehouse.id,
      issuedAt: new Date().toISOString(),
      total: 140,
      subtotal: 140,
      currency: 'GBP',
      lines: [
        {
          purchaseOrderId: workflowState.purchaseOrder.id,
          movementNoteLineId: workflowState.purchaseMovementNote.lines[0].id,
          chargeCode: 'STORAGE',
          description: 'Storage and handling',
          quantity: 1,
          unitRate: 140,
          total: 140,
        },
      ],
    }

    workflowState.invoice = await api.createWarehouseInvoice(invoiceSeed)
  })

  test('staff reconciles orders and ledgers', async ({ page }) => {
    const appUrl = workflowState.apiBaseUrl

    await page.goto(`${appUrl}/operations/purchase-orders`)
    await expect(page.getByRole('heading', { name: 'Purchase/Sales Orders' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'Purchase/Sales Orders', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Draft' }).click()
    await expect(page.locator('text=SO-SETUP-2001')).toBeVisible()

    await page.getByRole('button', { name: 'In Transit' }).click()
    await expect(page.locator('text=' + workflowState.purchaseOrder.orderNumber)).toBeVisible()

    await page.getByRole('link', { name: workflowState.purchaseOrder.orderNumber }).first().click()
    await expect(page.locator(`text=Purchase Order ${workflowState.purchaseOrder.orderNumber}`)).toBeVisible()
    await expect(page.locator('text=At Warehouse')).toBeVisible()

    await page.goto(`${appUrl}/finance/cost-ledger`)
    await expect(page.locator('table')).toContainText(workflowState.costCurrency)

    await page.goto(`${appUrl}/finance/storage-ledger`)
    await expect(page.locator('table')).toContainText(workflowState.purchaseMovementNote.lines[0].batchLot ?? '1001')

    await page.goto(`${appUrl}/finance/warehouse-invoices`)
    await expect(page.locator('table')).toContainText(workflowState.invoice.invoiceNumber)

    await page.goto(`${appUrl}/finance/reconciliation`)
    await expect(page.locator('body')).toContainText(primaryWarehouseLabel())
    await expect(page.locator('body')).toContainText(workflowState.purchaseOrder.orderNumber)

    await page.goto(`${appUrl}/finance/warehouse-invoices`)
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'New Invoice' })).toBeVisible()
  })
})

function primaryWarehouseLabel(): string {
  return workflowState.warehouse ? workflowState.warehouse.name : 'Warehouse'
}
