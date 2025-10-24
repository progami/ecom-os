import type { NextAuthOptions } from 'next-auth';
import { applyDevAuthDefaults, withSharedAuth } from '@ecom-os/auth';

// NOTE: Keep providers/callbacks/pages here as HRMS evolves.
const devPort = process.env.PORT || process.env.HRMS_PORT || 3006;
const devBaseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${devPort}`;
const portalDev = process.env.PORTAL_AUTH_URL || 'http://localhost:3000';
applyDevAuthDefaults({
  appId: 'ecomos',
  port: devPort,
  baseUrl: devBaseUrl,
  cookieDomain: 'localhost',
  portalUrl: portalDev,
  publicPortalUrl: process.env.NEXT_PUBLIC_PORTAL_AUTH_URL || 'http://localhost:3000',
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
  appId: 'ecomos',
});
