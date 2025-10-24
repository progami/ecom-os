import { withBasePath } from '@/lib/utils/base-path'

function ensureLeadingSlash(path: string): string {
  if (!path) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

function getConfiguredOrigin(): string | undefined {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.APP_ORIGIN

  if (!configured) return undefined

  try {
    return new URL(configured).origin
  } catch {
    return configured
  }
}

export function getRelativeUrl(path: string): string {
  const normalized = ensureLeadingSlash(path)
  return withBasePath(normalized)
}

export function getAbsoluteUrl(path: string, origin?: string): string {
  const relative = getRelativeUrl(path)
  const resolvedOrigin =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : undefined) ||
    getConfiguredOrigin()

  if (!resolvedOrigin) {
    return relative
  }

  const trimmedOrigin = resolvedOrigin.replace(/\/+$/, '')
  return `${trimmedOrigin}${relative}`
}

type CentralAuthType = 'login' | 'signout'

function getCentralBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL) {
    return process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL
  }
  if (process.env.CENTRAL_AUTH_URL) {
    return process.env.CENTRAL_AUTH_URL
  }
  return process.env.NODE_ENV === 'production'
    ? 'https://ecomos.targonglobal.com'
    : 'http://localhost:3000'
}

function buildCentralAuthUrl(path: string, type: CentralAuthType, origin?: string): string {
  const centralBase = getCentralBaseUrl()
  const centralPath = type === 'login' ? '/login' : '/api/auth/signout'
  const url = new URL(centralPath, centralBase)
  url.searchParams.set('callbackUrl', getAbsoluteUrl(path, origin))
  return url.toString()
}

export function buildCentralLoginUrl(path: string, origin?: string): string {
  return buildCentralAuthUrl(path, 'login', origin)
}

export function buildCentralSignOutUrl(path: string, origin?: string): string {
  return buildCentralAuthUrl(path, 'signout', origin)
}
