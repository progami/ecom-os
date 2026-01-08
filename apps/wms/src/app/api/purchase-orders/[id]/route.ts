import { ApiResponses, withAuthAndParams, z } from '@/lib/api'
import { hasPermission } from '@/lib/services/permission-service'
import { serializePurchaseOrder as serializeWithStageData } from '@/lib/services/po-stage-service'
import {
  getPurchaseOrderById,
  updatePurchaseOrderDetails,
} from '@/lib/services/purchase-order-service'
import { getTenantPrisma } from '@/lib/tenant/server'

type BatchPackagingPayload = {
  cartonDimensionsCm: string | null
  cartonLengthCm: number | null
  cartonWidthCm: number | null
  cartonHeightCm: number | null
  cartonWeightKg: number | null
  packagingType: string | null
}

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object') {
    const maybe = value as { toNumber?: () => number; toString?: () => string }
    if (typeof maybe.toNumber === 'function') {
      const parsed = maybe.toNumber()
      return Number.isFinite(parsed) ? parsed : null
    }
    if (typeof maybe.toString === 'function') {
      const parsed = Number(maybe.toString())
      return Number.isFinite(parsed) ? parsed : null
    }
  }
  return null
}

export const GET = withAuthAndParams(async (_request, params) => {
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params?.id?.[0]
        : undefined
  if (!id) {
    return ApiResponses.badRequest('Purchase order ID is required')
  }

  const order = await getPurchaseOrderById(id)
  if (!order) {
    return ApiResponses.notFound('Purchase order not found')
  }

  const serialized = serializeWithStageData(order) as Record<string, unknown>

  const combos = order.lines
    .filter(line => Boolean(line.skuCode?.trim()) && Boolean(line.batchLot?.trim()))
    .map(line => ({
      skuCode: line.skuCode.trim(),
      batchLot: (line.batchLot ?? '').trim(),
    }))

  if (combos.length > 0) {
    const prisma = await getTenantPrisma()
    const batches = await prisma.skuBatch.findMany({
      where: {
        OR: combos.map(combo => ({
          batchCode: { equals: combo.batchLot, mode: 'insensitive' },
          sku: { skuCode: { equals: combo.skuCode, mode: 'insensitive' } },
        })),
      },
      select: {
        batchCode: true,
        cartonDimensionsCm: true,
        cartonLengthCm: true,
        cartonWidthCm: true,
        cartonHeightCm: true,
        cartonWeightKg: true,
        packagingType: true,
        sku: { select: { skuCode: true } },
      },
    })

    const packagingByKey = new Map<string, BatchPackagingPayload>()
    batches.forEach(batch => {
      const skuCode = batch.sku.skuCode.trim().toUpperCase()
      const batchCode = batch.batchCode.trim().toUpperCase()
      const key = `${skuCode}::${batchCode}`
      packagingByKey.set(key, {
        cartonDimensionsCm: batch.cartonDimensionsCm ?? null,
        cartonLengthCm: toNumberOrNull(batch.cartonLengthCm),
        cartonWidthCm: toNumberOrNull(batch.cartonWidthCm),
        cartonHeightCm: toNumberOrNull(batch.cartonHeightCm),
        cartonWeightKg: toNumberOrNull(batch.cartonWeightKg),
        packagingType: batch.packagingType ? batch.packagingType.trim().toUpperCase() : null,
      })
    })

    const serializedLines = Array.isArray(serialized.lines) ? (serialized.lines as unknown[]) : []
    serializedLines.forEach(rawLine => {
      if (!rawLine || typeof rawLine !== 'object') return
      const line = rawLine as Record<string, unknown>
      const skuCode =
        typeof line.skuCode === 'string' && line.skuCode.trim() ? line.skuCode.trim() : null
      const batchLot =
        typeof line.batchLot === 'string' && line.batchLot.trim()
          ? line.batchLot.trim().toUpperCase()
          : null
      if (!skuCode || !batchLot) return

      const packaging = packagingByKey.get(`${skuCode.toUpperCase()}::${batchLot}`)
      if (!packaging) return

      line.cartonDimensionsCm = packaging.cartonDimensionsCm
      line.cartonLengthCm = packaging.cartonLengthCm
      line.cartonWidthCm = packaging.cartonWidthCm
      line.cartonHeightCm = packaging.cartonHeightCm
      line.cartonWeightKg = packaging.cartonWeightKg
      line.packagingType = packaging.packagingType
    })
  }

  return ApiResponses.success(serialized)
})

const UpdateDetailsSchema = z.object({
  expectedDate: z.string().trim().optional().nullable(),
  incoterms: z.string().trim().optional().nullable(),
  paymentTerms: z.string().trim().optional().nullable(),
  counterpartyName: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

export const PATCH = withAuthAndParams(async (request, params, session) => {
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params?.id?.[0]
        : undefined
  if (!id) {
    return ApiResponses.badRequest('Purchase order ID is required')
  }

  const canEdit = await hasPermission(session.user.id, 'po.edit')
  if (!canEdit) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return ApiResponses.badRequest('Invalid update payload')
  }

  const parsed = UpdateDetailsSchema.safeParse(payload)
  if (!parsed.success) {
    return ApiResponses.validationError(parsed.error.flatten().fieldErrors)
  }

  const normalized = {
    expectedDate: parsed.data.expectedDate === '' ? null : parsed.data.expectedDate ?? undefined,
    incoterms: parsed.data.incoterms === '' ? null : parsed.data.incoterms ?? undefined,
    paymentTerms: parsed.data.paymentTerms === '' ? null : parsed.data.paymentTerms ?? undefined,
    counterpartyName:
      parsed.data.counterpartyName === '' ? null : parsed.data.counterpartyName ?? undefined,
    notes: parsed.data.notes === '' ? null : parsed.data.notes ?? undefined,
  }

  try {
    const updated = await updatePurchaseOrderDetails(id, normalized, {
      id: session.user.id,
      name: session.user.name ?? session.user.email ?? null,
    })
    return ApiResponses.success(serializeWithStageData(updated))
  } catch (error) {
    return ApiResponses.handleError(error)
  }
})
