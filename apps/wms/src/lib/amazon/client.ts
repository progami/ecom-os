import 'server-only'
import type { TenantCode } from '@/lib/tenant/constants'

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

async function callAmazonApi<T>(tenantCode: TenantCode | undefined, params: Record<string, unknown>): Promise<T> {
  const client = getAmazonClient(tenantCode)
  return (await client.callAPI(params)) as T
}

type AmazonSpApiConfig = {
  region: SellingPartnerApiRegion
  refreshToken: string
  marketplaceId: string
  appClientId: string
  appClientSecret: string
}

const AMAZON_BASE_REQUIRED_ENV_VARS = [
  'AMAZON_SP_APP_CLIENT_ID',
  'AMAZON_SP_APP_CLIENT_SECRET',
] as const

const AMAZON_TENANT_REQUIRED_ENV_VARS = ['AMAZON_REFRESH_TOKEN'] as const

const clientCache = new Map<string, SellingPartnerApiClient>()

function normalizeRegion(value: string): SellingPartnerApiRegion | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'eu' || normalized === 'na' || normalized === 'fe') {
    return normalized
  }
  return null
}

function readEnvVar(name: string): string | undefined {
  const value = process.env[name]
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function getDefaultMarketplaceId(tenantCode: TenantCode | undefined): string | undefined {
  if (tenantCode === 'US') return 'ATVPDKIKX0DER'
  if (tenantCode === 'UK') return 'A1F83G8C2ARO7P'
  return undefined
}

function getDefaultRegion(tenantCode: TenantCode | undefined): SellingPartnerApiRegion {
  if (tenantCode === 'US') return 'na'
  if (tenantCode === 'UK') return 'eu'
  return 'eu'
}

function getAmazonSpApiConfigFromEnv(tenantCode?: TenantCode): AmazonSpApiConfig | null {
  const isProduction = process.env.NODE_ENV === 'production'
  const anyAmazonEnvConfigured =
    AMAZON_BASE_REQUIRED_ENV_VARS.some((name) => Boolean(readEnvVar(name))) ||
    AMAZON_TENANT_REQUIRED_ENV_VARS.some((name) => Boolean(readEnvVar(name) || readEnvVar(`${name}_US`) || readEnvVar(`${name}_UK`)))

  if (!anyAmazonEnvConfigured) {
    if (isProduction) {
      throw new Error(
        'Amazon SP-API not configured. Missing env vars: AMAZON_SP_APP_CLIENT_ID, AMAZON_SP_APP_CLIENT_SECRET, AMAZON_REFRESH_TOKEN[_US|_UK]'
      )
    }

    return null
  }

  const appClientId = readEnvVar('AMAZON_SP_APP_CLIENT_ID')
  const appClientSecret = readEnvVar('AMAZON_SP_APP_CLIENT_SECRET')

  const refreshToken = tenantCode
    ? readEnvVar(`AMAZON_REFRESH_TOKEN_${tenantCode}`)
    : readEnvVar('AMAZON_REFRESH_TOKEN')

  const marketplaceId =
    (tenantCode ? readEnvVar(`AMAZON_MARKETPLACE_ID_${tenantCode}`) : readEnvVar('AMAZON_MARKETPLACE_ID')) ||
    getDefaultMarketplaceId(tenantCode)

  const regionRaw =
    (tenantCode ? readEnvVar(`AMAZON_SP_API_REGION_${tenantCode}`) : readEnvVar('AMAZON_SP_API_REGION')) ||
    getDefaultRegion(tenantCode)
  const region = normalizeRegion(regionRaw)

  const missing: string[] = []
  if (!appClientId) missing.push('AMAZON_SP_APP_CLIENT_ID')
  if (!appClientSecret) missing.push('AMAZON_SP_APP_CLIENT_SECRET')

  if (!refreshToken) {
    missing.push(tenantCode ? `AMAZON_REFRESH_TOKEN_${tenantCode}` : 'AMAZON_REFRESH_TOKEN')
  }
  if (!marketplaceId) {
    missing.push(tenantCode ? `AMAZON_MARKETPLACE_ID_${tenantCode}` : 'AMAZON_MARKETPLACE_ID')
  }

  if (missing.length > 0) {
    throw new Error(`Amazon SP-API not configured. Missing env vars: ${missing.join(', ')}`)
  }

  if (!region) {
    const key = tenantCode ? `AMAZON_SP_API_REGION_${tenantCode}` : 'AMAZON_SP_API_REGION'
    throw new Error(`Invalid ${key} value "${regionRaw}". Expected one of: eu, na, fe.`)
  }

  return {
    region,
    refreshToken,
    marketplaceId,
    appClientId,
    appClientSecret,
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

export function getAmazonClient(tenantCode?: TenantCode): SellingPartnerApiClient {
  const config = getAmazonSpApiConfigFromEnv(tenantCode)
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
export async function getInventory(tenantCode?: TenantCode) {
  try {
    const config = getAmazonSpApiConfigFromEnv(tenantCode)
    const response = await callAmazonApi<AmazonInventorySummariesResponse>(tenantCode, {
      operation: 'getInventorySummaries',
      endpoint: 'fbaInventory',
      query: {
        marketplaceIds: [config?.marketplaceId ?? process.env.AMAZON_MARKETPLACE_ID],
        granularityType: 'Marketplace',
        granularityId: config?.marketplaceId ?? process.env.AMAZON_MARKETPLACE_ID,
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching Amazon inventory:', _error)
    throw _error
  }
}

export async function getInboundShipments(tenantCode?: TenantCode) {
  try {
    const config = getAmazonSpApiConfigFromEnv(tenantCode)
    const response = await callAmazonApi<unknown>(tenantCode, {
      operation: 'getShipments',
      endpoint: 'fbaInbound',
      query: {
        marketplaceIds: [config?.marketplaceId ?? process.env.AMAZON_MARKETPLACE_ID],
        shipmentStatusList: ['WORKING', 'SHIPPED', 'RECEIVING', 'CLOSED'],
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching inbound shipments:', _error)
    throw _error
  }
}

export async function getOrders(createdAfter?: Date, tenantCode?: TenantCode) {
  try {
    const config = getAmazonSpApiConfigFromEnv(tenantCode)
    const response = await callAmazonApi<unknown>(tenantCode, {
      operation: 'getOrders',
      endpoint: 'orders',
      query: {
        marketplaceIds: [config?.marketplaceId ?? process.env.AMAZON_MARKETPLACE_ID],
        createdAfter: createdAfter || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default to last 7 days
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching orders:', _error)
    throw _error
  }
}

export async function getCatalogItem(asin: string, tenantCode?: TenantCode) {
  try {
    const config = getAmazonSpApiConfigFromEnv(tenantCode)
    const response = await callAmazonApi<AmazonCatalogItemResponse>(tenantCode, {
      operation: 'getCatalogItem',
      endpoint: 'catalogItems',
      path: {
        asin,
      },
      query: {
        marketplaceIds: [config?.marketplaceId ?? process.env.AMAZON_MARKETPLACE_ID],
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching catalog item:', _error)
    throw _error
  }
}

export async function getProductFees(asin: string, price: number, tenantCode?: TenantCode) {
  try {
    const config = getAmazonSpApiConfigFromEnv(tenantCode)
    const response = await callAmazonApi<unknown>(tenantCode, {
      operation: 'getMyFeesEstimateForASIN',
      endpoint: 'productFees',
      path: {
        asin,
      },
      body: {
        FeesEstimateRequest: {
          MarketplaceId: config?.marketplaceId ?? process.env.AMAZON_MARKETPLACE_ID,
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

export async function getMonthlyStorageFees(
  startDate?: Date,
  endDate?: Date,
  tenantCode?: TenantCode
) {
  try {
    // This would fetch financial events including storage fees
    const response = await callAmazonApi<AmazonFinancialEventsResponse>(tenantCode, {
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

export async function getInventoryAgedData(tenantCode?: TenantCode) {
  try {
    const config = getAmazonSpApiConfigFromEnv(tenantCode)
    // Get aged inventory data which includes storage fee preview
    const response = await callAmazonApi<AmazonInventorySummariesResponse>(tenantCode, {
      operation: 'getInventorySummaries',
      endpoint: 'fbaInventory',
      query: {
        marketplaceIds: [config?.marketplaceId ?? process.env.AMAZON_MARKETPLACE_ID],
        granularityType: 'Marketplace',
        granularityId: config?.marketplaceId ?? process.env.AMAZON_MARKETPLACE_ID,
      },
    })
    return response
  } catch (_error) {
    // console.error('Error fetching inventory aged data:', _error)
    throw _error
  }
}
