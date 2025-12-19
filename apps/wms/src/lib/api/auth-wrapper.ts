import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { ApiResponses } from './responses'
import { auth } from '@/lib/auth'
import { requireTenantAccess, TenantAccessError } from '@/lib/tenant/guard'

type SessionRole = string | undefined

const getUserRole = (session: Session): SessionRole => {
  const role = (session.user as { role?: unknown })?.role
  return typeof role === 'string' ? role : undefined
}

export type AuthenticatedHandler = (
  request: NextRequest,
  session: Session
) => Promise<Response>

export type AuthenticatedHandlerWithParams = (
  request: NextRequest,
  params: Record<string, unknown>,
  session: Session
) => Promise<Response>

/**
 * Higher-order function to wrap API routes with authentication and tenant guard
 * Automatically checks for valid session and validates tenant access
 */
export function withAuth(
  handler: AuthenticatedHandler
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    const session = await auth()

    if (!session) {
      return ApiResponses.unauthorized()
    }

    try {
      // Validate user has access to current tenant
      await requireTenantAccess(session)
      return await handler(request, session)
    } catch (error) {
      if (error instanceof TenantAccessError) {
        return ApiResponses.forbidden(error.message)
      }
      return ApiResponses.handleError(error)
    }
  }
}

/**
 * Higher-order function for routes with params (e.g., [id] routes)
 */
export function withAuthAndParams(
  handler: AuthenticatedHandlerWithParams
): (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<Response> {
  return async (
    request: NextRequest,
    context
  ) => {
    const hydratedParams = await Promise.resolve(
      context?.params ?? Promise.resolve({} as Record<string, string>)
    )
    const contextParams = hydratedParams as Record<string, unknown>

    const session = await auth()

    if (!session) {
      return ApiResponses.unauthorized()
    }

    try {
      // Validate user has access to current tenant
      await requireTenantAccess(session)
      return await handler(request, contextParams, session)
    } catch (error) {
      if (error instanceof TenantAccessError) {
        return ApiResponses.forbidden(error.message)
      }
      return ApiResponses.handleError(error)
    }
  }
}

/**
 * Check if user has required role(s)
 */
export function requireRole(session: Session, allowedRoles: string[]): boolean {
  const role = getUserRole(session)
  if (!role) {
    return false
  }
  return allowedRoles.includes(role)
}

/**
 * Higher-order function that also checks for specific roles
 */
export function withRole(
  allowedRoles: string[],
  handler: AuthenticatedHandler
): (request: NextRequest) => Promise<Response> {
  return withAuth(async (request, session) => {
    if (!requireRole(session, allowedRoles)) {
      return ApiResponses.forbidden('Insufficient permissions')
    }
    return handler(request, session)
  })
}

/**
 * Check if staff user has warehouse assigned
 */
export function requireWarehouse(session: Session): boolean {
  if (session.user.role === 'staff' && !session.user.warehouseId) {
    return false
  }
  return true
}

/**
 * Higher-order function that checks for warehouse assignment for staff
 */
export function withWarehouse(
  handler: AuthenticatedHandler
): (request: NextRequest) => Promise<Response> {
  return withAuth(async (request, session) => {
    if (!requireWarehouse(session)) {
      return ApiResponses.badRequest('No warehouse assigned to this user')
    }
    return handler(request, session)
  })
}
