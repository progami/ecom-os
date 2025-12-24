import 'server-only'

type SellingPartnerApiRegion = 'eu' | 'na' | 'fe'

type SellingPartnerApiClient = {
  callAPI: (params: Record<string, unknown>) => Promise<unknown>
}

type AmazonInventorySummary = {
  asin?: string
  sellerSku?: string
  fnSku?: string
  totalQuantity?: number
}

type AmazonInventorySummariesResponse = {
  inventorySummaries?: AmazonInventorySummary[]
}

type AmazonCatalogItemResponse = {
  item?: {
    attributes?: {
      title?: Array<{ value?: string }>
      item_dimensions?: Array<{
        length?: { value?: number }
        width?: { value?: number }
        height?: { value?: number }
      }>
      item_weight?: Array<{ value?: number }>
    }
  }
}

type AmazonFinancialEventsResponse = {
  FinancialEvents?: {
    ServiceFeeEventList?: Array<{ FeeDescription?: string }>
  }
}

async function callAmazonApi<T>(params: Record<string, unknown>): Promise<T> {
  const client = getAmazonClient()
  return (await client.callAPI(params)) as T
}

type AmazonSpApiConfig = {
  region: SellingPartnerApiRegion
  refreshToken: string
  marketplaceId: string
  appClientId: string
  appClientSecret: string
}

const AMAZON_REQUIRED_ENV_VARS = [
  'AMAZON_SP_APP_CLIENT_ID',
  'AMAZON_SP_APP_CLIENT_SECRET',
  'AMAZON_REFRESH_TOKEN',
  'AMAZON_MARKETPLACE_ID',
] as const

const clientCache = new Map<string, SellingPartnerApiClient>()

function normalizeRegion(value: string): SellingPartnerApiRegion | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'eu' || normalized === 'na' || normalized === 'fe') {
    return normalized
  }
  return null
}

function getAmazonSpApiConfigFromEnv(): AmazonSpApiConfig | null {
  const isProduction = process.env.NODE_ENV === 'production'
  const anyAmazonEnvConfigured = AMAZON_REQUIRED_ENV_VARS.some((name) => Boolean(process.env[name]))

  if (!anyAmazonEnvConfigured) {
    if (isProduction) {
      throw new Error(
        `Amazon SP-API not configured. Missing env vars: ${AMAZON_REQUIRED_ENV_VARS.join(', ')}`
      )
    }

    return null
  }

  const missing = AMAZON_REQUIRED_ENV_VARS.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Amazon SP-API not configured. Missing env vars: ${missing.join(', ')}`)
  }

  const regionRaw = process.env.AMAZON_SP_API_REGION ?? 'eu'
  const region = normalizeRegion(regionRaw)
  if (!region) {
    throw new Error(
      `Invalid AMAZON_SP_API_REGION value "${regionRaw}". Expected one of: eu, na, fe.`
    )
  }

  return {
    region,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID!,
    appClientId: process.env.AMAZON_SP_APP_CLIENT_ID!,
    appClientSecret: process.env.AMAZON_SP_APP_CLIENT_SECRET!,
  }
}

function getCacheKey(config: AmazonSpApiConfig) {
  return `${config.region}:${config.marketplaceId}:${config.refreshToken}`
}

function createAmazonClient(config: AmazonSpApiConfig): SellingPartnerApiClient {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const SellingPartnerAPI = require('amazon-sp-api') as new (params: unknown) => SellingPartnerApiClient

  return new SellingPartnerAPI({
    region: config.region, // 'eu', 'na', or 'fe'
    refresh_token: config.refreshToken,
    credentials: {
      SELLING_PARTNER_APP_CLIENT_ID: config.appClientId,
      SELLING_PARTNER_APP_CLIENT_SECRET: config.appClientSecret,
    },
    options: {
      auto_request_tokens: true,
      auto_request_throttled: true,
      use_sandbox: false,
    },
  })
}

export function getAmazonClient(): SellingPartnerApiClient {
  const config = getAmazonSpApiConfigFromEnv()
  if (!config) {
    // Use mock client for local dev/testing when not configured.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mockClient = require('./mock-client') as { getAmazonClient: () => SellingPartnerApiClient }
    return mockClient.getAmazonClient()
  }

  const key = getCacheKey(config)
  const cached = clientCache.get(key)
  if (cached) return cached

  const client = createAmazonClient(config)
  clientCache.set(key, client)
  return client
}

// Helper functions for common operations
export async function getInventory() {
  try {
    const response = await callAmazonApi<AmazonInventorySummariesResponse>({
      operation: 'getInventorySummaries',
      endpoint: 'fbaInventory',
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
        granularityType: 'Marketplace',
        granularityId: process.env.AMAZON_MARKETPLACE_ID,
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching Amazon inventory:', _error)
    throw _error
  }
}

export async function getInboundShipments() {
  try {
    const response = await callAmazonApi<unknown>({
      operation: 'getShipments',
      endpoint: 'fbaInbound',
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
        shipmentStatusList: ['WORKING', 'SHIPPED', 'RECEIVING', 'CLOSED'],
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching inbound shipments:', _error)
    throw _error
  }
}

export async function getOrders(createdAfter?: Date) {
  try {
    const response = await callAmazonApi<unknown>({
      operation: 'getOrders',
      endpoint: 'orders',
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
        createdAfter: createdAfter || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default to last 7 days
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching orders:', _error)
    throw _error
  }
}

export async function getCatalogItem(asin: string) {
  try {
    const response = await callAmazonApi<AmazonCatalogItemResponse>({
      operation: 'getCatalogItem',
      endpoint: 'catalogItems',
      path: {
        asin,
      },
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching catalog item:', _error)
    throw _error
  }
}

export async function getProductFees(asin: string, price: number) {
  try {
    const response = await callAmazonApi<unknown>({
      operation: 'getMyFeesEstimateForASIN',
      endpoint: 'productFees',
      path: {
        asin,
      },
      body: {
        FeesEstimateRequest: {
          MarketplaceId: process.env.AMAZON_MARKETPLACE_ID,
          PriceToEstimateFees: {
            ListingPrice: {
              CurrencyCode: 'GBP',
              Amount: price,
            },
          },
          IsAmazonFulfilled: true,
        },
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching product fees:', _error)
    throw _error
  }
}

export async function getMonthlyStorageFees(startDate?: Date, endDate?: Date) {
  try {
    // This would fetch financial events including storage fees
    const response = await callAmazonApi<AmazonFinancialEventsResponse>({
      operation: 'listFinancialEvents',
      endpoint: 'finances',
      query: {
        PostedAfter: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default last 30 days
        PostedBefore: endDate || new Date(),
      },
    })

    // Filter for storage fee events
    const storageFees =
      response.FinancialEvents?.ServiceFeeEventList?.filter((fee) =>
        fee.FeeDescription?.toLowerCase().includes('storage')
      ) || []

    return storageFees
  } catch (_error) {
    // console.error('Error fetching storage fees:', _error)
    throw _error
  }
}

export async function getInventoryAgedData() {
  try {
    // Get aged inventory data which includes storage fee preview
    const response = await callAmazonApi<AmazonInventorySummariesResponse>({
      operation: 'getInventorySummaries',
      endpoint: 'fbaInventory',
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
        granularityType: 'Marketplace',
        granularityId: process.env.AMAZON_MARKETPLACE_ID,
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching inventory aged data:', _error)
    throw _error
  }
}
