import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth'

const isProductionBuild = process.env.NODE_ENV === 'production'

const ensureEnv = (key: string, fallback?: string) => {
  if (!process.env[key] && fallback) {
    process.env[key] = fallback
  }
  if (!process.env[key] && !isProductionBuild) {
    throw new Error(`${key} must be defined for X-Plan auth configuration.`)
  }
}

ensureEnv('NEXT_PUBLIC_APP_URL', 'https://ecomos.targonglobal.com/x-plan')
ensureEnv('PORTAL_AUTH_URL', 'https://ecomos.targonglobal.com/api/auth')
ensureEnv('NEXT_PUBLIC_PORTAL_AUTH_URL', process.env.PORTAL_AUTH_URL)

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

const baseAuthOptions: NextAuthConfig = {
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
      (session as { roles?: unknown }).roles = (token as { roles?: unknown }).roles
      session.user.id = (token.sub as string) || session.user.id
      return session
    },
  },
}

export const authOptions: NextAuthConfig = withSharedAuth(baseAuthOptions, {
  cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
  appId: 'x-plan',
})

// Initialize NextAuth with config and export handlers + auth function
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
