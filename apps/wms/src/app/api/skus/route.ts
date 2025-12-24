import { withAuth, withRole, ApiResponses, z } from '@/lib/api'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma, type Sku } from '@ecom-os/prisma-wms'
import {
  sanitizeForDisplay,
  sanitizeSearchQuery,
  escapeRegex,
} from '@/lib/security/input-sanitization'
import { formatDimensionTripletCm, resolveDimensionTripletCm } from '@/lib/sku-dimensions'
export const dynamic = 'force-dynamic'

type SkuWithCounts = Sku & { _count: { inventoryTransactions: number } }
type DeleteSkuResponse = { message: string } | { message: string; sku: Sku }

// Validation schemas with sanitization
const supplierIdSchema = z.preprocess(value => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return value
}, z.string().uuid().nullable().optional())

const optionalDimensionValueSchema = z.number().positive().nullable().optional()

const skuSchemaBase = z.object({
  skuCode: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .transform(val => sanitizeForDisplay(val)),
  asin: z
    .string()
    .trim()
    .max(64)
    .optional()
    .nullable()
    .transform(val => {
      if (val === undefined) return undefined
      if (val === null) return null
      const sanitized = sanitizeForDisplay(val)
      return sanitized ? sanitized : null
    }),
  description: z
    .string()
    .trim()
    .min(1)
    .transform(val => sanitizeForDisplay(val)),
  packSize: z.number().int().positive(),
  defaultSupplierId: supplierIdSchema,
  secondarySupplierId: supplierIdSchema,
  material: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform(val => {
      if (val === undefined) return undefined
      if (val === null) return null
      const sanitized = sanitizeForDisplay(val)
      return sanitized ? sanitized : null
    }),
  unitDimensionsCm: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform(val => {
      if (val === undefined) return undefined
      if (val === null) return null
      const sanitized = sanitizeForDisplay(val)
      return sanitized ? sanitized : null
    }),
  unitLengthCm: optionalDimensionValueSchema,
  unitWidthCm: optionalDimensionValueSchema,
  unitHeightCm: optionalDimensionValueSchema,
  unitWeightKg: z.number().positive().optional().nullable(),
  unitsPerCarton: z.number().int().positive(),
  cartonDimensionsCm: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform(val => {
      if (val === undefined) return undefined
      if (val === null) return null
      const sanitized = sanitizeForDisplay(val)
      return sanitized ? sanitized : null
    }),
  cartonLengthCm: optionalDimensionValueSchema,
  cartonWidthCm: optionalDimensionValueSchema,
  cartonHeightCm: optionalDimensionValueSchema,
  cartonWeightKg: z.number().positive().optional().nullable(),
  packagingType: z
    .string()
    .trim()
    .max(80)
    .optional()
    .nullable()
    .transform(val => {
      if (val === undefined) return undefined
      if (val === null) return null
      const sanitized = sanitizeForDisplay(val)
      return sanitized ? sanitized : null
    }),
  isActive: z.boolean().optional(),
})

type DimensionRefineShape = {
  unitLengthCm: z.ZodTypeAny
  unitWidthCm: z.ZodTypeAny
  unitHeightCm: z.ZodTypeAny
  cartonLengthCm: z.ZodTypeAny
  cartonWidthCm: z.ZodTypeAny
  cartonHeightCm: z.ZodTypeAny
}

const refineDimensions = <T extends z.ZodRawShape & DimensionRefineShape>(schema: z.ZodObject<T>) =>
  schema.superRefine((value, ctx) => {
    const unitValues = [value.unitLengthCm, value.unitWidthCm, value.unitHeightCm]
    const unitAny = unitValues.some(part => part !== undefined && part !== null)
    const unitAll = unitValues.every(part => part !== undefined && part !== null)
    if (unitAny && !unitAll) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Unit dimensions require length, width, and height',
      })
    }

    const cartonValues = [value.cartonLengthCm, value.cartonWidthCm, value.cartonHeightCm]
    const cartonAny = cartonValues.some(part => part !== undefined && part !== null)
    const cartonAll = cartonValues.every(part => part !== undefined && part !== null)
    if (cartonAny && !cartonAll) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Carton dimensions require length, width, and height',
      })
    }
  })

const createSkuSchema = refineDimensions(
  skuSchemaBase.extend({
    isActive: z.boolean().default(true),
    initialBatchCodes: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(80)
          .transform(val => sanitizeForDisplay(val))
      )
      .min(1),
  })
)

const updateSkuSchema = refineDimensions(skuSchemaBase.partial())

// GET /api/skus - List SKUs
export const GET = withAuth(async (request, _session) => {
  const prisma = await getTenantPrisma()
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')
    ? sanitizeSearchQuery(searchParams.get('search')!)
    : null
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const where: Prisma.SkuWhereInput = {}

  if (!includeInactive) {
    where.isActive = true
  }

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
  })

  // Get transaction counts for all SKUs in a single query
  const transactionCounts = await prisma.inventoryTransaction.groupBy({
    by: ['skuCode'],
    _count: {
      id: true,
    },
    where: {
      skuCode: {
        in: skus.map(sku => sku.skuCode),
      },
    },
  })

  const countMap = new Map(transactionCounts.map(tc => [tc.skuCode, tc._count.id]))

  const skusWithCounts: SkuWithCounts[] = skus.map(sku => ({
    ...sku,
    _count: {
      inventoryTransactions: countMap.get(sku.skuCode) || 0,
    },
  }))

  return ApiResponses.success(skusWithCounts)
})

// POST /api/skus - Create new SKU
export const POST = withRole(['admin', 'staff'], async (request, _session) => {
  const prisma = await getTenantPrisma()
  const body = await request.json()
  const validatedData = createSkuSchema.parse(body)

  if (
    validatedData.defaultSupplierId &&
    validatedData.secondarySupplierId &&
    validatedData.defaultSupplierId === validatedData.secondarySupplierId
  ) {
    return ApiResponses.badRequest('Default and secondary supplier must be different')
  }

  const supplierIds = [
    validatedData.defaultSupplierId ?? undefined,
    validatedData.secondarySupplierId ?? undefined,
  ].filter((id): id is string => Boolean(id))

  if (supplierIds.length > 0) {
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true },
    })

    const foundIds = new Set(suppliers.map(s => s.id))
    const missing = supplierIds.filter(id => !foundIds.has(id))
    if (missing.length > 0) {
      return ApiResponses.badRequest('Supplier not found')
    }
  }

  // Check if SKU code already exists
  const existingSku = await prisma.sku.findUnique({
    where: { skuCode: validatedData.skuCode },
  })

  if (existingSku) {
    return ApiResponses.badRequest('SKU code already exists')
  }

  const normalizedBatchCodes = validatedData.initialBatchCodes
    .map(code => code.trim())
    .filter(Boolean)

  const batchCodeSet = new Set<string>()
  for (const code of normalizedBatchCodes) {
    const key = code.toLowerCase()
    if (batchCodeSet.has(key)) {
      return ApiResponses.badRequest('Initial batch codes must be unique')
    }
    batchCodeSet.add(key)
  }

  const unitTriplet = resolveDimensionTripletCm({
    lengthCm: validatedData.unitLengthCm,
    widthCm: validatedData.unitWidthCm,
    heightCm: validatedData.unitHeightCm,
    legacy: validatedData.unitDimensionsCm,
  })
  const cartonTriplet = resolveDimensionTripletCm({
    lengthCm: validatedData.cartonLengthCm,
    widthCm: validatedData.cartonWidthCm,
    heightCm: validatedData.cartonHeightCm,
    legacy: validatedData.cartonDimensionsCm,
  })

  const unitInputProvided =
    validatedData.unitDimensionsCm ||
    validatedData.unitLengthCm ||
    validatedData.unitWidthCm ||
    validatedData.unitHeightCm
  const cartonInputProvided =
    validatedData.cartonDimensionsCm ||
    validatedData.cartonLengthCm ||
    validatedData.cartonWidthCm ||
    validatedData.cartonHeightCm

  if (unitInputProvided && !unitTriplet) {
    return ApiResponses.badRequest('Unit dimensions must be a valid LxWxH triple')
  }
  if (cartonInputProvided && !cartonTriplet) {
    return ApiResponses.badRequest('Carton dimensions must be a valid LxWxH triple')
  }

  const sku = await prisma.$transaction(async tx => {
    const record = await tx.sku.create({
      data: {
        skuCode: validatedData.skuCode,
        asin: validatedData.asin ?? null,
        description: validatedData.description,
        packSize: validatedData.packSize,
        defaultSupplierId: validatedData.defaultSupplierId ?? null,
        secondarySupplierId: validatedData.secondarySupplierId ?? null,
        material: validatedData.material ?? null,
        unitDimensionsCm: unitTriplet ? formatDimensionTripletCm(unitTriplet) : null,
        unitLengthCm: unitTriplet ? unitTriplet.lengthCm : null,
        unitWidthCm: unitTriplet ? unitTriplet.widthCm : null,
        unitHeightCm: unitTriplet ? unitTriplet.heightCm : null,
        unitWeightKg: validatedData.unitWeightKg ?? null,
        unitsPerCarton: validatedData.unitsPerCarton,
        cartonDimensionsCm: cartonTriplet ? formatDimensionTripletCm(cartonTriplet) : null,
        cartonLengthCm: cartonTriplet ? cartonTriplet.lengthCm : null,
        cartonWidthCm: cartonTriplet ? cartonTriplet.widthCm : null,
        cartonHeightCm: cartonTriplet ? cartonTriplet.heightCm : null,
        cartonWeightKg: validatedData.cartonWeightKg ?? null,
        packagingType: validatedData.packagingType ?? null,
        isActive: validatedData.isActive,
      },
    })

    await tx.skuBatch.createMany({
      data: normalizedBatchCodes.map(batchCode => ({
        skuId: record.id,
        batchCode,
        isActive: true,
      })),
    })

    return record
  })

  return ApiResponses.created<Sku>(sku)
})

// PATCH /api/skus - Update SKU
export const PATCH = withRole(['admin', 'staff'], async (request, _session) => {
  const prisma = await getTenantPrisma()
  const searchParams = request.nextUrl.searchParams
  const skuId = searchParams.get('id')

  if (!skuId) {
    return ApiResponses.badRequest('SKU ID is required')
  }

  const body = await request.json()
  const validatedData = updateSkuSchema.parse(body)

  if (
    validatedData.defaultSupplierId &&
    validatedData.secondarySupplierId &&
    validatedData.defaultSupplierId === validatedData.secondarySupplierId
  ) {
    return ApiResponses.badRequest('Default and secondary supplier must be different')
  }

  const supplierIds = [
    validatedData.defaultSupplierId ?? undefined,
    validatedData.secondarySupplierId ?? undefined,
  ].filter((id): id is string => Boolean(id))

  if (supplierIds.length > 0) {
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true },
    })

    const foundIds = new Set(suppliers.map(s => s.id))
    const missing = supplierIds.filter(id => !foundIds.has(id))
    if (missing.length > 0) {
      return ApiResponses.badRequest('Supplier not found')
    }
  }

  // If updating code, check if it's already in use
  if (validatedData.skuCode) {
    const existingSku = await prisma.sku.findFirst({
      where: {
        skuCode: validatedData.skuCode,
        id: { not: skuId },
      },
    })

    if (existingSku) {
      return ApiResponses.badRequest('SKU code already in use')
    }
  }

  const existing = await prisma.sku.findUnique({
    where: { id: skuId },
    select: { id: true, isActive: true },
  })

  if (!existing) {
    return ApiResponses.notFound('SKU not found')
  }

  if (validatedData.isActive === true && existing.isActive === false) {
    const activeBatchCount = await prisma.skuBatch.count({
      where: { skuId, isActive: true },
    })
    if (activeBatchCount === 0) {
      return ApiResponses.badRequest('Cannot activate SKU without at least one active batch')
    }
  }

  const {
    unitDimensionsCm,
    unitLengthCm,
    unitWidthCm,
    unitHeightCm,
    cartonDimensionsCm,
    cartonLengthCm,
    cartonWidthCm,
    cartonHeightCm,
    ...rest
  } = validatedData

  const updateData: Prisma.SkuUpdateInput = rest

  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(validatedData, key)

  const unitTouched =
    hasOwn('unitDimensionsCm') ||
    hasOwn('unitLengthCm') ||
    hasOwn('unitWidthCm') ||
    hasOwn('unitHeightCm')
  if (unitTouched) {
    const unitTriplet = resolveDimensionTripletCm({
      lengthCm: unitLengthCm,
      widthCm: unitWidthCm,
      heightCm: unitHeightCm,
      legacy: unitDimensionsCm,
    })
    const unitInputProvided =
      Boolean(unitDimensionsCm) ||
      [unitLengthCm, unitWidthCm, unitHeightCm].some(value => value !== undefined && value !== null)
    if (unitInputProvided && !unitTriplet) {
      return ApiResponses.badRequest('Unit dimensions must be a valid LxWxH triple')
    }

    updateData.unitDimensionsCm = unitTriplet ? formatDimensionTripletCm(unitTriplet) : null
    updateData.unitLengthCm = unitTriplet ? unitTriplet.lengthCm : null
    updateData.unitWidthCm = unitTriplet ? unitTriplet.widthCm : null
    updateData.unitHeightCm = unitTriplet ? unitTriplet.heightCm : null
  }

  const cartonTouched =
    hasOwn('cartonDimensionsCm') ||
    hasOwn('cartonLengthCm') ||
    hasOwn('cartonWidthCm') ||
    hasOwn('cartonHeightCm')
  if (cartonTouched) {
    const cartonTriplet = resolveDimensionTripletCm({
      lengthCm: cartonLengthCm,
      widthCm: cartonWidthCm,
      heightCm: cartonHeightCm,
      legacy: cartonDimensionsCm,
    })
    const cartonInputProvided =
      Boolean(cartonDimensionsCm) ||
      [cartonLengthCm, cartonWidthCm, cartonHeightCm].some(
        value => value !== undefined && value !== null
      )
    if (cartonInputProvided && !cartonTriplet) {
      return ApiResponses.badRequest('Carton dimensions must be a valid LxWxH triple')
    }

    updateData.cartonDimensionsCm = cartonTriplet ? formatDimensionTripletCm(cartonTriplet) : null
    updateData.cartonLengthCm = cartonTriplet ? cartonTriplet.lengthCm : null
    updateData.cartonWidthCm = cartonTriplet ? cartonTriplet.widthCm : null
    updateData.cartonHeightCm = cartonTriplet ? cartonTriplet.heightCm : null
  }

  const updatedSku = await prisma.sku.update({
    where: { id: skuId },
    data: updateData,
  })

  return ApiResponses.success<Sku>(updatedSku)
})

// DELETE /api/skus - Delete SKU
export const DELETE = withRole(['admin'], async (request, _session) => {
  const prisma = await getTenantPrisma()
  const searchParams = request.nextUrl.searchParams
  const skuId = searchParams.get('id')

  if (!skuId) {
    return ApiResponses.badRequest('SKU ID is required')
  }

  // Check if SKU exists
  const sku = await prisma.sku.findUnique({
    where: { id: skuId },
  })

  if (!sku) {
    return ApiResponses.notFound('SKU not found')
  }

  // Check if SKU is used in any transactions
  const transactionCount = await prisma.inventoryTransaction.count({
    where: { skuCode: sku.skuCode },
  })

  if (transactionCount > 0) {
    // Soft delete - just mark as inactive
    const updatedSku = await prisma.sku.update({
      where: { id: skuId },
      data: { isActive: false },
    })

    return ApiResponses.success<DeleteSkuResponse>({
      message: 'SKU deactivated (has related transactions)',
      sku: updatedSku,
    })
  } else {
    // Hard delete - no related data
    await prisma.sku.delete({
      where: { id: skuId },
    })

    return ApiResponses.success<DeleteSkuResponse>({
      message: 'SKU deleted successfully',
    })
  }
})
