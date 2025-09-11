// src/types/v4/financial.ts

// --- INPUT INTERFACES ---

export interface SalesForecastInput {
  sku: string;
  monthlySales: { month: number; unitsSold: number; ppcSpend: number; retailPrice: number }[];
}

export interface OperatingExpenseInput {
  id: string; // Unique identifier
  name: string;
  amount: number;
  startMonth: number; // e.g., 1 for the first month of the model
  frequency: 'Monthly' | 'Annually' | 'One-Time';
  category: 'Payroll' | 'Advertising' | 'Rent' | 'Software' | 'Insurance' | 'Legal & Compliance';
  // Optional fields for special cases
  promoRate?: number;
  promoDurationMonths?: number;
}

export interface InventoryRulesInput {
  targetMonthsOfSupply: number;
  supplierPaymentTerms: { percentage: number; daysAfterPO: number }[];
}

export interface ProductDetailsInput {
  sku: string;
  manufacturingCost: number;
  freightCost: number;
  fulfillmentFee: number;
  amazonReferralFeeRate: number; // e.g., 0.15
}

// The complete set of all user-defined inputs
export interface UserInputs {
  salesForecast: SalesForecastInput[];
  operatingExpenses: OperatingExpenseInput[];
  inventoryRules: InventoryRulesInput;
  productDetails: ProductDetailsInput[];
  // Global assumptions
  taxRate: number;
  openingCash: number;
  openingRetainedEarnings: number;
}

// --- TRANSACTION & LEDGER INTERFACES ---

export interface Transaction {
  date: Date;
  description: string;
  category: string; // Corresponds to P&L / CFS line items
  account: 'Cash' | 'AccountsReceivable' | 'Inventory' | 'Equity' | 'SalesRevenue' | 'COGS' | 'OpEx' | 'PayrollTaxPayable' | 'AccountsPayable';
  debit: number;
  credit: number;
  ruleSource: string; // Which rule generated this transaction
}

// --- OUTPUT INTERFACES ---

export interface MonthlySummary {
  month: number;
  date: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netIncome: number;
  endingCash: number;
  endingInventory: number;
  inventoryValue: number;
  accountsReceivable: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
}

export interface FinancialStatements {
  monthlySummaries: MonthlySummary[];
  transactions: Transaction[];
  yearlyPnL: {
    year: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netIncome: number;
  }[];
  balanceSheet: {
    assets: {
      cash: number;
      accountsReceivable: number;
      inventory: number;
      totalAssets: number;
    };
    liabilities: {
      payrollTaxPayable: number;
      totalLiabilities: number;
    };
    equity: {
      retainedEarnings: number;
      totalEquity: number;
    };
  };
}