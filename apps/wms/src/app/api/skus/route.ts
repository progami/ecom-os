import { withAuth, withRole, ApiResponses, z } from '@/lib/api'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma, type Sku, type SkuBatch } from '@ecom-os/prisma-wms'
import {
  sanitizeForDisplay,
  sanitizeSearchQuery,
  escapeRegex,
} from '@/lib/security/input-sanitization'
import { formatDimensionTripletCm, resolveDimensionTripletCm } from '@/lib/sku-dimensions'
import { SHIPMENT_PLANNING_CONFIG } from '@/lib/config/shipment-planning'
export const dynamic = 'force-dynamic'

type SkuWithCounts = Sku & { batches: SkuBatch[]; _count: { inventoryTransactions: number } }

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
  packSize: z.number().int().positive().optional().nullable(),
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
  unitsPerCarton: z.number().int().positive().optional(),
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
    packSize: z.number().int().positive().default(1),
    unitsPerCarton: z.number().int().positive().default(1),
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

  const where: Prisma.SkuWhereInput = {}

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
    include: {
      batches: {
        orderBy: [{ createdAt: 'desc' }],
      },
    },
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
    const created = await tx.sku.create({
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
        isActive: true,
      },
    })

    await tx.skuBatch.create({
      data: {
        sku: { connect: { id: created.id } },
        batchCode: 'DEFAULT',
        packSize: created.packSize,
        unitsPerCarton: created.unitsPerCarton,
        material: created.material,
        unitDimensionsCm: created.unitDimensionsCm,
        unitLengthCm: created.unitLengthCm,
        unitWidthCm: created.unitWidthCm,
        unitHeightCm: created.unitHeightCm,
        unitWeightKg: created.unitWeightKg,
        cartonDimensionsCm: created.cartonDimensionsCm,
        cartonLengthCm: created.cartonLengthCm,
        cartonWidthCm: created.cartonWidthCm,
        cartonHeightCm: created.cartonHeightCm,
        cartonWeightKg: created.cartonWeightKg,
        packagingType: created.packagingType,
        isActive: true,
      },
    })

    const warehouses = await tx.warehouse.findMany({ select: { id: true } })
    if (warehouses.length > 0) {
      const defaultCartonsPerPallet = SHIPMENT_PLANNING_CONFIG.DEFAULT_CARTONS_PER_PALLET
      await tx.warehouseSkuStorageConfig.createMany({
        data: warehouses.map(warehouse => ({
          warehouseId: warehouse.id,
          skuId: created.id,
          storageCartonsPerPallet: defaultCartonsPerPallet,
          shippingCartonsPerPallet: defaultCartonsPerPallet,
        })),
        skipDuplicates: true,
      })
    }

    return created
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
    select: { id: true },
  })

  if (!existing) {
    return ApiResponses.notFound('SKU not found')
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
  const [transactionCount, storageLedgerCount] = await Promise.all([
    prisma.inventoryTransaction.count({
      where: { skuCode: sku.skuCode },
    }),
    prisma.storageLedger.count({
      where: { skuCode: sku.skuCode },
    }),
  ])

  if (transactionCount > 0 || storageLedgerCount > 0) {
    return ApiResponses.conflict(
      `Cannot delete SKU "${sku.skuCode}". References found: inventory transactions=${transactionCount}, storage ledger=${storageLedgerCount}.`
    )
  }

  await prisma.sku.delete({
    where: { id: skuId },
  })

  return ApiResponses.success<{ message: string }>({
    message: 'SKU deleted successfully',
  })
})
