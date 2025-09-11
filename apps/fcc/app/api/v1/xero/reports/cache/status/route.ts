import { NextRequest, NextResponse } from 'next/server';
import { ReportCacheManager } from '@/lib/report-cache-manager';
import { getRedisStatus } from '@/lib/redis';
import { structuredLogger } from '@/lib/logger';
import { withValidation } from '@/lib/validation/middleware';
import { getTenantId } from '@/lib/xero-helpers';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('[Cache Status API] Fetching cache status', {
      component: 'cache-status'
    });

    // Get and validate tenant ID
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json(
        { 
          error: 'Xero connection required',
          details: 'Please connect to Xero to view cache status'
        },
        { status: 401 }
      );
    }

    // Get Redis connection status
    const redisStatus = await getRedisStatus();
    
    // Get cache statistics for this tenant
    const cacheStats = await ReportCacheManager.getCacheStats(tenantId);

    const response = {
      redis: redisStatus,
      cache: {
        ...cacheStats,
        status: redisStatus.connected ? 'healthy' : 'disconnected',
        performance: {
          hitRateCategory: 
            cacheStats.hitRate >= 80 ? 'excellent' :
            cacheStats.hitRate >= 60 ? 'good' :
            cacheStats.hitRate >= 40 ? 'fair' : 'poor',
          recommendation: 
            cacheStats.hitRate < 40 ? 'Consider warming cache for frequently accessed reports' :
            cacheStats.hitRate < 60 ? 'Cache performance is acceptable but could be improved' :
            'Cache performance is good'
        }
      },
      tenantId,
      timestamp: new Date().toISOString()
    };

    structuredLogger.info('[Cache Status API] Cache status retrieved successfully', {
      component: 'cache-status',
      tenantId,
      hitRate: cacheStats.hitRate,
      cacheSize: cacheStats.cacheSize,
      redisConnected: redisStatus.connected
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    structuredLogger.error('[Cache Status API] Error fetching cache status', error, {
      component: 'cache-status'
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch cache status',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Cache clearing endpoint
export async function DELETE(request: NextRequest) {
  try {
    structuredLogger.info('[Cache Status API] Clearing cache', {
      component: 'cache-status'
    });

    // Get and validate tenant ID
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json(
        { 
          error: 'Xero connection required',
          details: 'Please connect to Xero to clear cache'
        },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const reportType = searchParams.get('reportType');

    let clearedCount = 0;

    if (reportType) {
      // Clear specific report type
      const success = await ReportCacheManager.invalidate(
        tenantId, 
        reportType as any // Type assertion - should validate in real implementation
      );
      clearedCount = success ? 1 : 0;
      
      structuredLogger.info('[Cache Status API] Specific cache cleared', {
        component: 'cache-status',
        tenantId,
        reportType,
        success
      });
    } else {
      // Clear all caches for tenant
      clearedCount = await ReportCacheManager.invalidateAllForTenant(tenantId);
      
      structuredLogger.info('[Cache Status API] All tenant caches cleared', {
        component: 'cache-status',
        tenantId,
        clearedCount
      });
    }

    return NextResponse.json({
      success: true,
      clearedCount,
      tenantId,
      reportType: reportType || 'all',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error: any) {
    structuredLogger.error('[Cache Status API] Error clearing cache', error, {
      component: 'cache-status'
    });

    return NextResponse.json(
      {
        error: 'Failed to clear cache',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

