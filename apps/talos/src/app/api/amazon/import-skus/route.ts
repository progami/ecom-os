import { ApiResponses, withRole, z } from '@/lib/api'
import {
  getCatalogItem,
  getCatalogListingTypesByAsin,
  getListingsItems,
  getProductFees,
  testCompareApis,
  type AmazonCatalogListingType,
} from '@/lib/amazon/client'
import { SHIPMENT_PLANNING_CONFIG } from '@/lib/config/shipment-planning'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
import { parseAmazonProductFees, calculateSizeTier } from '@/lib/amazon/fees'
import { formatDimensionTripletCm, resolveDimensionTripletCm } from '@/lib/sku-dimensions'
import { SKU_FIELD_LIMITS } from '@/lib/sku-constants'
import { getCurrentTenantCode, getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@targon/prisma-talos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const previewQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(250).optional(),
})

const requestSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
  skuCodes: z.array(z.string().trim().min(1).max(50)).max(100).optional(),
  mode: z.enum(['import', 'validate']).default('import'),
})

const DEFAULT_BATCH_CODE = 'BATCH 01'
const DEFAULT_PACK_SIZE = 1
const DEFAULT_UNITS_PER_CARTON = 1
const DEFAULT_CARTONS_PER_PALLET = SHIPMENT_PLANNING_CONFIG.DEFAULT_CARTONS_PER_PALLET
const DEFAULT_FEE_ESTIMATE_PRICE = 10

function normalizeSkuCode(value: string): string | null {
  const normalized = sanitizeForDisplay(value.trim().toUpperCase())
  if (!normalized) return null
  if (normalized.length > 50) return null
  return normalized
}

function normalizeAsin(value: string | null): string | null {
  if (!value) return null
  const normalized = sanitizeForDisplay(value.trim().toUpperCase())
  if (!normalized) return null
  if (normalized.length > 64) return null
  return normalized
}

function normalizeTitle(value: string | null): string | null {
  if (!value) return null
  const normalized = sanitizeForDisplay(value.trim())
  return normalized ? normalized : null
}

function parseCatalogDimensions(attributes: {
  item_package_dimensions?: Array<{
    length?: { value?: number; unit?: string }
    width?: { value?: number; unit?: string }
    height?: { value?: number; unit?: string }
  }>
  package_dimensions?: Array<{
    length?: { value?: number; unit?: string }
    width?: { value?: number; unit?: string }
    height?: { value?: number; unit?: string }
  }>
  item_dimensions?: Array<{
    length?: { value?: number; unit?: string }
    width?: { value?: number; unit?: string }
    height?: { value?: number; unit?: string }
  }>
}): { lengthCm: number; widthCm: number; heightCm: number } | null {
  const dims =
    attributes.item_package_dimensions?.[0] ??
    attributes.package_dimensions?.[0] ??
    attributes.item_dimensions?.[0] ??
    null
  if (!dims) return null
  const length = dims?.length?.value
  const width = dims?.width?.value
  const height = dims?.height?.value
  if (length === undefined || width === undefined || height === undefined) return null
  if (!Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(height)) return null

  const lengthUnit = dims?.length?.unit
  const widthUnit = dims?.width?.unit
  const heightUnit = dims?.height?.unit

  const lengthCm = convertMeasurementToCm(length, lengthUnit)
  const widthCm = convertMeasurementToCm(width, widthUnit)
  const heightCm = convertMeasurementToCm(height, heightUnit)
  if (lengthCm === null || widthCm === null || heightCm === null) return null

  const triplet = resolveDimensionTripletCm({ lengthCm, widthCm, heightCm })
  return triplet
}

function convertMeasurementToCm(value: number, unit: string | undefined): number | null {
  if (!Number.isFinite(value)) return null
  if (typeof unit !== 'string') return null
  const normalized = unit.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'inches' || normalized === 'inch' || normalized === 'in') {
    return Number((value * 2.54).toFixed(2))
  }
  if (normalized === 'centimeters' || normalized === 'centimetres' || normalized === 'cm') {
    return Number(value.toFixed(2))
  }
  if (normalized === 'millimeters' || normalized === 'millimetres' || normalized === 'mm') {
    return Number((value / 10).toFixed(2))
  }
  return null
}

function parseCatalogWeightKg(attributes: {
  item_package_weight?: Array<{ value?: number; unit?: string }>
  package_weight?: Array<{ value?: number; unit?: string }>
  item_weight?: Array<{ value?: number; unit?: string }>
}): number | null {
  const measurement =
    attributes.item_package_weight?.[0] ?? attributes.package_weight?.[0] ?? attributes.item_weight?.[0] ?? null
  if (!measurement) return null
  const raw = measurement?.value
  if (raw === undefined || raw === null) return null
  if (!Number.isFinite(raw)) return null

  const unit = measurement?.unit
  if (typeof unit !== 'string') return null
  const normalized = unit.trim().toLowerCase()
  if (!normalized) return null

  if (normalized === 'kilograms' || normalized === 'kilogram' || normalized === 'kg') {
    return Number(raw.toFixed(3))
  }

  if (normalized === 'pounds' || normalized === 'pound' || normalized === 'lb' || normalized === 'lbs') {
    return Number((raw * 0.453592).toFixed(3))
  }

  if (normalized === 'grams' || normalized === 'gram' || normalized === 'g') {
    return Number((raw / 1000).toFixed(3))
  }

  if (normalized === 'ounces' || normalized === 'ounce' || normalized === 'oz') {
    return Number((raw * 0.0283495).toFixed(3))
  }

  return null
}

function parseCatalogCategory(catalog: { summaries?: unknown }): string | null {
  const summaries = catalog.summaries
  if (Array.isArray(summaries) && summaries.length > 0) {
    const summary = summaries[0]
    if (summary && typeof summary === 'object') {
      const summaryRecord = summary as Record<string, unknown>
      const browse = summaryRecord.browseClassification
      if (browse && typeof browse === 'object') {
        const browseRecord = browse as Record<string, unknown>
        const display = browseRecord.displayName
        if (typeof display === 'string' && display.trim()) {
          const sanitized = sanitizeForDisplay(display.trim())
          return sanitized ? sanitized : null
        }
      }

      const displayGroup = summaryRecord.websiteDisplayGroupName
      if (typeof displayGroup === 'string' && displayGroup.trim()) {
        const sanitized = sanitizeForDisplay(displayGroup.trim())
        return sanitized ? sanitized : null
      }
    }
  }
  return null
}

function roundToTwoDecimals(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Number(value.toFixed(2))
}

export const GET = withRole(['admin', 'staff'], async (request, _session) => {
  // Test mode: compare FBA Inventory API vs Listings API
  if (request.nextUrl.searchParams.get('test') === 'compare-apis') {
    const tenantCode = await getCurrentTenantCode()
    const result = await testCompareApis(tenantCode)
    return ApiResponses.success({ testResult: result })
  }

  // Test mode: fetch fees for a specific ASIN
  const testAsin = request.nextUrl.searchParams.get('test-fees')
  if (testAsin) {
    try {
      const tenantCode = await getCurrentTenantCode()
      const fees = await getProductFees(testAsin, DEFAULT_FEE_ESTIMATE_PRICE, tenantCode)
      const parsedFees = parseAmazonProductFees(fees)
      return ApiResponses.success({ raw: fees, parsed: parsedFees })
    } catch (error) {
      return ApiResponses.success({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })
    }
  }

  const parsed = previewQuerySchema.safeParse({
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  })
  if (!parsed.success) {
    return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
  }

  const previewLimit = parsed.data.limit ?? 250
  const tenantCode = await getCurrentTenantCode()
  const prisma = await getTenantPrisma()

  const listingResponse = await getListingsItems(tenantCode, { limit: previewLimit })
  const listings = listingResponse.items

  const normalizedCodes = listings
    .map(item => normalizeSkuCode(item.sellerSku))
    .filter((code): code is string => Boolean(code))

  const existingSkus = normalizedCodes.length
    ? await prisma.sku.findMany({
        where: { skuCode: { in: normalizedCodes } },
        select: { skuCode: true },
      })
    : []

  const existingSet = new Set(existingSkus.map(sku => sku.skuCode.toUpperCase()))
  const duplicates = new Set<string>()
  const seen = new Set<string>()

  for (const code of normalizedCodes) {
    const key = code.toUpperCase()
    if (seen.has(key)) duplicates.add(key)
    else seen.add(key)
  }

  const rawItems = listings.map(listing => {
    const skuCode = normalizeSkuCode(listing.sellerSku)
    const asin = normalizeAsin(listing.asin)
    const title = normalizeTitle(listing.title)

    if (!skuCode) {
      return {
        sellerSku: listing.sellerSku,
        skuCode: null,
        asin,
        title,
        status: 'blocked' as const,
        reason: 'Invalid SKU code (empty or too long)',
        exists: false,
      }
    }

    if (duplicates.has(skuCode.toUpperCase())) {
      return {
        sellerSku: listing.sellerSku,
        skuCode,
        asin,
        title,
        status: 'blocked' as const,
        reason: 'Duplicate seller SKU after normalization',
        exists: false,
      }
    }

    if (existingSet.has(skuCode.toUpperCase())) {
      return {
        sellerSku: listing.sellerSku,
        skuCode,
        asin,
        title,
        status: 'existing' as const,
        reason: 'Already in Talos (will refresh Amazon data)',
        exists: true,
      }
    }

    if (!asin) {
      return {
        sellerSku: listing.sellerSku,
        skuCode,
        asin,
        title,
        status: 'blocked' as const,
        reason: 'Missing ASIN on Amazon listing',
        exists: false,
      }
    }

    return {
      sellerSku: listing.sellerSku,
      skuCode,
      asin,
      title,
      status: 'new' as const,
      reason: null as string | null,
      exists: false,
    }
  })

  const asinsForClassification: string[] = []
  const seenAsins = new Set<string>()

  for (const item of rawItems) {
    if (!item.asin) continue
    const key = item.asin.toUpperCase()
    if (seenAsins.has(key)) continue
    seenAsins.add(key)
    asinsForClassification.push(key)
  }

  const listingTypesByAsin = asinsForClassification.length
    ? await getCatalogListingTypesByAsin(asinsForClassification, tenantCode)
    : new Map<string, AmazonCatalogListingType>()

  const items = rawItems.map(item => {
    const asinKey = item.asin ? item.asin.toUpperCase() : null
    let listingType: AmazonCatalogListingType = 'UNKNOWN'
    if (asinKey) {
      const resolved = listingTypesByAsin.get(asinKey)
      if (resolved) listingType = resolved
    }

    if (item.status === 'new' && listingType === 'PARENT') {
      return {
        ...item,
        listingType,
        status: 'blocked' as const,
        reason: 'Variation parent ASIN (import child listings only)',
      }
    }

    return { ...item, listingType }
  })

  const summary = items.reduce(
    (acc, item) => {
      if (item.status === 'new') acc.newCount += 1
      if (item.status === 'existing') acc.existingCount += 1
      if (item.status === 'blocked') acc.blockedCount += 1
      return acc
    },
    { newCount: 0, existingCount: 0, blockedCount: 0 }
  )

  return ApiResponses.success({
    preview: {
      limit: previewLimit,
      totalListings: listings.length,
      hasMore: listingResponse.hasMore,
      summary,
      policy: {
        updatesExistingSkus: false,
        createsBatch: true,
        defaultBatchCode: DEFAULT_BATCH_CODE,
      },
      items,
    },
  })
})

export const POST = withRole(['admin', 'staff'], async (request, _session) => {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
  }

  const importLimit = parsed.data.limit ?? 50
  const mode = parsed.data.mode
  const tenantCode = await getCurrentTenantCode()
  const prisma = await getTenantPrisma()

  const listingResponse = await getListingsItems(tenantCode, { limit: 250 })
  const listings = listingResponse.items

  const listingBySkuCode = new Map<string, (typeof listings)[number]>()
  for (const listing of listings) {
    const skuCode = normalizeSkuCode(listing.sellerSku)
    if (!skuCode) continue
    const key = skuCode.toUpperCase()
    if (!listingBySkuCode.has(key)) {
      listingBySkuCode.set(key, listing)
    }
  }

  const candidateSkus = listings
    .map(item => item.sellerSku.trim())
    .filter(Boolean)
    .map(code => normalizeSkuCode(code) ?? '')
    .filter(Boolean)

  const selectedSkuCodes = parsed.data.skuCodes?.length
    ? parsed.data.skuCodes.map(code => normalizeSkuCode(code) ?? '').filter(Boolean)
    : null

  if (candidateSkus.length === 0 || (selectedSkuCodes && selectedSkuCodes.length === 0)) {
    return ApiResponses.success({
      result: {
        imported: 0,
        skipped: 0,
        errors: ['No Amazon listings found to import'],
      },
    })
  }

  const existingSkus = await prisma.sku.findMany({
    where: { skuCode: { in: candidateSkus } },
    select: { skuCode: true },
  })
  const existingSet = new Set(existingSkus.map(sku => sku.skuCode.toUpperCase()))

  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const details: Array<{
    skuCode: string
    status: 'imported' | 'skipped' | 'blocked'
    message?: string
    unitWeightKg?: number | null
    unitDimensionsCm?: string | null
    feeDebug?: {
      referralFeePercent: number | null
      fbaFee: number | null
      sizeTier: string | null
    }
  }> = []

  const targets: string[] = []
  if (selectedSkuCodes) {
    targets.push(...selectedSkuCodes)
  } else {
    for (const listing of listings) {
      if (targets.length >= importLimit) break
      const skuCode = normalizeSkuCode(listing.sellerSku)
      if (!skuCode) continue
      if (existingSet.has(skuCode.toUpperCase())) continue
      targets.push(skuCode)
    }
  }

  if (targets.length === 0) {
    return ApiResponses.success({
      result: {
        imported: 0,
        skipped: 0,
        errors: ['No new SKUs found to import'],
      },
    })
  }

  const targetAsins: string[] = []
  const targetAsinSeen = new Set<string>()

  for (const target of targets) {
    const skuCode = normalizeSkuCode(target)
    if (!skuCode) continue
    const listing = listingBySkuCode.get(skuCode.toUpperCase())
    if (!listing) continue
    const asin = normalizeAsin(listing.asin)
    if (!asin) continue
    const key = asin.toUpperCase()
    if (targetAsinSeen.has(key)) continue
    targetAsinSeen.add(key)
    targetAsins.push(key)
  }

  const listingTypesByAsin = targetAsins.length
    ? await getCatalogListingTypesByAsin(targetAsins, tenantCode)
    : new Map<string, AmazonCatalogListingType>()

  for (const targetSkuCode of targets) {
    if (mode === 'import' && imported >= importLimit) break

    const skuCode = normalizeSkuCode(targetSkuCode)
    if (!skuCode) continue

    const listing = listingBySkuCode.get(skuCode.toUpperCase())
    if (!listing) {
      skipped += 1
      details.push({
        skuCode,
        status: 'blocked',
        message: 'SKU not found in current Amazon listings preview',
      })
      continue
    }

    const isExistingSku = existingSet.has(skuCode.toUpperCase())

    const asin = normalizeAsin(listing.asin)
    if (!asin) {
      skipped += 1
      errors.push(`Skipping ${skuCode}: ASIN missing on Amazon listing`)
      details.push({
        skuCode,
        status: 'blocked',
        message: 'Missing ASIN on Amazon listing',
      })
      continue
    }

    let listingType: AmazonCatalogListingType = 'UNKNOWN'
    const resolvedListingType = listingTypesByAsin.get(asin.toUpperCase())
    if (resolvedListingType) listingType = resolvedListingType
    if (listingType === 'PARENT') {
      skipped += 1
      details.push({
        skuCode,
        status: 'blocked',
        message: 'Variation parent ASIN (import child listings only)',
      })
      continue
    }

    let description = listing.title ? sanitizeForDisplay(listing.title.trim()) : ''
    let unitWeightKg: number | null = null
    let unitTriplet: { lengthCm: number; widthCm: number; heightCm: number } | null = null
    let amazonCategory: string | null = null
    let amazonReferralFeePercent: number | null = null
    let amazonFbaFulfillmentFee: number | null = null
    let amazonSizeTier: string | null = null

    try {
      const catalog = await getCatalogItem(asin, tenantCode)
      const attributes = catalog.attributes
      if (attributes) {
        const title = attributes.item_name?.[0]?.value
        if (title) {
          const sanitizedTitle = sanitizeForDisplay(title)
          if (sanitizedTitle) {
            description = sanitizedTitle
          }
        }
        unitWeightKg = parseCatalogWeightKg(attributes)
        unitTriplet = parseCatalogDimensions(attributes)
      }
      amazonCategory = parseCatalogCategory(catalog)
    } catch (error) {
      errors.push(
        `Amazon catalog lookup failed for ${skuCode} (ASIN ${asin}): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }

    try {
      const fees = await getProductFees(asin, DEFAULT_FEE_ESTIMATE_PRICE, tenantCode)
      const parsedFees = parseAmazonProductFees(fees)
      // Calculate referral fee percent from amount if available
      if (parsedFees.referralFee !== null && Number.isFinite(parsedFees.referralFee)) {
        amazonReferralFeePercent = roundToTwoDecimals((parsedFees.referralFee / DEFAULT_FEE_ESTIMATE_PRICE) * 100)
      }
      amazonFbaFulfillmentFee = roundToTwoDecimals(parsedFees.fbaFees ?? Number.NaN)
      const calculatedSizeTier = calculateSizeTier(
        unitTriplet?.lengthCm ?? null,
        unitTriplet?.widthCm ?? null,
        unitTriplet?.heightCm ?? null,
        unitWeightKg
      )
      if (calculatedSizeTier) {
        amazonSizeTier = calculatedSizeTier
      } else if (parsedFees.sizeTier) {
        amazonSizeTier = parsedFees.sizeTier
      } else {
        amazonSizeTier = null
      }
    } catch (error) {
      errors.push(
        `Amazon fee estimate failed for ${skuCode} (ASIN ${asin}): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }

    if (!description) description = skuCode
    if (description.length > SKU_FIELD_LIMITS.DESCRIPTION_MAX) {
      description = description.substring(0, SKU_FIELD_LIMITS.DESCRIPTION_MAX)
    }

    const unitDimensionsCm = unitTriplet ? formatDimensionTripletCm(unitTriplet) : null

    if (mode === 'validate') {
      imported += 1
      details.push({
        skuCode,
        status: 'imported',
        message: isExistingSku ? 'Will refresh Amazon data' : undefined,
        unitWeightKg,
        unitDimensionsCm,
      })
      continue
    }

    try {
      if (isExistingSku) {
        // Update existing SKU with fresh Amazon data (only Amazon-sourced fields)
        await prisma.sku.update({
          where: { skuCode },
          data: {
            description,
            amazonCategory,
            amazonSizeTier,
            amazonReferralFeePercent,
            amazonFbaFulfillmentFee,
            amazonReferenceWeightKg: unitWeightKg,
            unitDimensionsCm,
            unitLengthCm: unitTriplet ? unitTriplet.lengthCm : null,
            unitWidthCm: unitTriplet ? unitTriplet.widthCm : null,
            unitHeightCm: unitTriplet ? unitTriplet.heightCm : null,
            unitWeightKg,
          },
        })

        imported += 1
        details.push({
          skuCode,
          status: 'imported',
          message: 'Refreshed Amazon data',
          unitWeightKg,
          unitDimensionsCm,
          feeDebug: {
            referralFeePercent: amazonReferralFeePercent,
            fbaFee: amazonFbaFulfillmentFee,
            sizeTier: amazonSizeTier,
          },
        })
      } else {
        // Create new SKU
        await prisma.$transaction(async tx => {
          const createdSku = await tx.sku.create({
            data: {
              skuCode,
              asin,
              description,
              amazonCategory,
              amazonSizeTier,
              amazonReferralFeePercent,
              amazonFbaFulfillmentFee,
              amazonReferenceWeightKg: unitWeightKg,
              packSize: DEFAULT_PACK_SIZE,
              defaultSupplierId: null,
              secondarySupplierId: null,
              material: null,
              unitDimensionsCm,
              unitLengthCm: unitTriplet ? unitTriplet.lengthCm : null,
              unitWidthCm: unitTriplet ? unitTriplet.widthCm : null,
              unitHeightCm: unitTriplet ? unitTriplet.heightCm : null,
              unitWeightKg,
              unitsPerCarton: DEFAULT_UNITS_PER_CARTON,
              cartonDimensionsCm: null,
              cartonLengthCm: null,
              cartonWidthCm: null,
              cartonHeightCm: null,
              cartonWeightKg: null,
              packagingType: null,
              isActive: true,
            },
          })

          await tx.skuBatch.create({
            data: {
              skuId: createdSku.id,
              batchCode: DEFAULT_BATCH_CODE,
              description: null,
              productionDate: null,
              expiryDate: null,
              packSize: DEFAULT_PACK_SIZE,
              unitsPerCarton: DEFAULT_UNITS_PER_CARTON,
              material: null,
              // Note: Batch unit dimensions are for packaging, not product dimensions
              // Amazon catalog gives product dimensions, not packaging - leave null
              unitDimensionsCm: null,
              unitLengthCm: null,
              unitWidthCm: null,
              unitHeightCm: null,
              unitWeightKg: null,
              cartonDimensionsCm: null,
              cartonLengthCm: null,
              cartonWidthCm: null,
              cartonHeightCm: null,
              cartonWeightKg: null,
              packagingType: null,
              amazonSizeTier: null,
              amazonFbaFulfillmentFee: null,
              amazonReferenceWeightKg: null,
              storageCartonsPerPallet: DEFAULT_CARTONS_PER_PALLET,
              shippingCartonsPerPallet: DEFAULT_CARTONS_PER_PALLET,
              isActive: true,
            },
          })
        })

        imported += 1
        existingSet.add(skuCode.toUpperCase())
        details.push({
          skuCode,
          status: 'imported',
          unitWeightKg,
          unitDimensionsCm,
          feeDebug: {
            referralFeePercent: amazonReferralFeePercent,
            fbaFee: amazonFbaFulfillmentFee,
            sizeTier: amazonSizeTier,
          },
        })
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        skipped += 1
        existingSet.add(skuCode.toUpperCase())
        details.push({
          skuCode,
          status: 'skipped',
          message: 'Already exists in Talos (not updated)',
          unitWeightKg,
          unitDimensionsCm,
        })
        continue
      }

      skipped += 1
      errors.push(
        `Failed to import ${skuCode}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      details.push({
        skuCode,
        status: 'blocked',
        message: error instanceof Error ? error.message : 'Unknown error',
        unitWeightKg,
        unitDimensionsCm,
      })
    }
  }

  if (listingResponse.hasMore && imported < importLimit && !selectedSkuCodes) {
    errors.push('More Amazon listings exist. Run import again to continue.')
  }

  return ApiResponses.success({
    result: {
      imported,
      skipped,
      errors,
      details,
    },
  })
})
