/**
 * Marketplace Order Constants
 * Defines the pre-sorted order of marketplaces by size/importance
 */

// Marketplace codes in order of market size (USA first, then major EU markets, etc.)
export const MARKETPLACE_ORDER = [
  'US',   // United States
  'UK',   // United Kingdom
  'DE',   // Germany
  'FR',   // France
  'IT',   // Italy
  'ES',   // Spain
  'NL',   // Netherlands
  'SE',   // Sweden
  'PL',   // Poland
  'BE',   // Belgium
  'IE',   // Ireland (special case - unified marketplace)
] as const;

// Map of marketplace codes to their sort priority
export const MARKETPLACE_PRIORITY: Record<string, number> = MARKETPLACE_ORDER.reduce(
  (acc, marketplace, index) => ({
    ...acc,
    [marketplace]: index,
  }),
  {}
);

/**
 * Get the sort priority for a marketplace
 * Lower numbers = higher priority (USA = 0, UK = 1, etc.)
 * Unknown marketplaces get a high number to sort them last
 */
export function getMarketplacePriority(marketplace: string): number {
  // Handle both 'US' and 'USA' formats
  const normalizedMarketplace = marketplace.toUpperCase();
  
  // Check direct match first
  if (normalizedMarketplace in MARKETPLACE_PRIORITY) {
    return MARKETPLACE_PRIORITY[normalizedMarketplace];
  }
  
  // Handle special cases
  if (normalizedMarketplace === 'USA') {
    return MARKETPLACE_PRIORITY['US'];
  }
  
  // Return a high number for unknown marketplaces
  return 999;
}

/**
 * Compare two marketplaces for sorting
 * Returns negative if a should come before b, positive if after, 0 if equal
 */
export function compareMarketplaces(a: string, b: string): number {
  const aPriority = getMarketplacePriority(a);
  const bPriority = getMarketplacePriority(b);
  
  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }
  
  // If same priority (both unknown), sort alphabetically
  return a.localeCompare(b);
}

/**
 * Create a hierarchical comparator that groups by marketplace first
 * @param innerComparator The comparator to use within each marketplace group
 */
export function createHierarchicalComparator<T extends { marketplace?: string; marketplaceGroup?: string }>(
  innerComparator?: (a: T, b: T) => number
): (a: T, b: T) => number {
  return (a: T, b: T) => {
    // Get marketplace values (handle both 'marketplace' and 'marketplaceGroup' fields)
    const aMarketplace = a.marketplace || a.marketplaceGroup || '';
    const bMarketplace = b.marketplace || b.marketplaceGroup || '';
    
    // First, compare by marketplace priority
    const marketplaceComparison = compareMarketplaces(aMarketplace, bMarketplace);
    
    if (marketplaceComparison !== 0) {
      return marketplaceComparison;
    }
    
    // If same marketplace, use inner comparator if provided
    if (innerComparator) {
      return innerComparator(a, b);
    }
    
    // Default to no additional sorting within marketplace
    return 0;
  };
}