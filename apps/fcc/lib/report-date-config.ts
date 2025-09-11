import { DateType } from '@/components/reports/unified-date-picker'

export interface ReportDateConfig {
  dateType: DateType
  label?: string
  description?: string
  defaultPresetIndex?: number // Index of the default preset to use
}

// Centralized configuration for all report date handling
export const REPORT_DATE_CONFIG: Record<string, ReportDateConfig> = {
  // Point-in-time reports - show financial position at a specific date
  BALANCE_SHEET: {
    dateType: 'point-in-time',
    label: 'Balance Sheet Date',
    description: 'Shows financial position as of this date',
    defaultPresetIndex: 3 // End of last month
  },
  TRIAL_BALANCE: {
    dateType: 'point-in-time',
    label: 'Trial Balance Date',
    description: 'Shows account balances as of this date',
    defaultPresetIndex: 3 // End of last month
  },
  
  // Date range reports - show activity over a period
  PROFIT_LOSS: {
    dateType: 'date-range',
    label: 'Reporting Period',
    description: 'Shows income and expenses for this period',
    defaultPresetIndex: 1 // Last month
  },
  AGED_PAYABLES: {
    dateType: 'date-range',
    label: 'Analysis Period',
    description: 'Shows outstanding payables aged from this period',
    defaultPresetIndex: 0 // This month
  },
  AGED_RECEIVABLES: {
    dateType: 'date-range',
    label: 'Analysis Period',
    description: 'Shows outstanding receivables aged from this period',
    defaultPresetIndex: 0 // This month
  },
  BANK_SUMMARY: {
    dateType: 'date-range',
    label: 'Transaction Period',
    description: 'Shows bank transactions for this period',
    defaultPresetIndex: 0 // This month
  },
  
  // Monthly reports - analyze specific months
  CASH_FLOW: {
    dateType: 'month',
    label: 'Cash Flow Month',
    description: 'Shows cash movements for this month',
    defaultPresetIndex: 1 // Last month
  },
  MONTHLY_BUDGET: {
    dateType: 'month',
    label: 'Budget Month',
    description: 'Shows budget vs actual for this month',
    defaultPresetIndex: 0 // This month
  }
}

// Helper function to get date config for a report type
export function getReportDateConfig(reportType: string): ReportDateConfig | undefined {
  return REPORT_DATE_CONFIG[reportType]
}

// Helper function to determine if a report uses point-in-time dates
export function isPointInTimeReport(reportType: string): boolean {
  const config = getReportDateConfig(reportType)
  return config?.dateType === 'point-in-time'
}

// Helper function to determine if a report uses date ranges
export function isDateRangeReport(reportType: string): boolean {
  const config = getReportDateConfig(reportType)
  return config?.dateType === 'date-range'
}

// Helper function to determine if a report uses monthly dates
export function isMonthlyReport(reportType: string): boolean {
  const config = getReportDateConfig(reportType)
  return config?.dateType === 'month'
}