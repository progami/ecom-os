import { NextResponse } from 'next/server'
import { getTenantId } from '@/lib/xero-helpers'
import { structuredLogger } from '@/lib/logger'
import { XeroReportFetcher } from '@/lib/xero-report-fetcher'
import { ReportDatabaseFetcher } from '@/lib/report-database-fetcher'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const importId = searchParams.get('importId');
    const asAtDateParam = searchParams.get('date');
    const asAtDate = asAtDateParam ? new Date(asAtDateParam) : new Date('2025-06-30');
    
    structuredLogger.info('[Balance Sheet API] Request received', {
      source,
      importId,
      asAtDate: asAtDate.toISOString()
    });
    
    // If specific import requested
    if (importId) {
      const importedData = await ReportDatabaseFetcher.fetchBalanceSheet(asAtDate, asAtDate, importId);
      if (importedData) {
        return NextResponse.json({
          ...importedData,
          source: 'import',
          fetchedAt: new Date().toISOString()
        });
      }
      return NextResponse.json(
        { error: 'Import not found' },
        { status: 404 }
      );
    }
    
    // If live data explicitly requested
    if (source === 'live') {
      try {
        const tenantId = await getTenantId(request);
        if (!tenantId) {
          return NextResponse.json(
            { error: 'Xero not connected' },
            { status: 401 }
          );
        }
        
        structuredLogger.info('[Balance Sheet API] Fetching detailed balance sheet from Xero', {
          tenantId,
          asAtDate: asAtDate.toISOString()
        });
        
        // Use the new detailed balance sheet method
        const detailedData = await XeroReportFetcher.fetchDetailedBalanceSheet(tenantId, asAtDate);
        
        return NextResponse.json(detailedData);
      } catch (error) {
        structuredLogger.error('[Balance Sheet API] Failed to fetch from Xero', error);
        
        // Check if it's a token/client unavailable error
        const errorMessage = error instanceof Error ? error.message : '';
        const isClientUnavailable = errorMessage.includes('Xero client not available');
        const isUnauthorized = errorMessage.includes('401') || errorMessage.includes('unauthorized');
        
        if (isClientUnavailable || isUnauthorized) {
          // Check token status
          const tokenValidationUrl = new URL('/api/v1/xero/auth/validate', request.url);
          try {
            const tokenResponse = await fetch(tokenValidationUrl.toString());
            const tokenData = await tokenResponse.json();
            
            if (!tokenData.valid && tokenData.requiresAuth) {
              return NextResponse.json({
                error: 'Xero authentication required',
                message: 'Your Xero session has expired. Please reconnect to Xero to fetch live data.',
                requiresAuth: true,
                authUrl: '/api/v1/xero/auth',
                tokenInfo: tokenData.tokenInfo,
                source: 'error'
              }, { status: 401 });
            }
          } catch (validationError) {
            structuredLogger.warn('[Balance Sheet API] Failed to validate token status', validationError);
          }
        }
        
        return NextResponse.json(
          { 
            error: 'Failed to fetch balance sheet from Xero',
            details: error instanceof Error ? error.message : 'Unknown error',
            requiresAuth: isClientUnavailable || isUnauthorized,
            message: isClientUnavailable 
              ? 'Unable to connect to Xero. Please check your authentication.'
              : 'An error occurred while fetching the balance sheet.'
          },
          { status: 500 }
        );
      }
    }
    
    // Default: Try database first
    const databaseData = await ReportDatabaseFetcher.fetchBalanceSheet(asAtDate, asAtDate);
    if (databaseData) {
      return NextResponse.json({
        ...databaseData,
        source: 'database',
        fetchedAt: new Date().toISOString()
      });
    }
    
    // If no database data and Xero is not disabled, try Xero
    const isXeroDisabled = await ReportDatabaseFetcher.isXeroApiDisabled();
    if (!isXeroDisabled) {
      try {
        const tenantId = await getTenantId(request);
        if (tenantId) {
          const detailedData = await XeroReportFetcher.fetchDetailedBalanceSheet(tenantId, asAtDate);
          return NextResponse.json(detailedData);
        }
      } catch (error) {
        structuredLogger.warn('[Balance Sheet API] Failed to fetch from Xero as fallback', error);
        
        // Check if it's an authentication issue
        const errorMessage = error instanceof Error ? error.message : '';
        if (errorMessage.includes('Xero client not available')) {
          // Try to get more info about token status
          try {
            const tokenValidationUrl = new URL('/api/v1/xero/auth/validate', request.url);
            const tokenResponse = await fetch(tokenValidationUrl.toString());
            const tokenData = await tokenResponse.json();
            
            if (!tokenData.valid) {
              structuredLogger.info('[Balance Sheet API] Xero authentication required for data access', {
                tokenValid: tokenData.valid,
                requiresAuth: tokenData.requiresAuth
              });
            }
          } catch (validationError) {
            // Silent fail - we'll show generic message
          }
        }
      }
    }
    
    // No data available
    return NextResponse.json({
      error: 'No balance sheet data available',
      message: 'Please import balance sheet data to view this report',
      recommendation: 'Go to Reports → Import Data to upload balance sheet data',
      source: 'none'
    }, { status: 404 });
    
  } catch (error) {
    structuredLogger.error('[Balance Sheet API] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}