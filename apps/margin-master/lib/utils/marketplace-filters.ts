/**
 * Utility functions for handling marketplace group filtering
 */

/**
 * Checks if a marketplace group contains a specific country
 * @param marketplaceGroup - The marketplace group string (e.g., "DE/FR/IT/ES/NL/PL/BE/IE")
 * @param country - The country code to check for (e.g., "DE")
 * @returns boolean indicating if the country is in the group
 */
export function marketplaceGroupContainsCountry(marketplaceGroup: string, country: string): boolean {
  if (!marketplaceGroup || !country) return false;
  
  // Direct match
  if (marketplaceGroup === country) return true;
  
  // Handle special cases like "CEP (DE/PL/CZ)" or "DE Only"
  if (marketplaceGroup.includes('(') && marketplaceGroup.includes(')')) {
    // Extract countries from within parentheses
    const match = marketplaceGroup.match(/\(([^)]+)\)/);
    if (match) {
      const countriesInParens = match[1].split('/').map(c => c.trim());
      if (countriesInParens.includes(country)) return true;
    }
  }
  
  // Handle "XX Only" format
  if (marketplaceGroup.endsWith(' Only')) {
    const baseCountry = marketplaceGroup.replace(' Only', '').trim();
    if (baseCountry === country) return true;
  }
  
  // Check if country is part of a group (separated by /)
  const countries = marketplaceGroup.split('/').map(c => c.trim());
  return countries.includes(country);
}

/**
 * Filters marketplace data based on country selection
 * @param data - Array of items with marketplace/marketplaceGroup field
 * @param countryFilter - The selected country filter
 * @param marketplaceField - The field name containing marketplace info
 * @returns Filtered array
 */
export function filterByMarketplace<T extends Record<string, any>>(
  data: T[],
  countryFilter: string | null | undefined,
  marketplaceField: keyof T = 'marketplace'
): T[] {
  if (!countryFilter) return data;
  
  return data.filter(item => {
    const marketplace = item[marketplaceField] as string;
    return marketplaceGroupContainsCountry(marketplace, countryFilter);
  });
}

/**
 * Get all unique countries from marketplace groups
 * @param marketplaceGroups - Array of marketplace group strings
 * @returns Array of unique country codes
 */
export function extractUniqueCountries(marketplaceGroups: string[]): string[] {
  const countries = new Set<string>();
  
  marketplaceGroups.forEach(group => {
    if (group.includes('/')) {
      // It's a group, split and add each country
      group.split('/').forEach(country => {
        countries.add(country.trim());
      });
    } else {
      // Single country
      countries.add(group.trim());
    }
  });
  
  return Array.from(countries).sort();
}

/**
 * Get display name for a marketplace group
 * @param marketplaceGroup - The marketplace group string
 * @returns Display-friendly name
 */
export function getMarketplaceGroupDisplayName(marketplaceGroup: string): string {
  // Special cases for known groups
  const specialCases: Record<string, string> = {
    'UK/DE/FR/IT/ES': 'Major EU Markets',
    'DE/FR/IT/ES/NL/PL/BE/IE': 'EU Countries',
    'NL/BE/IE': 'Benelux + Ireland',
    'NL/BE': 'Benelux',
    'CEP (DE/PL/CZ)': 'Central Europe',
    'CEE (PL/CZ)': 'Central & Eastern Europe',
  };
  
  return specialCases[marketplaceGroup] || marketplaceGroup;
}