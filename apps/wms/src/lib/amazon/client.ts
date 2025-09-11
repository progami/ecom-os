// @ts-ignore - Dynamic import for amazon-sp-api
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const SellingPartnerAPI = typeof window === 'undefined' ? require('amazon-sp-api') : null

// Initialize the Amazon SP-API client
let spApiClient: unknown = null

export function getAmazonClient() {
  if (!spApiClient) {
    // Check if we have the required credentials
    if (!process.env.AMAZON_SP_APP_CLIENT_ID || !process.env.AMAZON_SP_APP_CLIENT_SECRET) {
      // console.warn('Amazon SP-API credentials not configured. Using mock client for testing.')
      // Use mock client for testing
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const mockClient = require('./mock-client')
      return mockClient.getAmazonClient()
    }
    
    spApiClient = new SellingPartnerAPI({
      region: 'eu', // Amazon SP-API expects 'eu', 'na', or 'fe'
      refresh_token: process.env.AMAZON_REFRESH_TOKEN,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: process.env.AMAZON_SP_APP_CLIENT_ID,
        SELLING_PARTNER_APP_CLIENT_SECRET: process.env.AMAZON_SP_APP_CLIENT_SECRET
      },
      options: {
        auto_request_tokens: true,
        auto_request_throttled: true,
        use_sandbox: false // Use production mode
      }
    })
  }
  return spApiClient
}

// Helper functions for common operations
export async function getInventory() {
  try {
    const client = getAmazonClient()
    const response = await client.callAPI({
      operation: 'getInventorySummaries',
      endpoint: 'fbaInventory',
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
        granularityType: 'Marketplace',
        granularityId: process.env.AMAZON_MARKETPLACE_ID
      }
    })
    return response
  } catch (_error) {
    // console.error('Error fetching Amazon inventory:', _error)
    throw _error
  }
}

export async function getInboundShipments() {
  try {
    const client = getAmazonClient()
    const response = await client.callAPI({
      operation: 'getShipments',
      endpoint: 'fbaInbound',
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
        shipmentStatusList: ['WORKING', 'SHIPPED', 'RECEIVING', 'CLOSED']
      }
    })
    return response
  } catch (_error) {
    // console.error('Error fetching inbound shipments:', _error)
    throw _error
  }
}

export async function getOrders(createdAfter?: Date) {
  try {
    const client = getAmazonClient()
    const response = await client.callAPI({
      operation: 'getOrders',
      endpoint: 'orders',
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
        createdAfter: createdAfter || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Default to last 7 days
      }
    })
    return response
  } catch (_error) {
    // console.error('Error fetching orders:', _error)
    throw _error
  }
}

export async function getCatalogItem(asin: string) {
  try {
    const client = getAmazonClient()
    const response = await client.callAPI({
      operation: 'getCatalogItem',
      endpoint: 'catalogItems',
      path: {
        asin
      },
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID]
      }
    })
    return response
  } catch (_error) {
    // console.error('Error fetching catalog item:', _error)
    throw _error
  }
}

export async function getProductFees(asin: string, price: number) {
  try {
    const client = getAmazonClient()
    const response = await client.callAPI({
      operation: 'getMyFeesEstimateForASIN',
      endpoint: 'productFees',
      path: {
        asin
      },
      body: {
        FeesEstimateRequest: {
          MarketplaceId: process.env.AMAZON_MARKETPLACE_ID,
          PriceToEstimateFees: {
            ListingPrice: {
              CurrencyCode: 'GBP',
              Amount: price
            }
          },
          IsAmazonFulfilled: true
        }
      }
    })
    return response
  } catch (_error) {
    // console.error('Error fetching product fees:', _error)
    throw _error
  }
}

export async function getMonthlyStorageFees(startDate?: Date, endDate?: Date) {
  try {
    const client = getAmazonClient()
    // This would fetch financial events including storage fees
    const response = await client.callAPI({
      operation: 'listFinancialEvents',
      endpoint: 'finances',
      query: {
        PostedAfter: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default last 30 days
        PostedBefore: endDate || new Date()
      }
    })
    
    // Filter for storage fee events
    const storageFees = response.FinancialEvents?.ServiceFeeEventList?.filter(
      (fee: unknown) => (fee as Record<string, unknown>).FeeDescription?.toString().toLowerCase().includes('storage')
    ) || []
    
    return storageFees
  } catch (_error) {
    // console.error('Error fetching storage fees:', _error)
    throw _error
  }
}

export async function getInventoryAgedData() {
  try {
    const client = getAmazonClient()
    // Get aged inventory data which includes storage fee preview
    const response = await client.callAPI({
      operation: 'getInventorySummaries',
      endpoint: 'fbaInventory',
      query: {
        marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
        granularityType: 'Marketplace',
        granularityId: process.env.AMAZON_MARKETPLACE_ID
      }
    })
    return response
  } catch (_error) {
    // console.error('Error fetching inventory aged data:', _error)
    throw _error
  }
}