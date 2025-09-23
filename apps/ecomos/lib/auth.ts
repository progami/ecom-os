import type { NextAuthOptions, RequestInternal } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { applyDevAuthDefaults, withSharedAuth, authenticateWithCentralDirectory } from '@ecom-os/auth'
import {
  AuthRateLimitError,
  getAuthRateLimiter,
  resolveRateLimitContext,
} from '@/lib/security/auth-rate-limiter'

interface CredentialPayload {
  emailOrUsername: string
  password: string
}

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

const baseAuthOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret: sharedSecret,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        emailOrUsername: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const limiter = getAuthRateLimiter()
        const context = resolveRateLimitContext(req as RequestInternal | undefined, credentials?.emailOrUsername)

        try {
          limiter.assertAllowed(context)
        } catch (error) {
          if (error instanceof AuthRateLimitError) {
            throw new Error(error.message)
          }
          throw error
        }

        if (!credentials?.emailOrUsername || !credentials?.password) {
          limiter.recordFailure(context)
          throw new Error('Invalid credentials')
        }

        try {
          const user = await authenticateWithCredentials(credentials as CredentialPayload)
          limiter.recordSuccess(context)
          return user
        } catch (error) {
          limiter.recordFailure(context)
          if (error instanceof AuthRateLimitError) {
            throw error
          }
          throw new Error('Invalid credentials')
        }
      },
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = (user as any).id
        token.role = (user as any).role
        token.apps = (user as any).apps
        // Central roles claim
        ;(token as any).roles = (user as any).roles
        ;(token as any).entitlements_ver = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      ;(session.user as any).id = token.sub as string
      ;(session.user as any).role = (token as any).role as string | undefined
      ;(session.user as any).apps = (token as any).apps as string[] | undefined
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

async function authenticateWithCredentials(credentials: CredentialPayload) {
  const { emailOrUsername, password } = credentials

  const user = await authenticateWithCentralDirectory({ emailOrUsername, password })
  if (!user) {
    throw new Error('Invalid credentials')
  }

  const apps = Object.keys(user.entitlements)

  return {
    id: user.id,
    email: user.email,
    name: user.fullName,
    role: user.roles[0] ?? null,
    roles: user.entitlements,
    apps,
  } as any
}
