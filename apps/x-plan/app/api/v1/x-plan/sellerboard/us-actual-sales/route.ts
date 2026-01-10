import { NextResponse } from 'next/server';
import {
  safeEqual,
} from '@/lib/integrations/sellerboard-orders';
import { syncSellerboardUsActualSales } from '@/lib/integrations/sellerboard-us-actual-sales-sync';

export const runtime = 'nodejs';

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ? match[1].trim() : null;
}

function requireSyncAuth(request: Request): NextResponse | null {
  const expected = process.env.SELLERBOARD_SYNC_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: 'Missing SELLERBOARD_SYNC_TOKEN' },
      { status: 500 },
    );
  }

  const provided = extractBearerToken(request.headers.get('authorization'));
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export const POST = async (request: Request) => {
  const authError = requireSyncAuth(request);
  if (authError) return authError;

  const reportUrl = process.env.SELLERBOARD_US_ORDERS_REPORT_URL?.trim();
  if (!reportUrl) {
    return NextResponse.json(
      { error: 'Missing SELLERBOARD_US_ORDERS_REPORT_URL' },
      { status: 500 },
    );
  }

  try {
    const result = await syncSellerboardUsActualSales({ reportUrl });
    return NextResponse.json({
      ok: true,
      ...result,
      oldestPurchaseDateUtc: result.oldestPurchaseDateUtc?.toISOString() ?? null,
      newestPurchaseDateUtc: result.newestPurchaseDateUtc?.toISOString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
};
