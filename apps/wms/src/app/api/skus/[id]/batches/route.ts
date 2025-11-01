import { withAuthAndParams, ApiResponses, requireRole, z } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'

const createBatchSchema = z.object({
  batchCode: z.string().min(1).max(64),
  description: z.string().optional().nullable(),
  productionDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export const GET = withAuthAndParams(async (request, params, session) => {
  if (!requireRole(session, ['admin', 'staff'])) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const skuId = params.id as string
  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'

  const sku = await prisma.sku.findUnique({
    where: { id: skuId },
    select: { id: true },
  })

  if (!sku) {
    return ApiResponses.notFound('SKU not found')
  }

  const batches = await prisma.skuBatch.findMany({
    where: {
      skuId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  })

  return ApiResponses.success({ batches })
})

export const POST = withAuthAndParams(async (request, params, session) => {
  if (!requireRole(session, ['admin', 'staff'])) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

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
  const productionDate = payload.productionDate ? new Date(payload.productionDate) : null
  const expiryDate = payload.expiryDate ? new Date(payload.expiryDate) : null

  if (productionDate && Number.isNaN(productionDate.getTime())) {
    return ApiResponses.validationError({ productionDate: 'Invalid production date' })
  }

  if (expiryDate && Number.isNaN(expiryDate.getTime())) {
    return ApiResponses.validationError({ expiryDate: 'Invalid expiry date' })
  }

  try {
    const batch = await prisma.skuBatch.create({
      data: {
        skuId,
        batchCode: normalizedCode,
        description: payload.description ? sanitizeForDisplay(payload.description) : null,
        productionDate,
        expiryDate,
        isActive: payload.isActive ?? true,
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
