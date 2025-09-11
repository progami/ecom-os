// src/__tests__/testUtils.ts

import { Assumptions, ProductMargin, MonthlyData, YearlyData } from '../types/financial';
// Mock Decimal for testing purposes
class MockDecimal {
  value: number;
  constructor(value: number) {
    this.value = value;
  }
  toNumber(): number {
    return this.value;
  }
}
const Decimal = MockDecimal;

/**
 * Create test assumptions with specified overrides
 */
export function createTestAssumptions(overrides: Partial<Assumptions> = {}): Assumptions {
  const defaults: Assumptions = {
    modelStartDate: '2024-01-01',
    baseMonthlySalesUnits: 10000,
    annualGrowthRateY1: 0.5,
    annualGrowthRateY2: 0.5,
    annualGrowthRateY3: 0.5,
    annualGrowthRateY4: 0.5,
    annualGrowthRateY5: 0.25,
    ecommerceChannelMixY1: 1.0,
    ecommerceChannelMixY2: 0.9,
    ecommerceChannelMixY3: 0.8,
    ecommerceChannelMixY4: 0.7,
    ecommerceChannelMixY5: 0.6,
    productSalesMix: [
      { sku: 'TEST-001', percentage: 0.5, monthlyUnits: 5000 },
      { sku: 'TEST-002', percentage: 0.3, monthlyUnits: 3000 },
      { sku: 'TEST-003', percentage: 0.2, monthlyUnits: 2000 }
    ],
    launchPhaseVelocity: 0.3,
    growthPhaseVelocity: 0.6,
    maturityPhaseVelocity: 1.0,
    amazonReferralFeeRate: 0.15,
    fulfillmentFeeRate: 0.20,
    refundReturnRate: 0.05,
    targetMonthsOfSupply: 3,
    leadTimeDays: 45,
    tariffRate: 0.25,
    lclShipmentCost: 5000,
    supplierPaymentTerms: [
      { percentage: 0.3, daysAfterPO: 0 },
      { percentage: 0.7, daysAfterPO: 30 }
    ],
    ownerSalary: 8333.33,
    managerSalaryFT: 4000,
    associateSalaryPT: 1100,
    ppcAdvertisingRate: 0.08,
    officeRentMonthly: 2500,
    utilitiesMonthly: 300,
    quickbooksMonthly: 70,
    googleWorkspaceMonthly: 30,
    claudeAiMonthly: 20,
    liabilityInsuranceAnnual: 2400,
    accountingFeesMonthly: 500,
    officeSuppliesMonthly: 200,
    grsRegistration: 5000,
    payrollTaxRate: 0.153,
    corporateTaxRate: 0.21,
    trademarkCost: 2500,
    trademarkDate: '2024-02-01',
    initialInvestment: 250000,
    investmentUseCash: 73258.54,
    investmentUseInventory: 121741.46,
    investmentUseSetup: 25000,
    investmentUseMarketing: 30000
  };
  
  return { ...defaults, ...overrides };
}

/**
 * Create test product margins
 */
export function createTestProductMargins(): ProductMargin[] {
  return [
    {
      sku: 'TEST-001',
      name: 'Test Product 1',
      retailPrice: 20.00,
      manufacturing: 4.00,
      freight: 0.50,
      thirdPLStorage: 0.50,
      amazonReferralFee: 3.00,
      fbaFee: 4.00,
      refundAllowance: 0.20,
      group: 1,
      country: 'US',
      packSize: 1,
      micron: 100,
      dimensions: '10x10x10',
      density: 1,
      weight: 1,
      weightOz: 16,
      weightLb: 1,
      cbmPerUnit: 0.001,
      sizeTier: 'Small',
      tariffRate: 25,
      fobCost: 4.00,
      landedCost: 5.50,
      totalCogs: 12.50,
      grossMargin: 0.375,
      grossMarginPercentage: 37.5
    },
    {
      sku: 'TEST-002',
      name: 'Test Product 2',
      retailPrice: 15.00,
      manufacturing: 3.00,
      freight: 0.40,
      thirdPLStorage: 0.40,
      amazonReferralFee: 2.25,
      fbaFee: 3.50,
      refundAllowance: 0.15,
      group: 1,
      country: 'US',
      packSize: 1,
      micron: 100,
      dimensions: '8x8x8',
      density: 1,
      weight: 0.8,
      weightOz: 12.8,
      weightLb: 0.8,
      cbmPerUnit: 0.0008,
      sizeTier: 'Small',
      tariffRate: 25,
      fobCost: 3.00,
      landedCost: 4.15,
      totalCogs: 9.90,
      grossMargin: 0.34,
      grossMarginPercentage: 34
    },
    {
      sku: 'TEST-003',
      name: 'Test Product 3',
      retailPrice: 25.00,
      manufacturing: 5.00,
      freight: 0.60,
      thirdPLStorage: 0.60,
      amazonReferralFee: 3.75,
      fbaFee: 4.50,
      refundAllowance: 0.25,
      group: 1,
      country: 'US',
      packSize: 1,
      micron: 100,
      dimensions: '12x12x12',
      density: 1,
      weight: 1.2,
      weightOz: 19.2,
      weightLb: 1.2,
      cbmPerUnit: 0.0012,
      sizeTier: 'Medium',
      tariffRate: 25,
      fobCost: 5.00,
      landedCost: 6.85,
      totalCogs: 15.10,
      grossMargin: 0.396,
      grossMarginPercentage: 39.6
    }
  ];
}

/**
 * Validate monthly data consistency
 */
export function validateMonthlyData(monthlyData: MonthlyData[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  monthlyData.forEach((month, index) => {
    // Check revenue calculations
    const calculatedRevenue = month.ecommerceRevenue + month.retailRevenue;
    if (Math.abs(calculatedRevenue - month.totalRevenue) > 0.01) {
      errors.push(`Month ${index + 1}: Revenue mismatch`);
    }
    
    // Check COGS calculations
    const calculatedCogs = month.ecommerceCogs + month.retailCogs;
    if (Math.abs(calculatedCogs - month.totalCogs) > 0.01) {
      errors.push(`Month ${index + 1}: COGS mismatch`);
    }
    
    // Check gross profit
    const calculatedGrossProfit = month.totalRevenue - month.totalCogs;
    if (Math.abs(calculatedGrossProfit - month.grossProfit) > 0.01) {
      errors.push(`Month ${index + 1}: Gross profit mismatch`);
    }
    
    // Check margin calculation
    if (month.totalRevenue > 0) {
      const calculatedMargin = month.grossProfit / month.totalRevenue;
      if (Math.abs(calculatedMargin - month.grossMargin) > 0.0001) {
        errors.push(`Month ${index + 1}: Gross margin mismatch`);
      }
    }
    
    // Check balance sheet equation
    const assets = month.totalAssets;
    const liabilitiesEquity = month.totalLiabilities + month.totalEquity;
    // Allow for up to $10 tolerance due to initial inventory allocation rounding
    const tolerance = Math.max(10.00, assets * 0.0001); // $10 or 0.01% of assets, whichever is larger
    if (Math.abs(assets - liabilitiesEquity) > tolerance) {
      errors.push(`Month ${index + 1}: Balance sheet doesn't balance - Assets: ${assets.toFixed(2)}, L+E: ${liabilitiesEquity.toFixed(2)}, Diff: ${(assets - liabilitiesEquity).toFixed(2)}`);
    }
    
    // Check for NaN or undefined values
    Object.entries(month).forEach(([key, value]) => {
      if (typeof value === 'number' && isNaN(value)) {
        errors.push(`Month ${index + 1}: ${key} is NaN`);
      }
    });
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate yearly data consistency
 */
export function validateYearlyData(
  yearlyData: YearlyData[], 
  monthlyData: MonthlyData[]
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  yearlyData.forEach((year, yearIndex) => {
    const yearMonths = monthlyData.filter(m => m.yearInModel === yearIndex + 1);
    
    // Check revenue summation
    const summedRevenue = yearMonths.reduce((sum, m) => sum + m.totalRevenue, 0);
    if (Math.abs(summedRevenue - year.totalRevenue) > 0.01) {
      errors.push(`Year ${yearIndex + 1}: Revenue summation mismatch`);
    }
    
    // Check COGS summation
    const summedCogs = yearMonths.reduce((sum, m) => sum + m.totalCogs, 0);
    if (Math.abs(summedCogs - year.totalCogs) > 0.01) {
      errors.push(`Year ${yearIndex + 1}: COGS summation mismatch`);
    }
    
    // Check net income summation
    const summedNetIncome = yearMonths.reduce((sum, m) => sum + m.netIncome, 0);
    if (Math.abs(summedNetIncome - year.netIncome) > 0.01) {
      errors.push(`Year ${yearIndex + 1}: Net income summation mismatch`);
    }
    
    // Check operating cash flow summation
    const summedOpCF = yearMonths.reduce((sum, m) => sum + m.cashFromOperations, 0);
    if (Math.abs(summedOpCF - year.operatingCashFlow) > 0.01) {
      errors.push(`Year ${yearIndex + 1}: Operating CF summation mismatch`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate financial metrics summary
 */
export function generateMetricsSummary(yearlyData: YearlyData[]): {
  cagr: number;
  avgGrossMargin: number;
  avgNetMargin: number;
  totalCashGenerated: number;
  peakCashNeed: number;
  breakevenYear: number | null;
} {
  const startRevenue = yearlyData[0].totalRevenue;
  const endRevenue = yearlyData[yearlyData.length - 1].totalRevenue;
  const years = yearlyData.length;
  
  // Calculate CAGR
  const cagr = Math.pow(endRevenue / startRevenue, 1 / (years - 1)) - 1;
  
  // Calculate average margins
  const avgGrossMargin = yearlyData.reduce((sum, y) => sum + y.grossMargin, 0) / years;
  const avgNetMargin = yearlyData.reduce((sum, y) => sum + y.netMargin, 0) / years;
  
  // Calculate total cash generated
  const totalCashGenerated = yearlyData.reduce((sum, y) => sum + y.operatingCashFlow, 0);
  
  // Find peak cash need (most negative cumulative cash flow)
  let cumulativeCF = 0;
  let peakCashNeed = 0;
  yearlyData.forEach(year => {
    cumulativeCF += year.operatingCashFlow;
    if (cumulativeCF < peakCashNeed) {
      peakCashNeed = cumulativeCF;
    }
  });
  
  // Find breakeven year
  let breakevenYear: number | null = null;
  for (let i = 0; i < yearlyData.length; i++) {
    if (yearlyData[i].netIncome > 0) {
      breakevenYear = i + 1;
      break;
    }
  }
  
  return {
    cagr,
    avgGrossMargin,
    avgNetMargin,
    totalCashGenerated,
    peakCashNeed: Math.abs(peakCashNeed),
    breakevenYear
  };
}

/**
 * Compare two forecasts and return differences
 */
export function compareForecasts(
  forecast1: { yearlyData: YearlyData[] },
  forecast2: { yearlyData: YearlyData[] }
): {
  revenueVariance: number[];
  profitVariance: number[];
  cashVariance: number[];
} {
  const revenueVariance: number[] = [];
  const profitVariance: number[] = [];
  const cashVariance: number[] = [];
  
  const minYears = Math.min(forecast1.yearlyData.length, forecast2.yearlyData.length);
  
  for (let i = 0; i < minYears; i++) {
    const year1 = forecast1.yearlyData[i];
    const year2 = forecast2.yearlyData[i];
    
    revenueVariance.push((year2.totalRevenue - year1.totalRevenue) / year1.totalRevenue);
    profitVariance.push(year2.netIncome - year1.netIncome);
    cashVariance.push(year2.endingCash - year1.endingCash);
  }
  
  return {
    revenueVariance,
    profitVariance,
    cashVariance
  };
}

/**
 * Create a mock Decimal value for testing
 */
export function mockDecimal(value: number): MockDecimal {
  return new MockDecimal(value);
}

/**
 * Create mock product with Decimal fields
 */
export function createMockProduct(overrides: any = {}) {
  return {
    id: 'test-id',
    sku: 'TEST-001',
    name: 'Test Product',
    description: 'Test Description',
    category: 'test-category',
    status: 'active',
    unitCost: mockDecimal(10),
    packagingCost: mockDecimal(1),
    laborCost: mockDecimal(2),
    overheadCost: mockDecimal(3),
    totalCost: mockDecimal(16),
    retailPrice: mockDecimal(25),
    wholesalePrice: mockDecimal(20),
    amazonPrice: mockDecimal(30),
    currentStock: 100,
    reorderPoint: 50,
    reorderQuantity: 200,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    cbmPerUnit: mockDecimal(0.1),
    country: 'US',
    density: mockDecimal(1.5),
    dimensions: '10x10x10',
    fbaFee: mockDecimal(5),
    freightCost: mockDecimal(2),
    manufacturingCost: mockDecimal(8),
    micron: mockDecimal(100),
    packSize: 1,
    sizeTier: 'standard',
    tariffRate: mockDecimal(0.25),
    warehouseCost: mockDecimal(1),
    weight: mockDecimal(1),
    weightLb: mockDecimal(2.2),
    weightOz: mockDecimal(35.2),
    thickness: '5mm',
    group: 1,
    ...overrides
  };
}

/**
 * Create mock GL entry with Decimal fields
 */
export function createMockGLEntry(overrides: any = {}) {
  return {
    id: 'test-gl-id',
    date: new Date(),
    account: 'test-account',
    accountCategory: 'Revenue',
    description: 'Test GL Entry',
    debit: mockDecimal(100),
    credit: mockDecimal(0),
    reference: 'test-ref',
    source: 'manual',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    periodId: null,
    ...overrides
  };
}

/**
 * Create mock expense with Decimal fields
 */
export function createMockExpense(overrides: any = {}) {
  return {
    id: 'test-expense-id',
    date: new Date(),
    weekStarting: new Date(),
    category: 'Operating Expenses',
    subcategory: 'Marketing',
    description: 'Test Expense',
    amount: mockDecimal(500),
    type: 'manual',
    vendor: 'Test Vendor',
    invoiceNumber: null,
    metadata: {},
    isRecurring: false,
    recurringFreq: null,
    isActual: false,
    bankTransactionId: null,
    originalForecast: null,
    reconciledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

/**
 * Create mock revenue with Decimal fields
 */
export function createMockRevenue(overrides: any = {}) {
  return {
    id: 'test-revenue-id',
    weekStarting: new Date(),
    weekEnding: new Date(),
    category: 'Amazon Sales',
    subcategory: 'FBA',
    amount: mockDecimal(1000),
    units: 100,
    orderCount: 10,
    metadata: {},
    isActual: false,
    bankTransactionId: null,
    originalForecast: null,
    reconciledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}