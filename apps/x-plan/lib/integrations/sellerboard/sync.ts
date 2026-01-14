import 'server-only';

import prisma from '@/lib/prisma';
import { loadPlanningCalendar } from '@/lib/planning';
import { getCalendarDateForWeek } from '@/lib/calculations/calendar';
import { weekStartsOnForRegion, type StrategyRegion } from '@/lib/strategy-region';
import { parseSellerboardOrdersWeeklyUnits } from './orders';
import { fetchSellerboardCsv } from './client';
import { getTalosPrisma } from '@/lib/integrations/talos-client';
import type { SellerboardActualSalesSyncResult, SellerboardDashboardSyncResult } from './types';
import { parseSellerboardDashboardWeeklyFinancials } from './dashboard';

export type { SellerboardActualSalesSyncResult, SellerboardDashboardSyncResult };

function logSync(message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[sellerboard-sync] ${timestamp} ${message}`, JSON.stringify(data));
  } else {
    console.log(`[sellerboard-sync] ${timestamp} ${message}`);
  }
}

export async function syncSellerboardActualSales(options: {
  region: StrategyRegion;
  reportUrl: string;
}): Promise<SellerboardActualSalesSyncResult> {
  logSync(`Starting Sellerboard ${options.region} actual sales sync`);

  const reportUrl = options.reportUrl.trim();
  if (!reportUrl) {
    throw new Error('Missing Sellerboard report URL');
  }

  logSync(`Fetching CSV from Sellerboard (${options.region})`);
  const csv = await fetchSellerboardCsv(reportUrl);
  logSync(`CSV fetched (${options.region})`, { bytes: csv.length });

  const weekStartsOn = weekStartsOnForRegion(options.region);
  const planning = await loadPlanningCalendar(weekStartsOn);

  const parsed = parseSellerboardOrdersWeeklyUnits(csv, planning, {
    weekStartsOn,
    excludeStatuses: ['Cancelled'],
  });

  logSync(`CSV parsed (${options.region})`, {
    rowsParsed: parsed.rowsParsed,
    rowsSkipped: parsed.rowsSkipped,
    weeklyUnitsCount: parsed.weeklyUnits.length,
    oldestDate: parsed.oldestPurchaseDateUtc?.toISOString(),
    newestDate: parsed.newestPurchaseDateUtc?.toISOString(),
  });

  const productCodes = Array.from(new Set(parsed.weeklyUnits.map((entry) => entry.productCode)));
  logSync(`Unique product codes from CSV (${options.region})`, {
    count: productCodes.length,
    sample: productCodes.slice(0, 10),
  });

  if (productCodes.length === 0) {
    logSync(`No product codes found in CSV (${options.region}), returning early`);
    return {
      rowsParsed: parsed.rowsParsed,
      rowsSkipped: parsed.rowsSkipped,
      productsMatched: 0,
      asinDirectMatched: 0,
      asinMappingsFound: 0,
      asinProductsMatched: 0,
      updates: 0,
      csvSha256: parsed.csvSha256,
      oldestPurchaseDateUtc: parsed.oldestPurchaseDateUtc,
      newestPurchaseDateUtc: parsed.newestPurchaseDateUtc,
    };
  }

  // Step 1: Match products by SKU
  logSync(`Looking up products by SKU (${options.region})`);
  const directProducts = await prisma.product.findMany({
    where: {
      sku: { in: productCodes },
      strategy: { region: options.region },
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

  logSync(`Direct SKU match results (${options.region})`, {
    productsFound: directProducts.length,
    uniqueSkusMatched: productsByCode.size,
    matchedSkus: Array.from(productsByCode.keys()).slice(0, 10),
  });

  // Step 2: Match unmatched codes by ASIN field in X-Plan products
  let unmatchedCodes = productCodes.filter((code) => !productsByCode.has(code));
  let asinDirectMatched = 0;
  let asinMappingsFound = 0;
  let asinProductsMatched = 0;

  if (unmatchedCodes.length) {
    logSync(`Looking up products by ASIN (${options.region})`, {
      unmatchedCount: unmatchedCodes.length,
      sample: unmatchedCodes.slice(0, 10),
    });

    const asinProducts = (await prisma.product.findMany({
      where: {
        asin: { in: unmatchedCodes },
        strategy: { region: options.region },
      },
      select: {
        id: true,
        sku: true,
        asin: true,
        strategyId: true,
      },
    })) as unknown as Array<{ id: string; sku: string; asin: string | null; strategyId: string | null }>;

    for (const product of asinProducts) {
      if (!product.strategyId || !product.asin) continue;
      directProductIds.add(product.id);
      const list = productsByCode.get(product.asin) ?? [];
      list.push({ id: product.id, strategyId: product.strategyId });
      productsByCode.set(product.asin, list);
      asinDirectMatched++;
    }

    logSync(`Direct ASIN match results (${options.region})`, {
      productsFound: asinProducts.length,
      asinDirectMatched,
    });

    unmatchedCodes = productCodes.filter((code) => !productsByCode.has(code));
  }

  // Step 3: Match remaining unmatched codes via Talos ASIN->SKU mapping (fallback)
  if (unmatchedCodes.length) {
    logSync(`Looking up Talos ASIN mappings (${options.region})`, {
      unmatchedCount: unmatchedCodes.length,
      sample: unmatchedCodes.slice(0, 10),
    });

    const talos = getTalosPrisma(options.region);
    if (talos) {
      const mappings = await talos.sku.findMany({
        where: { asin: { in: unmatchedCodes } },
        select: { asin: true, skuCode: true },
      });
      asinMappingsFound = mappings.length;

      logSync(`Talos ASIN mappings found (${options.region})`, {
        count: mappings.length,
        sample: mappings.slice(0, 5).map((m: { asin: string | null; skuCode: string | null }) => ({
          asin: m.asin,
          skuCode: m.skuCode,
        })),
      });

      const mappedSkuCodes = Array.from(
        new Set(
          mappings
            .map((row: { skuCode: string | null }) => row.skuCode?.trim())
            .filter((value: string | undefined): value is string => Boolean(value))
        )
      );

      if (mappedSkuCodes.length) {
        const mappedProducts = await prisma.product.findMany({
          where: {
            sku: { in: mappedSkuCodes },
            strategy: { region: options.region },
          },
          select: { id: true, sku: true, strategyId: true },
        });

        logSync(`Products found via Talos mapping (${options.region})`, {
          count: mappedProducts.length,
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

        logSync(`Talos ASIN->SKU matching complete (${options.region})`, {
          asinProductsMatched,
        });
      }
    }
  }

  // Log final unmatched codes for debugging
  const finalUnmatchedCodes = productCodes.filter((code) => !productsByCode.has(code));
  if (finalUnmatchedCodes.length) {
    logSync(`Unmatched product codes (no X-Plan product found) (${options.region})`, {
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
            weekDate,
            actualSales: entry.units,
            hasActualData: true,
            finalSales: null,
          },
          create: {
            strategyId: product.strategyId,
            productId: product.id,
            weekNumber: entry.weekNumber,
            weekDate,
            actualSales: entry.units,
            hasActualData: true,
            finalSales: null,
          },
        })
      );
    }
  }

  logSync(`Preparing upserts (${options.region})`, { count: upserts.length });

  if (upserts.length) {
    logSync(`Executing database transaction (${options.region})`);
    await prisma.$transaction(upserts);
    logSync(`Database transaction complete (${options.region})`);
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
    asinDirectMatched,
    asinMappingsFound,
    asinProductsMatched,
    updates: upserts.length,
    csvSha256: parsed.csvSha256,
    oldestPurchaseDateUtc: parsed.oldestPurchaseDateUtc,
    newestPurchaseDateUtc: parsed.newestPurchaseDateUtc,
  };

  logSync(`Sync complete (${options.region})`, {
    rowsParsed: result.rowsParsed,
    rowsSkipped: result.rowsSkipped,
    productsMatched: result.productsMatched,
    asinMappingsFound: result.asinMappingsFound,
    asinProductsMatched: result.asinProductsMatched,
    updates: result.updates,
  });

  return result;
}

export async function syncSellerboardUsActualSales(options: {
  reportUrl: string;
}): Promise<SellerboardActualSalesSyncResult> {
  return syncSellerboardActualSales({ region: 'US', reportUrl: options.reportUrl });
}

export async function syncSellerboardUkActualSales(options: {
  reportUrl: string;
}): Promise<SellerboardActualSalesSyncResult> {
  return syncSellerboardActualSales({ region: 'UK', reportUrl: options.reportUrl });
}

/**
 * Sync Sellerboard Dashboard by Day data to SalesWeekFinancials table
 */
export async function syncSellerboardDashboard(options: {
  region: StrategyRegion;
  reportUrl: string;
}): Promise<SellerboardDashboardSyncResult> {
  logSync(`Starting Sellerboard ${options.region} Dashboard sync`);

  const reportUrl = options.reportUrl.trim();
  if (!reportUrl) {
    throw new Error('Missing Sellerboard Dashboard report URL');
  }

  logSync(`Fetching Dashboard CSV from Sellerboard (${options.region})`);
  const csv = await fetchSellerboardCsv(reportUrl);
  logSync(`Dashboard CSV fetched (${options.region})`, { bytes: csv.length });

  const weekStartsOn = weekStartsOnForRegion(options.region);
  const planning = await loadPlanningCalendar(weekStartsOn);

  const parsed = parseSellerboardDashboardWeeklyFinancials(csv, planning, {
    weekStartsOn,
  });

  logSync(`Dashboard CSV parsed (${options.region})`, {
    rowsParsed: parsed.rowsParsed,
    rowsSkipped: parsed.rowsSkipped,
    weeklyFinancialsCount: parsed.weeklyFinancials.length,
    oldestDate: parsed.oldestDateUtc?.toISOString(),
    newestDate: parsed.newestDateUtc?.toISOString(),
  });

  const productCodes = Array.from(
    new Set(parsed.weeklyFinancials.map((entry) => entry.productCode))
  );
  logSync(`Unique product codes from Dashboard CSV (${options.region})`, {
    count: productCodes.length,
    sample: productCodes.slice(0, 10),
  });

  if (productCodes.length === 0) {
    logSync(`No product codes found in Dashboard CSV (${options.region}), returning early`);
    return {
      rowsParsed: parsed.rowsParsed,
      rowsSkipped: parsed.rowsSkipped,
      productsMatched: 0,
      asinDirectMatched: 0,
      asinMappingsFound: 0,
      asinProductsMatched: 0,
      updates: 0,
      csvSha256: parsed.csvSha256,
      oldestDateUtc: parsed.oldestDateUtc,
      newestDateUtc: parsed.newestDateUtc,
    };
  }

  // Step 1: Match products by SKU
  logSync(`Looking up products by SKU for Dashboard (${options.region})`);
  const directProducts = await prisma.product.findMany({
    where: {
      sku: { in: productCodes },
      strategy: { region: options.region },
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

  logSync(`Direct SKU match results for Dashboard (${options.region})`, {
    productsFound: directProducts.length,
    uniqueSkusMatched: productsByCode.size,
  });

  // Step 2: Match unmatched codes by ASIN field in X-Plan products
  let unmatchedCodes = productCodes.filter((code) => !productsByCode.has(code));
  let asinDirectMatched = 0;
  let asinMappingsFound = 0;
  let asinProductsMatched = 0;

  if (unmatchedCodes.length) {
    logSync(`Looking up products by ASIN for Dashboard (${options.region})`, {
      unmatchedCount: unmatchedCodes.length,
    });

    const asinProducts = (await prisma.product.findMany({
      where: {
        asin: { in: unmatchedCodes },
        strategy: { region: options.region },
      },
      select: {
        id: true,
        sku: true,
        asin: true,
        strategyId: true,
      },
    })) as unknown as Array<{ id: string; sku: string; asin: string | null; strategyId: string | null }>;

    for (const product of asinProducts) {
      if (!product.strategyId || !product.asin) continue;
      directProductIds.add(product.id);
      const list = productsByCode.get(product.asin) ?? [];
      list.push({ id: product.id, strategyId: product.strategyId });
      productsByCode.set(product.asin, list);
      asinDirectMatched++;
    }

    logSync(`Direct ASIN match results for Dashboard (${options.region})`, {
      productsFound: asinProducts.length,
      asinDirectMatched,
    });

    unmatchedCodes = productCodes.filter((code) => !productsByCode.has(code));
  }

  // Step 3: Match remaining unmatched codes via Talos ASIN->SKU mapping (fallback)
  if (unmatchedCodes.length) {
    logSync(`Looking up Talos ASIN mappings for Dashboard (${options.region})`, {
      unmatchedCount: unmatchedCodes.length,
    });

    const talos = getTalosPrisma(options.region);
    if (talos) {
      const mappings = await talos.sku.findMany({
        where: { asin: { in: unmatchedCodes } },
        select: { asin: true, skuCode: true },
      });
      asinMappingsFound = mappings.length;

      const mappedSkuCodes = Array.from(
        new Set(
          mappings
            .map((row: { skuCode: string | null }) => row.skuCode?.trim())
            .filter((value: string | undefined): value is string => Boolean(value))
        )
      );

      if (mappedSkuCodes.length) {
        const mappedProducts = await prisma.product.findMany({
          where: {
            sku: { in: mappedSkuCodes },
            strategy: { region: options.region },
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

  // Build upserts for SalesWeekFinancials
  // Note: Using type assertion until Prisma client is regenerated with SalesWeekFinancials model
  const prismaAny = prisma as unknown as Record<string, { upsert: (args: unknown) => unknown }>;
  const financialsDelegate = prismaAny.salesWeekFinancials;
  const upserts: unknown[] = [];

  for (const entry of parsed.weeklyFinancials) {
    const products = productsByCode.get(entry.productCode);
    if (!products?.length) continue;
    const weekDate = getCalendarDateForWeek(entry.weekNumber, planning.calendar);
    if (!weekDate) continue;

    for (const product of products) {
      upserts.push(
        financialsDelegate.upsert({
          where: {
            strategyId_productId_weekNumber: {
              strategyId: product.strategyId,
              productId: product.id,
              weekNumber: entry.weekNumber,
            },
          },
          update: {
            weekDate,
            actualRevenue: entry.revenue,
            actualAmazonFees: entry.amazonFees,
            actualReferralFees: entry.referralFees,
            actualFbaFees: entry.fbaFees,
            actualRefunds: entry.refunds,
            actualPpcSpend: entry.ppcSpend,
            actualNetProfit: entry.netProfit,
            syncedAt: new Date(),
          },
          create: {
            strategyId: product.strategyId,
            productId: product.id,
            weekNumber: entry.weekNumber,
            weekDate,
            actualRevenue: entry.revenue,
            actualAmazonFees: entry.amazonFees,
            actualReferralFees: entry.referralFees,
            actualFbaFees: entry.fbaFees,
            actualRefunds: entry.refunds,
            actualPpcSpend: entry.ppcSpend,
            actualNetProfit: entry.netProfit,
          },
        })
      );
    }
  }

  logSync(`Preparing Dashboard upserts (${options.region})`, { count: upserts.length });

  if (upserts.length) {
    logSync(`Executing Dashboard database transaction (${options.region})`);
    await prisma.$transaction(upserts as never);
    logSync(`Dashboard database transaction complete (${options.region})`);
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
    asinDirectMatched,
    asinMappingsFound,
    asinProductsMatched,
    updates: upserts.length,
    csvSha256: parsed.csvSha256,
    oldestDateUtc: parsed.oldestDateUtc,
    newestDateUtc: parsed.newestDateUtc,
  };

  logSync(`Dashboard sync complete (${options.region})`, {
    rowsParsed: result.rowsParsed,
    rowsSkipped: result.rowsSkipped,
    productsMatched: result.productsMatched,
    asinDirectMatched: result.asinDirectMatched,
    updates: result.updates,
  });

  return result;
}

export async function syncSellerboardUsDashboard(options: {
  reportUrl: string;
}): Promise<SellerboardDashboardSyncResult> {
  return syncSellerboardDashboard({ region: 'US', reportUrl: options.reportUrl });
}

export async function syncSellerboardUkDashboard(options: {
  reportUrl: string;
}): Promise<SellerboardDashboardSyncResult> {
  return syncSellerboardDashboard({ region: 'UK', reportUrl: options.reportUrl });
}
