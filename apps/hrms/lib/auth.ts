import type { NextAuthOptions } from 'next-auth';
import { withSharedAuth } from '@ecom-os/auth';

// NOTE: Keep providers/callbacks/pages here as HRMS evolves.
const baseAuthOptions: NextAuthOptions = {
  // Add providers when ready (e.g., Credentials, OIDC)
  providers: [],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).id) {
        token.sub = (user as any).id
      }
      return token
    },
    async session({ session, token }) {
      // propagate central roles for HRMS consumption if needed
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
  appId: 'ecomos',
});
