/*
 * API helper for setup scripts.
 * Ensures we only interact with the application via HTTP endpoints
 * instead of talking to Prisma directly.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SetupClientOptions {
  baseUrl?: string
  verbose?: boolean
  bypassAuthHeader?: boolean
}

export type CostCategory =
  | 'Container'
  | 'Carton'
  | 'Pallet'
  | 'Storage'
  | 'Unit'
  | 'transportation'
  | 'Accessorial'

export interface SkuSeed {
  skuCode: string
  description: string
  asin?: string
  packSize: number
  material?: string
  unitDimensionsCm?: string
  unitWeightKg?: number
  unitsPerCarton: number
  cartonDimensionsCm?: string
  cartonWeightKg?: number
  packagingType?: string
}

export interface WarehouseSeed {
  code: string
  name: string
  address?: string
  latitude?: number
  longitude?: number
  contactEmail?: string
  contactPhone?: string
  isActive?: boolean
}

export interface RateSeed {
  warehouseId: string
  costCategory: CostCategory
  costName: string
  costValue: number
  unitOfMeasure: string
  effectiveDate: string
  endDate?: string | null
}

export interface OrderLineSeed {
  skuCode: string
  quantity: number
  unitCost?: number
  batchLot?: string | null
}

export type OrderType = 'purchase' | 'sales' | 'adjustment'
export type OrderStatus =
  | 'DRAFT'
  | 'SHIPPED'
  | 'WAREHOUSE'
  | 'CANCELLED'
  | 'CLOSED'

export interface OrderSeed {
  orderNumber: string
  warehouseCode: string
  type: OrderType
  status?: OrderStatus
  counterpartyName?: string | null
  expectedDate?: string | null
  notes?: string | null
  lines: OrderLineSeed[]
}

export interface MovementNoteLineSeed {
  purchaseOrderLineId: string
  quantity: number
  batchLot?: string | null
  storageCartonsPerPallet?: number | null
  shippingCartonsPerPallet?: number | null
}

export interface MovementNoteSeed {
  purchaseOrderId: string
  referenceNumber?: string | null
  receivedAt?: string | null
  notes?: string | null
  lines: MovementNoteLineSeed[]
}

export interface TransactionItemSeed {
  skuCode: string
  batchLot: string
  cartons: number
  storageCartonsPerPallet?: number
  shippingCartonsPerPallet?: number
  pallets?: number
  storagePalletsIn?: number
  shippingPalletsOut?: number
  unitsPerCarton?: number
}

export interface TransactionCostSeed {
  costType?: string
  costName?: string
  quantity?: number
  unitRate?: number
  totalCost?: number
}

export interface TransactionSeed {
  transactionType: 'RECEIVE' | 'SHIP' | 'ADJUST_IN' | 'ADJUST_OUT'
  warehouseId: string
  referenceNumber: string
  transactionDate: string
  pickupDate?: string
  supplier?: string
  shipName?: string
  trackingNumber?: string
  notes?: string
  items: TransactionItemSeed[]
  costs?: TransactionCostSeed[]
}

export interface InvoiceLineSeed {
  purchaseOrderId?: string | null
  purchaseOrderLineId?: string | null
  movementNoteLineId?: string | null
  chargeCode: string
  description?: string | null
  quantity?: number | null
  unitRate?: number | null
  total?: number | null
  notes?: string | null
}

export interface InvoiceSeed {
  invoiceNumber: string
  warehouseCode: string
  warehouseName: string
  warehouseId?: string | null
  issuedAt?: string | null
  dueAt?: string | null
  currency?: string | null
  subtotal?: number | null
  total?: number | null
  notes?: string | null
  lines: InvoiceLineSeed[]
}

export class SetupClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: any
  ) {
    super(message)
    this.name = 'SetupClientError'
  }
}

export class SetupClient {
  private readonly baseUrl: string
  private readonly verbose: boolean
  private readonly headers: Record<string, string>

  constructor(options: SetupClientOptions = {}) {
    this.baseUrl = options.baseUrl?.replace(/\/$/, '')
      ?? process.env.WMS_BASE_URL
      ?? process.env.BASE_URL
      ?? 'http://localhost:3001'
    this.verbose = Boolean(options.verbose)
    this.headers = {
      'content-type': 'application/json',
      ...(options.bypassAuthHeader !== false ? { 'x-bypass-auth': 'true' } : {}),
      ...(process.env.WMS_SESSION_COOKIE
        ? { cookie: process.env.WMS_SESSION_COOKIE }
        : {}),
    }
  }

  private log(message: string, data?: unknown) {
    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(`[setup][api] ${message}`, data ?? '')
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | undefined | null>
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        url.searchParams.set(key, String(value))
      })
    }

    const response = await fetch(url.toString(), {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      let details: any = undefined
      try {
        const text = await response.text()
        details = text ? JSON.parse(text) : undefined
      } catch (_error) {
        // ignore JSON parsing failure
      }

      const message =
        (details && (details.error || details.message))
        || `${method} ${url.pathname} failed with status ${response.status}`

      throw new SetupClientError(message, response.status, details)
    }

    if (response.status === 204) {
      return undefined as unknown as T
    }

    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  // -------------------- SKU helpers --------------------

  async listSkus(search?: string, includeInactive = true): Promise<any[]> {
    return this.request<any[]>(
      'GET',
      '/api/skus',
      undefined,
      {
        includeInactive: includeInactive ? 'true' : undefined,
        search,
      }
    )
  }

  async findSkuByCode(code: string): Promise<any | undefined> {
    const results = await this.listSkus(code, true)
    return results.find((sku) => sku.skuCode === code)
  }

  async deleteSku(id: string): Promise<void> {
    await this.request('DELETE', '/api/skus', undefined, { id })
  }

  async upsertSku(seed: SkuSeed): Promise<any> {
    try {
      const created = await this.request<any>('POST', '/api/skus', {
        ...seed,
        asin: seed.asin ?? null,
        material: seed.material ?? null,
        unitDimensionsCm: seed.unitDimensionsCm ?? null,
        unitWeightKg: seed.unitWeightKg ?? null,
        cartonDimensionsCm: seed.cartonDimensionsCm ?? null,
        cartonWeightKg: seed.cartonWeightKg ?? null,
        packagingType: seed.packagingType ?? null,
      })
      this.log(`Created SKU ${seed.skuCode}`)
      return created
    } catch (error) {
      if (error instanceof SetupClientError && error.status === 400) {
        const existing = await this.findSkuByCode(seed.skuCode)
        if (!existing) {
          throw error
        }
        const updated = await this.request<any>('PATCH', '/api/skus', {
          ...seed,
          asin: seed.asin ?? null,
          material: seed.material ?? null,
          unitDimensionsCm: seed.unitDimensionsCm ?? null,
          unitWeightKg: seed.unitWeightKg ?? null,
          cartonDimensionsCm: seed.cartonDimensionsCm ?? null,
          cartonWeightKg: seed.cartonWeightKg ?? null,
          packagingType: seed.packagingType ?? null,
          isActive: true,
        }, { id: existing.id })
        this.log(`Updated SKU ${seed.skuCode}`)
        return updated
      }
      throw error
    }
  }

  // -------------------- Warehouse helpers --------------------

  async listWarehouses(includeInactive = true): Promise<any[]> {
    return this.request<any[]>(
      'GET',
      '/api/warehouses',
      undefined,
      { includeInactive: includeInactive ? 'true' : undefined }
    )
  }

  async findWarehouseByCode(code: string): Promise<any | undefined> {
    const warehouses = await this.listWarehouses(true)
    return warehouses.find((warehouse) => warehouse.code === code)
  }

  async upsertWarehouse(seed: WarehouseSeed): Promise<any> {
    try {
      const payload: Record<string, unknown> = {
        code: seed.code,
        name: seed.name,
        isActive: seed.isActive ?? true,
      }

      if (seed.address !== undefined) payload.address = seed.address
      if (seed.latitude !== undefined) payload.latitude = seed.latitude
      if (seed.longitude !== undefined) payload.longitude = seed.longitude
      if (seed.contactEmail !== undefined) payload.contactEmail = seed.contactEmail
      if (seed.contactPhone !== undefined) payload.contactPhone = seed.contactPhone

      const created = await this.request<any>('POST', '/api/warehouses', payload)
      this.log(`Created warehouse ${seed.code}`)
      return created
    } catch (error) {
      if (error instanceof SetupClientError && error.status === 400) {
        const existing = await this.findWarehouseByCode(seed.code)
        if (!existing) {
          throw error
        }
        const updatePayload: Record<string, unknown> = {
          name: seed.name,
          isActive: seed.isActive ?? true,
        }
        if (seed.address !== undefined) updatePayload.address = seed.address
        if (seed.latitude !== undefined) updatePayload.latitude = seed.latitude
        if (seed.longitude !== undefined) updatePayload.longitude = seed.longitude
        if (seed.contactEmail !== undefined) updatePayload.contactEmail = seed.contactEmail
        if (seed.contactPhone !== undefined) updatePayload.contactPhone = seed.contactPhone

        const updated = await this.request<any>('PATCH', '/api/warehouses', updatePayload, { id: existing.id })
        this.log(`Updated warehouse ${seed.code}`)
        return updated
      }
      throw error
    }
  }

  // -------------------- Cost rate helpers --------------------

  async listRates(params?: { warehouseId?: string; activeOnly?: boolean; costCategory?: CostCategory }): Promise<any[]> {
    return this.request<any[]>(
      'GET',
      '/api/rates',
      undefined,
      {
        warehouseId: params?.warehouseId,
        activeOnly: params?.activeOnly ? 'true' : undefined,
        costCategory: params?.costCategory,
      }
    )
  }

  async listPurchaseOrders(): Promise<any[]> {
    const response = await this.request<{ data?: any[] }>(
      'GET',
      '/api/purchase-orders'
    )
    return Array.isArray(response?.data) ? response.data : []
  }

  async findPurchaseOrder(orderNumber: string, warehouseCode?: string): Promise<any | undefined> {
    const orders = await this.listPurchaseOrders()
    return orders.find((order) => {
      if (order.orderNumber !== orderNumber) return false
      if (warehouseCode && order.warehouseCode !== warehouseCode) return false
      return true
    })
  }

  async retireActiveRates(warehouseId: string, costName: string): Promise<void> {
    const activeRates = await this.listRates({ warehouseId, activeOnly: true })
    const toRetire = activeRates.filter((rate) => rate.costName.toLowerCase() === costName.toLowerCase())

    await Promise.all(
      toRetire.map((rate) =>
        this.request('PATCH', '/api/rates', { endDate: new Date().toISOString() }, { id: rate.id })
      )
    )

    if (toRetire.length && this.verbose) {
      this.log(`Retired ${toRetire.length} active rate(s) for ${costName}`)
    }
  }

  async createRate(rate: RateSeed): Promise<any> {
    const payload: Record<string, unknown> = {
      warehouseId: rate.warehouseId,
      costCategory: rate.costCategory,
      costName: rate.costName,
      costValue: rate.costValue,
      unitOfMeasure: rate.unitOfMeasure,
      effectiveDate: rate.effectiveDate,
    }
    if (rate.endDate !== undefined && rate.endDate !== null) {
      payload.endDate = rate.endDate
    }
    return this.request<any>('POST', '/api/rates', payload)
  }

  // -------------------- Order helpers --------------------

  async createOrder(order: OrderSeed): Promise<any> {
    return this.request<any>('POST', '/api/purchase-orders', order)
  }

  async getOrder(orderId: string): Promise<any> {
    return this.request<any>('GET', `/api/purchase-orders/${orderId}`)
  }

  async createMovementNote(note: MovementNoteSeed): Promise<any> {
    return this.request<any>('POST', '/api/movement-notes', note)
  }

  async postMovementNote(noteId: string): Promise<any> {
    return this.request<any>('POST', `/api/movement-notes/${noteId}/post`)
  }

  async createTransaction(transaction: TransactionSeed): Promise<any> {
    return this.request<any>('POST', '/api/transactions', transaction)
  }

  async createWarehouseInvoice(invoice: InvoiceSeed): Promise<any> {
    return this.request<any>('POST', '/api/warehouse-invoices', invoice)
  }

  // -------------------- Inventory transaction helpers --------------------

  async listInventoryTransactions(params?: { limit?: number }): Promise<any[]> {
    const response = await this.request<{ transactions?: any[] } | any[]>(
      'GET',
      '/api/transactions',
      undefined,
      {
        limit: params?.limit ?? 50,
      }
    )

    if (Array.isArray((response as any)?.transactions)) {
      return (response as any).transactions
    }

    return Array.isArray(response) ? (response as any[]) : []
  }

  // -------------------- Ledger helpers --------------------

  async getStorageLedger(params?: { limit?: number; includeCosts?: boolean }): Promise<any> {
    return this.request<any>(
      'GET',
      '/api/finance/storage-ledger',
      undefined,
      {
        limit: params?.limit ?? 10,
        includeCosts: params?.includeCosts ? 'true' : undefined,
      }
    )
  }

  async getCostLedger(params?: { limit?: number }): Promise<any> {
    return this.request<any>(
      'GET',
      '/api/finance/cost-ledger',
      undefined,
      {
        limit: params?.limit ?? 10,
      }
    )
  }
}

export class SetupScriptContext {
  readonly client: SetupClient
  readonly verbose: boolean

  constructor(verbose = false, baseUrl?: string) {
    this.verbose = verbose
    this.client = new SetupClient({ baseUrl, verbose })
  }

  log(message: string, data?: unknown) {
    if (this.verbose) {
      // eslint-disable-next-line no-console
      console.log(message, data ?? '')
    }
  }
}
