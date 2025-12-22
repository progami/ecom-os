import { NextRequest, NextResponse } from 'next/server'
import { authRateLimitConfig, getAuthRateLimiter } from '@/lib/security/auth-rate-limiter'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const username = request.nextUrl.searchParams.get('username')

  if (!username) {
    return NextResponse.json({ error: 'Username parameter required' }, { status: 400 })
  }

  const limiter = getAuthRateLimiter()
  const result = await limiter.checkAuthLimit(request, username, authRateLimitConfig)

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
      exponentialBackoff: authRateLimitConfig.exponentialBackoff,
    },
  })
}
