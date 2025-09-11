import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
// Set precision to handle currency with 4 decimal places for intermediate calculations
Decimal.set({ 
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 20
});

// Development logging helper
function logError(message: string, error?: any, context?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [FinancialCalc] ${message}`;
  
  console.error(logMessage, error || '', context || '');
  
  // In development, log additional context
  if (process.env.NODE_ENV === 'development' && context) {
    console.error('Context:', context);
  }
}

/**
 * Financial calculation utilities using decimal.js for precision
 * All monetary values should be processed through these functions
 */

export class FinancialCalc {
  /**
   * Create a Decimal from a value, handling null/undefined safely
   */
  static decimal(value: number | string | null | undefined): Decimal {
    if (value === null || value === undefined) {
      return new Decimal(0);
    }
    return new Decimal(value);
  }

  /**
   * Add multiple values with precision
   */
  static add(...values: (number | string | null | undefined)[]): Decimal {
    return values.reduce(
      (sum, val) => sum.plus(FinancialCalc.decimal(val)),
      new Decimal(0)
    );
  }

  /**
   * Subtract values with precision
   */
  static subtract(minuend: number | string, ...subtrahends: (number | string | null | undefined)[]): Decimal {
    const result = FinancialCalc.decimal(minuend);
    return subtrahends.reduce(
      (diff, val) => diff.minus(FinancialCalc.decimal(val)),
      result
    );
  }

  /**
   * Multiply values with precision
   */
  static multiply(...values: (number | string | null | undefined)[]): Decimal {
    return values.reduce(
      (product, val) => product.times(FinancialCalc.decimal(val)),
      new Decimal(1)
    );
  }

  /**
   * Divide with precision and safe zero handling
   */
  static divide(dividend: number | string | null | undefined, divisor: number | string | null | undefined): Decimal | null {
    try {
      const divisorDecimal = FinancialCalc.decimal(divisor);
      if (divisorDecimal.isZero()) {
        return null; // Return null for division by zero
      }
      return FinancialCalc.decimal(dividend).dividedBy(divisorDecimal);
    } catch (error) {
      logError('Error in divide', error, { dividend, divisor });
      return null;
    }
  }

  /**
   * Calculate percentage
   */
  static percentage(value: number | string, percentage: number | string): Decimal {
    return FinancialCalc.decimal(value).times(FinancialCalc.decimal(percentage)).dividedBy(100);
  }

  /**
   * Round to currency (2 decimal places)
   */
  static toCurrency(value: Decimal | number | string): string {
    if (value instanceof Decimal) {
      return value.toFixed(2);
    }
    return FinancialCalc.decimal(value).toFixed(2);
  }

  /**
   * Round to specified decimal places
   */
  static round(value: Decimal | number | string, decimals: number = 2): string {
    if (value instanceof Decimal) {
      return value.toFixed(decimals);
    }
    return FinancialCalc.decimal(value).toFixed(decimals);
  }

  /**
   * Convert to number (use with caution, only for display or when precision isn't critical)
   */
  static toNumber(value: Decimal | number | string | null | undefined): number {
    try {
      if (value === null || value === undefined) {
        return 0;
      }
      if (value instanceof Decimal) {
        return value.toNumber();
      }
      return FinancialCalc.decimal(value).toNumber();
    } catch (error) {
      logError('Error converting to number', error, { value });
      return 0;
    }
  }

  /**
   * Compare two values
   */
  static compare(a: number | string, b: number | string): number {
    const decimalA = FinancialCalc.decimal(a);
    const decimalB = FinancialCalc.decimal(b);
    return decimalA.comparedTo(decimalB);
  }

  /**
   * Check if value is greater than another
   */
  static isGreaterThan(a: number | string, b: number | string): boolean {
    return FinancialCalc.compare(a, b) > 0;
  }

  /**
   * Check if value is less than another
   */
  static isLessThan(a: number | string, b: number | string): boolean {
    return FinancialCalc.compare(a, b) < 0;
  }

  /**
   * Check if values are equal
   */
  static isEqual(a: number | string, b: number | string): boolean {
    return FinancialCalc.compare(a, b) === 0;
  }

  /**
   * Calculate tax amount
   */
  static calculateTax(amount: number | string, taxRate: number | string): {
    taxAmount: string;
    totalWithTax: string;
    netAmount: string;
  } {
    const amountDecimal = FinancialCalc.decimal(amount);
    const taxAmount = FinancialCalc.percentage(amount, taxRate);
    const totalWithTax = amountDecimal.plus(taxAmount);

    return {
      taxAmount: FinancialCalc.toCurrency(taxAmount),
      totalWithTax: FinancialCalc.toCurrency(totalWithTax),
      netAmount: FinancialCalc.toCurrency(amountDecimal)
    };
  }

  /**
   * Calculate discount
   */
  static calculateDiscount(amount: number | string, discountPercent: number | string): {
    discountAmount: string;
    finalAmount: string;
  } {
    const amountDecimal = FinancialCalc.decimal(amount);
    const discountAmount = FinancialCalc.percentage(amount, discountPercent);
    const finalAmount = amountDecimal.minus(discountAmount);

    return {
      discountAmount: FinancialCalc.toCurrency(discountAmount),
      finalAmount: FinancialCalc.toCurrency(finalAmount)
    };
  }

  /**
   * Sum an array of values
   */
  static sum(values: (number | string | null | undefined)[]): string {
    const total = values.reduce(
      (sum, val) => sum.plus(FinancialCalc.decimal(val)),
      new Decimal(0)
    );
    return FinancialCalc.toCurrency(total);
  }

  /**
   * Calculate average
   */
  static average(values: (number | string | null | undefined)[]): string | null {
    if (values.length === 0) return null;
    
    const sum = values.reduce(
      (total, val) => total.plus(FinancialCalc.decimal(val)),
      new Decimal(0)
    );
    
    const avg = sum.dividedBy(values.length);
    return FinancialCalc.toCurrency(avg);
  }

  /**
   * Format currency with symbol
   */
  static formatCurrency(value: number | string | Decimal, symbol: string = '$'): string {
    const formatted = FinancialCalc.toCurrency(value);
    return `${symbol}${formatted}`;
  }

  /**
   * Parse currency string to Decimal
   */
  static parseCurrency(value: string): Decimal {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$,]/g, '').trim();
    return FinancialCalc.decimal(cleaned);
  }

  /**
   * Calculate financial health score based on multiple factors
   * @returns Score from 0-100
   */
  static calculateHealthScore(
    cash: number,
    revenue: number,
    expenses: number,
    netIncome: number,
    currentAssets: number,
    currentLiabilities: number
  ): number {
    try {
      let score = 0;
      let weightedFactors = 0;
      
      // Ensure all inputs are valid numbers
      cash = cash || 0;
      revenue = revenue || 0;
      expenses = expenses || 0;
      netIncome = netIncome || 0;
      currentAssets = currentAssets || 0;
      currentLiabilities = currentLiabilities || 0;
      
      // Cash runway (30% weight) - Can the business survive 3+ months?
      if (expenses > 0) {
        const divisionResult = FinancialCalc.divide(cash, expenses / 12);
        const monthsOfCash = divisionResult ? FinancialCalc.toNumber(divisionResult) : 0;
        const cashScore = Math.min(monthsOfCash / 3, 1) * 100;
        score += cashScore * 0.3;
        weightedFactors += 0.3;
      } else if (cash > 0) {
        // If no expenses but has cash, give partial credit
        score += 50 * 0.3;
        weightedFactors += 0.3;
      }
      
      // Profitability (25% weight)
      if (revenue > 0) {
        const divisionResult = FinancialCalc.divide(netIncome, revenue);
        const profitMargin = divisionResult ? FinancialCalc.toNumber(divisionResult) * 100 : 0;
        const profitScore = Math.max(0, Math.min(profitMargin, 20)) * 5; // 0-20% margin = 0-100 score
        score += profitScore * 0.25;
        weightedFactors += 0.25;
      }
      
      // Current ratio (25% weight) - Liquidity
      // Note: This uses current ratio, not quick ratio, as inventory data 
      // is not available in this generic calculation function
      if (currentLiabilities > 0) {
        const divisionResult = FinancialCalc.divide(currentAssets, currentLiabilities);
        const currentRatio = divisionResult ? FinancialCalc.toNumber(divisionResult) : 0;
        const liquidityScore = Math.min(currentRatio, 2) * 50; // 0-2 ratio = 0-100 score
        score += liquidityScore * 0.25;
        weightedFactors += 0.25;
      } else if (currentAssets > 0) {
        // If no liabilities but has assets, that's good
        score += 100 * 0.25;
        weightedFactors += 0.25;
      }
      
      // Revenue health (20% weight) - Is there business activity?
      if (revenue > 0) {
        score += 100 * 0.2;
        weightedFactors += 0.2;
      }
      
      // Normalize score based on available factors
      if (weightedFactors > 0) {
        return Math.round(score / weightedFactors);
      }
      
      // If no data available, return 0
      return 0;
    } catch (error) {
      logError('Error calculating health score', error, { cash, revenue, expenses, netIncome, currentAssets, currentLiabilities });
      return 0;
    }
  }

  /**
   * Calculate daily burn rate
   */
  static calculateDailyBurnRate(expenses: number, timeRangeDays: number): number {
    try {
      // Validate inputs
      expenses = expenses || 0;
      timeRangeDays = timeRangeDays || 1;
      
      if (timeRangeDays <= 0) {
        logError('Invalid timeRangeDays for burn rate calculation', null, { timeRangeDays });
        return 0;
      }
      
      const result = FinancialCalc.divide(expenses, timeRangeDays);
      return result ? FinancialCalc.toNumber(result) : 0;
    } catch (error) {
      logError('Error calculating daily burn rate', error, { expenses, timeRangeDays });
      return 0;
    }
  }

  /**
   * Format currency with proper locale and currency code
   */
  static formatCurrencyWithCode(
    amount: number | string | Decimal, 
    currencyCode: string = 'GBP',
    options?: {
      minimumFractionDigits?: number;
      maximumFractionDigits?: number;
    }
  ): string {
    const locale = currencyCode === 'USD' ? 'en-US' : 'en-GB';
    const numericValue = amount instanceof Decimal ? amount.toNumber() : FinancialCalc.toNumber(amount);
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2
    }).format(numericValue);
  }

  /**
   * Calculate time range in days based on period string
   */
  static getTimeRangeDays(timeRange: string): number {
    switch (timeRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '365d':
      case 'year': return 365;
      default: return 30;
    }
  }

  /**
   * Calculate Quick Ratio (Acid Test Ratio)
   * Quick Ratio = (Current Assets - Inventory) / Current Liabilities
   * Measures ability to pay short-term obligations with liquid assets only
   * @returns Quick ratio or null if division by zero
   */
  static calculateQuickRatio(
    currentAssets: number | string | null | undefined,
    inventory: number | string | null | undefined,
    currentLiabilities: number | string | null | undefined
  ): number | null {
    try {
      const liabilities = FinancialCalc.decimal(currentLiabilities);
      if (liabilities.isZero()) {
        logError('Cannot calculate quick ratio: current liabilities is zero', null, { currentAssets, inventory, currentLiabilities });
        return null;
      }
      
      const assets = FinancialCalc.decimal(currentAssets);
      const inv = FinancialCalc.decimal(inventory);
      const liquidAssets = assets.minus(inv);
      
      const result = FinancialCalc.divide(liquidAssets.toString(), liabilities.toString());
      return result ? FinancialCalc.toNumber(result) : null;
    } catch (error) {
      logError('Error calculating quick ratio', error, { currentAssets, inventory, currentLiabilities });
      return null;
    }
  }

  /**
   * Parse and compare dates safely
   */
  static isDateInRange(
    dateString: string,
    startDate?: string,
    endDate?: string
  ): boolean {
    try {
      const date = new Date(dateString);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (date < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }
}

// Export convenience functions
export const {
  decimal,
  add,
  subtract,
  multiply,
  divide,
  percentage,
  toCurrency,
  round,
  toNumber,
  compare,
  isGreaterThan,
  isLessThan,
  isEqual,
  calculateTax,
  calculateDiscount,
  sum,
  average,
  formatCurrency,
  parseCurrency,
  calculateHealthScore,
  calculateDailyBurnRate,
  formatCurrencyWithCode,
  getTimeRangeDays,
  calculateQuickRatio,
  isDateInRange
} = FinancialCalc;