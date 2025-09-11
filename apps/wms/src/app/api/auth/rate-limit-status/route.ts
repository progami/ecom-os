import { NextRequest, NextResponse } from 'next/server';
import { getAuthRateLimiter, authRateLimitConfig } from '@/lib/security/auth-rate-limiter';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  
  if (!username) {
    return NextResponse.json({
      error: 'Username parameter required'
    }, { status: 400 });
  }

  const limiter = getAuthRateLimiter();
  const result = await limiter.checkAuthLimit(req, username, authRateLimitConfig);

  return NextResponse.json({
    username,
    allowed: result.allowed,
    retryAfter: result.retryAfter,
    reason: result.reason,
    config: {
      windowMinutes: authRateLimitConfig.windowMs / 1000 / 60,
      maxAttempts: authRateLimitConfig.maxAttempts,
      lockoutMinutes: authRateLimitConfig.lockoutDuration / 1000 / 60,
      lockoutThreshold: authRateLimitConfig.lockoutThreshold,
      exponentialBackoff: authRateLimitConfig.exponentialBackoff
    }
  });
}