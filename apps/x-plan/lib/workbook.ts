import { formatDistanceToNow } from 'date-fns'
import { SHEETS, type SheetConfig, type SheetSlug } from './sheets'
import prisma from './prisma'

type AggregateSummary = {
  _count: { id: number }
  _max: { updatedAt: Date | null }
}

type WorkbookStatus = {
  completedCount: number
  totalCount: number
  sheets: WorkbookSheetStatus[]
}

export type WorkbookSheetStatus = {
  slug: SheetSlug
  label: string
  description: string
  recordCount: number
  lastUpdated?: string
  status: 'complete' | 'todo'
  relativeUpdatedAt?: string
}

function formatIso(date?: Date | null) {
  return date ? date.toISOString() : undefined
}

function formatRelative(date?: Date | null) {
  if (!date) return undefined
  return formatDistanceToNow(date, { addSuffix: true })
}

function latestDate(dates: Array<Date | null | undefined>): Date | undefined {
  return dates.reduce<Date | undefined>((latest, current) => {
    if (!current) return latest
    if (!latest || current.getTime() > latest.getTime()) return current
    return latest
  }, undefined)
}

export async function getWorkbookStatus(): Promise<WorkbookStatus> {
  const [productAgg, purchaseOrderAgg, salesAgg, profitAgg, cashAgg, businessAgg] = (await Promise.all([
    prisma.product.aggregate({
      _count: { id: true },
      _max: { updatedAt: true },
    }),
    prisma.purchaseOrder.aggregate({
      _count: { id: true },
      _max: { updatedAt: true },
    }),
    prisma.salesWeek.aggregate({
      _count: { id: true },
      _max: { updatedAt: true },
    }),
    prisma.profitAndLossWeek.aggregate({
      _count: { id: true },
      _max: { updatedAt: true },
    }),
    prisma.cashFlowWeek.aggregate({
      _count: { id: true },
      _max: { updatedAt: true },
    }),
    prisma.businessParameter.aggregate({
      _count: { id: true },
      _max: { updatedAt: true },
    }),
  ])) as AggregateSummary[]

  const productUpdatedAt = latestDate([productAgg._max.updatedAt, businessAgg._max.updatedAt])
  const profitUpdatedAt = latestDate([profitAgg._max.updatedAt, businessAgg._max.updatedAt])
  const cashUpdatedAt = latestDate([cashAgg._max.updatedAt, businessAgg._max.updatedAt])

  const sheetStatus: Record<SheetSlug, WorkbookSheetStatus> = {
    '1-product-setup': {
      slug: '1-product-setup',
      label: '1. Product Setup',
      description: 'SKU pricing, cost inputs, and lead-time defaults.',
      recordCount: productAgg._count.id,
      lastUpdated: formatIso(productUpdatedAt ?? productAgg._max.updatedAt),
      relativeUpdatedAt: formatRelative(productUpdatedAt ?? productAgg._max.updatedAt),
      status: productAgg._count.id > 0 ? 'complete' : 'todo',
    },
    '2-ops-planning': {
      slug: '2-ops-planning',
      label: '2. Ops Planning',
      description: 'Purchase orders, supplier payments, and logistics tracking.',
      recordCount: purchaseOrderAgg._count.id,
      lastUpdated: formatIso(purchaseOrderAgg._max.updatedAt),
      relativeUpdatedAt: formatRelative(purchaseOrderAgg._max.updatedAt),
      status: purchaseOrderAgg._count.id > 0 ? 'complete' : 'todo',
    },
    '3-sales-planning': {
      slug: '3-sales-planning',
      label: '3. Sales Planning',
      description: 'Weekly sales forecast and inventory coverage by SKU.',
      recordCount: salesAgg._count.id,
      lastUpdated: formatIso(salesAgg._max.updatedAt),
      relativeUpdatedAt: formatRelative(salesAgg._max.updatedAt),
      status: salesAgg._count.id > 0 ? 'complete' : 'todo',
    },
    '4-fin-planning-pl': {
      slug: '4-fin-planning-pl',
      label: '4. Fin Planning P&L',
      description: 'Weekly profitability and monthly rollups.',
      recordCount: profitAgg._count.id,
      lastUpdated: formatIso(profitUpdatedAt ?? profitAgg._max.updatedAt),
      relativeUpdatedAt: formatRelative(profitUpdatedAt ?? profitAgg._max.updatedAt),
      status: profitAgg._count.id > 0 ? 'complete' : 'todo',
    },
    '5-fin-planning-cash-flow': {
      slug: '5-fin-planning-cash-flow',
      label: '5. Fin Planning Cash Flow',
      description: 'Cash movement, payouts, and runway visibility.',
      recordCount: cashAgg._count.id,
      lastUpdated: formatIso(cashUpdatedAt ?? cashAgg._max.updatedAt),
      relativeUpdatedAt: formatRelative(cashUpdatedAt ?? cashAgg._max.updatedAt),
      status: cashAgg._count.id > 0 ? 'complete' : 'todo',
    },
    '6-dashboard': {
      slug: '6-dashboard',
      label: '6. Dashboard',
      description: 'KPI snapshots across demand, supply, and finance.',
      recordCount: Math.max(
        productAgg._count.id,
        purchaseOrderAgg._count.id,
        salesAgg._count.id,
        profitAgg._count.id,
        cashAgg._count.id,
      ),
      lastUpdated: formatIso(
        latestDate([
          productUpdatedAt ?? productAgg._max.updatedAt,
          purchaseOrderAgg._max.updatedAt,
          salesAgg._max.updatedAt,
          profitUpdatedAt ?? profitAgg._max.updatedAt,
          cashUpdatedAt ?? cashAgg._max.updatedAt,
          businessAgg._max.updatedAt,
        ]) ?? null,
      ),
      relativeUpdatedAt: formatRelative(
        latestDate([
          productUpdatedAt ?? productAgg._max.updatedAt,
          purchaseOrderAgg._max.updatedAt,
          salesAgg._max.updatedAt,
          profitUpdatedAt ?? profitAgg._max.updatedAt,
          cashUpdatedAt ?? cashAgg._max.updatedAt,
          businessAgg._max.updatedAt,
        ]) ?? null,
      ),
      status:
        productAgg._count.id > 0 ||
        purchaseOrderAgg._count.id > 0 ||
        salesAgg._count.id > 0 ||
        profitAgg._count.id > 0 ||
        cashAgg._count.id > 0
          ? 'complete'
          : 'todo',
    },
  }

  const items: WorkbookSheetStatus[] = SHEETS.map((sheet: SheetConfig) => sheetStatus[sheet.slug])
  const completedCount = items.filter((item) => item.status === 'complete').length

  return {
    completedCount,
    totalCount: items.length,
    sheets: items,
  }
}
