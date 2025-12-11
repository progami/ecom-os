import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL must be defined for FCC auth configuration.')
}
if (!process.env.PORTAL_AUTH_URL) {
  throw new Error('PORTAL_AUTH_URL must be defined for FCC auth configuration.')
}
if (!process.env.NEXT_PUBLIC_PORTAL_AUTH_URL) {
  throw new Error('NEXT_PUBLIC_PORTAL_AUTH_URL must be defined for FCC auth configuration.')
}
applyDevAuthDefaults({
  appId: 'ecomos',
})

const sharedSecret = process.env.PORTAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET
if (sharedSecret) {
  process.env.NEXTAUTH_SECRET = sharedSecret
}

const baseAuthOptions: NextAuthConfig = {
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

export const authOptions: NextAuthConfig = withSharedAuth(baseAuthOptions, {
  cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
  // Read portal cookie in dev
  appId: 'ecomos',
})

// Initialize NextAuth with config and export handlers + auth function
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
