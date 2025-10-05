import type { APIRequestContext } from '@playwright/test'

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
  costCategory: 'Container' | 'Carton' | 'Pallet' | 'Storage' | 'Unit' | 'transportation' | 'Accessorial'
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

export interface OrderSeed {
  orderNumber: string
  warehouseCode: string
  type: 'purchase' | 'sales' | 'adjustment'
  status?: 'DRAFT' | 'SHIPPED' | 'WAREHOUSE' | 'CANCELLED' | 'CLOSED'
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

export class WmsApiClient {
  private readonly baseUrl: string
  private readonly headers = {
    'content-type': 'application/json',
    'x-bypass-auth': 'true',
  }

  constructor(private readonly request: APIRequestContext, baseUrl?: string) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : 'http://localhost:3001'
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}${path}`
  }

  private async handleResponse<T>(response: Awaited<ReturnType<APIRequestContext['fetch']>>): Promise<T> {
    if (response.status() === 204) {
      return undefined as unknown as T
    }
    const text = await response.text()
    if (!text) {
      return undefined as unknown as T
    }
    return JSON.parse(text) as T
  }

  private async requestJson<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.buildUrl(path))
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    const response = await this.request.fetch(url.toString(), {
      method,
      data: body,
      headers: this.headers,
    })

    if (!response.ok()) {
      const errorBody = await this.handleResponse<{ error?: string }>(response).catch(() => undefined)
      const message = errorBody?.error ?? `Request failed: ${response.status()} ${response.statusText()}`
      throw new Error(message)
    }

    return this.handleResponse<T>(response)
  }

  async ensureSku(seed: SkuSeed): Promise<any> {
    try {
      return await this.requestJson('POST', '/api/skus', {
        ...seed,
        asin: seed.asin ?? null,
        material: seed.material ?? null,
        unitDimensionsCm: seed.unitDimensionsCm ?? null,
        unitWeightKg: seed.unitWeightKg ?? null,
        cartonDimensionsCm: seed.cartonDimensionsCm ?? null,
        cartonWeightKg: seed.cartonWeightKg ?? null,
        packagingType: seed.packagingType ?? null,
      })
    } catch (error) {
      if (error instanceof Error && /SKU code already exists/i.test(error.message)) {
        const existing = await this.requestJson<any[]>('GET', '/api/skus', undefined, {
          search: seed.skuCode,
          includeInactive: 'true',
        })
        const match = existing.find((sku) => sku.skuCode === seed.skuCode)
        if (match) return match
      }
      throw error
    }
  }

  async listWarehouses(): Promise<any[]> {
    return this.requestJson('GET', '/api/warehouses', undefined, {
      includeInactive: 'true',
      includeAmazon: 'true',
    })
  }

  async ensureWarehouse(seed: WarehouseSeed): Promise<any> {
    try {
      return await this.requestJson('POST', '/api/warehouses', seed)
    } catch (error) {
      if (error instanceof Error && /already exists/i.test(error.message)) {
        const warehouses = await this.listWarehouses()
        const match = warehouses.find((wh) => wh.code.toLowerCase() === seed.code.toLowerCase())
        if (match) return match
      }
      throw error
    }
  }

  async createRate(seed: RateSeed): Promise<any> {
    try {
      return await this.requestJson('POST', '/api/rates', seed)
    } catch (error) {
      try {
        const existing = await this.requestJson<any[]>(
          'GET',
          '/api/rates',
          undefined,
          { warehouseId: seed.warehouseId }
        )
        const match = existing.find(
          (rate) =>
            rate.costCategory === seed.costCategory &&
            rate.costName?.toLowerCase() === seed.costName.toLowerCase()
        )
        if (match) return match
      } catch (lookupError) {
        throw lookupError instanceof Error ? lookupError : error
      }
      if (error instanceof Error) throw error
      throw new Error('Failed to create rate')
    }
  }

  async createOrder(seed: OrderSeed): Promise<any> {
    return this.requestJson('POST', '/api/purchase-orders', seed)
  }

  async getOrder(id: string): Promise<any> {
    return this.requestJson('GET', `/api/purchase-orders/${id}`)
  }

  async updateOrderStatus(id: string, status: 'DRAFT' | 'SHIPPED' | 'WAREHOUSE' | 'CLOSED'): Promise<any> {
    return this.requestJson('PATCH', `/api/purchase-orders/${id}/status`, { status })
  }

  async createMovementNote(seed: MovementNoteSeed): Promise<any> {
    return this.requestJson('POST', '/api/movement-notes', seed)
  }

  async postMovementNote(id: string): Promise<any> {
    return this.requestJson('POST', `/api/movement-notes/${id}/post`)
  }

  async createTransaction(seed: TransactionSeed): Promise<any> {
    return this.requestJson('POST', '/api/transactions', seed)
  }

  async createWarehouseInvoice(seed: InvoiceSeed): Promise<any> {
    return this.requestJson('POST', '/api/warehouse-invoices', seed)
  }

  async listCostLedger(params?: Record<string, string>): Promise<any> {
    return this.requestJson('GET', '/api/finance/cost-ledger', undefined, params)
  }

  async listStorageLedger(params?: Record<string, string>): Promise<any> {
    return this.requestJson('GET', '/api/finance/storage-ledger', undefined, params)
  }
}
