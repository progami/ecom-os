import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import {
  CostLedgerAggregationResult,
  CostLedgerBucketTotals,
  CostLedgerDetail,
  CostLedgerEntryRecord,
  LedgerGroupBy
} from './types'
import { parseNumeric } from './utils/units'

const CATEGORY_BUCKETS = {
  storage: 'storage',
  container: 'container',
  pallet: 'pallet',
  carton: 'carton',
  unit: 'unit',
  transportation: 'transportation',
  accessorial: 'accessorial'
} as const

type BucketKey = keyof typeof CATEGORY_BUCKETS | 'other'

type BucketAccumulator = Omit<CostLedgerBucketTotals, 'total'>

type GroupAccumulator = {
  rangeStart: Date
  rangeEnd: Date
  costs: BucketAccumulator
  transactions: Set<string>
  details: CostLedgerDetail[]
}

export interface AggregateCostLedgerOptions {
  groupBy?: LedgerGroupBy
}

export function aggregateCostLedger(
  entries: readonly CostLedgerEntryRecord[],
  options: AggregateCostLedgerOptions = {}
): CostLedgerAggregationResult {
  const groupBy = options.groupBy ?? 'week'
  const grouped = new Map<string, GroupAccumulator>()

  for (const entry of entries) {
    const entryDate = new Date(entry.createdAt)
    const { key, rangeStart, rangeEnd } = buildGroupingKey(entryDate, groupBy)

    if (!grouped.has(key)) {
      grouped.set(key, {
        rangeStart,
        rangeEnd,
        costs: {
          storage: 0,
          container: 0,
          pallet: 0,
          carton: 0,
          unit: 0,
          transportation: 0,
          accessorial: 0,
          other: 0
        },
        transactions: new Set<string>(),
        details: []
      })
    }

    const bucket = grouped.get(key)!
    const bucketKey = mapCostCategory(entry.costCategory)

    bucket.costs[bucketKey] += parseNumeric(entry.totalCost)
    if (entry.transactionId) {
      bucket.transactions.add(entry.transactionId)
    }

    bucket.details.push({
      transactionId: entry.transactionId,
      transactionDate: entry.createdAt,
      transactionType: entry.context?.transactionType || 'UNKNOWN',
      warehouse: entry.context?.warehouseName || entry.warehouseCode || 'Unknown Warehouse',
      sku: entry.context?.skuCode || 'Unknown SKU',
      batchLot: entry.context?.batchLot || '',
      costCategory: entry.costCategory,
      costName: entry.costName,
      quantity: parseNumeric(entry.quantity),
      unitRate: parseNumeric(entry.unitRate),
      totalCost: parseNumeric(entry.totalCost)
    })
  }

  const groups = Array.from(grouped.entries())
    .map(([key, accumulator]) => {
      const totalsWithAggregate = computeBucketTotals(accumulator.costs)
      return {
        period: key,
        rangeStart: accumulator.rangeStart.toISOString(),
        rangeEnd: accumulator.rangeEnd.toISOString(),
        costs: totalsWithAggregate,
        transactions: Array.from(accumulator.transactions),
        details: accumulator.details
      }
    })
    .sort((a, b) => new Date(a.rangeStart).getTime() - new Date(b.rangeStart).getTime())

  const grandTotals = groups.reduce<CostLedgerBucketTotals>((totals, group) => {
    totals.storage += group.costs.storage
    totals.container += group.costs.container
    totals.pallet += group.costs.pallet
    totals.carton += group.costs.carton
    totals.unit += group.costs.unit
    totals.transportation += group.costs.transportation
    totals.accessorial += group.costs.accessorial
    totals.other += group.costs.other
    totals.total += group.costs.total
    return totals
  }, {
    storage: 0,
    container: 0,
    pallet: 0,
    carton: 0,
    unit: 0,
    transportation: 0,
    accessorial: 0,
    other: 0,
    total: 0
  })

  return {
    groups,
    totals: grandTotals
  }
}

function mapCostCategory(category: string): BucketKey {
  const normalized = category?.toLowerCase() ?? ''
  return (CATEGORY_BUCKETS as Record<string, BucketKey>)[normalized] ?? 'other'
}

function computeBucketTotals(bucket: BucketAccumulator): CostLedgerBucketTotals {
  const total =
    bucket.storage +
    bucket.container +
    bucket.pallet +
    bucket.carton +
    bucket.unit +
    bucket.transportation +
    bucket.accessorial +
    bucket.other

  return {
    ...bucket,
    total
  }
}

function buildGroupingKey(date: Date, groupBy: LedgerGroupBy) {
  if (groupBy === 'month') {
    const rangeStart = startOfMonth(date)
    const rangeEnd = endOfMonth(date)
    const key = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, '0')}`
    return { key, rangeStart, rangeEnd }
  }

  const rangeStart = startOfWeek(date, { weekStartsOn: 1 })
  const rangeEnd = endOfWeek(date, { weekStartsOn: 1 })
  return { key: rangeStart.toISOString(), rangeStart, rangeEnd }
}
