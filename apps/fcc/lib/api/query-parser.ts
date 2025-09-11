import { DateRange, PeriodFilter, ReportFilter } from '@/lib/reports/types';
import { parseISO, isValid } from 'date-fns';

export interface ParsedReportQuery {
  dateRange?: DateRange;
  dateType?: 'ytd' | 'point-in-time' | 'date-range';
  asAtDate?: Date;
  period?: PeriodFilter;
  filters: ReportFilter;
  pagination?: {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
}

export function parseReportQuery(searchParams: URLSearchParams): ParsedReportQuery {
  const result: ParsedReportQuery = {
    filters: {},
  };

  // Parse date range
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  
  if (from || to) {
    result.dateRange = {
      from: from ? parseDate(from) : undefined,
      to: to ? parseDate(to) : undefined,
    };
    result.dateType = 'date-range';
  }

  // Parse point-in-time date
  const asAtDate = searchParams.get('asAtDate') || searchParams.get('date');
  if (asAtDate) {
    const date = parseDate(asAtDate);
    if (date) {
      result.asAtDate = date;
      result.dateType = 'point-in-time';
    }
  }

  // Parse date type
  const dateType = searchParams.get('dateType');
  if (dateType === 'ytd' || dateType === 'point-in-time' || dateType === 'date-range') {
    result.dateType = dateType;
  }

  // Parse period filter
  const period = searchParams.get('period') || searchParams.get('timeframe');
  const periodCount = searchParams.get('periods');
  
  if (period === 'MONTH' || period === 'QUARTER' || period === 'YEAR') {
    result.period = {
      period,
      ...(periodCount && { periodCount: parseInt(periodCount, 10) }),
    };
  }

  // Parse filters
  const accounts = searchParams.get('accounts');
  if (accounts) {
    result.filters.accounts = accounts.split(',').filter(Boolean);
  }

  const categories = searchParams.get('categories');
  if (categories) {
    result.filters.categories = categories.split(',').filter(Boolean);
  }

  const status = searchParams.get('status');
  if (status) {
    result.filters.status = status.split(',').filter(Boolean);
  }

  const search = searchParams.get('search') || searchParams.get('q');
  if (search) {
    result.filters.search = search;
  }

  // Parse additional filters
  searchParams.forEach((value, key) => {
    if (!isReservedParam(key) && !result.filters[key]) {
      result.filters[key] = value;
    }
  });

  // Parse pagination
  const page = searchParams.get('page');
  const pageSize = searchParams.get('pageSize') || searchParams.get('limit');
  const sortBy = searchParams.get('sortBy') || searchParams.get('sort');
  const sortOrder = searchParams.get('sortOrder') || searchParams.get('order');

  if (page || pageSize) {
    result.pagination = {
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      ...(sortBy && { sortBy }),
      ...(sortOrder && (sortOrder === 'asc' || sortOrder === 'desc') && { sortOrder }),
    };
  }

  return result;
}

function parseDate(dateString: string): Date | undefined {
  try {
    const date = parseISO(dateString);
    return isValid(date) ? date : undefined;
  } catch {
    return undefined;
  }
}

function isReservedParam(key: string): boolean {
  const reserved = [
    'from', 'to', 'date', 'asAtDate', 'dateType',
    'period', 'timeframe', 'periods',
    'accounts', 'categories', 'status', 'search', 'q',
    'page', 'pageSize', 'limit', 'sortBy', 'sort', 'sortOrder', 'order',
    'refresh', 'importId',
  ];
  return reserved.includes(key);
}

export function buildQueryString(params: ParsedReportQuery): string {
  const searchParams = new URLSearchParams();

  // Add date parameters
  if (params.dateRange) {
    if (params.dateRange.from) {
      searchParams.append('from', params.dateRange.from.toISOString());
    }
    if (params.dateRange.to) {
      searchParams.append('to', params.dateRange.to.toISOString());
    }
  }

  if (params.asAtDate) {
    searchParams.append('asAtDate', params.asAtDate.toISOString());
  }

  if (params.dateType) {
    searchParams.append('dateType', params.dateType);
  }

  // Add period parameters
  if (params.period) {
    searchParams.append('period', params.period.period);
    if (params.period.periodCount) {
      searchParams.append('periods', params.period.periodCount.toString());
    }
  }

  // Add filters
  if (params.filters.accounts?.length) {
    searchParams.append('accounts', params.filters.accounts.join(','));
  }

  if (params.filters.categories?.length) {
    searchParams.append('categories', params.filters.categories.join(','));
  }

  if (params.filters.status?.length) {
    searchParams.append('status', params.filters.status.join(','));
  }

  if (params.filters.search) {
    searchParams.append('search', params.filters.search);
  }

  // Add other filters
  Object.entries(params.filters).forEach(([key, value]) => {
    if (!['accounts', 'categories', 'status', 'search'].includes(key) && value) {
      searchParams.append(key, String(value));
    }
  });

  // Add pagination
  if (params.pagination) {
    searchParams.append('page', params.pagination.page.toString());
    searchParams.append('pageSize', params.pagination.pageSize.toString());
    if (params.pagination.sortBy) {
      searchParams.append('sortBy', params.pagination.sortBy);
    }
    if (params.pagination.sortOrder) {
      searchParams.append('sortOrder', params.pagination.sortOrder);
    }
  }

  return searchParams.toString();
}