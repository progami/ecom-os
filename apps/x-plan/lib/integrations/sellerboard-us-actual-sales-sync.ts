import 'server-only';

import prisma from '@/lib/prisma';
import { loadPlanningCalendar } from '@/lib/planning';
import { getCalendarDateForWeek } from '@/lib/calculations/calendar';
import { weekStartsOnForRegion } from '@/lib/strategy-region';
import { parseSellerboardOrdersWeeklyUnits } from '@/lib/integrations/sellerboard-orders';
import { getTalosPrisma } from '@/lib/integrations/talos-client';

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

function logSync(message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[sellerboard-sync] ${timestamp} ${message}`, JSON.stringify(data));
  } else {
    console.log(`[sellerboard-sync] ${timestamp} ${message}`);
  }
}

export async function syncSellerboardUsActualSales(options: {
  reportUrl: string;
}): Promise<SellerboardUsActualSalesSyncResult> {
  const reportUrl = options.reportUrl.trim();
  if (!reportUrl) {
    throw new Error('Missing Sellerboard report URL');
  }

  logSync('Starting sync', { reportUrlPrefix: reportUrl.substring(0, 50) });

  const response = await fetch(reportUrl, { method: 'GET' });
  if (!response.ok) {
    logSync('CSV fetch failed', { status: response.status });
    throw new Error(`Sellerboard fetch failed (${response.status})`);
  }

  const csv = await response.text();
  logSync('CSV fetched', { byteLength: csv.length });

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

  logSync('Product codes extracted', { count: productCodes.length, codes: productCodes.slice(0, 20) });

  if (productCodes.length === 0) {
    logSync('No product codes found, skipping sync');
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

  // Try matching by SKU first
  const directProducts = await prisma.product.findMany({
    where: {
      sku: { in: productCodes },
      strategy: { region: 'US' },
    },
    select: {
      id: true,
      sku: true,
      asin: true,
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

  logSync('SKU matching complete', {
    directMatches: directProducts.length,
    matchedCodes: Array.from(productsByCode.keys()),
  });

  // Try matching remaining codes by ASIN field on Product
  const unmatchedAfterSku = productCodes.filter((code) => !productsByCode.has(code));
  if (unmatchedAfterSku.length) {
    logSync('Attempting ASIN field matching', { unmatchedCodes: unmatchedAfterSku });

    const asinProducts = await prisma.product.findMany({
      where: {
        asin: { in: unmatchedAfterSku },
        strategy: { region: 'US' },
      },
      select: {
        id: true,
        sku: true,
        asin: true,
        strategyId: true,
      },
    });

    logSync('ASIN field matches found', {
      count: asinProducts.length,
      matches: asinProducts.map((p) => ({ sku: p.sku, asin: p.asin })),
    });

    for (const product of asinProducts) {
      if (!product.strategyId || !product.asin) continue;
      directProductIds.add(product.id);
      const list = productsByCode.get(product.asin) ?? [];
      list.push({ id: product.id, strategyId: product.strategyId });
      productsByCode.set(product.asin, list);
    }
  }

  const unmatchedCodes = productCodes.filter((code) => !productsByCode.has(code));
  let asinMappingsFound = 0;
  let asinProductsMatched = 0;

  if (unmatchedCodes.length) {
    logSync('Attempting Talos ASIN lookup', { unmatchedCodes });

    const talos = getTalosPrisma('US');
    if (talos) {
      const mappings = await talos.sku.findMany({
        where: { asin: { in: unmatchedCodes } },
        select: { asin: true, skuCode: true },
      });
      asinMappingsFound = mappings.length;

      logSync('Talos ASIN mappings found', {
        count: mappings.length,
        mappings: mappings.map((m) => ({ asin: m.asin, skuCode: m.skuCode })),
      });

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

        logSync('X-Plan products for mapped SKUs', {
          count: mappedProducts.length,
          skus: mappedProducts.map((p) => p.sku),
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
    } else {
      logSync('Talos client not available for US region');
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

  logSync('Preparing upserts', { upsertCount: upserts.length });

  if (upserts.length) {
    await prisma.$transaction(upserts);
    logSync('Upserts completed', { count: upserts.length });
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
    productsMatched: result.productsMatched,
    updates: result.updates,
    asinMappingsFound: result.asinMappingsFound,
    asinProductsMatched: result.asinProductsMatched,
  });

  return result;
}
