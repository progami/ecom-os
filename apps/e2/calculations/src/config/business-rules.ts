/**
 * Business Rules Configuration
 * Centralizes all business logic constants, percentages, rates, and thresholds
 * These values can be overridden using environment variables in src/config/environment.ts
 */

import { BUSINESS_RULES_CONFIG } from './environment.client';

export interface AmazonFees {
  referralRate: number;
  returnAllowance: number;
}

export interface TaxRates {
  tariffRate: number;
  payrollTaxRate: number;
}

export interface TACoSRates {
  [year: number]: number;
}

export interface GrowthRates {
  [year: number]: number;
}

export interface BusinessThresholds {
  defaultMarginThreshold: number;
  minimumOrderQuantity: number;
  leadTimeDays: number;
  defaultWholesalePriceRatio: number; // Default wholesale price as ratio of retail
  assetDepreciationMonths: number; // Depreciation period for PPE
}

export interface PaymentTerms {
  accountsPayableRatio: number; // Ratio of COGS held as AP (30 days / 30 days)
  accountsReceivableRatio: number; // Ratio of retail revenue held as AR (15 days / 30 days)
  accruedExpensesRatio: number; // Ratio of OpEx held as accrued expenses
}

// Amazon marketplace fees (can be overridden by environment variables)
export const AMAZON_FEES: AmazonFees = {
  referralRate: BUSINESS_RULES_CONFIG.amazonReferralRate,
  returnAllowance: BUSINESS_RULES_CONFIG.amazonReturnAllowance,
} as const;

// Tax rates (can be overridden by environment variables)
export const TAX_RATES: TaxRates = {
  tariffRate: BUSINESS_RULES_CONFIG.tariffRate,
  payrollTaxRate: BUSINESS_RULES_CONFIG.payrollTaxRate,
} as const;

// Total Advertising Cost of Sales (TACoS) rates by year
export const TACOS_RATES: TACoSRates = BUSINESS_RULES_CONFIG.tacosRates;

// Year-over-year growth rates
export const GROWTH_RATES: GrowthRates = BUSINESS_RULES_CONFIG.growthRates;

// Business thresholds and defaults
export const BUSINESS_THRESHOLDS: BusinessThresholds = {
  defaultMarginThreshold: BUSINESS_RULES_CONFIG.defaultMarginThreshold,
  minimumOrderQuantity: BUSINESS_RULES_CONFIG.minimumOrderQuantity,
  leadTimeDays: BUSINESS_RULES_CONFIG.leadTimeDays,
  defaultWholesalePriceRatio: 0.5, // Default wholesale price is 50% of retail
  assetDepreciationMonths: 60, // 5 years depreciation period
} as const;

// Payment terms and working capital ratios
export const PAYMENT_TERMS: PaymentTerms = {
  accountsPayableRatio: 0.3, // 30 days payable = 30% of monthly COGS
  accountsReceivableRatio: 0.5, // 15 days collection = 50% of monthly retail revenue
  accruedExpensesRatio: 0.1, // 10% of OpEx held as accrued
} as const;

// Calculation helpers
export const calculateNetRevenue = (grossRevenue: number): number => {
  return grossRevenue * (1 - AMAZON_FEES.referralRate - AMAZON_FEES.returnAllowance);
};

export const calculateTariff = (amount: number): number => {
  return amount * TAX_RATES.tariffRate;
};

export const calculatePayrollTax = (payrollAmount: number): number => {
  return payrollAmount * TAX_RATES.payrollTaxRate;
};