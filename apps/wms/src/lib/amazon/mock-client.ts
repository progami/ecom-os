// Mock Amazon client for testing without API credentials

export function getAmazonClient() {
 return {
 callAPI: async ({ operation }: { operation: string }) => {
 // console.log(`Mock Amazon API call: ${operation}`)
 return getMockData(operation)
 }
 }
}

function getMockData(operation: string) {
 switch (operation) {
 case 'getInventorySummaries':
 return {
 inventorySummaries: [
 { sellerSku: 'SKU001', asin: 'B001TEST01', totalQuantity: 150, fnSku: 'X001TEST01' },
 { sellerSku: 'SKU002', asin: 'B001TEST02', totalQuantity: 200, fnSku: 'X001TEST02' },
 { sellerSku: 'SKU003', asin: 'B001TEST03', totalQuantity: 75, fnSku: 'X001TEST03' },
 { sellerSku: 'SKU004', asin: 'B001TEST04', totalQuantity: 300, fnSku: 'X001TEST04' },
 { sellerSku: 'SKU005', asin: 'B001TEST05', totalQuantity: 25, fnSku: 'X001TEST05' },
 { sellerSku: 'TEST-SKU-001', asin: 'B001TEST06', totalQuantity: 100, fnSku: 'X001TEST06' },
 { sellerSku: 'TEST-SKU-002', asin: 'B001TEST07', totalQuantity: 50, fnSku: 'X001TEST07' },
 { sellerSku: 'TEST-SKU-003', asin: 'B001TEST08', totalQuantity: 0, fnSku: 'X001TEST08' },
 ]
 }
 case 'getCatalogItem':
 return {
 item: {
 attributes: {
 title: [{ value: 'Sample Product Description' }],
 item_dimensions: [{
 length: { value: 10 },
 width: { value: 8 },
 height: { value: 6 }
 }],
 item_weight: [{ value: 2.5 }]
 }
 }
 }
 default:
 return {}
 }
}

export async function getInventory() {
 // console.log('Mock: Fetching Amazon inventory')
 return getMockData('getInventorySummaries')
}

export async function getInboundShipments(_tenantCode?: unknown, _options?: { nextToken?: string }) {
 // console.log('Mock: Fetching inbound shipments')
 return { shipments: [] }
}

export async function getOrders(_createdAfter?: Date) {
 // console.log('Mock: Fetching orders')
 return { orders: [] }
}

export async function getCatalogItem(_asin: string) {
 // console.log(`Mock: Fetching catalog item for ${asin}`)
 return getMockData('getCatalogItem')
}

export async function getProductFees(_asin: string, _price: number) {
 // console.log(`Mock: Fetching product fees for ${asin}`)
 return { fees: [] }
}

export async function getMonthlyStorageFees(_startDate?: Date, _endDate?: Date) {
 // console.log('Mock: Fetching storage fees')
 return []
}

export async function getInventoryAgedData() {
 // console.log('Mock: Fetching aged inventory data')
 return getMockData('getInventorySummaries')
}
