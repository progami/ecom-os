import { prisma } from '@/lib/prisma';
import { CostCategory } from '@prisma/client';

export interface AggregatedCost {
  warehouseCode: string;
  warehouseName: string;
  costCategory: CostCategory;
  costName: string;
  quantity: number;
  unitRate: number;
  unit: string;
  amount: number;
  details?: Array<{
    skuCode: string;
    description: string;
    batchLot?: string;
    count: number;
  }>;
}

export interface BillingPeriod {
  start: Date;
  end: Date;
}

/**
 * Aggregates costs for a warehouse during a billing period
 * Note: Several cost aggregation features have been removed in v0.5.0
 * with the removal of CalculatedCost and related models
 */
export async function aggregateCostsForBillingPeriod(
  warehouseCode: string,
  billingPeriod: BillingPeriod
): Promise<AggregatedCost[]> {
  const aggregatedCosts: AggregatedCost[] = [];

  // Get warehouse info
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseCode },
  });

  if (!warehouse) {
    throw new Error('Warehouse not found');
  }

  // Note: Cost aggregation logic simplified in v0.5.0
  // Previously aggregated from CalculatedCost model which has been removed
  
  // Get costs from CostLedger (the new unified cost tracking model)
  const costLedgerEntries = await prisma.costLedger.findMany({
    where: {
      warehouseCode,
      createdAt: {
        gte: billingPeriod.start,
        lte: billingPeriod.end,
      },
    },
  });

  // Group costs by category and name
  const costMap = new Map<string, AggregatedCost>();
  
  for (const entry of costLedgerEntries) {
    const key = `${entry.costCategory}-${entry.costName}`;
    const existing = costMap.get(key);
    
    if (existing) {
      existing.quantity += Number(entry.quantity);
      existing.amount += Number(entry.totalCost);
    } else {
      costMap.set(key, {
        warehouseCode: entry.warehouseCode,
        warehouseName: warehouse.name,
        costCategory: entry.costCategory,
        costName: entry.costName,
        quantity: Number(entry.quantity),
        unitRate: Number(entry.unitRate),
        unit: 'unit',
        amount: Number(entry.totalCost),
      });
    }
  }

  // Storage costs have been simplified in v0.5.0
  // The billingPeriodStart/End fields were removed from StorageLedger
  // Storage is now calculated differently
  const storageEntries = await prisma.storageLedger.findMany({
    where: {
      warehouseCode,
      weekEndingDate: {
        gte: billingPeriod.start,
        lte: billingPeriod.end,
      },
    },
  });

  // Add simplified storage costs
  let totalStoragePalletWeeks = 0;
  for (const entry of storageEntries) {
    // Use average balance as approximation for pallets stored
    totalStoragePalletWeeks += Number(entry.averageBalance);
  }
  
  if (totalStoragePalletWeeks > 0) {
    aggregatedCosts.push({
      warehouseCode,
      warehouseName: warehouse.name,
      costCategory: CostCategory.Storage,
      costName: 'Weekly Pallet Storage',
      quantity: totalStoragePalletWeeks,
      unitRate: 0, // Rate would need to be fetched from CostRate
      unit: 'pallet-week',
      amount: 0, // Amount would need to be calculated
    });
  }

  // Return all aggregated costs
  return [...costMap.values(), ...aggregatedCosts];
}

/**
 * Gets cost summary by category for a warehouse
 */
export async function getCostSummaryByCategory(
  warehouseCode: string,
  startDate: Date,
  endDate: Date
): Promise<Map<CostCategory, number>> {
  const summary = new Map<CostCategory, number>();

  const costs = await prisma.costLedger.findMany({
    where: {
      warehouseCode,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  for (const cost of costs) {
    const currentAmount = summary.get(cost.costCategory) || 0;
    summary.set(cost.costCategory, currentAmount + Number(cost.totalCost));
  }

  return summary;
}

/**
 * Calculates average cost per unit for a specific SKU
 */
export async function calculateAverageCostPerUnit(
  skuCode: string,
  warehouseCode: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Get all transactions for this SKU in the period
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      skuCode,
      warehouseCode,
      transactionDate: {
        gte: startDate,
        lte: endDate,
      },
      transactionType: 'RECEIVE',
    },
  });

  if (transactions.length === 0) {
    return 0;
  }

  // Get costs associated with these transactions
  let totalCost = 0;
  let totalUnits = 0;

  for (const transaction of transactions) {
    const costs = await prisma.costLedger.findMany({
      where: {
        transactionId: transaction.id,
      },
    });

    for (const cost of costs) {
      totalCost += Number(cost.totalCost);
    }

    totalUnits += transaction.cartonsIn * transaction.unitsPerCarton;
  }

  return totalUnits > 0 ? totalCost / totalUnits : 0;
}