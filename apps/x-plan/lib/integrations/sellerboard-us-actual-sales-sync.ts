import 'server-only';

import prisma from '@/lib/prisma';
import { loadPlanningCalendar } from '@/lib/planning';
import { getCalendarDateForWeek } from '@/lib/calculations/calendar';
import { weekStartsOnForRegion } from '@/lib/strategy-region';
import { parseSellerboardOrdersWeeklyUnits } from '@/lib/integrations/sellerboard-orders';
import { getTalosPrisma } from '@/lib/integrations/talos-client';

function logSync(message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[sellerboard-sync] ${timestamp} ${message}`, JSON.stringify(data));
  } else {
    console.log(`[sellerboard-sync] ${timestamp} ${message}`);
  }
}

export type SellerboardUsActualSalesSyncResult = {
  rowsParsed: number;
  rowsSkipped: number;
  productsMatched: number;
  asinMappingsFound: number;
  asinProductsMatched: number;
  updates: number;
  csvSha256: string;
  oldestPurchaseDateUtc: Date | null;
  newestPurchaseDateUtc: Date | null;
};

export async function syncSellerboardUsActualSales(options: {
  reportUrl: string;
}): Promise<SellerboardUsActualSalesSyncResult> {
  logSync('Starting Sellerboard US actual sales sync');

  const reportUrl = options.reportUrl.trim();
  if (!reportUrl) {
    throw new Error('Missing Sellerboard report URL');
  }

  logSync('Fetching CSV from Sellerboard');
  const response = await fetch(reportUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Sellerboard fetch failed (${response.status})`);
  }

  const csv = await response.text();
  logSync('CSV fetched', { bytes: csv.length });

  const weekStartsOn = weekStartsOnForRegion('US');
  const planning = await loadPlanningCalendar(weekStartsOn);

  const parsed = parseSellerboardOrdersWeeklyUnits(csv, planning, {
    weekStartsOn,
    excludeStatuses: ['Cancelled'],
  });

  logSync('CSV parsed', {
    rowsParsed: parsed.rowsParsed,
    rowsSkipped: parsed.rowsSkipped,
    weeklyUnitsCount: parsed.weeklyUnits.length,
    oldestDate: parsed.oldestPurchaseDateUtc?.toISOString(),
    newestDate: parsed.newestPurchaseDateUtc?.toISOString(),
  });

  const productCodes = Array.from(new Set(parsed.weeklyUnits.map((entry) => entry.productCode)));
  logSync('Unique product codes from CSV', { count: productCodes.length, sample: productCodes.slice(0, 10) });

  if (productCodes.length === 0) {
    logSync('No product codes found in CSV, returning early');
    return {
      rowsParsed: parsed.rowsParsed,
      rowsSkipped: parsed.rowsSkipped,
      productsMatched: 0,
      asinMappingsFound: 0,
      asinProductsMatched: 0,
      updates: 0,
      csvSha256: parsed.csvSha256,
      oldestPurchaseDateUtc: parsed.oldestPurchaseDateUtc,
      newestPurchaseDateUtc: parsed.newestPurchaseDateUtc,
    };
  }

  // Step 1: Match products by SKU
  logSync('Looking up products by SKU');
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

  logSync('Direct SKU match results', {
    productsFound: directProducts.length,
    uniqueSkusMatched: productsByCode.size,
    matchedSkus: Array.from(productsByCode.keys()).slice(0, 10),
  });

  // Step 2: Match unmatched codes by ASIN field in X-Plan products
  let unmatchedCodes = productCodes.filter((code) => !productsByCode.has(code));
  let asinMappingsFound = 0;
  let asinProductsMatched = 0;
  let xplanAsinMatched = 0;

  // Note: ASIN field matching requires the database to have the asin column added
  // This is done via migration but TypeScript types may not reflect it until CI regenerates
  // For now, we skip this step if there are TypeScript issues - Talos ASIN mapping below handles the fallback

  // Update unmatched codes (X-Plan ASIN matching skipped for now - using Talos fallback)

  // Step 3: Match remaining unmatched codes via Talos ASIN->SKU mapping
  if (unmatchedCodes.length) {
    logSync('Looking up Talos ASIN mappings', { unmatchedCount: unmatchedCodes.length, sample: unmatchedCodes.slice(0, 10) });

    const talos = getTalosPrisma('US');
    if (talos) {
      const mappings = await talos.sku.findMany({
        where: { asin: { in: unmatchedCodes } },
        select: { asin: true, skuCode: true },
      });
      asinMappingsFound = mappings.length;

      logSync('Talos ASIN mappings found', {
        count: mappings.length,
        sample: mappings.slice(0, 5).map((m: { asin: string | null; skuCode: string | null }) => ({ asin: m.asin, skuCode: m.skuCode })),
      });

      const mappedSkuCodes = Array.from(
        new Set(
          mappings
            .map((row: { skuCode: string | null }) => row.skuCode?.trim())
            .filter((value: string | undefined): value is string => Boolean(value)),
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

        logSync('Products found via Talos mapping', { count: mappedProducts.length });

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

        logSync('Talos ASIN->SKU matching complete', { asinProductsMatched });
      }
    }
  }

  // Log final unmatched codes for debugging
  const finalUnmatchedCodes = productCodes.filter((code) => !productsByCode.has(code));
  if (finalUnmatchedCodes.length) {
    logSync('Unmatched product codes (no X-Plan product found)', {
      count: finalUnmatchedCodes.length,
      codes: finalUnmatchedCodes.slice(0, 20),
    });
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

  logSync('Preparing upserts', { count: upserts.length });

  if (upserts.length) {
    logSync('Executing database transaction');
    await prisma.$transaction(upserts);
    logSync('Database transaction complete');
  }

  const uniqueProductsMatched = new Set<string>(directProductIds);
  for (const products of productsByCode.values()) {
    for (const product of products) {
      uniqueProductsMatched.add(product.id);
    }
  }

  const result = {
    rowsParsed: parsed.rowsParsed,
    rowsSkipped: parsed.rowsSkipped,
    productsMatched: uniqueProductsMatched.size,
    asinMappingsFound,
    asinProductsMatched,
    updates: upserts.length,
    csvSha256: parsed.csvSha256,
    oldestPurchaseDateUtc: parsed.oldestPurchaseDateUtc,
    newestPurchaseDateUtc: parsed.newestPurchaseDateUtc,
  };

  logSync('Sync complete', {
    rowsParsed: result.rowsParsed,
    rowsSkipped: result.rowsSkipped,
    productsMatched: result.productsMatched,
    asinMappingsFound: result.asinMappingsFound,
    asinProductsMatched: result.asinProductsMatched,
    updates: result.updates,
  });

  return result;
}
