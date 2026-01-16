import { ApiResponses, withRole, z } from '@/lib/api'
import { getMarketplaceCurrencyCode } from '@/lib/amazon/fees'
import { escapeRegex, sanitizeSearchQuery } from '@/lib/security/input-sanitization'
import { getCurrentTenantCode, getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@targon/prisma-talos'

export const dynamic = 'force-dynamic'

const listQuerySchema = z.object({
  search: z.string().optional(),
})

export const GET = withRole(['admin', 'staff'], async (request, _session) => {
  const prisma = await getTenantPrisma()
  const tenantCode = await getCurrentTenantCode()
  const currencyCode = getMarketplaceCurrencyCode(tenantCode)

  const query = listQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams))
  const search = query.search ? sanitizeSearchQuery(query.search) : null

  const where: Prisma.SkuWhereInput = { isActive: true }
  if (search) {
    const escapedSearch = escapeRegex(search)
    where.OR = [
      { skuCode: { contains: escapedSearch, mode: 'insensitive' } },
      { description: { contains: escapedSearch, mode: 'insensitive' } },
      { asin: { contains: escapedSearch, mode: 'insensitive' } },
    ]
  }

  const skus = await prisma.sku.findMany({
    where,
    orderBy: { skuCode: 'asc' },
    select: {
      id: true,
      skuCode: true,
      description: true,
      asin: true,
      fbaFulfillmentFee: true,
      amazonFbaFulfillmentFee: true,
      amazonListingPrice: true,
      amazonReferenceWeightKg: true,
      unitDimensionsCm: true,
      unitSide1Cm: true,
      unitSide2Cm: true,
      unitSide3Cm: true,
      itemDimensionsCm: true,
      itemSide1Cm: true,
      itemSide2Cm: true,
      itemSide3Cm: true,
      itemWeightKg: true,
      batches: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { batchCode: true },
      },
    },
  })

  const resolvedSkus = skus.map(({ batches, ...sku }) => ({
    ...sku,
    latestBatchCode: batches[0]?.batchCode ?? null,
  }))

  return ApiResponses.success({ currencyCode, skus: resolvedSkus })
})
