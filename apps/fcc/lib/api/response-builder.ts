import { ReportMetadata } from '@/lib/reports/types';

export interface BuildReportResponseOptions<T> {
  data: T;
  source: 'database' | 'xero' | 'import';
  importId?: string;
  additionalMetadata?: Record<string, any>;
}

export function buildReportResponse<T>({
  data,
  source,
  importId,
  additionalMetadata = {},
}: BuildReportResponseOptions<T>) {
  const metadata: ReportMetadata = {
    source,
    fetchedAt: new Date().toISOString(),
    ...(importId && { importId }),
    ...additionalMetadata,
  };

  return {
    data,
    metadata,
  };
}

export function buildErrorResponse(
  error: Error | string,
  statusCode: number = 500,
  context?: string
) {
  const errorMessage = error instanceof Error ? error.message : error;
  
  const response = {
    error: true,
    message: errorMessage,
    ...(context && { context }),
    timestamp: new Date().toISOString(),
  };

  // Add recommendations based on error type
  if (statusCode === 404) {
    response['recommendation'] = 'Try importing data from Xero or check your filters';
  } else if (statusCode === 401) {
    response['recommendation'] = 'Please log in to access this resource';
  } else if (statusCode === 500) {
    response['recommendation'] = 'Please try again later or contact support if the issue persists';
  }

  return response;
}

export function buildSuccessResponse<T>(
  data: T,
  message?: string
) {
  return {
    success: true,
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  };
}