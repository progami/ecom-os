import { NextRequest, NextResponse } from 'next/server';
import { priorityRateLimiter, RequestPriority } from '@/lib/priority-rate-limiter';
import { getRedisStatus } from '@/lib/redis';
import { structuredLogger } from '@/lib/logger';
import { withValidation } from '@/lib/validation/middleware';
import { getTenantId } from '@/lib/xero-helpers';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('[Rate Limit Status API] Fetching rate limit status', {
      component: 'rate-limit-status'
    });

    // Get and validate tenant ID
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          details: 'Please login to view rate limit status'
        },
        { status: 401 }
      );
    }

    // Get Redis connection status
    const redisStatus = await getRedisStatus();
    
    // Get queue statistics
    const queueStats = await priorityRateLimiter.getQueueStats();

    // Calculate health metrics
    const queueHealth = {
      status: queueStats.queueLength === 0 ? 'healthy' : 
              queueStats.queueLength < 10 ? 'moderate' :
              queueStats.queueLength < 50 ? 'high' : 'critical',
      averageWaitTime: Math.round(queueStats.averageWaitTime / 1000), // Convert to seconds
      recommendation: 
        queueStats.queueLength === 0 ? 'No action needed' :
        queueStats.queueLength < 10 ? 'Monitor queue length' :
        queueStats.queueLength < 50 ? 'Consider increasing rate limits or adding cache' :
        'Urgent: Review rate limiting configuration and Xero API usage'
    };

    // Get priority distribution
    const totalQueued = Object.values(queueStats.priorityBreakdown).reduce((sum, count) => sum + count, 0);
    const priorityPercentages = Object.entries(queueStats.priorityBreakdown).reduce((acc, [priority, count]) => {
      acc[priority] = totalQueued > 0 ? Math.round((count / totalQueued) * 100) : 0;
      return acc;
    }, {} as Record<string, number>);

    const response = {
      redis: redisStatus,
      queue: {
        ...queueStats,
        health: queueHealth,
        priorityPercentages
      },
      rateLimits: {
        configuration: {
          critical: '30 requests/minute',
          high: '20 requests/minute', 
          normal: '15 requests/minute',
          low: '5 requests/minute'
        },
        endpoints: {
          'cash-flow': '40 requests/minute',
          'aged-receivables': '30 requests/minute',
          'aged-payables': '30 requests/minute',
          'bank-summary': '35 requests/minute',
          'financial-overview': '25 requests/minute',
          'cache-warm': '5 requests/minute'
        }
      },
      recommendations: [
        queueHealth.recommendation,
        redisStatus.connected ? 
          'Redis connection healthy' : 
          'Warning: Redis disconnected - rate limiting using in-memory fallback',
        queueStats.averageWaitTime > 30000 ? 
          'High average wait time - consider optimizing Xero API usage' : 
          'Wait times acceptable'
      ].filter(rec => rec !== 'No action needed'),
      tenantId,
      timestamp: new Date().toISOString()
    };

    structuredLogger.info('[Rate Limit Status API] Rate limit status retrieved successfully', {
      component: 'rate-limit-status',
      tenantId,
      queueLength: queueStats.queueLength,
      queueHealth: queueHealth.status,
      redisConnected: redisStatus.connected
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    structuredLogger.error('[Rate Limit Status API] Error fetching rate limit status', error, {
      component: 'rate-limit-status'
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch rate limit status',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Queue management endpoint
export async function DELETE(request: NextRequest) {
  try {
    structuredLogger.info('[Rate Limit Status API] Clearing queue', {
      component: 'rate-limit-status'
    });

    // Get and validate tenant ID
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          details: 'Please login to clear queue'
        },
        { status: 401 }
      );
    }

    // Clear the queue (emergency operation)
    const clearedCount = priorityRateLimiter.clearQueue();
    
    structuredLogger.warn('[Rate Limit Status API] Queue cleared by user', {
      component: 'rate-limit-status',
      tenantId,
      clearedCount
    });

    return NextResponse.json({
      success: true,
      clearedCount,
      message: 'Priority queue cleared successfully',
      tenantId,
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error: any) {
    structuredLogger.error('[Rate Limit Status API] Error clearing queue', error, {
      component: 'rate-limit-status'
    });

    return NextResponse.json(
      {
        error: 'Failed to clear queue',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Priority testing endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { priority = 'normal', endpoint = '/test' } = body;

    // Get and validate tenant ID
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          details: 'Please login to test rate limiting'
        },
        { status: 401 }
      );
    }

    // Map string priority to enum
    const priorityEnum = {
      critical: RequestPriority.CRITICAL,
      high: RequestPriority.HIGH,
      normal: RequestPriority.NORMAL,
      low: RequestPriority.LOW
    }[priority] || RequestPriority.NORMAL;

    // Test rate limit check
    const rateCheck = await priorityRateLimiter.checkRateLimit(
      tenantId,
      endpoint,
      priorityEnum
    );

    const response = {
      testResult: rateCheck,
      priority,
      endpoint,
      tenantId,
      timestamp: new Date().toISOString()
    };

    structuredLogger.info('[Rate Limit Status API] Rate limit test completed', {
      component: 'rate-limit-status',
      tenantId,
      priority,
      endpoint,
      allowed: rateCheck.allowed
    });

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    structuredLogger.error('[Rate Limit Status API] Error testing rate limit', error, {
      component: 'rate-limit-status'
    });

    return NextResponse.json(
      {
        error: 'Failed to test rate limit',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

