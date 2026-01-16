import { NextResponse } from 'next/server';
import { withXPlanAuth } from '@/lib/api/auth';
import { getStrategyActor } from '@/lib/strategy-access';
import { syncSellerboardUsActualSales, syncSellerboardUsDashboard } from '@/lib/integrations/sellerboard';

export const runtime = 'nodejs';

export const POST = withXPlanAuth(async (_request: Request, session) => {
  const actor = getStrategyActor(session);
  if (!actor.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ordersReportUrl = process.env.SELLERBOARD_US_ORDERS_REPORT_URL?.trim();
  if (!ordersReportUrl) {
    return NextResponse.json(
      { error: 'Missing SELLERBOARD_US_ORDERS_REPORT_URL' },
      { status: 500 },
    );
  }

  const dashboardReportUrl = process.env.SELLERBOARD_US_DASHBOARD_REPORT_URL?.trim();
  if (!dashboardReportUrl) {
    return NextResponse.json(
      { error: 'Missing SELLERBOARD_US_DASHBOARD_REPORT_URL' },
      { status: 500 },
    );
  }

  const startedAt = Date.now();

  try {
    const actualSalesStartedAt = Date.now();
    const actualSalesResult = await syncSellerboardUsActualSales({ reportUrl: ordersReportUrl });
    const actualSales = {
      ok: true,
      durationMs: Date.now() - actualSalesStartedAt,
      ...actualSalesResult,
      oldestPurchaseDateUtc: actualSalesResult.oldestPurchaseDateUtc?.toISOString() ?? null,
      newestPurchaseDateUtc: actualSalesResult.newestPurchaseDateUtc?.toISOString() ?? null,
    };

    const dashboardStartedAt = Date.now();
    const dashboardResult = await syncSellerboardUsDashboard({ reportUrl: dashboardReportUrl });
    const dashboard = {
      ok: true,
      durationMs: Date.now() - dashboardStartedAt,
      ...dashboardResult,
      oldestDateUtc: dashboardResult.oldestDateUtc?.toISOString() ?? null,
      newestDateUtc: dashboardResult.newestDateUtc?.toISOString() ?? null,
    };

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      actualSales,
      dashboard,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
});

