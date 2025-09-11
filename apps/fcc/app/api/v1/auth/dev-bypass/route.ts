import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from '@/lib/cookie-config'
import { structuredLogger } from '@/lib/logger'
import { withErrorHandling, ApiErrors } from '@/lib/errors/api-error-wrapper'

export const GET = withErrorHandling(
  async (request: NextRequest) => {
    // IMPORTANT: Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
      structuredLogger.error('Dev bypass attempted in non-development environment', {
        component: 'auth-dev-bypass',
        environment: process.env.NODE_ENV
      })
      throw ApiErrors.forbidden('Dev bypass is only available in development environment')
    }

    // Log the bypass attempt
    structuredLogger.info('Dev bypass authentication initiated', {
      component: 'auth-dev-bypass',
      timestamp: new Date().toISOString()
    })

    // Get the redirect URL from query params
    const { searchParams } = new URL(request.url)
    const redirectTo = searchParams.get('redirect') || '/finance'

    // Create test session data matching the structure from login route
    const sessionData = {
      user: {
        id: 'dev-user-123',
        email: 'dev@example.com',
        name: 'Dev User'
      },
      userId: 'dev-user-123',
      email: 'dev@example.com',
      tenantId: 'dev-tenant-123',
      tenantName: 'Dev Organization'
    }

    structuredLogger.info('Dev bypass session created', {
      component: 'auth-dev-bypass',
      userId: sessionData.userId,
      email: sessionData.email,
      tenantId: sessionData.tenantId,
      redirectTo
    })

    // Create redirect response
    const response = NextResponse.redirect(new URL(redirectTo, request.url))

    // Set session cookie with proper configuration
    response.cookies.set(
      SESSION_COOKIE_NAME, 
      JSON.stringify(sessionData), 
      AUTH_COOKIE_OPTIONS
    )

    structuredLogger.info('Dev bypass authentication successful', {
      component: 'auth-dev-bypass',
      userId: sessionData.userId,
      redirectTo,
      cookieSet: true
    })

    return response
  },
  { endpoint: '/api/v1/auth/dev-bypass' }
)

export const POST = withErrorHandling(
  async (request: NextRequest) => {
    // IMPORTANT: Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
      structuredLogger.error('Dev bypass POST attempted in non-development environment', {
        component: 'auth-dev-bypass',
        environment: process.env.NODE_ENV
      })
      throw ApiErrors.forbidden('Dev bypass is only available in development environment')
    }

    // Parse optional custom session data from request body
    let customData = {}
    try {
      const body = await request.json()
      customData = body
    } catch (e) {
      // No body provided, use defaults
      structuredLogger.info('No custom data provided for dev bypass, using defaults', {
        component: 'auth-dev-bypass'
      })
    }

    // Create test session data with possible overrides
    const sessionData = {
      user: {
        id: customData.userId || 'dev-user-123',
        email: customData.email || 'dev@example.com',
        name: customData.name || 'Dev User'
      },
      userId: customData.userId || 'dev-user-123',
      email: customData.email || 'dev@example.com',
      tenantId: customData.tenantId || 'dev-tenant-123',
      tenantName: customData.tenantName || 'Dev Organization'
    }

    structuredLogger.info('Dev bypass session created via POST', {
      component: 'auth-dev-bypass',
      userId: sessionData.userId,
      email: sessionData.email,
      tenantId: sessionData.tenantId,
      hasCustomData: Object.keys(customData).length > 0
    })

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Dev authentication bypass activated',
      session: sessionData
    })

    // Set session cookie
    response.cookies.set(
      SESSION_COOKIE_NAME,
      JSON.stringify(sessionData),
      AUTH_COOKIE_OPTIONS
    )

    return response
  },
  { endpoint: '/api/v1/auth/dev-bypass' }
)