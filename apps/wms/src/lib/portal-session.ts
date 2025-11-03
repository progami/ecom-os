import type { Session } from 'next-auth'
import type { NextRequest } from 'next/server'
import {
  decodePortalSession,
  getCandidateSessionCookieNames,
  getAppEntitlement,
} from '@ecom-os/auth'
import { UserRole } from '@prisma/client'

const DEFAULT_DEV_SECRET = 'dev_portal_auth_secret_2025'
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const APP_ID = 'ecomos'
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

const getPortalSecrets = () => ({
  portalSecret: process.env.PORTAL_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? DEFAULT_DEV_SECRET,
})

const resolvePortalBaseUrl = () =>
  process.env.PORTAL_AUTH_URL
  ?? process.env.NEXT_PUBLIC_PORTAL_AUTH_URL
  ?? process.env.NEXTAUTH_URL
  ?? 'https://dev.ecomos.targonglobal.com'

const coerceExpiry = (expires?: string) =>
  expires && !Number.isNaN(new Date(expires).getTime())
    ? expires
    : new Date(Date.now() + SESSION_MAX_AGE_MS).toISOString()

const buildSessionFromPayload = (payload: PortalSessionPayload | null): Session | null => {
  if (!payload?.user?.id) {
    if (process.env.NODE_ENV !== 'production') {
      return {
        user: {
          id: 'dev-portal-user',
          email: payload?.user?.email ?? 'dev@local.test',
          name: payload?.user?.name ?? 'Dev Portal User',
          role: 'admin',
          departments: [],
        } as Session['user'],
        expires: coerceExpiry(payload?.expires),
      }
    }
    return null
  }

  const entitlement = getAppEntitlement(payload.roles, 'wms')
  const allowedRole = entitlement?.role && ALLOWED_ROLES.includes(entitlement.role as UserRole)
    ? entitlement.role as UserRole
    : process.env.NODE_ENV !== 'production'
      ? 'admin'
      : undefined
  if (!allowedRole) {
    return process.env.NODE_ENV !== 'production'
      ? {
          user: {
            id: payload.user.id,
            email: payload.user.email ?? undefined,
            name: payload.user.name ?? undefined,
            role: 'admin',
            departments: [],
          } as Session['user'],
          expires: coerceExpiry(payload.expires),
        }
      : null
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
  if (!cookieHeader) return null

  const { portalSecret } = getPortalSecrets()
  const candidates = getCandidateSessionCookieNames(APP_ID)
  const decoded = await decodePortalSession({
    cookieHeader,
    cookieNames: candidates,
    appId: APP_ID,
    secret: portalSecret,
    debug: process.env.NODE_ENV !== 'production',
  })

  const directSession = buildSessionFromPayload(decoded as unknown as PortalSessionPayload | null)
  if (directSession) {
    return directSession
  }

  const portalPayload = await fetchPortalSession(cookieHeader)
  return buildSessionFromPayload(portalPayload)
}
