import Decimal from 'decimal.js';

type DecimalValue = InstanceType<typeof Decimal>;

// Configure Decimal for financial calculations
Decimal.config({ 
  precision: 10,
  rounding: Decimal.ROUND_HALF_UP
});

export class Money {
  private amount: DecimalValue;
  private currency: string;

  constructor(amount: number | string | DecimalValue, currency: string = 'USD') {
    this.amount = new Decimal(amount);
    this.currency = currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.getCurrency()) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount.plus(other.getAmount()), this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.getCurrency()) {
      throw new Error('Cannot subtract different currencies');
    }
    return new Money(this.amount.minus(other.getAmount()), this.currency);
  }

  multiply(factor: number | string | DecimalValue): Money {
    return new Money(this.amount.times(factor), this.currency);
  }

  divide(divisor: number | string | DecimalValue): Money {
    if (new Decimal(divisor).isZero()) {
      throw new Error('Division by zero');
    }
    return new Money(this.amount.dividedBy(divisor), this.currency);
  }

  round(decimals: number = 2): Money {
    const rounded = this.amount.toDecimalPlaces(decimals);
    return new Money(rounded, this.currency);
  }

  toNumber(): number {
    return this.amount.toNumber();
  }

  toString(): string {
    return this.amount.toFixed(2);
  }

  getCurrency(): string {
    return this.currency;
  }

  getAmount(): DecimalValue {
    return this.amount;
  }

  isPositive(): boolean {
    return this.amount.greaterThan(0);
  }

  isNegative(): boolean {
    return this.amount.lessThan(0);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  equals(other: Money): boolean {
    return this.currency === other.getCurrency() && this.amount.equals(other.getAmount());
  }

  static fromCents(cents: number, currency: string = 'USD'): Money {
    return new Money(new Decimal(cents).dividedBy(100), currency);
  }

  toCents(): number {
    return this.amount.times(100).round().toNumber();
  }

  format(locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency
    }).format(this.toNumber());
  }
}

export function calculateStorageCost(
  palletCount: number,
  ratePerPallet: number,
  palletConfig: number
): Money {
  // Validate inputs
  if (palletConfig <= 0) {
    throw new Error('Pallet configuration must be greater than 0');
  }

  const totalCost = new Money(palletCount).multiply(ratePerPallet);
  
  if (palletConfig === 0) {
    return new Money(0);
  }

  return totalCost.divide(palletConfig);
}

export function calculateProRatedAmount(
  monthlyRate: Money,
  startDate: Date,
  endDate: Date
): Money {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Ensure dates are in correct order
  if (start > end) {
    throw new Error('Start date must be before end date');
  }

  // Get actual days in the billing month
  const year = start.getFullYear();
  const month = start.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Calculate billable days
  const billableDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Calculate pro-rated amount
  const dailyRate = monthlyRate.divide(daysInMonth);
  return dailyRate.multiply(billableDays);
}

export function handleTimezoneForBilling(date: Date, _timezone: string = 'UTC'): Date {
  // Convert to UTC for consistent billing
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return utcDate;
}

export function calculateTax(
  subtotal: Money,
  taxRate: number,
  inclusive: boolean = false
): { tax: Money; total: Money } {
  const rate = new Decimal(taxRate);
  
  if (inclusive) {
    // Extract tax from inclusive amount
    const divisor = new Decimal(1).plus(rate);
    const netAmount = subtotal.divide(divisor);
    const tax = subtotal.subtract(netAmount);
    return { tax, total: subtotal };
  } else {
    // Add tax to exclusive amount
    const tax = subtotal.multiply(rate);
    const total = subtotal.add(tax);
    return { tax, total };
  }
}

export function sumMoney(amounts: Money[]): Money {
  if (amounts.length === 0) {
    return new Money(0);
  }

  const currency = amounts[0].getCurrency();
  return amounts.reduce((sum, amount) => sum.add(amount), new Money(0, currency));
}

export function formatMoney(amount: Money, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: amount.getCurrency()
  }).format(amount.toNumber());
}

export function validatePositiveAmount(amount: unknown): boolean {
  try {
    const money = new Money(amount);
    return money.isPositive();
  } catch {
    return false;
  }
}

// Audit trail for financial calculations
export interface FinancialCalculationAudit {
  calculationType: string;
  inputs: Record<string, unknown>;
  result: unknown;
  formula: string;
  calculatedBy: string;
  calculatedAt: Date;
  metadata?: Record<string, unknown>;
}

export function createAuditEntry(
  type: string,
  inputs: Record<string, unknown>,
  result: unknown,
  formula: string,
  userId: string
): FinancialCalculationAudit {
  return {
    calculationType: type,
    inputs,
    result,
    formula,
    calculatedBy: userId,
    calculatedAt: new Date(),
    metadata: {
      version: '1.0',
      precision: Decimal.precision
    }
  };
}

// Export MoneyCalculator as an alias for Money class for backward compatibility
export const MoneyCalculator = Money;