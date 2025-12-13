export const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  MXN: '$',
  BRL: 'R$',
  SEK: 'kr',
  PLN: 'zł',
  SGD: 'S$',
  AED: 'د.إ',
  SAR: '﷼',
  TRY: '₺',
  EGP: 'E£',
};

export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  // Handle special cases for certain currencies
  const locale = getLocaleForCurrency(currency);
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

export function getLocaleForCurrency(currency: string): string {
  const currencyLocaleMap: Record<string, string> = {
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    CAD: 'en-CA',
    AUD: 'en-AU',
    JPY: 'ja-JP',
    CNY: 'zh-CN',
    INR: 'en-IN',
    MXN: 'es-MX',
    BRL: 'pt-BR',
    SEK: 'sv-SE',
    PLN: 'pl-PL',
    SGD: 'en-SG',
    AED: 'ar-AE',
    SAR: 'ar-SA',
    TRY: 'tr-TR',
    EGP: 'ar-EG',
  };

  return currencyLocaleMap[currency] || 'en-US';
}

export function getCurrencySymbol(currency: string): string {
  return currencySymbols[currency] || currency;
}