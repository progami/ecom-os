/**
 * Date Configuration
 * Centralizes all date-related constants and utilities
 */

import { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

export interface FiscalYear {
  start: Date;
  end: Date;
  year: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// Fiscal year configuration
export const FISCAL_YEAR_START_MONTH = 1; // January
export const FISCAL_YEAR_START_DAY = 1;

// Planning horizon
export const PLANNING_HORIZON_YEARS = 5;
export const DEFAULT_FORECAST_MONTHS = 12;

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  INPUT: 'yyyy-MM-dd',
  MONTH_YEAR: 'MMM yyyy',
  QUARTER: 'Q[quarter] yyyy',
  YEAR: 'yyyy',
  FILE_TIMESTAMP: 'yyyyMMdd_HHmmss',
} as const;

// Week definitions
export const WEEK_START_DAY = 1; // Monday
export const WEEK_END_DAY = 0; // Sunday

// Business days
export const BUSINESS_DAYS = [1, 2, 3, 4, 5]; // Monday through Friday

// Quarters
export const QUARTERS = {
  Q1: { start: 1, end: 3, name: 'Q1' },
  Q2: { start: 4, end: 6, name: 'Q2' },
  Q3: { start: 7, end: 9, name: 'Q3' },
  Q4: { start: 10, end: 12, name: 'Q4' },
} as const;

// Helper functions
export const getFiscalYear = (date: Date): FiscalYear => {
  const year = date.getFullYear();
  const fiscalYearStart = new Date(year, FISCAL_YEAR_START_MONTH - 1, FISCAL_YEAR_START_DAY);
  
  if (date < fiscalYearStart) {
    return {
      start: new Date(year - 1, FISCAL_YEAR_START_MONTH - 1, FISCAL_YEAR_START_DAY),
      end: new Date(year, FISCAL_YEAR_START_MONTH - 1, FISCAL_YEAR_START_DAY - 1),
      year: year - 1,
    };
  }
  
  return {
    start: fiscalYearStart,
    end: new Date(year + 1, FISCAL_YEAR_START_MONTH - 1, FISCAL_YEAR_START_DAY - 1),
    year,
  };
};

export const getQuarter = (date: Date): keyof typeof QUARTERS => {
  const month = date.getMonth() + 1;
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
};

export const getQuarterDateRange = (year: number, quarter: keyof typeof QUARTERS): DateRange => {
  const q = QUARTERS[quarter];
  return {
    start: startOfQuarter(new Date(year, q.start - 1, 1)),
    end: endOfQuarter(new Date(year, q.start - 1, 1)),
  };
};

export const getMonthDateRange = (year: number, month: number): DateRange => {
  const date = new Date(year, month - 1, 1);
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
};

export const getYearDateRange = (year: number): DateRange => {
  const date = new Date(year, 0, 1);
  return {
    start: startOfYear(date),
    end: endOfYear(date),
  };
};

// Week numbering
export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Business day calculations
export const isBusinessDay = (date: Date): boolean => {
  return BUSINESS_DAYS.includes(date.getDay());
};

export const addBusinessDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  let addedDays = 0;
  
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) {
      addedDays++;
    }
  }
  
  return result;
};

// Reporting periods
export const REPORTING_PERIODS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
} as const;

export type ReportingPeriod = typeof REPORTING_PERIODS[keyof typeof REPORTING_PERIODS];

// System-wide date constants
export const SYSTEM_DATES = {
  // Cutoff date for actual vs forecast data (end of actual bank statement data)
  CUTOFF_DATE: new Date('2025-07-20'),
  
  // Forecast start date (day after cutoff)
  FORECAST_START_DATE: new Date('2025-07-21'),
  
  // Revenue projection start (when revenue forecasts begin)
  REVENUE_PROJECTION_START: new Date('2025-09-01'),
  
  // Last date of actual transactions in the system
  ACTUAL_TRANSACTIONS_END: new Date('2025-07-14'),
  
  // Default date range for forecasts
  DEFAULT_FORECAST_END: new Date('2030-12-31'),
  
  // Historical data start
  HISTORICAL_DATA_START: new Date('2025-01-01'),
} as const;

// Inventory and lead time constants
export const INVENTORY_CONSTANTS = {
  // Total lead time for inventory orders
  LEAD_TIME_DAYS: 110, // 40 manufacturing + 30 logistics + 10 local + 30 buffer
  
  // Lead time breakdown
  MANUFACTURING_DAYS: 40,
  LOGISTICS_DAYS: 30,
  LOCAL_DELIVERY_DAYS: 10,
  BUFFER_DAYS: 30,
  
  // Lead time in weeks
  LEAD_TIME_WEEKS: Math.ceil(110 / 7), // ~16 weeks
} as const;

// Recurring expense start dates
export const RECURRING_EXPENSE_DATES = {
  // Payroll dates
  MANAGER_SALARY_START: new Date('2025-07-01'),
  OWNER_SALARY_START: new Date('2025-10-01'),
  
  // Tax payment dates
  PAYROLL_TAX_START: new Date('2025-07-31'),
  PAYROLL_TAX_INCREASE: new Date('2025-10-31'),
  
  // Rent
  OFFICE_RENT_START: new Date('2025-08-01'),
  
  // Software subscriptions
  CLAUDE_AI_START: new Date('2025-07-23'),
  QUICKBOOKS_START: new Date('2025-08-01'),
  QUICKBOOKS_UPGRADE: new Date('2025-11-01'),
  GOOGLE_WORKSPACE_START: new Date('2025-08-01'),
  
  // Advertising
  PPC_CONTRACT_START: new Date('2025-10-01'),
  
  // Annual expenses
  LIABILITY_INSURANCE_START: new Date('2025-08-01'),
  SCALE_INSIGHTS_START: new Date('2025-08-01'),
  SELLERBOARD_START: new Date('2025-08-01'),
} as const;