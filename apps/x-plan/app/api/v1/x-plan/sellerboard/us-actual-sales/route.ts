import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { loadPlanningCalendar } from '@/lib/planning';
import { getCalendarDateForWeek } from '@/lib/calculations/calendar';
import { weekStartsOnForRegion } from '@/lib/strategy-region';
import {
  parseSellerboardOrdersWeeklyUnits,
  safeEqual,
} from '@/lib/integrations/sellerboard-orders';

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

  const response = await fetch(reportUrl, { method: 'GET' });
  if (!response.ok) {
    return NextResponse.json(
      { error: `Sellerboard fetch failed (${response.status})` },
      { status: 502 },
    );
  }

  const csv = await response.text();
  const weekStartsOn = weekStartsOnForRegion('US');
  const planning = await loadPlanningCalendar(weekStartsOn);

  const parsed = parseSellerboardOrdersWeeklyUnits(csv, planning, {
    weekStartsOn,
    excludeStatuses: ['Cancelled'],
  });

  const productCodes = Array.from(new Set(parsed.weeklyUnits.map((entry) => entry.productCode)));

  if (productCodes.length === 0) {
    return NextResponse.json({
      ok: true,
      rowsParsed: parsed.rowsParsed,
      rowsSkipped: parsed.rowsSkipped,
      updates: 0,
      productsMatched: 0,
      csvSha256: parsed.csvSha256,
      oldestPurchaseDateUtc: parsed.oldestPurchaseDateUtc?.toISOString() ?? null,
      newestPurchaseDateUtc: parsed.newestPurchaseDateUtc?.toISOString() ?? null,
    });
  }

  const matchedProducts = await prisma.product.findMany({
    where: {
      sku: { in: productCodes },
      strategy: { region: 'US' },
    },
    select: {
      id: true,
      sku: true,
      strategyId: true,
    },
  });

  const productsByCode = new Map<string, Array<{ id: string; strategyId: string }>>();
  for (const product of matchedProducts) {
    if (!product.strategyId) continue;
    const list = productsByCode.get(product.sku) ?? [];
    list.push({ id: product.id, strategyId: product.strategyId });
    productsByCode.set(product.sku, list);
  }

  const upserts: ReturnType<(typeof prisma.salesWeek)['upsert']>[] = [];

  for (const entry of parsed.weeklyUnits) {
    const products = productsByCode.get(entry.productCode);
    if (!products?.length) continue;
    const weekDate = getCalendarDateForWeek(entry.weekNumber, planning.calendar);
    if (!weekDate) continue;

    for (const product of products) {
      upserts.push(
        prisma.salesWeek.upsert({
          where: {
            strategyId_productId_weekNumber: {
              strategyId: product.strategyId,
              productId: product.id,
              weekNumber: entry.weekNumber,
            },
          },
          update: {
            actualSales: entry.units,
            finalSales: null,
          },
          create: {
            strategyId: product.strategyId,
            productId: product.id,
            weekNumber: entry.weekNumber,
            weekDate,
            actualSales: entry.units,
            finalSales: null,
          },
        }),
      );
    }
  }

  if (upserts.length) {
    await prisma.$transaction(upserts);
  }

  return NextResponse.json({
    ok: true,
    rowsParsed: parsed.rowsParsed,
    rowsSkipped: parsed.rowsSkipped,
    productsMatched: matchedProducts.length,
    updates: upserts.length,
    csvSha256: parsed.csvSha256,
    oldestPurchaseDateUtc: parsed.oldestPurchaseDateUtc?.toISOString() ?? null,
    newestPurchaseDateUtc: parsed.newestPurchaseDateUtc?.toISOString() ?? null,
  });
};
