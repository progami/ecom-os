import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'
import { getUserByEmail } from '@ecom-os/auth/server'

const devPort = process.env.PORT || 3000
const devBaseUrl = `http://localhost:${devPort}`
applyDevAuthDefaults({
  appId: 'ecomos',
  port: devPort,
  baseUrl: devBaseUrl,
  cookieDomain: 'localhost',
  portalUrl: devBaseUrl,
  publicPortalUrl: devBaseUrl,
})

function sanitizeBaseUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    url.hash = ''
    url.search = ''
    if (/\/api\/auth\/?$/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/?api\/auth\/?$/, '') || '/'
    }
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }
    return url.origin + (url.pathname === '/' ? '' : url.pathname)
  } catch {
    return undefined
  }
}

function resolveCookieDomain(explicit: string | undefined, baseUrl: string | undefined): string {
  const trimmed = explicit?.trim()
  if (baseUrl) {
    try {
      const { hostname } = new URL(baseUrl)
      const normalizedHost = hostname.replace(/\.$/, '')
      if (trimmed && trimmed !== '') {
        const normalizedExplicit = trimmed.startsWith('.') ? trimmed.slice(1) : trimmed
        if (trimmed === '.targonglobal.com' && normalizedHost && normalizedHost !== 'ecomos.targonglobal.com') {
          return `.${normalizedHost}`
        }
        if (normalizedHost && !normalizedHost.endsWith(normalizedExplicit)) {
          return `.${normalizedHost}`
        }
        return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
      }
      if (normalizedHost) {
        return `.${normalizedHost}`
      }
    } catch {
      // fall back to default domain below
    }
  } else if (trimmed && trimmed !== '') {
    return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
  }
  return '.targonglobal.com'
}

const normalizedBaseUrl = sanitizeBaseUrl(process.env.NEXTAUTH_URL || process.env.PORTAL_AUTH_URL)
if (normalizedBaseUrl) {
  process.env.NEXTAUTH_URL = normalizedBaseUrl
  if (!process.env.PORTAL_AUTH_URL) {
    process.env.PORTAL_AUTH_URL = normalizedBaseUrl
  }
}

const resolvedCookieDomain = resolveCookieDomain(process.env.COOKIE_DOMAIN, process.env.NEXTAUTH_URL)
process.env.COOKIE_DOMAIN = resolvedCookieDomain

const sharedSecret = process.env.PORTAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET
if (sharedSecret) {
  process.env.NEXTAUTH_SECRET = sharedSecret
}

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const hasGoogleOAuth = Boolean(googleClientId && googleClientSecret)
const isProd = process.env.NODE_ENV === 'production'

if (!hasGoogleOAuth) {
  throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured for EcomOS auth.')
}

const allowedEmails = parseAllowedEmails(process.env.GOOGLE_ALLOWED_EMAILS || process.env.ALLOWED_GOOGLE_EMAILS)
if (isProd && allowedEmails.size === 0) {
  throw new Error('GOOGLE_ALLOWED_EMAILS must include at least one permitted account in production.')
}

const providers: NextAuthOptions['providers'] = [
  GoogleProvider({
    clientId: googleClientId || '',
    clientSecret: googleClientSecret || '',
    authorization: { params: { prompt: 'select_account', access_type: 'offline', response_type: 'code' } },
  }),
]

const baseAuthOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret: sharedSecret,
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/login',
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = (profile?.email || user?.email || '').toLowerCase()
        const emailVerified = typeof (profile as any)?.email_verified === 'boolean'
          ? Boolean((profile as any)?.email_verified)
          : typeof (profile as any)?.verified_email === 'boolean'
            ? Boolean((profile as any)?.verified_email)
            : true

        if (!email || !emailVerified) {
          return false
        }

        if (allowedEmails.size > 0 && !allowedEmails.has(email)) {
          if (!isProd) {
            console.warn(`[auth] Blocked Google login for ${email} (not in GOOGLE_ALLOWED_EMAILS)`)
          }
          return false
        }

        let portalUser = await getUserByEmail(email)
        if (!portalUser && !isProd) {
          portalUser = buildDevPortalUser(email)
        }
        if (!portalUser) {
          throw new Error('PortalUserMissing')
        }

        ;(user as any).portalUser = portalUser
        return true
      }

      if (account) {
        return false
      }
      return false
    },
    async jwt({ token, user }) {
      const portal = (user as any)?.portalUser
      if (portal) {
        token.sub = portal.id
        token.email = portal.email
        token.name = portal.fullName || user?.name || portal.email
        token.role = portal.roles[0] ?? null
        token.apps = Object.keys(portal.entitlements)
        ;(token as any).roles = portal.entitlements
        ;(token as any).entitlements_ver = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.sub as string
        session.user.email = (token.email as string | undefined) ?? session.user.email
        session.user.name = (token.name as string | undefined) ?? session.user.name
        ;(session.user as any).role = (token as any).role as string | undefined
        ;(session.user as any).apps = (token as any).apps as string[] | undefined
      }
      ;(session as any).roles = (token as any).roles
      ;(session as any).entitlements_ver = (token as any).entitlements_ver
      return session
    },
    async redirect({ url, baseUrl }) {
      const allowValue = String(process.env.ALLOW_CALLBACK_REDIRECT || '').toLowerCase()
      const allowCallbackExplicit = ['1', 'true', 'yes', 'on'].includes(allowValue)
      const allowCallbackDefault = process.env.NODE_ENV !== 'production' && allowValue === ''
      const allowCallback = allowCallbackExplicit || allowCallbackDefault
    if (!allowCallback) {
      return baseUrl
    }
    try {
      const target = new URL(url, baseUrl)
      const base = new URL(baseUrl)
      if (target.origin === base.origin) return target.toString()
      if (target.hostname.endsWith('.ecomos.targonglobal.com') && base.hostname.endsWith('.targonglobal.com')) {
        const loginOrigin = `${target.protocol}//${target.hostname}`
        const rewritten = new URL('/login', loginOrigin)
        rewritten.searchParams.set('callbackUrl', target.toString())
        return rewritten.toString()
      }
      if (process.env.NODE_ENV !== 'production') {
        if (target.hostname === 'localhost' || target.hostname === '127.0.0.1') {
          const relay = new URL('/auth/relay', base)
          relay.searchParams.set('to', target.toString())
          return relay.toString()
  }
  return baseUrl
}
        const cookieDomain = resolvedCookieDomain.replace(/^\./, '')
        if (cookieDomain && target.hostname.endsWith(cookieDomain)) {
          const relay = new URL('/auth/relay', base)
          relay.searchParams.set('to', target.toString())
          return relay.toString()
        }
      } catch {}
      return baseUrl
    },
  },
}

export const authOptions: NextAuthOptions = withSharedAuth(baseAuthOptions, {
  cookieDomain: resolvedCookieDomain,
  appId: 'ecomos',
})

function buildDevPortalUser(email: string) {
  const normalized = email.trim().toLowerCase()
  const [localPart] = normalized.split('@')
  const displayName = localPart
    ? localPart
        .split(/[.\-_]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ')
    : normalized

  const entitlements = {
    wms: { role: 'admin', departments: ['Ops'] },
    fcc: { role: 'admin', departments: ['Finance'] },
    hrms: { role: 'admin', departments: ['People Ops'] },
    'margin-master': { role: 'admin', departments: ['Product'] },
  }

  return {
    id: `dev-${normalized}`,
    email: normalized,
    username: localPart || null,
    fullName: displayName || normalized,
    roles: ['admin'],
    entitlements,
  }
}

function parseAllowedEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  const candidates = raw
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  return new Set(candidates)
}
