export interface GLEntry {
  id?: string
  date: Date | string
  description: string
  category: string
  accountCode?: string
  accountType?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  amount: number
  runningBalance?: number
  isProjection?: boolean
  isReconciled?: boolean
  isActual?: boolean
  debit?: number
  credit?: number
}

export interface GLFilters {
  startDate?: Date
  endDate?: Date
  accountType?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  accountCode?: string
  category?: string
  isProjection?: boolean
  isReconciled?: boolean
  isActual?: boolean
}

export interface GLSummary {
  totalEntries: number
  dateRange: {
    startDate: Date | null
    endDate: Date | null
  }
  balancesByType: Record<string, number>
  projectionCount: number
  reconciledCount: number
  actualCount: number
  historicalCount: number
}