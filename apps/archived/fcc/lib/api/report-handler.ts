import { NextRequest, NextResponse } from 'next/server';
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation';
import { ReportDatabaseFetcher } from '@/lib/report-database-fetcher';
import { structuredLogger } from '@/lib/logger';
import { ZodSchema } from 'zod';

export interface ReportHandlerOptions<T> {
  reportType: string;
  databaseFetcher: (params: any) => Promise<T | null>;
  xeroFetcher?: (tenantId: string, params?: any) => Promise<T | null>;
  requestSchema?: ZodSchema;
  cacheHeaders?: Record<string, string>;
  requireAuth?: boolean;
  validationLevel?: ValidationLevel;
}

export function createReportHandler<T>({
  reportType,
  databaseFetcher,
  xeroFetcher,
  requestSchema,
  cacheHeaders = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    'CDN-Cache-Control': 'max-age=600',
  },
  requireAuth = true,
  validationLevel = ValidationLevel.USER,
}: ReportHandlerOptions<T>) {
  return async (request: NextRequest) => {
    const logContext = `[${reportType} Handler]`;
    
    try {
      // Validate authentication if required
      if (requireAuth) {
        const session = await validateSession(request, validationLevel);
        if (!session.isValid || !session.user) {
          structuredLogger.warn(`${logContext} Unauthorized access attempt`);
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
      }

      // Parse and validate request parameters
      const { searchParams } = new URL(request.url);
      const params = Object.fromEntries(searchParams.entries());
      
      if (requestSchema) {
        const validation = requestSchema.safeParse(params);
        if (!validation.success) {
          structuredLogger.warn(`${logContext} Invalid request parameters`, {
            errors: validation.error.errors,
          });
          return NextResponse.json(
            { error: 'Invalid request parameters', details: validation.error.errors },
            { status: 400 }
          );
        }
      }

      const forceRefresh = params.refresh === 'true';
      
      // Try database first unless force refresh
      if (!forceRefresh) {
        try {
          structuredLogger.info(`${logContext} Checking database for cached data`);
          const databaseData = await databaseFetcher(params);
          
          if (databaseData) {
            structuredLogger.info(`${logContext} Found data in database`);
            return NextResponse.json(
              {
                ...databaseData,
                source: 'database',
                fetchedAt: new Date().toISOString(),
              },
              { headers: cacheHeaders }
            );
          }
        } catch (dbError) {
          structuredLogger.error(`${logContext} Database fetch error`, dbError);
          // Continue to Xero fallback
        }
      }

      // Check if Xero is disabled
      const isXeroDisabled = await ReportDatabaseFetcher.isXeroApiDisabled();
      if (isXeroDisabled) {
        structuredLogger.info(`${logContext} Xero API is disabled`);
        return NextResponse.json(
          {
            error: 'No data available',
            message: 'Please import data from Xero first',
            recommendation: 'Use the Import feature to sync data from Xero',
          },
          { status: 404 }
        );
      }

      // Try Xero API if available
      if (xeroFetcher) {
        try {
          structuredLogger.info(`${logContext} Fetching from Xero API`);
          const tenantId = request.headers.get('xero-tenant-id') || '';
          
          if (!tenantId) {
            return NextResponse.json(
              { error: 'Xero tenant ID required' },
              { status: 400 }
            );
          }
          
          const xeroData = await xeroFetcher(tenantId, params);
          
          if (xeroData) {
            structuredLogger.info(`${logContext} Successfully fetched from Xero`);
            return NextResponse.json(
              {
                ...xeroData,
                source: 'xero',
                fetchedAt: new Date().toISOString(),
              },
              { headers: cacheHeaders }
            );
          }
        } catch (xeroError) {
          structuredLogger.error(`${logContext} Xero API error`, xeroError);
          return NextResponse.json(
            {
              error: 'Failed to fetch from Xero',
              message: xeroError instanceof Error ? xeroError.message : 'Unknown error',
            },
            { status: 500 }
          );
        }
      }

      // No data available from any source
      return NextResponse.json(
        {
          error: 'No data available',
          message: 'Unable to retrieve report data',
        },
        { status: 404 }
      );
      
    } catch (error) {
      structuredLogger.error(`${logContext} Unexpected error`, error);
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  };
}