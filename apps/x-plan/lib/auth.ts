import type { NextAuthOptions } from 'next-auth'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'

// Only set dev defaults in development - production uses NEXTAUTH_URL at runtime
const devPort = process.env.PORT || process.env.CROSS_PLAN_PORT || 3008
const portalDev = process.env.PORTAL_AUTH_URL || 'http://localhost:3000'

// Don't override NEXTAUTH_URL if it's already set (production uses runtime env vars)
applyDevAuthDefaults({
  appId: 'x-plan',
  port: devPort,
  // Don't pass baseUrl - let applyDevAuthDefaults compute it only if NEXTAUTH_URL is not set
  cookieDomain: 'localhost',
  portalUrl: portalDev,
  publicPortalUrl: process.env.NEXT_PUBLIC_PORTAL_AUTH_URL || 'http://localhost:3000',
})

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = 'build-only-nextauth-secret-x-plan'
}

const sharedSecret = process.env.PORTAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET
if (sharedSecret) {
  process.env.NEXTAUTH_SECRET = sharedSecret
}

const baseAuthOptions: NextAuthOptions = {
  providers: [],
  session: { strategy: 'jwt' },
  secret: sharedSecret,
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).id) {
        token.sub = (user as any).id
      }
      return token
    },
    async session({ session, token }) {
      // @ts-expect-error propagate roles if present
      session.roles = (token as any).roles
      // @ts-expect-error add user id for downstream services
      session.user.id = (token.sub as string) || session.user.id
      return session
    },
  },
}

export const authOptions: NextAuthOptions = withSharedAuth(baseAuthOptions, {
  cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
  appId: 'x-plan',
})
