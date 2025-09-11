// src/types/expenses.ts

export enum ExpenseCategory {
  PAYROLL = 'payroll',
  RENT = 'rent',
  UTILITIES = 'utilities',
  SOFTWARE = 'software',
  INSURANCE = 'insurance',
  PROFESSIONAL = 'professional_fees',
  MARKETING = 'marketing',
  EQUIPMENT = 'equipment',
  SUPPLIES = 'supplies',
  TRAVEL = 'travel',
  LEGAL = 'legal',
  TAXES = 'taxes',
  OFFICE = 'office',
  OTHER = 'other'
}

export enum ExpenseFrequency {
  ONE_TIME = 'one_time',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually'
}

export enum CalculationType {
  FIXED = 'fixed_amount',
  PERCENT_OF_REVENUE = 'percentage_of_revenue',
  PER_UNIT = 'per_unit',
  HEADCOUNT = 'headcount_based',
  FORMULA = 'custom_formula'
}

export interface ExpenseItem {
  id: string;
  name: string;
  category: ExpenseCategory;
  description?: string;
  calculationType: CalculationType;
  frequency: ExpenseFrequency;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  isActive: boolean;
  order: number; // For sorting/reordering
  
  // Amount configuration based on calculation type
  fixedAmount?: number;
  percentageOfRevenue?: number;
  perUnitAmount?: number;
  headcountMultiplier?: number;
  customFormula?: string;
  
  // Additional metadata
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseTemplate {
  id: string;
  name: string;
  description: string;
  industry?: string;
  expenses: Omit<ExpenseItem, 'id' | 'createdAt' | 'updatedAt'>[];
  isCustom: boolean;
  createdAt: string;
}

export interface ExpenseCalculationResult {
  expenseId: string;
  month: string;
  amount: number;
  details?: {
    baseValue?: number;
    multiplier?: number;
    formula?: string;
  };
}

export interface ExpenseManagerState {
  expenses: ExpenseItem[];
  templates: ExpenseTemplate[];
  selectedExpense?: ExpenseItem;
  filters: {
    categories?: ExpenseCategory[];
    frequencies?: ExpenseFrequency[];
    activeOnly?: boolean;
    searchTerm?: string;
  };
  sortBy: 'name' | 'category' | 'amount' | 'startDate' | 'order';
  sortDirection: 'asc' | 'desc';
}

export interface ExpenseFormData {
  name: string;
  category: ExpenseCategory;
  description?: string;
  calculationType: CalculationType;
  frequency: ExpenseFrequency;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  
  // Amount fields
  fixedAmount?: number;
  percentageOfRevenue?: number;
  perUnitAmount?: number;
  headcountMultiplier?: number;
  customFormula?: string;
  
  tags?: string[];
  notes?: string;
}

export interface ExpenseImportExport {
  version: string;
  exportDate: string;
  expenses: ExpenseItem[];
  templates?: ExpenseTemplate[];
}