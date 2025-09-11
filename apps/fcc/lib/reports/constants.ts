// Chart color schemes for consistent visualization across reports
export const CHART_COLORS = {
  primary: ['#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6'],
  aging: ['#10b981', '#f59e0b', '#ef4444', '#dc2626'],
  comparison: ['#6366f1', '#8b5cf6'],
  trend: '#6366f1',
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#64748b',
} as const;

// Common date ranges for reports
export const DATE_RANGES = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  LAST_7_DAYS: 'last-7-days',
  LAST_30_DAYS: 'last-30-days',
  LAST_90_DAYS: 'last-90-days',
  THIS_MONTH: 'this-month',
  LAST_MONTH: 'last-month',
  THIS_QUARTER: 'this-quarter',
  LAST_QUARTER: 'last-quarter',
  THIS_YEAR: 'this-year',
  LAST_YEAR: 'last-year',
  CUSTOM: 'custom',
} as const;

// Common time periods for comparisons
export const TIME_PERIODS = {
  MONTH: 'MONTH',
  QUARTER: 'QUARTER',
  YEAR: 'YEAR',
} as const;

// Export formats
export const EXPORT_FORMATS = {
  CSV: 'csv',
  EXCEL: 'excel',
  PDF: 'pdf',
} as const;

// Report refresh intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  MANUAL: 0,
  FIVE_MINUTES: 5 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
} as const;

// Common report status types
export const REPORT_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// Aging bucket definitions
export const AGING_BUCKETS = [
  { label: 'Current', days: 0 },
  { label: '1-30 days', days: 30 },
  { label: '31-60 days', days: 60 },
  { label: '61-90 days', days: 90 },
  { label: 'Over 90 days', days: Infinity },
] as const;

// Common number format options
export const NUMBER_FORMATS = {
  CURRENCY: {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  PERCENTAGE: {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  },
  DECIMAL: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  INTEGER: {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
} as const;

// Common table column widths
export const COLUMN_WIDTHS = {
  NARROW: '80px',
  SMALL: '120px',
  MEDIUM: '180px',
  LARGE: '240px',
  EXTRA_LARGE: '320px',
  FLEXIBLE: 'auto',
} as const;