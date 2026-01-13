import { NextResponse } from 'next/server';
import { withXPlanAuth } from '@/lib/api/auth';
import { getStrategyActor } from '@/lib/strategy-access';
import { loadPlanningCalendar } from '@/lib/planning';
import { weekStartsOnForRegion } from '@/lib/strategy-region';
import { parseSellerboardOrdersWeeklyUnits } from '@/lib/integrations/sellerboard-orders';
import prisma from '@/lib/prisma';
import { getTalosPrisma } from '@/lib/integrations/talos-client';

export const runtime = 'nodejs';

export const GET = withXPlanAuth(async (_request: Request, session) => {
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

  try {
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

    // Group by week for easier reading
    const byWeek = new Map<number, Map<string, number>>();
    for (const entry of parsed.weeklyUnits) {
      if (!byWeek.has(entry.weekNumber)) {
        byWeek.set(entry.weekNumber, new Map());
      }
      const weekMap = byWeek.get(entry.weekNumber)!;
      weekMap.set(entry.productCode, (weekMap.get(entry.productCode) || 0) + entry.units);
    }

    // Convert to JSON-friendly format
    const weeklyData: Record<string, Record<string, number>> = {};
    for (const [weekNumber, products] of byWeek.entries()) {
      const weekDate = planning.calendar.weekDates.get(weekNumber);
      const weekKey = `Week ${weekNumber} (${weekDate?.toISOString().split('T')[0] || 'unknown'})`;
      weeklyData[weekKey] = Object.fromEntries(products);
    }

    // Get product codes from CSV
    const productCodes = Array.from(new Set(parsed.weeklyUnits.map((entry) => entry.productCode)));

    // Check direct SKU matches
    const directProducts = await prisma.product.findMany({
      where: {
        sku: { in: productCodes },
        strategy: { region: 'US' },
      },
      select: { id: true, sku: true, strategyId: true },
    });

    // Check ASIN to SKU mappings in Talos
    const unmatchedCodes = productCodes.filter(
      (code) => !directProducts.some((p) => p.sku === code)
    );

    let asinMappings: Array<{ asin: string | null; skuCode: string | null }> = [];
    const talos = getTalosPrisma('US');
    if (talos && unmatchedCodes.length) {
      asinMappings = await talos.sku.findMany({
        where: { asin: { in: unmatchedCodes } },
        select: { asin: true, skuCode: true },
      });
    }

    // Get current SalesWeek data for week 53 and 54
    const salesWeeksData = await prisma.salesWeek.findMany({
      where: {
        weekNumber: { in: [53, 54] },
        product: {
          strategy: { region: 'US' },
        },
      },
      select: {
        weekNumber: true,
        actualSales: true,
        product: {
          select: { sku: true },
        },
      },
    });

    // Show first 50 lines of raw CSV for debugging
    const csvLines = csv.split('\n').slice(0, 50);

    return NextResponse.json({
      reportUrl: reportUrl.substring(0, 50) + '...',
      rowsParsed: parsed.rowsParsed,
      rowsSkipped: parsed.rowsSkipped,
      oldestPurchaseDateUtc: parsed.oldestPurchaseDateUtc?.toISOString() ?? null,
      newestPurchaseDateUtc: parsed.newestPurchaseDateUtc?.toISOString() ?? null,
      csvSha256: parsed.csvSha256,
      weeklyData,
      productMatching: {
        csvProductCodes: productCodes,
        directMatches: directProducts.map((p) => ({ sku: p.sku, id: p.id })),
        unmatchedCodes,
        asinMappings: asinMappings.map((m) => ({ asin: m.asin, skuCode: m.skuCode })),
      },
      currentDbData: salesWeeksData.map((sw) => ({
        weekNumber: sw.weekNumber,
        sku: sw.product.sku,
        actualSales: sw.actualSales,
      })),
      rawCsvPreview: csvLines,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
