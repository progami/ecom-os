import { NextRequest, NextResponse } from 'next/server';
import { XeroReportFetcher } from '@/lib/xero-report-fetcher';
import { structuredLogger } from '@/lib/logger';
import { withValidation } from '@/lib/validation/middleware';
import { getTenantId } from '@/lib/xero-helpers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('[Financial Overview API] Starting financial overview fetch', {
      component: 'financial-overview-report'
    });

    // Get and validate tenant ID
    const tenantId = await getTenantId(request);
    
    // If no tenant ID, return disconnected state
    if (!tenantId) {
      structuredLogger.info('[Financial Overview API] No Xero tenant ID found - returning disconnected state', {
        component: 'financial-overview-report'
      });
      
      return NextResponse.json({
        connected: false,
        lastSyncedAt: undefined,
        financialReports: undefined
      });
    }

    // Get the last sync time from the database
    let lastSyncedAt: string | undefined;
    try {
      // Try to get the most recent sync from any synced entity
      // Check contacts as they have lastSyncedAt field
      const recentContact = await prisma.contact.findFirst({
        orderBy: {
          lastSyncedAt: 'desc'
        },
        select: {
          lastSyncedAt: true
        }
      });
      
      if (recentContact) {
        lastSyncedAt = recentContact.lastSyncedAt.toISOString();
      } else {
        // If no contacts, check for any recent data updates
        const recentInvoice = await prisma.invoice.findFirst({
          orderBy: {
            updatedAt: 'desc'
          },
          select: {
            updatedAt: true
          }
        });
        
        if (recentInvoice) {
          lastSyncedAt = recentInvoice.updatedAt.toISOString();
        }
      }
    } catch (error) {
      structuredLogger.warn('[Financial Overview API] Could not fetch last sync time', {
        component: 'financial-overview-report',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Get the last update times for each report type
    const financialReports: any = {};
    
    try {
      // Check for cached report data in the database
      const reportTypes = ['balanceSheet', 'profitLoss', 'cashFlow', 'trialBalance', 'generalLedger'];
      
      for (const reportType of reportTypes) {
        try {
          // For now, we'll use the lastSyncedAt time for all reports
          // In a real implementation, you'd track individual report update times
          if (lastSyncedAt) {
            financialReports[reportType] = {
              lastUpdated: lastSyncedAt
            };
          }
        } catch (error) {
          structuredLogger.warn(`[Financial Overview API] Could not fetch ${reportType} metadata`, {
            component: 'financial-overview-report',
            reportType,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      structuredLogger.error('[Financial Overview API] Error fetching report metadata', error, {
        component: 'financial-overview-report'
      });
    }

    const response = {
      connected: true,
      lastSyncedAt,
      financialReports: Object.keys(financialReports).length > 0 ? financialReports : undefined
    };

    structuredLogger.info('[Financial Overview API] Financial overview metadata generated successfully', {
      component: 'financial-overview-report',
      tenantId,
      connected: response.connected,
      hasLastSync: !!response.lastSyncedAt,
      reportCount: Object.keys(financialReports).length
    });

    // Set cache headers for 1 minute (metadata endpoint)
    const responseHeaders = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { 
      status: 200,
      headers: responseHeaders
    });

  } catch (error: any) {
    structuredLogger.error('[Financial Overview API] Error fetching financial overview from Xero', error, {
      component: 'financial-overview-report'
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch financial overview from Xero',
        details: error.message || 'Unknown error',
        recommendation: 'Please check your Xero connection and try again'
      },
      { status: 500 }
    );
  }
}

