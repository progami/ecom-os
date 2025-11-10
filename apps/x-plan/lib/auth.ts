import type { NextAuthOptions } from 'next-auth'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'

// Only validate configuration in development - production uses runtime env vars
if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL must be defined for X-Plan auth configuration.')
}
if (!process.env.PORTAL_AUTH_URL) {
  throw new Error('PORTAL_AUTH_URL must be defined for X-Plan auth configuration.')
}
if (!process.env.NEXT_PUBLIC_PORTAL_AUTH_URL) {
  throw new Error('NEXT_PUBLIC_PORTAL_AUTH_URL must be defined for X-Plan auth configuration.')
}

applyDevAuthDefaults({
  appId: 'x-plan',
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
