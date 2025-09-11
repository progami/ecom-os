export interface RevenueData {
  [yearWeek: string]: {
    [sku: string]: {
      grossRevenue: number
      units: number
    }
  }
}

export interface ExpenseSetup {
  payrollMonthly: number
  payrollStartDate: string
  rentMonthly: number
  rentStartDate: string
  advertisingPercent: number
  otherMonthly: number
  otherStartDate: string
  warehouseMonthly: number
  warehouseStartDate: string
  softwareMonthly: number
  softwareStartDate: string
  officeSuppliesMonthly: number
  officeSuppliesStartDate: string
  inventoryPurchases: InventoryPurchase[]
  freightPurchases: FreightPurchase[]
}

export interface InventoryPurchase {
  date: string
  sku: string
  quantity: number
  unitCost: number
  totalCost: number
  description?: string
}

export interface FreightPurchase {
  date: string
  amount: number
  description?: string
}

export interface ExpenseData extends ExpenseSetup {
  id?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface MonthlyExpenseData {
  [yearMonth: string]: {
    [categoryId: string]: number
  }
}

export interface WeeklyExpenseData {
  [yearWeek: string]: {
    [categoryId: string]: number
  }
}

export interface ProductPriceOverride {
  sku: string
  price: number
  effectiveDate: Date
}

export interface ProductCostData {
  sku: string
  manufacturingCost: number
  freightCost: number
  warehouseCost: number
  fulfillmentFee: number
  totalCost: number
}

export interface FreightData {
  purchases: FreightPurchase[]
  totalAmount: number
}

export interface FinancialSummary {
  revenue: {
    total: number
    byWeek: { [week: string]: number }
    bySku: { [sku: string]: number }
  }
  expenses: {
    total: number
    byCategory: { [category: string]: number }
    byWeek: { [week: string]: number }
  }
  profit: {
    gross: number
    net: number
    margin: number
  }
}


export interface SupplierPaymentTerm {
  // Supplier payment term properties
  [key: string]: any
}

export interface Assumptions {
  // General & Timing
  modelStartDate: string
  
  // Sales & Revenue
  baseMonthlySalesUnits: number
  annualGrowthRateY1: number
  annualGrowthRateY2: number
  annualGrowthRateY3: number
  annualGrowthRateY4: number
  annualGrowthRateY5: number
  
  // Channel Mix
  ecommerceChannelMixY1: number
  ecommerceChannelMixY2: number
  ecommerceChannelMixY3: number
  ecommerceChannelMixY4: number
  ecommerceChannelMixY5: number
  
  // Operating Expenses
  ownerSalary?: number
  employeeSalary?: number
  officeRent?: number
  utilities?: number
  insurance?: number
  professionalFees?: number
  marketingBudget?: number
  
  // Initial Investment
  initialInvestment?: number
  
  // Other properties as needed
  [key: string]: any
}

export interface CashEvent {
  id?: string | number
  date: string
  description: string
  amount: number
  type: 'inflow' | 'outflow'
  category?: string
  status?: string
  relatedPO?: string
}

export interface ProductMix {
  skuCode: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
}

export interface CashFlowForecast {
  month: string
  beginningCash: number
  cashInflows: {
    total: number
    [key: string]: number
  }
  cashOutflows: {
    total: number
    [key: string]: number
  }
  netCashFlow: number
  endingCash: number
  cashRunway?: number
}

export interface FinancialStatements {
  [key: string]: any
}

export interface EnhancedFinancialStatements {
  [key: string]: any
}

export interface GeneralLedgerData {
  [key: string]: any
}

export interface TrialBalanceEntry {
  [key: string]: any
}

export interface JournalEntry {
  [key: string]: any
}

export interface AccountBalance {
  [key: string]: any
}

export interface InventoryStatus {
  [key: string]: any
}

export interface ProductMargin {
  sku: string
  name: string
  retailPrice: number
  manufacturing: number
  freight: number
  thirdPLStorage: number
  amazonReferralFee: number
  fulfillmentFee: number
  refundAllowance: number
  group: number
  country: string
  packSize: number
  micron: number
  dimensions: string
  density: number
  weight: number
  weightOz: number
  weightLb: number
  cbmPerUnit: number
  sizeTier: string
  tariffRate: number
  fobCost?: number
  landedCost?: number
  totalCogs?: number
  grossMargin?: number
  grossMarginPercentage?: number
}

export interface CSVData {
  productMargins?: ProductMargin[]
  yearlyFigures?: any[]
  investmentBreakdown?: any
  monthlyData?: MonthlyData[]
  productMix?: ProductMix[]
  assumptions?: Partial<Assumptions>
  balanceSheet?: any
  cashFlow?: any
  financialRatios?: any
  competitorAnalysis?: any
  year1Phased?: any
}

export interface EmployeePosition {
  title: string
  type: 'FT' | 'PT' | 'Contractor'
  monthlySalary: number
  startMonth?: number
}

export interface MonthlyData {
  month: string
  year: number
  revenue?: number
  expenses?: number
  units?: number
  [key: string]: any
}

export interface YearlyData {
  year: number
  revenue?: number
  expenses?: number
  profit?: number
  growth?: number
  [key: string]: any
}
