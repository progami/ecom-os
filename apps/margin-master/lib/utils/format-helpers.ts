// Marketplace mapping to full country names
export const marketplaceToCountry: Record<string, string> = {
  'UK': 'United Kingdom',
  'FR': 'France',
  'DE': 'Germany',
  'IT': 'Italy',
  'ES': 'Spain',
  'NL': 'Netherlands',
  'SE': 'Sweden',
  'PL': 'Poland',
  'BE': 'Belgium',
  'TR': 'Turkey',
  'CEP (DE/PL/CZ)': 'Central Europe (DE/PL/CZ)',
  'DE Only': 'Germany Only',
  'CEP': 'Central Europe',
  'EU': 'European Union',
  'US': 'United States',
  'IE': 'Ireland',
  'NL/BE': 'Netherlands/Belgium',
  'NL/BE/IE': 'Netherlands/Belgium/Ireland',
  'CEE (PL/CZ)': 'Central & Eastern Europe (PL/CZ)',
};

// Currency code to symbol mapping
export const currencySymbols: Record<string, string> = {
  'EUR': '€',
  'GBP': '£',
  'USD': '$',
  'SEK': 'kr',
  'PLN': 'zł',
  'TRY': '₺',
};

export function getCountryName(marketplace: string): string {
  return marketplaceToCountry[marketplace] || marketplace;
}

export function getCurrencySymbol(currency: string): string {
  return currencySymbols[currency] || currency;
}

export function formatCurrencyWithSymbol(amount: number | string, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // For EUR, symbol goes after the number in some locales, but we'll use before for consistency
  return `${symbol}${value.toFixed(2)}`;
}