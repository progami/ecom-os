import { withAuthAndParams, ApiResponses, requireRole, z } from '@/lib/api'
import { getTenantPrisma } from '@/lib/tenant/server'
import { Prisma } from '@ecom-os/prisma-wms'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
import { formatDimensionTripletCm, resolveDimensionTripletCm } from '@/lib/sku-dimensions'

const optionalDimensionValueSchema = z.number().positive().nullable().optional()

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

const createBatchSchema = refineDimensions(
  z.object({
    batchCode: z.string().trim().min(1).max(64),
    description: z.string().trim().max(200).optional().nullable(),
    productionDate: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    packSize: z.number().int().positive(),
    unitsPerCarton: z.number().int().positive(),
    material: z.string().trim().max(120).optional().nullable(),
    packagingType: z.string().trim().max(80).optional().nullable(),
    unitDimensionsCm: z.string().trim().max(120).optional().nullable(),
    unitLengthCm: optionalDimensionValueSchema,
    unitWidthCm: optionalDimensionValueSchema,
    unitHeightCm: optionalDimensionValueSchema,
    unitWeightKg: z.number().positive().optional().nullable(),
    cartonDimensionsCm: z.string().trim().max(120).optional().nullable(),
    cartonLengthCm: optionalDimensionValueSchema,
    cartonWidthCm: optionalDimensionValueSchema,
    cartonHeightCm: optionalDimensionValueSchema,
    cartonWeightKg: z.number().positive().optional().nullable(),
  })
)

export const GET = withAuthAndParams(async (_request, params, session) => {
  if (!requireRole(session, ['admin', 'staff'])) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const prisma = await getTenantPrisma()
  const skuId = params.id as string

  const sku = await prisma.sku.findUnique({
    where: { id: skuId },
    select: {
      id: true,
      skuCode: true,
      packSize: true,
      unitsPerCarton: true,
      material: true,
      unitDimensionsCm: true,
      unitLengthCm: true,
      unitWidthCm: true,
      unitHeightCm: true,
      unitWeightKg: true,
      cartonDimensionsCm: true,
      cartonLengthCm: true,
      cartonWidthCm: true,
      cartonHeightCm: true,
      cartonWeightKg: true,
      packagingType: true,
    },
  })

  if (!sku) {
    return ApiResponses.notFound('SKU not found')
  }

  await prisma.skuBatch.upsert({
    where: {
      skuId_batchCode: {
        skuId,
        batchCode: 'DEFAULT',
      },
    },
    create: {
      sku: { connect: { id: skuId } },
      batchCode: 'DEFAULT',
      packSize: sku.packSize,
      unitsPerCarton: sku.unitsPerCarton,
      material: sku.material,
      unitDimensionsCm: sku.unitDimensionsCm,
      unitLengthCm: sku.unitLengthCm,
      unitWidthCm: sku.unitWidthCm,
      unitHeightCm: sku.unitHeightCm,
      unitWeightKg: sku.unitWeightKg,
      cartonDimensionsCm: sku.cartonDimensionsCm,
      cartonLengthCm: sku.cartonLengthCm,
      cartonWidthCm: sku.cartonWidthCm,
      cartonHeightCm: sku.cartonHeightCm,
      cartonWeightKg: sku.cartonWeightKg,
      packagingType: sku.packagingType,
      isActive: true,
    },
    update: {
      isActive: true,
    },
  })

  const batches = await prisma.skuBatch.findMany({
    where: { skuId },
    orderBy: { createdAt: 'desc' },
  })

  return ApiResponses.success({ batches })
})

export const POST = withAuthAndParams(async (request, params, session) => {
  if (!requireRole(session, ['admin', 'staff'])) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const prisma = await getTenantPrisma()
  const skuId = params.id as string
  const body = await request.json().catch(() => null)

  if (!body) {
    return ApiResponses.badRequest('Invalid JSON payload')
  }

  const parsed = createBatchSchema.safeParse(body)
  if (!parsed.success) {
    return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
  }

  const sku = await prisma.sku.findUnique({
    where: { id: skuId },
    select: { id: true },
  })

  if (!sku) {
    return ApiResponses.notFound('SKU not found')
  }

  const payload = parsed.data

  const normalizedCode = sanitizeForDisplay(payload.batchCode.toUpperCase())
  const existingDefault = await prisma.skuBatch.findFirst({
    where: {
      skuId,
      batchCode: { equals: 'DEFAULT', mode: 'insensitive' },
    },
    select: { id: true },
  })

  if (!existingDefault && normalizedCode !== 'DEFAULT') {
    return ApiResponses.badRequest('DEFAULT batch must be created before adding other batches')
  }

  if (existingDefault && normalizedCode === 'DEFAULT') {
    return ApiResponses.badRequest('DEFAULT batch already exists for this SKU')
  }
  const productionDate = payload.productionDate ? new Date(payload.productionDate) : null
  const expiryDate = payload.expiryDate ? new Date(payload.expiryDate) : null

  if (productionDate && Number.isNaN(productionDate.getTime())) {
    return ApiResponses.validationError({ productionDate: 'Invalid production date' })
  }

  if (expiryDate && Number.isNaN(expiryDate.getTime())) {
    return ApiResponses.validationError({ expiryDate: 'Invalid expiry date' })
  }

  const unitTriplet = resolveDimensionTripletCm({
    lengthCm: payload.unitLengthCm,
    widthCm: payload.unitWidthCm,
    heightCm: payload.unitHeightCm,
    legacy: payload.unitDimensionsCm,
  })
  const cartonTriplet = resolveDimensionTripletCm({
    lengthCm: payload.cartonLengthCm,
    widthCm: payload.cartonWidthCm,
    heightCm: payload.cartonHeightCm,
    legacy: payload.cartonDimensionsCm,
  })

  const unitInputProvided =
    payload.unitDimensionsCm || payload.unitLengthCm || payload.unitWidthCm || payload.unitHeightCm
  const cartonInputProvided =
    payload.cartonDimensionsCm ||
    payload.cartonLengthCm ||
    payload.cartonWidthCm ||
    payload.cartonHeightCm

  if (unitInputProvided && !unitTriplet) {
    return ApiResponses.badRequest('Unit dimensions must be a valid LxWxH triple')
  }

  if (cartonInputProvided && !cartonTriplet) {
    return ApiResponses.badRequest('Carton dimensions must be a valid LxWxH triple')
  }

  try {
    const batch = await prisma.skuBatch.create({
      data: {
        sku: { connect: { id: skuId } },
        batchCode: normalizedCode,
        description: payload.description ? sanitizeForDisplay(payload.description) : null,
        productionDate,
        expiryDate,
        packSize: payload.packSize,
        unitsPerCarton: payload.unitsPerCarton,
        material: payload.material ? sanitizeForDisplay(payload.material) : null,
        unitDimensionsCm: unitTriplet ? formatDimensionTripletCm(unitTriplet) : null,
        unitLengthCm: unitTriplet ? unitTriplet.lengthCm : null,
        unitWidthCm: unitTriplet ? unitTriplet.widthCm : null,
        unitHeightCm: unitTriplet ? unitTriplet.heightCm : null,
        unitWeightKg: payload.unitWeightKg ?? null,
        cartonDimensionsCm: cartonTriplet ? formatDimensionTripletCm(cartonTriplet) : null,
        cartonLengthCm: cartonTriplet ? cartonTriplet.lengthCm : null,
        cartonWidthCm: cartonTriplet ? cartonTriplet.widthCm : null,
        cartonHeightCm: cartonTriplet ? cartonTriplet.heightCm : null,
        cartonWeightKg: payload.cartonWeightKg ?? null,
        packagingType: payload.packagingType ? sanitizeForDisplay(payload.packagingType) : null,
        isActive: true,
      },
    })

    return ApiResponses.created({ batch })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return ApiResponses.conflict('A batch with this code already exists for the SKU')
    }

    throw error
  }
})
