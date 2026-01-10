import { NextResponse } from 'next/server';
import { withXPlanAuth } from '@/lib/api/auth';
import { getStrategyActor } from '@/lib/strategy-access';
import { syncSellerboardUsActualSales } from '@/lib/integrations/sellerboard-us-actual-sales-sync';

export const runtime = 'nodejs';

export const POST = withXPlanAuth(async (_request: Request, session) => {
  const actor = getStrategyActor(session);
  if (!actor.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reportUrl = process.env.SELLERBOARD_US_ORDERS_REPORT_URL?.trim();
  if (!reportUrl) {
    return NextResponse.json(
      { error: 'Missing SELLERBOARD_US_ORDERS_REPORT_URL' },
      { status: 500 },
    );
  }

  const startedAt = Date.now();

  try {
    const result = await syncSellerboardUsActualSales({ reportUrl });
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      ...result,
      oldestPurchaseDateUtc: result.oldestPurchaseDateUtc?.toISOString() ?? null,
      newestPurchaseDateUtc: result.newestPurchaseDateUtc?.toISOString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
});

