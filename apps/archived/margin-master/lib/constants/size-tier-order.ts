/**
 * Size Tier Order Constants
 * Defines the pre-sorted order of size tiers for Amazon FBA
 */

// Size tier codes in order (envelopes first, then parcels, then oversize)
export const SIZE_TIER_ORDER = [
  // Standard size - Envelopes
  'LIGHT_ENVELOPE',
  'LIGHT_ENVELOPE_LP', // Low Price variant
  'STANDARD_ENVELOPE',
  'STANDARD_ENVELOPE_LP', // Low Price variant
  'LARGE_ENVELOPE',
  'LARGE_ENVELOPE_LP', // Low Price variant
  'EXTRA_LARGE_ENVELOPE',
  'EXTRA_LARGE_ENVELOPE_LP', // Low Price variant
  
  // Standard size - Parcels
  'SMALL_PARCEL',
  'SMALL_PARCEL_LP', // Low Price variant
  'STANDARD_PARCEL',
  'STANDARD_PARCEL_LP', // Low Price variant
  
  // Oversize
  'SMALL_OVERSIZE',
  'SMALL_OVERSIZE_LP', // Low Price variant
  'STANDARD_OVERSIZE_LIGHT',
  'STANDARD_OVERSIZE_HEAVY',
  'STANDARD_OVERSIZE_LARGE',
  'BULKY_OVERSIZE',
  'HEAVY_OVERSIZE',
  'SPECIAL_OVERSIZE',
] as const;

// Map of size tier codes to their sort priority
export const SIZE_TIER_PRIORITY: Record<string, number> = SIZE_TIER_ORDER.reduce(
  (acc, tier, index) => ({
    ...acc,
    [tier]: index,
  }),
  {}
);

/**
 * Get the sort priority for a size tier
 * Lower numbers = higher priority (Light Envelope = 0, etc.)
 * Unknown size tiers get a high number to sort them last
 */
export function getSizeTierPriority(sizeTier: string): number {
  const normalizedTier = sizeTier.toUpperCase().replace(/[\s-]+/g, '_');
  
  // Check direct match first
  if (normalizedTier in SIZE_TIER_PRIORITY) {
    return SIZE_TIER_PRIORITY[normalizedTier];
  }
  
  // Try to match with common variations
  const tierWithoutLP = normalizedTier.replace(/_LP$/, '');
  if (tierWithoutLP in SIZE_TIER_PRIORITY) {
    return SIZE_TIER_PRIORITY[tierWithoutLP] + 0.5; // Place LP variants right after standard
  }
  
  // Manual mapping for Excel data format
  const manualMapping: Record<string, string> = {
    'LIGHT_ENVELOPE': 'LIGHT_ENVELOPE',
    'STANDARD_ENVELOPE': 'STANDARD_ENVELOPE', 
    'LARGE_ENVELOPE': 'LARGE_ENVELOPE',
    'EXTRA_LARGE_ENVELOPE': 'EXTRA_LARGE_ENVELOPE',
    'SMALL_ENVELOPE': 'STANDARD_ENVELOPE', // Map small to standard
    'SMALL_PARCEL': 'SMALL_PARCEL',
    'STANDARD_PARCEL': 'STANDARD_PARCEL',
  };
  
  if (normalizedTier in manualMapping) {
    const mappedTier = manualMapping[normalizedTier];
    return SIZE_TIER_PRIORITY[mappedTier] || 999;
  }
  
  // Return a high number for unknown size tiers
  return 999;
}

/**
 * Compare two size tiers for sorting
 * Returns negative if a should come before b, positive if after, 0 if equal
 */
export function compareSizeTiers(a: string, b: string): number {
  const aPriority = getSizeTierPriority(a);
  const bPriority = getSizeTierPriority(b);
  
  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }
  
  // If same priority (both unknown), sort alphabetically
  return a.localeCompare(b);
}

/**
 * Storage size categories in order
 */
export const STORAGE_SIZE_ORDER = [
  'STANDARD_SIZE',
  'OVERSIZE',
  'SPECIAL_OVERSIZE',
] as const;

/**
 * Get storage size priority
 */
export function getStorageSizePriority(size: string): number {
  const index = STORAGE_SIZE_ORDER.indexOf(size as any);
  return index >= 0 ? index : 999;
}