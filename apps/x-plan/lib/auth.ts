import type { NextAuthOptions } from 'next-auth'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'

// Use NEXTAUTH_URL if available (runtime), otherwise fall back to NEXT_PUBLIC_APP_URL (build-time) or localhost
const devPort = process.env.PORT || process.env.CROSS_PLAN_PORT || 3008
const devBaseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${devPort}`
const centralDev = process.env.CENTRAL_AUTH_URL || 'http://localhost:3000'

applyDevAuthDefaults({
  appId: 'x-plan',
  port: devPort,
  baseUrl: devBaseUrl,
  cookieDomain: 'localhost',
  centralUrl: centralDev,
  publicCentralUrl: process.env.NEXT_PUBLIC_CENTRAL_AUTH_URL || 'http://localhost:3000',
})

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = 'build-only-nextauth-secret-x-plan'
}

const sharedSecret = process.env.CENTRAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET
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
