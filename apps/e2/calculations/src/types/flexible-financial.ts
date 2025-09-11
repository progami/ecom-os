// src/types/flexible-financial.ts

import { ProductMix, SupplierPaymentTerm } from './financial';

/**
 * Flexible financial model types that allow dynamic expense management
 */

export type ExpenseCategory = 
  | 'Personnel'
  | 'Marketing'
  | 'Facility'
  | 'Technology'
  | 'Insurance & Legal'
  | 'Professional Services'
  | 'Administrative'
  | 'Inventory'
  | 'Other';

export type ExpenseFrequency = 
  | 'one-time'
  | 'monthly'
  | 'quarterly'
  | 'annual';

export type ScalingType = 
  | 'fixed'
  | 'percentage'
  | 'tiered'
  | 'stepped'
  | 'custom';

export type TriggerType = 
  | 'date'
  | 'revenue'
  | 'profit'
  | 'employees'
  | 'customers'
  | 'custom';

export type TriggerOperator = 
  | '>'
  | '>='
  | '<'
  | '<='
  | '='
  | '!=';

/**
 * Scaling rule for dynamic expense calculations
 */
export interface ScalingRule {
  type: ScalingType;
  baseMetric?: 'revenue' | 'profit' | 'employees' | 'customers' | 'units';
  percentage?: number; // For percentage type
  tiers?: Array<{
    min: number;
    max: number | null;
    rate: number;
  }>; // For tiered type
  steps?: Array<{
    threshold: number;
    value: number;
  }>; // For stepped type
  customFormula?: string; // For custom type
}

/**
 * Trigger condition for activating/deactivating expenses
 */
export interface TriggerCondition {
  type: TriggerType;
  operator: TriggerOperator;
  value: number | string;
  customMetric?: string; // For custom type
  description?: string;
}

/**
 * Individual expense item with flexible configuration
 */
export interface ExpenseItem {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number; // Base amount
  frequency: ExpenseFrequency;
  startDate: string; // ISO date string
  endDate?: string; // Optional end date
  isActive: boolean;
  taxDeductible: boolean;
  description?: string;
  scalingRule?: ScalingRule;
  trigger?: TriggerCondition;
  tags?: string[]; // For filtering and grouping
}

/**
 * Employment position with flexible configuration
 */
export interface FlexibleEmployeePosition {
  id: string;
  title: string;
  type: 'FT' | 'PT' | 'Contractor';
  monthlySalary: number;
  startMonth: number;
  endMonth?: number;
  department?: string;
  benefits?: {
    healthInsurance?: number;
    retirement401k?: number;
    other?: number;
  };
}

/**
 * Employment plan for a specific year
 */
export interface FlexibleEmploymentPlan {
  year: number;
  positions: FlexibleEmployeePosition[];
}

/**
 * Phase configuration for phased launches
 */
export interface Phase {
  name: string;
  startMonth: number;
  endMonth: number;
  velocityMultiplier: number;
  description?: string;
}

/**
 * Channel configuration
 */
export interface ChannelMix {
  ecommerce: number[];
  retail: number[];
  wholesale?: number[];
  directToConsumer?: number[];
}

/**
 * Fee structure
 */
export interface FeeStructure {
  amazonReferralFeeRate: number;
  fulfillmentFeeRate: number;
  refundReturnRate: number;
  payrollTaxRate: number;
  corporateTaxRate: number;
  stateTaxRate?: number;
  customFees?: Array<{
    name: string;
    rate: number;
    baseMetric: 'revenue' | 'units' | 'profit';
  }>;
}

/**
 * Supply chain configuration
 */
export interface SupplyChainConfig {
  targetMonthsOfSupply: number;
  leadTimeDays: number;
  tariffRate: number;
  lclShipmentCost: number;
  supplierPaymentTerms: SupplierPaymentTerm[];
  safetyStockMultiplier?: number;
  reorderPoint?: number;
}

/**
 * Investment configuration
 */
export interface InvestmentConfig {
  totalAmount: number;
  uses: Array<{
    category: string;
    amount: number;
    description?: string;
  }>;
  sources?: Array<{
    type: 'equity' | 'debt' | 'grant' | 'personal';
    amount: number;
    terms?: string;
  }>;
}

/**
 * Main flexible assumptions structure
 */
export interface FlexibleAssumptions {
  // General & Timing
  modelStartDate: string;
  modelName?: string;
  currency?: string;
  
  // Sales & Revenue
  baseMonthlySalesUnits: number;
  annualGrowthRates: number[]; // Array instead of Y1, Y2, etc.
  seasonality?: Array<{
    month: number;
    multiplier: number;
  }>;
  
  // Channel Mix
  channelMix: ChannelMix;
  
  // Product Sales Mix
  productSalesMix: ProductMix[];
  
  // Phased Launch
  phasedLaunch?: {
    phases: Phase[];
  };
  
  // Fees & Rates
  fees: FeeStructure;
  
  // Supply Chain
  supplyChain: SupplyChainConfig;
  
  // Initial Investment
  initialInvestment: InvestmentConfig;
  
  // Flexible Expenses
  expenses: ExpenseItem[];
  
  // Employment Plans
  employmentPlans: FlexibleEmploymentPlan[];
  
  // Custom Metrics (for triggers and scaling)
  customMetrics?: Record<string, number | string>;
  
  // Scenario Configuration
  scenario?: {
    name: string;
    type: 'base' | 'best' | 'worst' | 'custom';
    adjustments?: {
      revenueMultiplier?: number;
      expenseMultiplier?: number;
      growthRateAdjustment?: number;
    };
  };
}

/**
 * Expense template for quick setup
 */
export interface ExpenseTemplate {
  id: string;
  name: string;
  description: string;
  industry?: string;
  businessSize?: 'small' | 'medium' | 'large';
  expenses: ExpenseItem[];
}

/**
 * Migration result type
 */
export interface MigrationResult {
  success: boolean;
  data?: FlexibleAssumptions;
  errors?: string[];
  warnings?: string[];
  report?: string;
}