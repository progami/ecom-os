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
  try {
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
        label: 'Product Setup',
        description: '',
        recordCount: productAgg._count.id,
        lastUpdated: formatIso(productUpdatedAt ?? productAgg._max.updatedAt),
        relativeUpdatedAt: formatRelative(productUpdatedAt ?? productAgg._max.updatedAt),
        status: productAgg._count.id > 0 ? 'complete' : 'todo',
      },
      '2-ops-planning': {
        slug: '2-ops-planning',
        label: 'Ops Planning',
        description: '',
        recordCount: purchaseOrderAgg._count.id,
        lastUpdated: formatIso(purchaseOrderAgg._max.updatedAt),
        relativeUpdatedAt: formatRelative(purchaseOrderAgg._max.updatedAt),
        status: purchaseOrderAgg._count.id > 0 ? 'complete' : 'todo',
      },
      '3-sales-planning': {
        slug: '3-sales-planning',
        label: 'Sales Planning',
        description: '',
        recordCount: salesAgg._count.id,
        lastUpdated: formatIso(salesAgg._max.updatedAt),
        relativeUpdatedAt: formatRelative(salesAgg._max.updatedAt),
        status: salesAgg._count.id > 0 ? 'complete' : 'todo',
      },
      '4-fin-planning-pl': {
        slug: '4-fin-planning-pl',
        label: 'P&L',
        description: '',
        recordCount: profitAgg._count.id,
        lastUpdated: formatIso(profitUpdatedAt ?? profitAgg._max.updatedAt),
        relativeUpdatedAt: formatRelative(profitUpdatedAt ?? profitAgg._max.updatedAt),
        status: profitAgg._count.id > 0 ? 'complete' : 'todo',
      },
      '5-fin-planning-cash-flow': {
        slug: '5-fin-planning-cash-flow',
        label: 'Cash Flow',
        description: '',
        recordCount: cashAgg._count.id,
        lastUpdated: formatIso(cashUpdatedAt ?? cashAgg._max.updatedAt),
        relativeUpdatedAt: formatRelative(cashUpdatedAt ?? cashAgg._max.updatedAt),
        status: cashAgg._count.id > 0 ? 'complete' : 'todo',
      },
    }

    const items: WorkbookSheetStatus[] = SHEETS.map((sheet: SheetConfig) => sheetStatus[sheet.slug])
    const completedCount = items.filter((item) => item.status === 'complete').length

    return {
      completedCount,
      totalCount: items.length,
      sheets: items,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('[workbook] Falling back to empty workbook status during build.', message)

    const fallbackSheets: WorkbookSheetStatus[] = SHEETS.map((sheet) => ({
      slug: sheet.slug,
      label: sheet.label,
      description: sheet.description,
      recordCount: 0,
      status: 'todo',
    }))

    return {
      completedCount: 0,
      totalCount: fallbackSheets.length,
      sheets: fallbackSheets,
    }
  }
}
