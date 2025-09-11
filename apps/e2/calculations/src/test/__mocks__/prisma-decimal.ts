class MockDecimal {
  value: number;
  constructor(value: number) {
    this.value = value;
  }
  toNumber(): number {
    return this.value;
  }
}

export const Decimal = MockDecimal;