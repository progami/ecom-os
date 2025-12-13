import { FilterConfig } from '@/components/reports/filter-panel';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, format } from 'date-fns';

export type ReportType = 
  | 'cash-flow'
  | 'profit-loss' 
  | 'balance-sheet'
  | 'trial-balance'
  | 'bank-summary'
  | 'financial-overview';

export interface ReportFilterDefinition {
  filters: FilterConfig[];
  defaultDateRange?: {
    from: Date;
    to: Date;
  };
}

// Utility functions for common date ranges
export function getDatePresets() {
  const today = new Date();
  
  return {
    thisMonth: {
      from: startOfMonth(today),
      to: endOfMonth(today)
    },
    lastMonth: {
      from: startOfMonth(subMonths(today, 1)),
      to: endOfMonth(subMonths(today, 1))
    },
    last3Months: {
      from: startOfMonth(subMonths(today, 2)),
      to: endOfMonth(today)
    },
    last6Months: {
      from: startOfMonth(subMonths(today, 5)),
      to: endOfMonth(today)
    },
    thisYear: {
      from: startOfYear(today),
      to: endOfYear(today)
    },
    lastYear: {
      from: startOfYear(subYears(today, 1)),
      to: endOfYear(subYears(today, 1))
    }
  };
}

// Common filter options that can be reused across reports
export const COMMON_FILTERS = {
  accountTypes: [
    { value: 'ASSET', label: 'Assets' },
    { value: 'LIABILITY', label: 'Liabilities' },
    { value: 'EQUITY', label: 'Equity' },
    { value: 'REVENUE', label: 'Revenue' },
    { value: 'EXPENSE', label: 'Expenses' },
    { value: 'CURRENT', label: 'Current Assets' },
    { value: 'FIXED', label: 'Fixed Assets' },
    { value: 'BANK', label: 'Bank' },
    { value: 'SALES', label: 'Sales' },
    { value: 'OVERHEADS', label: 'Overheads' }
  ],
  
  currencies: [
    { value: 'GBP', label: 'British Pound (£)' },
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'AUD', label: 'Australian Dollar (A$)' },
    { value: 'CAD', label: 'Canadian Dollar (C$)' }
  ],
  
  periods: [
    { value: 'MONTH', label: 'Month' },
    { value: 'QUARTER', label: 'Quarter' },
    { value: 'YEAR', label: 'Year' }
  ],
  
  agingPeriods: [
    { value: '30', label: '30 days' },
    { value: '60', label: '60 days' },
    { value: '90', label: '90 days' },
    { value: '120', label: '120 days' }
  ]
};

// Report-specific filter configurations
export const REPORT_FILTERS: Record<ReportType, ReportFilterDefinition> = {
  'cash-flow': {
    filters: [
      {
        key: 'month',
        label: 'Report Month',
        type: 'month',
        placeholder: 'Select month'
      },
      {
        key: 'comparison',
        label: 'Compare With',
        type: 'month',
        placeholder: 'Select comparison month (optional)'
      },
      {
        key: 'currency',
        label: 'Currency',
        type: 'select',
        options: COMMON_FILTERS.currencies,
        placeholder: 'All currencies'
      },
      {
        key: 'activities',
        label: 'Activities',
        type: 'multi-select',
        options: [
          { value: 'operating', label: 'Operating Activities' },
          { value: 'investing', label: 'Investing Activities' },
          { value: 'financing', label: 'Financing Activities' }
        ],
        placeholder: 'All activities'
      },
      {
        key: 'minAmount',
        label: 'Minimum Amount',
        type: 'number-range',
        min: 0,
        step: 0.01,
        placeholder: 'Filter by amount'
      }
    ],
    defaultDateRange: getDatePresets().lastMonth
  },

  'profit-loss': {
    filters: [
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'date-range',
        placeholder: 'Select date range'
      },
      {
        key: 'period',
        label: 'Period',
        type: 'select',
        options: COMMON_FILTERS.periods,
        placeholder: 'Select period'
      },
      {
        key: 'accountTypes',
        label: 'Account Types',
        type: 'multi-select',
        options: COMMON_FILTERS.accountTypes.filter(type => 
          ['REVENUE', 'EXPENSE', 'SALES', 'OVERHEADS'].includes(type.value)
        ),
        placeholder: 'All account types'
      },
      {
        key: 'minAmount',
        label: 'Minimum Amount',
        type: 'number-range',
        min: 0,
        step: 0.01,
        placeholder: 'Filter by amount'
      },
      {
        key: 'showZeroBalances',
        label: 'Include Zero Balances',
        type: 'select',
        options: [
          { value: 'true', label: 'Include zero balances' },
          { value: 'false', label: 'Exclude zero balances' }
        ],
        placeholder: 'Include zero balances'
      }
    ],
    defaultDateRange: getDatePresets().thisMonth
  },

  'balance-sheet': {
    filters: [
      {
        key: 'date',
        label: 'As at Date',
        type: 'date',
        placeholder: 'Select balance sheet date'
      },
      {
        key: 'accountTypes',
        label: 'Account Types',
        type: 'multi-select',
        options: COMMON_FILTERS.accountTypes.filter(type => 
          ['ASSET', 'LIABILITY', 'EQUITY', 'CURRENT', 'FIXED', 'BANK'].includes(type.value)
        ),
        placeholder: 'All account types'
      },
      {
        key: 'showZeroBalances',
        label: 'Include Zero Balances',
        type: 'select',
        options: [
          { value: 'true', label: 'Include zero balances' },
          { value: 'false', label: 'Exclude zero balances' }
        ],
        placeholder: 'Include zero balances'
      },
      {
        key: 'minAmount',
        label: 'Minimum Amount',
        type: 'number-range',
        min: 0,
        step: 0.01,
        placeholder: 'Filter by amount'
      }
    ],
    defaultDateRange: {
      from: endOfMonth(new Date()),
      to: endOfMonth(new Date())
    }
  },

  'trial-balance': {
    filters: [
      {
        key: 'date',
        label: 'As at Date',
        type: 'date',
        placeholder: 'Select trial balance date'
      },
      {
        key: 'accountTypes',
        label: 'Account Types',
        type: 'multi-select',
        options: COMMON_FILTERS.accountTypes,
        placeholder: 'All account types'
      },
      {
        key: 'showInactive',
        label: 'Include Inactive Accounts',
        type: 'select',
        options: [
          { value: 'true', label: 'Include inactive accounts' },
          { value: 'false', label: 'Active accounts only' }
        ],
        placeholder: 'Active accounts only'
      },
      {
        key: 'showZeroBalances',
        label: 'Include Zero Balances',
        type: 'select',
        options: [
          { value: 'true', label: 'Include zero balances' },
          { value: 'false', label: 'Exclude zero balances' }
        ],
        placeholder: 'Include zero balances'
      },
      {
        key: 'minAmount',
        label: 'Minimum Amount',
        type: 'number-range',
        min: 0,
        step: 0.01,
        placeholder: 'Filter by amount'
      },
      {
        key: 'accountCode',
        label: 'Account Code',
        type: 'text',
        placeholder: 'Search by account code'
      }
    ],
    defaultDateRange: {
      from: endOfMonth(new Date()),
      to: endOfMonth(new Date())
    }
  },

  'bank-summary': {
    filters: [
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'date-range',
        placeholder: 'Select date range'
      },
      {
        key: 'bankAccounts',
        label: 'Bank Accounts',
        type: 'multi-select',
        options: [], // This will be populated dynamically
        placeholder: 'All bank accounts'
      },
      {
        key: 'transactionTypes',
        label: 'Transaction Types',
        type: 'multi-select',
        options: [
          { value: 'RECEIVE', label: 'Receipts' },
          { value: 'SPEND', label: 'Payments' }
        ],
        placeholder: 'All transaction types'
      },
      {
        key: 'minAmount',
        label: 'Minimum Amount',
        type: 'number-range',
        min: 0,
        step: 0.01,
        placeholder: 'Filter by amount'
      },
      {
        key: 'reconciledOnly',
        label: 'Reconciled Only',
        type: 'select',
        options: [
          { value: 'true', label: 'Reconciled only' },
          { value: 'false', label: 'All transactions' }
        ],
        placeholder: 'All transactions'
      }
    ],
    defaultDateRange: getDatePresets().thisMonth
  },

  'financial-overview': {
    filters: [
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'date-range',
        placeholder: 'Select date range'
      },
      {
        key: 'period',
        label: 'Period',
        type: 'select',
        options: COMMON_FILTERS.periods,
        placeholder: 'Select period'
      },
      {
        key: 'includeForecasts',
        label: 'Include Forecasts',
        type: 'select',
        options: [
          { value: 'true', label: 'Include forecasts' },
          { value: 'false', label: 'Actual only' }
        ],
        placeholder: 'Actual only'
      },
      {
        key: 'sections',
        label: 'Report Sections',
        type: 'multi-select',
        options: [
          { value: 'summary', label: 'Financial Summary' },
          { value: 'cashflow', label: 'Cash Flow' },
          { value: 'profitloss', label: 'Profit & Loss' },
          { value: 'balancesheet', label: 'Balance Sheet' }
        ],
        placeholder: 'All sections'
      }
    ],
    defaultDateRange: getDatePresets().thisMonth
  }
};

// Utility function to get filters for a specific report type
export function getReportFilters(reportType: ReportType): FilterConfig[] {
  return REPORT_FILTERS[reportType]?.filters || [];
}

// Utility function to get default date range for a report type
export function getDefaultDateRange(reportType: ReportType) {
  return REPORT_FILTERS[reportType]?.defaultDateRange || getDatePresets().thisMonth;
}

// Utility function to validate filter values
export function validateFilterValue(filter: FilterConfig, value: any): boolean {
  switch (filter.type) {
    case 'date-range':
      return value?.from && value?.to && value.from <= value.to;
    
    case 'select':
      return !filter.options || filter.options.some(opt => opt.value === value);
    
    case 'multi-select':
      return Array.isArray(value) && 
        (!filter.options || value.every(v => filter.options!.some(opt => opt.value === v)));
    
    case 'number-range':
      return typeof value === 'object' && 
        (value.min === undefined || typeof value.min === 'number') &&
        (value.max === undefined || typeof value.max === 'number') &&
        (value.min === undefined || value.max === undefined || value.min <= value.max);
    
    case 'text':
      return typeof value === 'string';
    
    case 'date':
      return value instanceof Date && !isNaN(value.getTime());
    
    case 'month':
      return value instanceof Date && !isNaN(value.getTime());
    
    default:
      return true;
  }
}

// Utility function to format filter values for API requests
export function formatFiltersForAPI(filters: Record<string, any>) {
  const apiFilters: Record<string, any> = {};
  
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;
    
    if (value.dateRange) {
      apiFilters[`${key}_from`] = format(value.dateRange.from, 'yyyy-MM-dd');
      apiFilters[`${key}_to`] = format(value.dateRange.to, 'yyyy-MM-dd');
    }
    
    if (value.select) {
      apiFilters[key] = value.select;
    }
    
    if (value.multiSelect && value.multiSelect.length > 0) {
      apiFilters[key] = value.multiSelect.join(',');
    }
    
    if (value.numberRange) {
      if (value.numberRange.min !== undefined) {
        apiFilters[`${key}_min`] = value.numberRange.min;
      }
      if (value.numberRange.max !== undefined) {
        apiFilters[`${key}_max`] = value.numberRange.max;
      }
    }
    
    if (value.text) {
      apiFilters[key] = value.text;
    }
    
    if (value.date) {
      apiFilters[key] = format(value.date, 'yyyy-MM-dd');
    }
    
    if (value.month) {
      apiFilters[`${key}_year`] = value.month.getFullYear();
      apiFilters[`${key}_month`] = value.month.getMonth() + 1; // getMonth() is 0-indexed
    }
  });
  
  return apiFilters;
}