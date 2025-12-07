import type { NextAuthOptions } from 'next-auth';
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth';

// NOTE: Keep providers/callbacks/pages here as HRMS evolves.
if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL must be defined for HRMS auth configuration.')
}
if (!process.env.PORTAL_AUTH_URL) {
  throw new Error('PORTAL_AUTH_URL must be defined for HRMS auth configuration.')
}
if (!process.env.NEXT_PUBLIC_PORTAL_AUTH_URL) {
  throw new Error('NEXT_PUBLIC_PORTAL_AUTH_URL must be defined for HRMS auth configuration.')
}
applyDevAuthDefaults({
  appId: 'hrms',
});

const sharedSecret = process.env.PORTAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (sharedSecret) {
  process.env.NEXTAUTH_SECRET = sharedSecret;
}

const baseAuthOptions: NextAuthOptions = {
  // Add providers when ready (e.g., Credentials, OIDC)
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
      // propagate portal roles for HRMS consumption if needed
      // @ts-expect-error roles claim passthrough
      session.roles = (token as any).roles
      // @ts-expect-error id
      session.user.id = (token.sub as string) || session.user.id
      return session
    },
  },
};

export const authOptions: NextAuthOptions = withSharedAuth(baseAuthOptions, {
  cookieDomain: process.env.COOKIE_DOMAIN || '.targonglobal.com',
  appId: 'hrms',
});
