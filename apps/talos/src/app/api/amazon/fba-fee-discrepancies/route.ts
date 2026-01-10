import { ApiResponses, withRole, z } from '@/lib/api'
import { getProductFees } from '@/lib/amazon/client'
import { getMarketplaceCurrencyCode, parseAmazonProductFees } from '@/lib/amazon/fees'
import { escapeRegex, sanitizeSearchQuery } from '@/lib/security/input-sanitization'
import { getCurrentTenantCode, getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@ecom-os/prisma-talos'

export const dynamic = 'force-dynamic'

const DEFAULT_LISTING_PRICE = 10
const FEE_TOLERANCE = 0.01

const checkSchema = z.object({
  skuId: z.string().uuid(),
  listingPrice: z.number().positive().optional(),
})

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
})

type AlertStatus =
  | 'UNKNOWN'
  | 'MATCH'
  | 'MISMATCH'
  | 'NO_ASIN'
  | 'MISSING_REFERENCE'
  | 'ERROR'

function parseDecimalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    try {
      const parsed = Number.parseFloat(String(value))
      return Number.isFinite(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

function toAlertStatus(value: string | null): AlertStatus | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase()
  switch (normalized) {
    case 'UNKNOWN':
    case 'MATCH':
    case 'MISMATCH':
    case 'NO_ASIN':
    case 'MISSING_REFERENCE':
    case 'ERROR':
      return normalized
    default:
      return null
  }
}

export const GET = withRole(['admin', 'staff'], async (request, _session) => {
  const prisma = await getTenantPrisma()
  const tenantCode = await getCurrentTenantCode()
  const currencyCode = getMarketplaceCurrencyCode(tenantCode)

  const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams))
  const search = query.search ? sanitizeSearchQuery(query.search) : null
  const statusFilter = toAlertStatus(query.status ?? null)

  const where: Prisma.SkuWhereInput = { isActive: true }
  if (search) {
    const escapedSearch = escapeRegex(search)
    where.OR = [
      { skuCode: { contains: escapedSearch, mode: 'insensitive' } },
      { description: { contains: escapedSearch, mode: 'insensitive' } },
      { asin: { contains: escapedSearch, mode: 'insensitive' } },
    ]
  }

  if (statusFilter) {
    where.amazonFbaFeeAlert = { is: { status: statusFilter } }
  }

  const skus = await prisma.sku.findMany({
    where,
    orderBy: { skuCode: 'asc' },
    select: {
      id: true,
      skuCode: true,
      description: true,
      asin: true,
      amazonCategory: true,
      amazonSizeTier: true,
      amazonReferralFeePercent: true,
      amazonFbaFulfillmentFee: true,
      batches: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          batchCode: true,
          amazonSizeTier: true,
          amazonFbaFulfillmentFee: true,
          amazonReferenceWeightKg: true,
          unitWeightKg: true,
        },
      },
      amazonFbaFeeAlert: {
        select: {
          status: true,
          message: true,
          checkedAt: true,
          currencyCode: true,
          listingPrice: true,
          referenceSizeTier: true,
          referenceFbaFulfillmentFee: true,
          amazonFbaFulfillmentFee: true,
        },
      },
    },
  })

  const resolvedSkus = skus.map(({ batches, ...sku }) => {
    const latestBatch = batches[0] ?? null
    return {
      ...sku,
      latestBatchCode: latestBatch?.batchCode ?? null,
      amazonSizeTier: latestBatch?.amazonSizeTier ?? sku.amazonSizeTier ?? null,
      amazonFbaFulfillmentFee:
        latestBatch?.amazonFbaFulfillmentFee ?? sku.amazonFbaFulfillmentFee ?? null,
      amazonReferenceWeightKg:
        latestBatch?.amazonReferenceWeightKg ?? latestBatch?.unitWeightKg ?? null,
    }
  })

  return ApiResponses.success({ currencyCode, skus: resolvedSkus })
})

export const POST = withRole(['admin', 'staff'], async (request, session) => {
  const prisma = await getTenantPrisma()
  const tenantCode = await getCurrentTenantCode()

  const body = checkSchema.parse(await request.json())
  const listingPrice = body.listingPrice ?? DEFAULT_LISTING_PRICE

  const sku = await prisma.sku.findUnique({
    where: { id: body.skuId },
    select: {
      id: true,
      skuCode: true,
      asin: true,
      amazonSizeTier: true,
      amazonFbaFulfillmentFee: true,
      batches: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          batchCode: true,
          amazonSizeTier: true,
          amazonFbaFulfillmentFee: true,
        },
      },
    },
  })

  if (!sku) return ApiResponses.notFound('SKU not found')

  const latestBatch = sku.batches[0] ?? null
  const referenceSizeTier = latestBatch?.amazonSizeTier ?? sku.amazonSizeTier ?? null
  const referenceFeeRaw = latestBatch?.amazonFbaFulfillmentFee ?? sku.amazonFbaFulfillmentFee
  const referenceFbaFulfillmentFee = parseDecimalNumber(referenceFeeRaw)

  const checkedAt = new Date()
  let status: AlertStatus = 'UNKNOWN'
  let message: string | null = null
  let amazonFbaFulfillmentFee: number | null = null
  let currencyCode: string | null = getMarketplaceCurrencyCode(tenantCode)

  if (!sku.asin) {
    status = 'NO_ASIN'
    message = 'ASIN missing on SKU'
  } else if (referenceFbaFulfillmentFee === null || !Number.isFinite(referenceFbaFulfillmentFee)) {
    status = 'MISSING_REFERENCE'
    message = 'Reference FBA fulfillment fee missing'
  } else {
    try {
      const feesResponse = await getProductFees(sku.asin, listingPrice, tenantCode)
      const parsed = parseAmazonProductFees(feesResponse)
      currencyCode = parsed.currencyCode ?? currencyCode
      amazonFbaFulfillmentFee = parsed.fbaFees

      if (amazonFbaFulfillmentFee === null || !Number.isFinite(amazonFbaFulfillmentFee)) {
        status = 'ERROR'
        message = 'Amazon did not return an FBA fee estimate'
      } else {
        const delta = amazonFbaFulfillmentFee - referenceFbaFulfillmentFee
        status = Math.abs(delta) <= FEE_TOLERANCE ? 'MATCH' : 'MISMATCH'
        message = `Amazon ${amazonFbaFulfillmentFee.toFixed(2)} vs Ref ${referenceFbaFulfillmentFee.toFixed(2)}`
      }
    } catch (error) {
      status = 'ERROR'
      message = error instanceof Error ? error.message : 'Amazon fee check failed'
    }
  }

  const alert = await prisma.amazonFbaFeeAlert.upsert({
    where: { skuId: sku.id },
    create: {
      skuId: sku.id,
      status,
      message,
      checkedAt,
      currencyCode,
      listingPrice,
      referenceSizeTier,
      referenceFbaFulfillmentFee,
      amazonFbaFulfillmentFee,
    },
    update: {
      status,
      message,
      checkedAt,
      currencyCode,
      listingPrice,
      referenceSizeTier,
      referenceFbaFulfillmentFee,
      amazonFbaFulfillmentFee,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'amazon.fbaFeeCheck',
      entity: 'sku',
      entityId: sku.id,
      newValue: {
        skuCode: sku.skuCode,
        status,
        listingPrice,
        currencyCode,
      },
    },
  })

  return ApiResponses.success(alert)
})
