import type { NextAuthOptions } from 'next-auth';
import { withSharedAuth } from '@ecom-os/auth';

// NOTE: Keep providers/callbacks/pages here as HRMS evolves.
const baseAuthOptions: NextAuthOptions = {
  // Add providers when ready (e.g., Credentials, OIDC)
  providers: [],
  session: { strategy: 'jwt' },
};

export const authOptions: NextAuthOptions = withSharedAuth(
  baseAuthOptions,
  process.env.COOKIE_DOMAIN || '.targonglobal.com'
);

