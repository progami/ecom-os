import type { NextAuthOptions } from 'next-auth'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'

const devPort = process.env.PORT || process.env.FCC_PORT || 3003
const devBaseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${devPort}`
const portalDev = process.env.PORTAL_AUTH_URL || 'http://localhost:3000'
applyDevAuthDefaults({
  appId: 'ecomos',
  port: devPort,
  baseUrl: devBaseUrl,
  cookieDomain: 'localhost',
  portalUrl: portalDev,
  publicPortalUrl: process.env.NEXT_PUBLIC_PORTAL_AUTH_URL || 'http://localhost:3000',
})

const sharedSecret = process.env.PORTAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET
if (sharedSecret) {
  process.env.NEXTAUTH_SECRET = sharedSecret
}

const baseAuthOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: sharedSecret,
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).id) {
        token.sub = (user as any).id
      }
      return token
    },
    async session({ session, token }) {
      // Basic identity
      // @ts-expect-error id
      session.user.id = (token.sub as string) || session.user.id
      // Portal entitlements
      // @ts-expect-error roles claim
      session.roles = (token as any).roles
      // @ts-expect-error version
      session.entitlements_ver = (token as any).entitlements_ver
      return session
    },
  },
  // No signIn page here; sign-in happens at the portal (ecomos)
}

export const authOptions: NextAuthOptions = withSharedAuth(baseAuthOptions, {
  cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
  // Read portal cookie in dev
  appId: 'ecomos',
})
