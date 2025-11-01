import { withAuthAndParams, ApiResponses, requireRole, z } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'

const updateSchema = z.object({
  batchCode: z.string().min(1).max(64).optional(),
  description: z.string().optional().nullable(),
  productionDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

async function ensureBatch(skuId: string, batchId: string) {
  return prisma.skuBatch.findFirst({
    where: {
      id: batchId,
      skuId,
    },
  })
}

export const PATCH = withAuthAndParams(async (request, params, session) => {
  if (!requireRole(session, ['admin', 'staff'])) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const skuId = params.id as string
  const batchId = params.batchId as string
  const body = await request.json().catch(() => null)

  if (!body) {
    return ApiResponses.badRequest('Invalid JSON payload')
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
  }

  const existing = await ensureBatch(skuId, batchId)
  if (!existing) {
    return ApiResponses.notFound('Batch not found')
  }

  const data: Prisma.SkuBatchUpdateInput = {}

  if (parsed.data.batchCode) {
    data.batchCode = sanitizeForDisplay(parsed.data.batchCode.toUpperCase())
  }

  if (parsed.data.description !== undefined) {
    data.description = parsed.data.description ? sanitizeForDisplay(parsed.data.description) : null
  }

  if (parsed.data.productionDate !== undefined) {
    if (parsed.data.productionDate === null) {
      data.productionDate = null
    } else {
      const production = new Date(parsed.data.productionDate)
      if (Number.isNaN(production.getTime())) {
        return ApiResponses.validationError({ productionDate: 'Invalid production date' })
      }
      data.productionDate = production
    }
  }

  if (parsed.data.expiryDate !== undefined) {
    if (parsed.data.expiryDate === null) {
      data.expiryDate = null
    } else {
      const expiry = new Date(parsed.data.expiryDate)
      if (Number.isNaN(expiry.getTime())) {
        return ApiResponses.validationError({ expiryDate: 'Invalid expiry date' })
      }
      data.expiryDate = expiry
    }
  }

  if (parsed.data.isActive !== undefined) {
    data.isActive = parsed.data.isActive
  }

  try {
    const updated = await prisma.skuBatch.update({
      where: { id: batchId },
      data,
    })

    return ApiResponses.success({ batch: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return ApiResponses.conflict('A batch with this code already exists for the SKU')
    }

    throw error
  }
})

export const DELETE = withAuthAndParams(async (_request, params, session) => {
  if (!requireRole(session, ['admin', 'staff'])) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const skuId = params.id as string
  const batchId = params.batchId as string

  const existing = await ensureBatch(skuId, batchId)
  if (!existing) {
    return ApiResponses.notFound('Batch not found')
  }

  await prisma.skuBatch.update({
    where: { id: batchId },
    data: { isActive: false },
  })

  return ApiResponses.success({ message: 'Batch deactivated' })
})
