import { NextResponse } from 'next/server';
import { PrismaClient as WmsPrismaClient } from '@ecom-os/prisma-wms';
import prisma from '@/lib/prisma';
import { loadPlanningCalendar } from '@/lib/planning';
import { getCalendarDateForWeek } from '@/lib/calculations/calendar';
import { weekStartsOnForRegion } from '@/lib/strategy-region';
import {
  parseSellerboardOrdersWeeklyUnits,
  safeEqual,
} from '@/lib/integrations/sellerboard-orders';

export const runtime = 'nodejs';

type GlobalWithWmsPrisma = typeof globalThis & {
  __xplanWmsUsPrisma?: WmsPrismaClient;
};

function getWmsUsPrisma(): WmsPrismaClient | null {
  const url = process.env.WMS_DATABASE_URL_US?.trim();
  if (!url) return null;

  const globalForPrisma = globalThis as GlobalWithWmsPrisma;
  if (globalForPrisma.__xplanWmsUsPrisma) return globalForPrisma.__xplanWmsUsPrisma;

  const client = new WmsPrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url } },
  });

  globalForPrisma.__xplanWmsUsPrisma = client;
  return client;
}

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

  const directProducts = await prisma.product.findMany({
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
  const directProductIds = new Set<string>();
  for (const product of directProducts) {
    if (!product.strategyId) continue;
    directProductIds.add(product.id);
    const list = productsByCode.get(product.sku) ?? [];
    list.push({ id: product.id, strategyId: product.strategyId });
    productsByCode.set(product.sku, list);
  }

  const unmatchedCodes = productCodes.filter((code) => !productsByCode.has(code));
  let asinMappingsFound = 0;
  let asinProductsMatched = 0;

  if (unmatchedCodes.length) {
    const wms = getWmsUsPrisma();
    if (wms) {
      const mappings = await wms.sku.findMany({
        where: { asin: { in: unmatchedCodes } },
        select: { asin: true, skuCode: true },
      });
      asinMappingsFound = mappings.length;

      const mappedSkuCodes = Array.from(
        new Set(
          mappings
            .map((row) => row.skuCode?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      );

      if (mappedSkuCodes.length) {
        const mappedProducts = await prisma.product.findMany({
          where: {
            sku: { in: mappedSkuCodes },
            strategy: { region: 'US' },
          },
          select: { id: true, sku: true, strategyId: true },
        });

        const productsBySku = new Map<string, Array<{ id: string; strategyId: string }>>();
        for (const product of mappedProducts) {
          if (!product.strategyId) continue;
          const list = productsBySku.get(product.sku) ?? [];
          list.push({ id: product.id, strategyId: product.strategyId });
          productsBySku.set(product.sku, list);
        }

        for (const mapping of mappings) {
          const asin = mapping.asin?.trim();
          const skuCode = mapping.skuCode?.trim();
          if (!asin || !skuCode) continue;
          const products = productsBySku.get(skuCode);
          if (!products?.length) continue;
          asinProductsMatched += products.length;
          productsByCode.set(asin, products);
        }
      }
    }
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

  const uniqueProductsMatched = new Set<string>(directProductIds);
  for (const products of productsByCode.values()) {
    for (const product of products) {
      uniqueProductsMatched.add(product.id);
    }
  }

  return NextResponse.json({
    ok: true,
    rowsParsed: parsed.rowsParsed,
    rowsSkipped: parsed.rowsSkipped,
    productsMatched: uniqueProductsMatched.size,
    asinMappingsFound,
    asinProductsMatched,
    updates: upserts.length,
    csvSha256: parsed.csvSha256,
    oldestPurchaseDateUtc: parsed.oldestPurchaseDateUtc?.toISOString() ?? null,
    newestPurchaseDateUtc: parsed.newestPurchaseDateUtc?.toISOString() ?? null,
  });
};
