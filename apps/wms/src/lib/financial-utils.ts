/**
 * Utility class for precise financial calculations
 * All monetary values should go through this class to avoid floating point errors
 */
export class Money {
  private value: number;

  constructor(value: string | number | { toNumber(): number } | unknown) {
    // Handle Prisma Decimal objects
    if (value && typeof value === 'object' && 'toNumber' in value) {
      this.value = value.toNumber();
    } else if (typeof value === 'string') {
      this.value = parseFloat(value);
    } else {
      this.value = Number(value);
    }
  }

  /**
   * Add monetary values
   */
  add(other: string | number | Money | unknown): Money {
    const otherValue = other instanceof Money ? other.value : new Money(other).value;
    return new Money(this.value + otherValue);
  }

  /**
   * Subtract monetary values
   */
  subtract(other: string | number | Money | unknown): Money {
    const otherValue = other instanceof Money ? other.value : new Money(other).value;
    return new Money(this.value - otherValue);
  }

  /**
   * Multiply monetary value
   */
  multiply(other: string | number): Money {
    return new Money(this.value * Number(other));
  }

  /**
   * Divide monetary value
   */
  divide(other: string | number): Money {
    return new Money(this.value / Number(other));
  }

  /**
   * Round to currency precision (2 decimal places)
   */
  round(): Money {
    return new Money(Math.round(this.value * 100) / 100);
  }

  /**
   * Check if value equals another
   */
  equals(other: string | number | Money | unknown): boolean {
    const otherValue = other instanceof Money ? other.value : new Money(other).value;
    return Math.abs(this.value - otherValue) < 0.001;
  }

  /**
   * Check if value is greater than another
   */
  greaterThan(other: string | number | Money | unknown): boolean {
    const otherValue = other instanceof Money ? other.value : new Money(other).value;
    return this.value > otherValue;
  }

  /**
   * Check if value is less than another
   */
  lessThan(other: string | number | Money | unknown): boolean {
    const otherValue = other instanceof Money ? other.value : new Money(other).value;
    return this.value < otherValue;
  }

  /**
   * Check if value is zero
   */
  isZero(): boolean {
    return Math.abs(this.value) < 0.001;
  }

  /**
   * Check if value is positive
   */
  isPositive(): boolean {
    return this.value > 0;
  }

  /**
   * Check if value is negative
   */
  isNegative(): boolean {
    return this.value < 0;
  }

  /**
   * Get absolute value
   */
  abs(): Money {
    return new Money(Math.abs(this.value));
  }

  /**
   * Convert to number (use sparingly, mainly for display)
   */
  toNumber(): number {
    return this.value;
  }

  /**
   * Convert to string with fixed decimal places
   */
  toString(): string {
    return this.value.toFixed(2);
  }

  /**
   * Convert to formatted currency string
   */
  format(currency: string = 'GBP'): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(this.value);
  }

  /**
   * Convert to Decimal for Prisma
   */
  toDecimal(): number {
    return this.value;
  }

  /**
   * Create Money from database Decimal type
   */
  static fromPrismaDecimal(value: { toNumber(): number } | unknown): Money {
    return new Money(value);
  }

  /**
   * Calculate percentage
   */
  percentage(percent: string | number): Money {
    return new Money(this.value * Number(percent) / 100);
  }

  /**
   * Calculate VAT amount
   */
  calculateVAT(vatRate: number = 20): Money {
    return this.percentage(vatRate);
  }

  /**
   * Add VAT to amount
   */
  addVAT(vatRate: number = 20): Money {
    return this.add(this.calculateVAT(vatRate));
  }

  /**
   * Remove VAT from gross amount
   */
  removeVAT(vatRate: number = 20): Money {
    return new Money(this.value / (1 + vatRate / 100));
  }

  /**
   * Calculate discounted amount
   */
  discount(discountPercent: string | number): Money {
    const discountAmount = this.percentage(discountPercent);
    return this.subtract(discountAmount);
  }

  /**
   * Split amount into equal parts
   */
  split(parts: number): Money[] {
    if (parts <= 0) throw new Error('Parts must be greater than 0');
    
    const baseAmount = Math.floor(this.value * 100 / parts) / 100;
    const remainder = this.value - (baseAmount * parts);
    
    const splits: Money[] = [];
    for (let i = 0; i < parts; i++) {
      if (i === 0) {
        splits.push(new Money(baseAmount + remainder));
      } else {
        splits.push(new Money(baseAmount));
      }
    }
    
    return splits;
  }

  /**
   * Compare two monetary values
   */
  compareTo(other: string | number | Money | unknown): number {
    const otherValue = other instanceof Money ? other.value : new Money(other).value;
    if (this.value < otherValue) return -1;
    if (this.value > otherValue) return 1;
    return 0;
  }

  /**
   * Get minimum of monetary values
   */
  static min(...values: (string | number | Money | unknown)[]): Money {
    const moneyValues = values.map(v => v instanceof Money ? v : new Money(v));
    return moneyValues.reduce((min, current) => 
      current.lessThan(min) ? current : min
    );
  }

  /**
   * Get maximum of monetary values
   */
  static max(...values: (string | number | Money | unknown)[]): Money {
    const moneyValues = values.map(v => v instanceof Money ? v : new Money(v));
    return moneyValues.reduce((max, current) => 
      current.greaterThan(max) ? current : max
    );
  }

  /**
   * Sum array of monetary values
   */
  static sum(values: (string | number | Money | unknown)[]): Money {
    return values.reduce((sum, current) => {
      const money = current instanceof Money ? current : new Money(current);
      return sum.add(money);
    }, new Money(0));
  }

  /**
   * Calculate average of monetary values
   */
  static average(values: (string | number | Money | unknown)[]): Money {
    if (values.length === 0) return new Money(0);
    return Money.sum(values).divide(values.length);
  }
}

/**
 * Financial calculation utilities
 */
export class FinancialCalculator {
  /**
   * Calculate compound interest
   */
  static compoundInterest(
    principal: Money,
    rate: number,
    periods: number,
    compoundingFrequency: number = 1
  ): Money {
    const r = rate / 100 / compoundingFrequency;
    const n = compoundingFrequency * periods;
    const amount = principal.toNumber() * Math.pow(1 + r, n);
    return new Money(amount);
  }

  /**
   * Calculate simple interest
   */
  static simpleInterest(
    principal: Money,
    rate: number,
    periods: number
  ): Money {
    const interest = principal.multiply(rate / 100).multiply(periods);
    return principal.add(interest);
  }

  /**
   * Calculate payment for annuity
   */
  static annuityPayment(
    presentValue: Money,
    rate: number,
    periods: number
  ): Money {
    const r = rate / 100 / 12; // Monthly rate
    const n = periods * 12; // Total months
    
    if (r === 0) {
      return presentValue.divide(n);
    }
    
    const payment = presentValue.toNumber() * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return new Money(payment);
  }

  /**
   * Calculate net present value
   */
  static npv(cashFlows: Money[], discountRate: number): Money {
    const rate = discountRate / 100;
    let npv = 0;
    
    cashFlows.forEach((cashFlow, period) => {
      npv += cashFlow.toNumber() / Math.pow(1 + rate, period);
    });
    
    return new Money(npv);
  }

  /**
   * Calculate days between dates for interest calculations
   */
  static daysBetween(startDate: Date, endDate: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);
  }

  /**
   * Calculate pro-rata amount for partial periods
   */
  static proRata(
    fullAmount: Money,
    actualDays: number,
    totalDays: number = 365
  ): Money {
    return fullAmount.multiply(actualDays).divide(totalDays);
  }
}

/**
 * Parse money value from various inputs
 */
export function parseMoney(value: string | number | unknown): Money {
  if (typeof value === 'string') {
    // Remove currency symbols and commas
    const cleanValue = value.replace(/[£$€,]/g, '').trim();
    return new Money(cleanValue);
  }
  return new Money(value);
}

/**
 * Calculate reconciliation difference and status
 */
export function calculateReconciliationDifference(
  invoicedAmount: number | string | Money,
  expectedAmount: number | string | Money
): { difference: number; status: 'match' | 'underbilled' | 'overbilled' } {
  const invoiced = invoicedAmount instanceof Money ? invoicedAmount : new Money(invoicedAmount);
  const expected = expectedAmount instanceof Money ? expectedAmount : new Money(expectedAmount);
  
  const difference = invoiced.subtract(expected);
  const tolerance = 0.01; // 1 cent tolerance
  
  let status: 'match' | 'underbilled' | 'overbilled';
  if (Math.abs(difference.toNumber()) <= tolerance) {
    status = 'match';
  } else if (difference.toNumber() > 0) {
    status = 'overbilled';
  } else {
    status = 'underbilled';
  }
  
  return {
    difference: difference.toNumber(),
    status
  };
}

/**
 * Currency conversion utilities
 */
export class CurrencyConverter {
  private rates: Map<string, number>;

  constructor(_baseCurrency: string = 'GBP') {
    this.rates = new Map([
      ['GBP', 1],
      ['USD', 1.27],
      ['EUR', 1.17],
      // Add more rates as needed
    ]);
  }

  /**
   * Convert between currencies
   */
  convert(
    amount: Money,
    fromCurrency: string,
    toCurrency: string
  ): Money {
    const fromRate = this.rates.get(fromCurrency) || 1;
    const toRate = this.rates.get(toCurrency) || 1;
    
    // Convert to base currency then to target
    const inBase = amount.divide(fromRate);
    return inBase.multiply(toRate);
  }

  /**
   * Update exchange rate
   */
  setRate(currency: string, rate: number): void {
    this.rates.set(currency, rate);
  }

  /**
   * Get exchange rate
   */
  getRate(currency: string): number {
    return this.rates.get(currency) || 1;
  }
}