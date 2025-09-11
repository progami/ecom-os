// Common report data types
export interface ReportMetadata {
  source: 'database' | 'xero' | 'import';
  fetchedAt: string;
  importId?: string;
  version?: string;
}

export interface DateRangeFilter {
  from: Date | undefined;
  to: Date | undefined;
}

export interface PointInTimeFilter {
  asAtDate: Date;
}

export interface PeriodFilter {
  period: 'MONTH' | 'QUARTER' | 'YEAR';
  periodCount?: number;
}

// Base report response type
export interface BaseReportResponse<T> {
  data: T;
  metadata: ReportMetadata;
  error?: string;
}

// Common financial data structures
export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  balance: number;
  currency?: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  accountCode: string;
  accountName: string;
  reference?: string;
  status?: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: 'customer' | 'supplier' | 'other';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  date: string;
  dueDate: string;
  total: number;
  amountDue: number;
  status: string;
  daysOverdue?: number;
}

// Chart data types
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
  metadata?: Record<string, any>;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ComparisonDataPoint {
  category: string;
  current: number;
  previous: number;
  change?: number;
  changePercentage?: number;
}

// Export data types
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  filename: string;
  columns: ExportColumn[];
  data: any[];
}

export interface ExportColumn {
  header: string;
  key: string;
  formatter?: (value: any) => string;
}

// Filter types
export interface ReportFilter {
  dateRange?: DateRangeFilter;
  accounts?: string[];
  categories?: string[];
  status?: string[];
  search?: string;
  [key: string]: any;
}

// Pagination types
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}