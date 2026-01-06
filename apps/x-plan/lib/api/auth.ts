import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { getAppEntitlement } from '@ecom-os/auth';
import { auth } from '@/lib/auth';

export type XPlanAuthedHandler = (request: Request, session: Session) => Promise<Response>;

export function withXPlanAuth(handler: XPlanAuthedHandler) {
  return async (request: Request) => {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const entitlement = getAppEntitlement((session as any).roles, 'x-plan');
    if (!entitlement) {
      return NextResponse.json({ error: 'No access to X-Plan' }, { status: 403 });
    }

    return handler(request, session);
  };
}
