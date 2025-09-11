// Import History Component Types

export interface ImportHistoryItem {
  id: string
  reportType: ReportType
  source: ImportSource
  periodStart?: Date | null
  periodEnd: Date
  importedAt: Date
  importedBy: string
  fileName?: string
  fileSize?: number
  status: ImportStatus
  errorLog?: string | null
  recordCount?: number
  checksum?: string
  metadata?: Record<string, any>
}

export type ReportType = 
  | 'BALANCE_SHEET' 
  | 'PROFIT_LOSS' 
  | 'CASH_FLOW' 
  | 'AGED_PAYABLES' 
  | 'AGED_RECEIVABLES' 
  | 'BANK_SUMMARY'
  | 'TRIAL_BALANCE'
  | 'GENERAL_LEDGER'

export type ImportSource = 'csv' | 'excel' | 'json' | 'manual' | 'xero'

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ImportHistoryProps {
  reportType?: ReportType
  onSelectImport?: (importId: string) => void
  onDeleteImport?: (importId: string) => Promise<void>
  onCompareImports?: (importIds: string[]) => void
  showActions?: boolean
  maxItems?: number
  className?: string
}

export interface ImportDateDisplayProps {
  reportType: ReportType
  periodStart?: Date | null
  periodEnd: Date
  className?: string
}

export interface ImportHistoryItemProps {
  item: ImportHistoryItem
  onSelect?: (importId: string) => void
  onDelete?: (importId: string) => Promise<void>
  onCompare?: (importId: string) => void
  showActions?: boolean
  isSelected?: boolean
  isCompareMode?: boolean
  showReportType?: boolean
}

export interface ImportActionsProps {
  importItem: ImportHistoryItem
  onView?: () => void
  onDelete?: () => Promise<void>
  onSelect?: (selected: boolean) => void
  isSelected?: boolean
  disabled?: boolean
}

export interface ImportHistoryFilterProps {
  onFilterChange: (filters: ImportFilters) => void
  reportTypes?: ReportType[]
  className?: string
}

export interface ImportFilters {
  reportType?: ReportType
  status?: ImportStatus
  source?: ImportSource
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

// Date format configurations per report type
export const REPORT_DATE_FORMATS: Record<ReportType, {
  displayFormat: 'point-in-time' | 'period' | 'month' | 'ytd'
  label: string
}> = {
  TRIAL_BALANCE: {
    displayFormat: 'ytd',
    label: 'YTD as of'
  },
  CASH_FLOW: {
    displayFormat: 'month',
    label: 'Month of'
  },
  AGED_PAYABLES: {
    displayFormat: 'point-in-time',
    label: 'As of'
  },
  AGED_RECEIVABLES: {
    displayFormat: 'point-in-time',
    label: 'As of'
  },
  BALANCE_SHEET: {
    displayFormat: 'point-in-time',
    label: 'As of'
  },
  PROFIT_LOSS: {
    displayFormat: 'period',
    label: 'Period'
  },
  BANK_SUMMARY: {
    displayFormat: 'period',
    label: 'Period'
  },
  GENERAL_LEDGER: {
    displayFormat: 'period',
    label: 'Period'
  }
}

// Report type display names
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  BALANCE_SHEET: 'Balance Sheet',
  PROFIT_LOSS: 'Profit & Loss',
  CASH_FLOW: 'Cash Flow Statement',
  AGED_PAYABLES: 'Aged Payables',
  AGED_RECEIVABLES: 'Aged Receivables',
  BANK_SUMMARY: 'Bank Summary',
  TRIAL_BALANCE: 'Trial Balance',
  GENERAL_LEDGER: 'General Ledger'
}