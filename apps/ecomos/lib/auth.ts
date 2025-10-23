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
  centralUrl: devBaseUrl,
  publicCentralUrl: devBaseUrl,
})

const sharedSecret = process.env.CENTRAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET
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

        let centralUser = await getUserByEmail(email)
        if (!centralUser && !isProd) {
          centralUser = buildDevCentralUser(email)
        }
        if (!centralUser) {
          throw new Error('CentralUserMissing')
        }

        ;(user as any).centralUser = centralUser
        return true
      }

      if (account) {
        return false
      }
      return false
    },
    async jwt({ token, user }) {
      const central = (user as any)?.centralUser
      if (central) {
        token.sub = central.id
        token.email = central.email
        token.name = central.fullName || user?.name || central.email
        token.role = central.roles[0] ?? null
        token.apps = Object.keys(central.entitlements)
        ;(token as any).roles = central.entitlements
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
        if (process.env.NODE_ENV !== 'production') {
          if (target.hostname === 'localhost' || target.hostname === '127.0.0.1') {
            const relay = new URL('/auth/relay', base)
            relay.searchParams.set('to', target.toString())
            return relay.toString()
          }
          return baseUrl
        }
        const cookieDomain = (process.env.COOKIE_DOMAIN || '').replace(/^\./, '')
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
  cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
  appId: 'ecomos',
})

function buildDevCentralUser(email: string) {
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
