import { prisma } from '@/lib/prisma';
import { CostCategory } from '@prisma/client';

export interface AggregatedCost {
  warehouseId: string;
  warehouseName: string;
  costCategory: CostCategory;
  costName: string;
  quantity: number;
  unitRate: number;
  unit: string;
  amount: number;
  details?: {
    skuId?: string;
    skuCode?: string;
    description?: string;
    batchLot?: string;
    transactionType?: string;
    count?: number;
  }[];
}

export interface BillingPeriod {
  start: Date;
  end: Date;
}

/**
 * Get billing period dates (16th of month to 15th of next month)
 */
export function getBillingPeriod(date: Date): BillingPeriod {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  let start: Date;
  let end: Date;

  if (day >= 16) {
    // Current month's billing period
    start = new Date(year, month, 16);
    end = new Date(year, month + 1, 15, 23, 59, 59, 999);
  } else {
    // Previous month's billing period
    start = new Date(year, month - 1, 16);
    end = new Date(year, month, 15, 23, 59, 59, 999);
  }

  return { start, end };
}

/**
 * Calculate storage costs from StorageLedger for a billing period
 */
export async function calculateStorageCosts(
  warehouseId: string,
  billingPeriod: BillingPeriod
): Promise<AggregatedCost[]> {
  // Get storage entries for the billing period
  const storageEntries = await prisma.storageLedger.findMany({
    where: {
      warehouseId,
      billingPeriodStart: {
        gte: billingPeriod.start,
      },
      billingPeriodEnd: {
        lte: billingPeriod.end,
      },
    },
    include: {
      sku: true,
      warehouse: true,
    },
  });

  // Group storage costs by SKU and aggregate
  const costsBySku = new Map<string, AggregatedCost>();

  for (const entry of storageEntries) {
    const key = `${entry.skuId}-${entry.batchLot}`;
    
    const existingCost = costsBySku.get(key);
    const weeklyAmount = Number(entry.calculatedWeeklyCost);

    if (existingCost) {
      existingCost.quantity += entry.storagePalletsCharged;
      existingCost.amount += weeklyAmount;
      if (existingCost.details) {
        existingCost.details.push({
          skuId: entry.skuId,
          skuCode: entry.sku.skuCode,
          description: entry.sku.description,
          batchLot: entry.batchLot,
          count: entry.storagePalletsCharged,
        });
      }
    } else {
      costsBySku.set(key, {
        warehouseId: entry.warehouseId,
        warehouseName: entry.warehouse.name,
        costCategory: CostCategory.Storage,
        costName: 'Weekly Pallet Storage',
        quantity: entry.storagePalletsCharged,
        unitRate: Number(entry.applicableWeeklyRate),
        unit: 'pallet-week',
        amount: weeklyAmount,
        details: [{
          skuId: entry.skuId,
          skuCode: entry.sku.skuCode,
          description: entry.sku.description,
          batchLot: entry.batchLot,
          count: entry.storagePalletsCharged,
        }],
      });
    }
  }

  // Aggregate by cost name for summary
  const aggregatedCosts: AggregatedCost[] = [];
  const totalsByCostName = new Map<string, AggregatedCost>();

  for (const cost of costsBySku.values()) {
    const existing = totalsByCostName.get(cost.costName);
    if (existing) {
      existing.quantity += cost.quantity;
      existing.amount += cost.amount;
      if (existing.details && cost.details) {
        existing.details.push(...cost.details);
      }
    } else {
      totalsByCostName.set(cost.costName, { ...cost });
    }
  }

  return Array.from(totalsByCostName.values());
}

/**
 * Calculate transaction-based costs (inbound/outbound) for a billing period
 */
export async function calculateTransactionCosts(
  warehouseId: string,
  billingPeriod: BillingPeriod
): Promise<AggregatedCost[]> {
  // Get all transactions for the billing period
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      warehouseId,
      transactionDate: {
        gte: billingPeriod.start,
        lte: billingPeriod.end,
      },
      transactionType: {
        in: ['RECEIVE', 'SHIP'],
      },
    },
    include: {
      sku: true,
      warehouse: true,
    },
  });

  // Get all cost rates for the warehouse
  const costRates = await prisma.costRate.findMany({
    where: {
      warehouseId,
      costCategory: {
        in: [CostCategory.Container, CostCategory.Carton, CostCategory.Pallet, 
             CostCategory.Unit, CostCategory.Shipment],
      },
      effectiveDate: {
        lte: billingPeriod.end,
      },
      OR: [
        { endDate: null },
        { endDate: { gte: billingPeriod.start } },
      ],
    },
  });

  const aggregatedCosts: AggregatedCost[] = [];

  // Process inbound transactions (RECEIVE)
  const inboundTransactions = transactions.filter(t => t.transactionType === 'RECEIVE');
  
  // Container unloading (one per receive batch with container)
  const containerTransactions = inboundTransactions.filter(t => t.containerNumber);
  const uniqueContainers = new Set(containerTransactions.map(t => t.containerNumber));
  
  const containerRate = costRates.find(r => r.costCategory === CostCategory.Container);
  if (containerRate && uniqueContainers.size > 0) {
    aggregatedCosts.push({
      warehouseId,
      warehouseName: transactions[0]?.warehouse.name || '',
      costCategory: CostCategory.Container,
      costName: containerRate.costName,
      quantity: uniqueContainers.size,
      unitRate: Number(containerRate.costValue),
      unit: containerRate.unitOfMeasure,
      amount: uniqueContainers.size * Number(containerRate.costValue),
      details: Array.from(uniqueContainers).map(containerNumber => ({
        transactionType: 'RECEIVE',
        count: 1,
      })),
    });
  }

  // Inbound carton handling
  const inboundCartonRate = costRates.find(r => 
    r.costCategory === CostCategory.Carton && r.costName.toLowerCase().includes('inbound')
  );
  if (inboundCartonRate) {
    const totalInboundCartons = inboundTransactions.reduce(
      (sum, t) => sum + t.cartonsIn, 0
    );
    if (totalInboundCartons > 0) {
      aggregatedCosts.push({
        warehouseId,
        warehouseName: transactions[0]?.warehouse.name || '',
        costCategory: CostCategory.Carton,
        costName: inboundCartonRate.costName,
        quantity: totalInboundCartons,
        unitRate: Number(inboundCartonRate.costValue),
        unit: inboundCartonRate.unitOfMeasure,
        amount: totalInboundCartons * Number(inboundCartonRate.costValue),
        details: inboundTransactions
          .filter(t => t.cartonsIn > 0)
          .map(t => ({
            skuId: t.skuId,
            skuCode: t.sku.skuCode,
            description: t.sku.description,
            batchLot: t.batchLot,
            transactionType: 'RECEIVE',
            count: t.cartonsIn,
          })),
      });
    }
  }

  // Inbound pallet handling
  const inboundPalletRate = costRates.find(r => 
    r.costCategory === CostCategory.Pallet && r.costName.toLowerCase().includes('inbound')
  );
  if (inboundPalletRate) {
    const totalInboundPallets = inboundTransactions.reduce(
      (sum, t) => sum + t.storagePalletsIn, 0
    );
    if (totalInboundPallets > 0) {
      aggregatedCosts.push({
        warehouseId,
        warehouseName: transactions[0]?.warehouse.name || '',
        costCategory: CostCategory.Pallet,
        costName: inboundPalletRate.costName,
        quantity: totalInboundPallets,
        unitRate: Number(inboundPalletRate.costValue),
        unit: inboundPalletRate.unitOfMeasure,
        amount: totalInboundPallets * Number(inboundPalletRate.costValue),
        details: inboundTransactions
          .filter(t => t.storagePalletsIn > 0)
          .map(t => ({
            skuId: t.skuId,
            skuCode: t.sku.skuCode,
            description: t.sku.description,
            batchLot: t.batchLot,
            transactionType: 'RECEIVE',
            count: t.storagePalletsIn,
          })),
      });
    }
  }

  // Process outbound transactions (SHIP)
  const outboundTransactions = transactions.filter(t => t.transactionType === 'SHIP');

  // Outbound by pallet
  const outboundPalletRate = costRates.find(r => 
    r.costCategory === CostCategory.Pallet && r.costName.toLowerCase().includes('outbound')
  );
  if (outboundPalletRate) {
    const totalOutboundPallets = outboundTransactions.reduce(
      (sum, t) => sum + t.shippingPalletsOut, 0
    );
    if (totalOutboundPallets > 0) {
      aggregatedCosts.push({
        warehouseId,
        warehouseName: transactions[0]?.warehouse.name || '',
        costCategory: CostCategory.Pallet,
        costName: outboundPalletRate.costName,
        quantity: totalOutboundPallets,
        unitRate: Number(outboundPalletRate.costValue),
        unit: outboundPalletRate.unitOfMeasure,
        amount: totalOutboundPallets * Number(outboundPalletRate.costValue),
        details: outboundTransactions
          .filter(t => t.shippingPalletsOut > 0)
          .map(t => ({
            skuId: t.skuId,
            skuCode: t.sku.skuCode,
            description: t.sku.description,
            batchLot: t.batchLot,
            transactionType: 'SHIP',
            count: t.shippingPalletsOut,
          })),
      });
    }
  }

  // Outbound by carton (only for transactions without pallets)
  const outboundCartonRate = costRates.find(r => 
    r.costCategory === CostCategory.Carton && r.costName.toLowerCase().includes('outbound')
  );
  if (outboundCartonRate) {
    const cartonsNotOnPallets = outboundTransactions
      .filter(t => t.shippingPalletsOut === 0)
      .reduce((sum, t) => sum + t.cartonsOut, 0);
    
    if (cartonsNotOnPallets > 0) {
      aggregatedCosts.push({
        warehouseId,
        warehouseName: transactions[0]?.warehouse.name || '',
        costCategory: CostCategory.Carton,
        costName: outboundCartonRate.costName,
        quantity: cartonsNotOnPallets,
        unitRate: Number(outboundCartonRate.costValue),
        unit: outboundCartonRate.unitOfMeasure,
        amount: cartonsNotOnPallets * Number(outboundCartonRate.costValue),
        details: outboundTransactions
          .filter(t => t.shippingPalletsOut === 0 && t.cartonsOut > 0)
          .map(t => ({
            skuId: t.skuId,
            skuCode: t.sku.skuCode,
            description: t.sku.description,
            batchLot: t.batchLot,
            transactionType: 'SHIP',
            count: t.cartonsOut,
          })),
      });
    }
  }

  // Shipment charges (per shipment)
  const shipmentRate = costRates.find(r => r.costCategory === CostCategory.Shipment);
  if (shipmentRate) {
    // Group by date and reference to count unique shipments
    const shipments = new Map<string, { date: Date; referenceId: string | null }>();
    for (const t of outboundTransactions) {
      const key = `${t.transactionDate.toDateString()}-${t.referenceId || 'NO_REF'}`;
      if (!shipments.has(key)) {
        shipments.set(key, {
          date: t.transactionDate,
          referenceId: t.referenceId,
        });
      }
    }
    
    if (shipments.size > 0) {
      aggregatedCosts.push({
        warehouseId,
        warehouseName: transactions[0]?.warehouse.name || '',
        costCategory: CostCategory.Shipment,
        costName: shipmentRate.costName,
        quantity: shipments.size,
        unitRate: Number(shipmentRate.costValue),
        unit: shipmentRate.unitOfMeasure,
        amount: shipments.size * Number(shipmentRate.costValue),
        details: Array.from(shipments.values()).map(shipment => ({
          transactionType: 'SHIP',
          count: 1,
        })),
      });
    }
  }

  return aggregatedCosts;
}

/**
 * Calculate all costs for a warehouse during a billing period
 */
export async function calculateAllCosts(
  warehouseId: string,
  billingPeriod: BillingPeriod
): Promise<AggregatedCost[]> {
  const [storageCosts, transactionCosts] = await Promise.all([
    calculateStorageCosts(warehouseId, billingPeriod),
    calculateTransactionCosts(warehouseId, billingPeriod),
  ]);

  return [...storageCosts, ...transactionCosts];
}

/**
 * Get calculated costs grouped by cost category and name
 */
export async function getCalculatedCostsSummary(
  warehouseId: string,
  billingPeriod: BillingPeriod
): Promise<{ costCategory: CostCategory; costName: string; totalQuantity: number; totalAmount: number; unitRate: number; unit: string }[]> {
  const allCosts = await calculateAllCosts(warehouseId, billingPeriod);
  
  const summaryMap = new Map<string, {
    costCategory: CostCategory;
    costName: string;
    totalQuantity: number;
    totalAmount: number;
    unitRate: number;
    unit: string;
  }>();
  
  for (const cost of allCosts) {
    const key = `${cost.costCategory}-${cost.costName}`;
    const existing = summaryMap.get(key);
    
    if (existing) {
      existing.totalQuantity += cost.quantity;
      existing.totalAmount += cost.amount;
    } else {
      summaryMap.set(key, {
        costCategory: cost.costCategory,
        costName: cost.costName,
        totalQuantity: cost.quantity,
        totalAmount: cost.amount,
        unitRate: cost.unitRate,
        unit: cost.unit,
      });
    }
  }
  
  return Array.from(summaryMap.values());
}