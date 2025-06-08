const SellingPartnerAPI = require('amazon-sp-api')

// Initialize the Amazon SP-API client
let spApiClient: any = null

export function getAmazonClient() {
  if (!spApiClient) {
    // Check if we have the required credentials
    if (!process.env.AMAZON_SP_APP_CLIENT_ID || !process.env.AMAZON_SP_APP_CLIENT_SECRET) {
      throw new Error('Amazon SP-API credentials not configured. Please set AMAZON_SP_APP_CLIENT_ID and AMAZON_SP_APP_CLIENT_SECRET environment variables.')
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
  } catch (error) {
    console.error('Error fetching Amazon inventory:', error)
    throw error
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
  } catch (error) {
    console.error('Error fetching inbound shipments:', error)
    throw error
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
  } catch (error) {
    console.error('Error fetching orders:', error)
    throw error
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
  } catch (error) {
    console.error('Error fetching catalog item:', error)
    throw error
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
  } catch (error) {
    console.error('Error fetching product fees:', error)
    throw error
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
      (fee: any) => fee.FeeDescription?.toLowerCase().includes('storage')
    ) || []
    
    return storageFees
  } catch (error) {
    console.error('Error fetching storage fees:', error)
    throw error
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
  } catch (error) {
    console.error('Error fetching inventory aged data:', error)
    throw error
  }
}