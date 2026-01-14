import { NextResponse } from 'next/server';
import { withXPlanAuth } from '@/lib/api/auth';
import { getStrategyActor } from '@/lib/strategy-access';
import { syncSellerboardUkDashboard } from '@/lib/integrations/sellerboard';

export const runtime = 'nodejs';

export const POST = withXPlanAuth(async (_request: Request, session) => {
  const actor = getStrategyActor(session);
  if (!actor.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reportUrl = process.env.SELLERBOARD_UK_DASHBOARD_REPORT_URL?.trim();
  if (!reportUrl) {
    return NextResponse.json(
      { error: 'Missing SELLERBOARD_UK_DASHBOARD_REPORT_URL' },
      { status: 500 },
    );
  }

  const startedAt = Date.now();

  try {
    const result = await syncSellerboardUkDashboard({ reportUrl });
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      ...result,
      oldestDateUtc: result.oldestDateUtc?.toISOString() ?? null,
      newestDateUtc: result.newestDateUtc?.toISOString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
});

