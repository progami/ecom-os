import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { getAppEntitlement } from '@ecom-os/auth';

import { auth } from '@/lib/auth';

export type ChronosAuthedHandler<TContext = unknown> = (
  request: Request,
  session: Session,
  context: TContext,
) => Promise<Response>;

export function withChronosAuth<TContext = unknown>(handler: ChronosAuthedHandler<TContext>) {
  return async (request: Request, context: TContext) => {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const entitlement = getAppEntitlement((session as any).roles, 'chronos');
    if (!entitlement) {
      return NextResponse.json({ error: 'No access to Chronos' }, { status: 403 });
    }

    return handler(request, session, context);
  };
}
