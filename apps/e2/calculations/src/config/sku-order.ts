// Define the standard SKU display order across the application
// Order: 6-pack 7 micron, 12-pack 7 micron, 1-pack 32 micron, 3-pack 32 micron
export const SKU_DISPLAY_ORDER = [
  '6PK - 7M',
  '12PK - 7M',
  '1PK - 32M',
  '3PK - 32M'
]

// Helper function to sort SKUs based on the defined order
export function sortBySkuOrder<T>(
  entries: [string, T][],
  getSkuKey: (entry: [string, T]) => string = ([sku]) => sku
): [string, T][] {
  return entries.sort((a, b) => {
    const skuA = getSkuKey(a)
    const skuB = getSkuKey(b)
    
    const indexA = SKU_DISPLAY_ORDER.indexOf(skuA)
    const indexB = SKU_DISPLAY_ORDER.indexOf(skuB)
    
    // If both SKUs are in the order list, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }
    
    // If only one is in the list, it comes first
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    
    // Otherwise, sort alphabetically
    return skuA.localeCompare(skuB)
  })
}