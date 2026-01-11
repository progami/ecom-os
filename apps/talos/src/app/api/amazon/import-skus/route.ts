import { ApiResponses, withRole, z } from '@/lib/api'
import { getCatalogItem, getListingsItems } from '@/lib/amazon/client'
import { SHIPMENT_PLANNING_CONFIG } from '@/lib/config/shipment-planning'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
import { formatDimensionTripletCm, resolveDimensionTripletCm } from '@/lib/sku-dimensions'
import { getCurrentTenantCode, getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@targon/prisma-talos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const requestSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
})

const DEFAULT_BATCH_CODE = 'BATCH 01'
const DEFAULT_PACK_SIZE = 1
const DEFAULT_UNITS_PER_CARTON = 1
const DEFAULT_CARTONS_PER_PALLET = SHIPMENT_PLANNING_CONFIG.DEFAULT_CARTONS_PER_PALLET

function parseCatalogDimensions(attributes: {
  item_dimensions?: Array<{
    length?: { value?: number }
    width?: { value?: number }
    height?: { value?: number }
  }>
}): { lengthCm: number; widthCm: number; heightCm: number } | null {
  const dims = attributes.item_dimensions?.[0]
  const length = dims?.length?.value
  const width = dims?.width?.value
  const height = dims?.height?.value
  if (!length || !width || !height) return null

  const lengthCm = Number((length * 2.54).toFixed(2))
  const widthCm = Number((width * 2.54).toFixed(2))
  const heightCm = Number((height * 2.54).toFixed(2))

  const triplet = resolveDimensionTripletCm({ lengthCm, widthCm, heightCm })
  return triplet
}

function parseCatalogWeightKg(attributes: { item_weight?: Array<{ value?: number }> }): number | null {
  const raw = attributes.item_weight?.[0]?.value
  if (!raw || !Number.isFinite(raw)) return null
  // Amazon returns weight in pounds for catalog items (convert to kg).
  return Number((raw * 0.453592).toFixed(3))
}

export const POST = withRole(['admin', 'staff'], async (request, _session) => {
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
  }

  const importLimit = parsed.data.limit ?? 50
  const tenantCode = await getCurrentTenantCode()
  const prisma = await getTenantPrisma()

  const listingResponse = await getListingsItems(tenantCode, { limit: 250 })
  const listings = listingResponse.items

  const candidateSkus = listings
    .map(item => item.sellerSku.trim())
    .filter(Boolean)
    .map(code => sanitizeForDisplay(code.toUpperCase()))
    .filter(Boolean)

  if (candidateSkus.length === 0) {
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

  for (const listing of listings) {
    if (imported >= importLimit) break

    const skuCode = sanitizeForDisplay(listing.sellerSku.trim().toUpperCase())
    if (!skuCode) continue

    if (existingSet.has(skuCode.toUpperCase())) {
      skipped += 1
      continue
    }

    const asin = listing.asin ? sanitizeForDisplay(listing.asin.trim().toUpperCase()) : null
    if (!asin) {
      skipped += 1
      errors.push(`Skipping ${skuCode}: ASIN missing on Amazon listing`)
      continue
    }

    let description = listing.title ? sanitizeForDisplay(listing.title.trim()) : ''
    let unitWeightKg: number | null = null
    let unitTriplet: { lengthCm: number; widthCm: number; heightCm: number } | null = null

    try {
      const catalog = await getCatalogItem(asin, tenantCode)
      const attributes = catalog?.item?.attributes
      if (attributes) {
        if (attributes.title?.[0]?.value) {
          description = sanitizeForDisplay(attributes.title[0].value) || description
        }
        unitWeightKg = parseCatalogWeightKg(attributes)
        unitTriplet = parseCatalogDimensions(attributes)
      }
    } catch (error) {
      errors.push(
        `Amazon catalog lookup failed for ${skuCode} (ASIN ${asin}): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }

    if (!description) description = skuCode

    if (!unitWeightKg) {
      skipped += 1
      errors.push(`Skipping ${skuCode}: Amazon did not provide a unit weight`)
      continue
    }

    try {
      await prisma.$transaction(async tx => {
        const createdSku = await tx.sku.create({
          data: {
            skuCode,
            asin,
            description,
            amazonCategory: null,
            amazonReferralFeePercent: null,
            packSize: DEFAULT_PACK_SIZE,
            defaultSupplierId: null,
            secondarySupplierId: null,
            material: null,
            unitDimensionsCm: unitTriplet ? formatDimensionTripletCm(unitTriplet) : null,
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
            unitDimensionsCm: unitTriplet ? formatDimensionTripletCm(unitTriplet) : null,
            unitLengthCm: unitTriplet ? unitTriplet.lengthCm : null,
            unitWidthCm: unitTriplet ? unitTriplet.widthCm : null,
            unitHeightCm: unitTriplet ? unitTriplet.heightCm : null,
            unitWeightKg,
            cartonDimensionsCm: null,
            cartonLengthCm: null,
            cartonWidthCm: null,
            cartonHeightCm: null,
            cartonWeightKg: null,
            packagingType: null,
            amazonSizeTier: null,
            amazonFbaFulfillmentFee: null,
            amazonReferenceWeightKg: unitWeightKg,
            storageCartonsPerPallet: DEFAULT_CARTONS_PER_PALLET,
            shippingCartonsPerPallet: DEFAULT_CARTONS_PER_PALLET,
            isActive: true,
          },
        })
      })

      imported += 1
      existingSet.add(skuCode.toUpperCase())
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        skipped += 1
        existingSet.add(skuCode.toUpperCase())
        continue
      }

      skipped += 1
      errors.push(
        `Failed to import ${skuCode}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  if (listingResponse.hasMore && imported < importLimit) {
    errors.push('More Amazon listings exist. Run import again to continue.')
  }

  return ApiResponses.success({
    result: {
      imported,
      skipped,
      errors,
    },
  })
})

