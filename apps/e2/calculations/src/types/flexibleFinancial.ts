// src/types/flexibleFinancial.ts

// Enums for flexibility and type safety
export enum ExpenseCategory {
  // Operating Expenses
  PAYROLL = 'payroll',
  RENT = 'rent',
  UTILITIES = 'utilities',
  SOFTWARE = 'software',
  INSURANCE = 'insurance',
  MARKETING = 'marketing',
  ADVERTISING = 'advertising',
  PROFESSIONAL_FEES = 'professional_fees',
  OFFICE_SUPPLIES = 'office_supplies',
  TRAVEL = 'travel',
  MAINTENANCE = 'maintenance',
  
  // Cost of Goods Sold
  MATERIALS = 'materials',
  LABOR_DIRECT = 'labor_direct',
  FREIGHT = 'freight',
  TARIFFS = 'tariffs',
  PACKAGING = 'packaging',
  FULFILLMENT = 'fulfillment',
  
  // Capital Expenditures
  EQUIPMENT = 'equipment',
  FURNITURE = 'furniture',
  TECHNOLOGY = 'technology',
  LEASEHOLD_IMPROVEMENTS = 'leasehold_improvements',
  VEHICLES = 'vehicles',
  
  // Other
  TAXES = 'taxes',
  INTEREST = 'interest',
  DEPRECIATION = 'depreciation',
  AMORTIZATION = 'amortization',
  OTHER = 'other'
}

export enum Frequency {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually',
  SEMI_ANNUALLY = 'semi_annually',
  ONE_TIME = 'one_time',
  CUSTOM = 'custom' // For irregular patterns
}

export enum CalculationType {
  FIXED = 'fixed', // Fixed amount
  PERCENT_OF_REVENUE = 'percent_of_revenue',
  PERCENT_OF_UNITS = 'percent_of_units',
  PERCENT_OF_COGS = 'percent_of_cogs',
  PER_UNIT = 'per_unit',
  PER_EMPLOYEE = 'per_employee',
  FORMULA = 'formula', // Custom formula
  TIERED = 'tiered' // Different rates at different levels
}

export enum RevenueType {
  PRODUCT_SALES = 'product_sales',
  SERVICE_REVENUE = 'service_revenue',
  SUBSCRIPTION = 'subscription',
  LICENSING = 'licensing',
  COMMISSION = 'commission',
  OTHER = 'other'
}

// Core Interfaces

export interface ExpenseItem {
  id: string; // Unique identifier
  name: string;
  description?: string;
  category: ExpenseCategory;
  
  // Timing
  startMonth: number; // Month in model (1-60)
  endMonth?: number; // Optional end month for temporary expenses
  frequency: Frequency;
  customFrequency?: number[]; // For CUSTOM frequency: array of months
  
  // Calculation
  calculationType: CalculationType;
  baseAmount?: number; // For FIXED or base amount for other types
  percentage?: number; // For percentage-based calculations
  formula?: string; // For FORMULA type (e.g., "revenue * 0.15 + 1000")
  perUnitRate?: number; // For PER_UNIT calculations
  
  // Tiered pricing
  tiers?: {
    threshold: number;
    rate: number;
  }[];
  
  // Special fields
  isPromotional?: boolean; // For promotional/temporary pricing
  promotionalEndMonth?: number;
  growthRate?: number; // Annual growth rate
  inflationAdjusted?: boolean;
  
  // Tracking
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[]; // For grouping and filtering
  
  // Accounting
  accountCode?: string;
  taxDeductible?: boolean;
  capitalizable?: boolean; // For CapEx items
  depreciationMonths?: number; // For capitalizable items
}

export interface RevenueStream {
  id: string;
  name: string;
  description?: string;
  type: RevenueType;
  
  // Product/Service details
  sku?: string;
  unitPrice?: number;
  
  // Timing
  startMonth: number;
  endMonth?: number;
  
  // Volume/Calculation
  calculationType: CalculationType;
  baseUnits?: number; // For unit-based revenue
  growthRate?: number; // Monthly or annual growth
  seasonalityFactors?: number[]; // 12 monthly factors
  
  // Channel information
  channel?: 'ecommerce' | 'retail' | 'wholesale' | 'direct';
  channelFees?: {
    referralFeeRate?: number;
    fulfillmentFeeRate?: number;
    paymentProcessingRate?: number;
  };
  
  // Customer information
  customerSegment?: string;
  recurringRevenue?: boolean;
  contractLength?: number; // For subscription/contract revenue
  
  // Tracking
  isActive: boolean;
  tags?: string[];
}

export interface CostComponent {
  id: string;
  name: string;
  sku?: string; // Associated product SKU
  
  // Direct costs
  materialCost?: number;
  laborCost?: number;
  overheadAllocation?: number;
  
  // Import/Logistics costs
  fobCost?: number;
  freightCost?: number;
  tariffRate?: number;
  customsFees?: number;
  
  // Other costs
  packagingCost?: number;
  qualityControlCost?: number;
  
  // Calculation method
  calculationType: CalculationType;
  formula?: string;
  
  isActive: boolean;
}

// Templates and Presets

export interface ExpenseTemplate {
  id: string;
  name: string;
  description: string;
  category: ExpenseCategory;
  expenses: Partial<ExpenseItem>[];
  tags?: string[];
}

export interface ExpensePreset {
  id: string;
  name: string;
  description: string;
  businessType: 'ecommerce' | 'saas' | 'retail' | 'manufacturing' | 'service';
  templates: ExpenseTemplate[];
}

// Flexible Assumptions Interface

export interface FlexibleAssumptions {
  // General & Timing
  modelStartDate: string;
  modelEndDate?: string;
  fiscalYearEnd?: string;
  
  // Dynamic Revenue Configuration
  revenueStreams: RevenueStream[];
  
  // Dynamic Expense Configuration
  expenses: ExpenseItem[];
  
  // Dynamic Cost Components
  costComponents: CostComponent[];
  
  // Growth & Scaling
  growthAssumptions: {
    defaultAnnualGrowth: number;
    channelGrowthRates?: {
      [channel: string]: number[];
    };
    productGrowthRates?: {
      [sku: string]: number[];
    };
  };
  
  // Tax Configuration
  taxConfiguration: {
    corporateTaxRate: number;
    payrollTaxRate: number;
    salesTaxRate?: number;
    customTaxes?: {
      name: string;
      rate: number;
      applicableTo: 'revenue' | 'payroll' | 'profit';
    }[];
  };
  
  // Working Capital
  workingCapitalAssumptions: {
    accountsReceivableDays: number;
    accountsPayableDays: number;
    inventoryTurnoverDays: number;
    prepaidExpensesMonths: number;
  };
  
  // Initial Investment
  initialInvestment: {
    totalAmount: number;
    allocation: {
      category: string;
      amount: number;
      description?: string;
    }[];
  };
  
  // Templates in use
  activeTemplates?: string[]; // IDs of expense templates being used
}

// Helper interfaces for calculations

export interface CalculationContext {
  month: number;
  revenue: number;
  units: number;
  cogs: number;
  employees: number;
  customVariables?: { [key: string]: number };
}

export interface ExpenseCalculationResult {
  expenseId: string;
  amount: number;
  calculated: boolean;
  error?: string;
}

// Validation interfaces

export interface FlexibleValidationRule {
  field: string;
  rules: {
    type?: 'number' | 'string' | 'boolean' | 'array';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any, context: FlexibleAssumptions) => boolean;
  };
  message?: string;
}

export interface FlexibleValidationResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }[];
}

// Reporting interfaces

export interface ExpenseReport {
  period: string;
  expenses: {
    category: ExpenseCategory;
    items: {
      name: string;
      amount: number;
      percentage: number; // % of total expenses
    }[];
    subtotal: number;
  }[];
  totalExpenses: number;
  expenseToRevenueRatio: number;
}

export interface FlexibleFinancialStatement {
  // Income Statement
  revenue: {
    streams: {
      id: string;
      name: string;
      amount: number;
    }[];
    total: number;
  };
  
  cogs: {
    components: {
      id: string;
      name: string;
      amount: number;
    }[];
    total: number;
  };
  
  grossProfit: number;
  grossMargin: number;
  
  operatingExpenses: {
    byCategory: {
      category: ExpenseCategory;
      amount: number;
    }[];
    total: number;
  };
  
  ebitda: number;
  depreciation: number;
  amortization: number;
  ebit: number;
  interestExpense: number;
  taxExpense: number;
  netIncome: number;
  
  // Metadata
  period: {
    month?: number;
    year?: number;
    startDate: string;
    endDate: string;
  };
}

// Export functions for expense calculations

export interface ExpenseCalculator {
  calculateExpense(expense: ExpenseItem, context: CalculationContext): number;
  calculateAllExpenses(expenses: ExpenseItem[], context: CalculationContext): ExpenseCalculationResult[];
  evaluateFormula(formula: string, context: CalculationContext): number;
}

// Scenario modeling

export interface FlexibleScenario {
  id: string;
  name: string;
  description: string;
  assumptions: FlexibleAssumptions;
  adjustments?: {
    revenueMultiplier?: number;
    expenseMultiplier?: number;
    growthRateAdjustment?: number;
  };
}

// Migration helper

export interface LegacyToFlexibleMigration {
  mapLegacyAssumptions(legacy: any): FlexibleAssumptions;
  createDefaultExpenses(): ExpenseItem[];
  createDefaultRevenueStreams(): RevenueStream[];
}