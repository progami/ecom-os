import type { ProductCostSummary } from './product';
import type { SalesWeekDerived } from './sales';

export interface AllocationLedgerLine {
  weekNumber: number;
  weekDate: Date | null;
  productId: string;
  orderCode: string | null;
  batchCode: string | null;
  units: number;
  revenue: number;
  cogs: number;
  amazonFees: number;
  ppcSpend: number;
}

function coerceFinite(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function buildAllocationLedger(
  salesPlan: SalesWeekDerived[],
  products: Map<string, ProductCostSummary>,
): AllocationLedgerLine[] {
  const lines: AllocationLedgerLine[] = [];

  for (const row of salesPlan) {
    const weekNumber = row.weekNumber;
    const weekDate = row.weekDate ?? null;

    let allocatedUnits = 0;
    if (row.batchAllocations && row.batchAllocations.length > 0) {
      for (const allocation of row.batchAllocations) {
        const units = coerceFinite(allocation.quantity);
        const revenue = units * coerceFinite(allocation.sellingPrice);
        const cogs = units * coerceFinite(allocation.landedUnitCost);
        const amazonFees =
          revenue * coerceFinite(allocation.amazonReferralRate) +
          units * coerceFinite(allocation.fbaFee) +
          units * coerceFinite(allocation.storagePerMonth);
        const ppcSpend =
          units * coerceFinite(allocation.sellingPrice) * coerceFinite(allocation.tacosPercent);

        lines.push({
          weekNumber,
          weekDate,
          productId: row.productId,
          orderCode: allocation.orderCode,
          batchCode: allocation.batchCode ?? null,
          units,
          revenue,
          cogs,
          amazonFees,
          ppcSpend,
        });

        allocatedUnits += units;
      }
    }

    const remainingUnits = row.finalSales - allocatedUnits;
    if (remainingUnits > 0) {
      const product = products.get(row.productId);
      if (!product) continue;

      const units = coerceFinite(remainingUnits);
      const revenue = units * coerceFinite(product.sellingPrice);
      const cogs = units * coerceFinite(product.landedUnitCost);
      const amazonFees =
        revenue * coerceFinite(product.amazonReferralRate) +
        units * coerceFinite(product.fbaFee) +
        units * coerceFinite(product.storagePerMonth);
      const ppcSpend =
        units * coerceFinite(product.sellingPrice) * coerceFinite(product.tacosPercent);

      lines.push({
        weekNumber,
        weekDate,
        productId: row.productId,
        orderCode: null,
        batchCode: null,
        units,
        revenue,
        cogs,
        amazonFees,
        ppcSpend,
      });
    }
  }

  return lines;
}
