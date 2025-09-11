export class Decimal {
  private value: number;

  constructor(value: number | string) {
    this.value = typeof value === 'string' ? parseFloat(value) : value;
  }

  toNumber(): number {
    return this.value;
  }

  // Add other methods if they are used in the code and need to be mocked
  // For example, if you use .plus(), .minus(), etc.
  plus(other: Decimal | number): Decimal {
    const otherValue = other instanceof Decimal ? other.value : other;
    return new Decimal(this.value + otherValue);
  }

  minus(other: Decimal | number): Decimal {
    const otherValue = other instanceof Decimal ? other.value : other;
    return new Decimal(this.value - otherValue);
  }

  times(other: Decimal | number): Decimal {
    const otherValue = other instanceof Decimal ? other.value : other;
    return new Decimal(this.value * otherValue);
  }

  dividedBy(other: Decimal | number): Decimal {
    const otherValue = other instanceof Decimal ? other.value : other;
    if (otherValue === 0) {
      throw new Error("Division by zero");
    }
    return new Decimal(this.value / otherValue);
  }

  // Add a mock for the ._is  property if it's being accessed
  get _isBigNumber() {
    return true;
  }
}
