import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
// 2 decimal places for currency, rounding mode for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Utility class for precise financial calculations
 * All monetary values should go through this class to avoid floating point errors
 */
export class Money {
  private value: Decimal;

  constructor(value: string | number | Decimal) {
    this.value = new Decimal(value);
  }

  /**
   * Add monetary values
   */
  add(other: string | number | Decimal | Money): Money {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return new Money(this.value.plus(otherValue));
  }

  /**
   * Subtract monetary values
   */
  subtract(other: string | number | Decimal | Money): Money {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return new Money(this.value.minus(otherValue));
  }

  /**
   * Multiply monetary value
   */
  multiply(other: string | number | Decimal): Money {
    return new Money(this.value.times(other));
  }

  /**
   * Divide monetary value
   */
  divide(other: string | number | Decimal): Money {
    return new Money(this.value.dividedBy(other));
  }

  /**
   * Round to currency precision (2 decimal places)
   */
  round(): Money {
    return new Money(this.value.toFixed(2));
  }

  /**
   * Check if value equals another
   */
  equals(other: string | number | Decimal | Money): boolean {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return this.value.equals(otherValue);
  }

  /**
   * Check if value is greater than another
   */
  greaterThan(other: string | number | Decimal | Money): boolean {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return this.value.greaterThan(otherValue);
  }

  /**
   * Check if value is less than another
   */
  lessThan(other: string | number | Decimal | Money): boolean {
    const otherValue = other instanceof Money ? other.value : new Decimal(other);
    return this.value.lessThan(otherValue);
  }

  /**
   * Check if value is zero
   */
  isZero(): boolean {
    return this.value.isZero();
  }

  /**
   * Check if value is positive
   */
  isPositive(): boolean {
    return this.value.isPositive();
  }

  /**
   * Check if value is negative
   */
  isNegative(): boolean {
    return this.value.isNegative();
  }

  /**
   * Get absolute value
   */
  abs(): Money {
    return new Money(this.value.abs());
  }

  /**
   * Convert to number (use sparingly, mainly for display)
   */
  toNumber(): number {
    return this.value.toNumber();
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
  format(currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(this.toNumber());
  }

  /**
   * Convert to Decimal for Prisma
   */
  toDecimal(): Decimal {
    return this.value;
  }

  /**
   * Create Money from database Decimal type
   */
  static fromPrismaDecimal(value: any): Money {
    // Prisma returns Decimal as object with special properties
    if (value && typeof value === 'object' && value.constructor.name === 'Decimal') {
      return new Money(value.toString());
    }
    return new Money(value);
  }

  /**
   * Calculate percentage
   */
  percentage(percent: string | number | Decimal): Money {
    return new Money(this.value.times(percent).dividedBy(100));
  }

  /**
   * Calculate sum of array of values
   */
  static sum(values: Array<string | number | Decimal | Money>): Money {
    return values.reduce((acc, val) => {
      const money = val instanceof Money ? val : new Money(val);
      return acc.add(money);
    }, new Money(0));
  }

  /**
   * Get minimum value
   */
  static min(...values: Array<string | number | Decimal | Money>): Money {
    const moneyValues = values.map(v => v instanceof Money ? v : new Money(v));
    return moneyValues.reduce((min, val) => val.lessThan(min) ? val : min);
  }

  /**
   * Get maximum value
   */
  static max(...values: Array<string | number | Decimal | Money>): Money {
    const moneyValues = values.map(v => v instanceof Money ? v : new Money(v));
    return moneyValues.reduce((max, val) => val.greaterThan(max) ? val : max);
  }
}

/**
 * Helper function to safely parse monetary values from strings
 */
export function parseMoney(value: string | number | null | undefined): Money {
  if (value === null || value === undefined || value === '') {
    return new Money(0);
  }
  
  // Remove currency symbols and commas if string
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '').trim();
    return new Money(cleaned || '0');
  }
  
  return new Money(value);
}

/**
 * Helper to calculate invoice line item totals
 */
export function calculateLineItemTotal(quantity: string | number, unitRate: string | number): Money {
  const qty = new Money(quantity);
  const rate = new Money(unitRate);
  return qty.multiply(rate).round();
}

/**
 * Helper to calculate reconciliation difference
 */
export function calculateReconciliationDifference(
  invoicedAmount: string | number | Decimal,
  expectedAmount: string | number | Decimal
): {
  difference: Money;
  status: 'match' | 'overbilled' | 'underbilled';
} {
  const invoiced = new Money(invoicedAmount);
  const expected = new Money(expectedAmount);
  const difference = invoiced.subtract(expected);
  
  // Use a small threshold for matching (1 cent)
  const threshold = new Money('0.01');
  
  let status: 'match' | 'overbilled' | 'underbilled';
  if (difference.abs().lessThan(threshold) || difference.abs().equals(threshold)) {
    status = 'match';
  } else if (difference.isPositive()) {
    status = 'overbilled';
  } else {
    status = 'underbilled';
  }
  
  return { difference, status };
}