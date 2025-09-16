import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { Session } from 'next-auth'
import { ApiResponses } from './responses'

export type AuthenticatedHandler<T = unknown> = (
  request: NextRequest,
  session: Session
) => Promise<NextResponse<T> | NextResponse<unknown>>

export type AuthenticatedHandlerWithParams<T = unknown> = (
  request: NextRequest,
  params: Record<string, unknown>,
  session: Session
) => Promise<NextResponse<T> | NextResponse<unknown>>

/**
 * Higher-order function to wrap API routes with authentication
 * Automatically checks for valid session and returns 401 if not authenticated
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>
): (request: NextRequest) => Promise<NextResponse<T | { error: string }>> {
  return async (request: NextRequest) => {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return ApiResponses.unauthorized()
    }
    
    try {
      return await handler(request, session)
    } catch (error) {
      return ApiResponses.handleError(error)
    }
  }
}

/**
 * Higher-order function for routes with params (e.g., [id] routes)
 */
export function withAuthAndParams<T = unknown>(
  handler: AuthenticatedHandlerWithParams<T>
): (request: NextRequest, params: Record<string, unknown>) => Promise<NextResponse<T | { error: string }>> {
  return async (request: NextRequest, params: Record<string, unknown>) => {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return ApiResponses.unauthorized()
    }
    
    try {
      return await handler(request, params, session)
    } catch (error) {
      return ApiResponses.handleError(error)
    }
  }
}

/**
 * Check if user has required role(s)
 */
export function requireRole(session: Session, allowedRoles: string[]): boolean {
  return allowedRoles.includes((session.user as any).role)
}

export function requireDept(session: Session, allowedDepts: string[]): boolean {
  const depts: string[] | undefined = (session.user as any).departments
  if (!allowedDepts.length) return true
  if (!depts?.length) return false
  return allowedDepts.some((d) => depts.includes(d))
}

export function withRoleAndDept<T = unknown>(
  allowedRoles: string[],
  allowedDepts: string[] | undefined,
  handler: AuthenticatedHandler<T>
): (request: NextRequest) => Promise<NextResponse<T | { error: string }>> {
  return withAuth(async (request, session) => {
    if (!requireRole(session, allowedRoles)) {
      return ApiResponses.forbidden('Insufficient role')
    }
    if (allowedDepts && !requireDept(session, allowedDepts)) {
      return ApiResponses.forbidden('Insufficient department')
    }
    return handler(request, session)
  })
}

/**
 * Higher-order function that also checks for specific roles
 */
export function withRole<T = unknown>(
  allowedRoles: string[],
  handler: AuthenticatedHandler<T>
): (request: NextRequest) => Promise<NextResponse<T | { error: string }>> {
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
export function withWarehouse<T = unknown>(
  handler: AuthenticatedHandler<T>
): (request: NextRequest) => Promise<NextResponse<T | { error: string }>> {
  return withAuth(async (request, session) => {
    if (!requireWarehouse(session)) {
      return ApiResponses.badRequest('No warehouse assigned to this user')
    }
    return handler(request, session)
  })
}
