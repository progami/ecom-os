import type { Session } from 'next-auth'
import type { NextRequest } from 'next/server'
import { getAppEntitlement } from '@ecom-os/auth'
import { UserRole } from '@ecom-os/prisma-wms'

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const ALLOWED_ROLES: readonly UserRole[] = ['admin', 'staff']

type PortalSessionPayload = {
  user?: {
    id?: string
    email?: string
    name?: string
    role?: string
    apps?: string[]
  }
  expires?: string
  roles?: Record<string, { role?: string; departments?: string[] }>
}

const resolvePortalBaseUrl = () => {
  const candidate =
    process.env.PORTAL_AUTH_URL ??
    process.env.NEXT_PUBLIC_PORTAL_AUTH_URL ??
    process.env.NEXTAUTH_URL

  if (!candidate) {
    throw new Error('PORTAL_AUTH_URL, NEXT_PUBLIC_PORTAL_AUTH_URL, or NEXTAUTH_URL must be configured for portal session resolution.')
  }

  return candidate
}

const coerceExpiry = (expires?: string) =>
  expires && !Number.isNaN(new Date(expires).getTime())
    ? expires
    : new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString()

const buildSessionFromPayload = (payload: PortalSessionPayload | null): Session | null => {
  if (!payload?.user?.id) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wms portal-session] portal payload missing user id')
    }
    return null
  }

  const entitlement = getAppEntitlement(payload.roles, 'wms')
  const allowedRole = entitlement?.role && ALLOWED_ROLES.includes(entitlement.role as UserRole)
    ? entitlement.role as UserRole
    : undefined
  if (!allowedRole) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wms portal-session] portal payload missing allowed role', entitlement)
    }
    return null
  }
  const departments = entitlement?.depts?.filter((dept): dept is string => typeof dept === 'string')

  return {
    user: {
      id: payload.user.id,
      email: payload.user.email ?? undefined,
      name: payload.user.name ?? undefined,
      role: allowedRole,
      departments,
    } as Session['user'],
    expires: coerceExpiry(payload.expires),
  }
}

const fetchPortalSession = async (cookieHeader: string): Promise<PortalSessionPayload | null> => {
  try {
    const res = await fetch(`${resolvePortalBaseUrl()}/api/auth/session`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        cookie: cookieHeader,
        'cache-control': 'no-store',
        'x-ecomos-session-probe': '1',
      },
    })
    if (!res.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[wms portal-session] portal responded with', res.status)
      }
      return null
    }
    const data = await res.json().catch(() => null)
    if (!data || typeof data !== 'object') return null
    return data as PortalSessionPayload
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wms portal-session] portal fetch failed', error)
    }
    return null
  }
}

export async function resolvePortalSession(request: NextRequest): Promise<Session | null> {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wms portal-session] no cookies on request')
    }
    return null
  }

  const portalPayload = await fetchPortalSession(cookieHeader)
  if (!portalPayload) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[wms portal-session] portal session fetch returned null')
    }
    return null
  }
  return buildSessionFromPayload(portalPayload)
}
