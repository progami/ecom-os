import { NextRequest } from 'next/server'
import { withAuth, ApiResponses, z } from '@/lib/api'
import { getPurchaseOrders, serializePurchaseOrder } from '@/lib/services/purchase-order-service'
import {
  createPurchaseOrder,
  serializePurchaseOrder as serializeNewPO,
} from '@/lib/services/po-stage-service'
import type { UserContext } from '@/lib/services/po-stage-service'
import { hasPermission } from '@/lib/services/permission-service'
import { getCurrentTenant } from '@/lib/tenant/server'

export const GET = withAuth(async (_request: NextRequest, _session) => {
  const orders = await getPurchaseOrders()
  return ApiResponses.success({
    data: orders.map(order => serializePurchaseOrder(order)),
  })
})

const LineItemSchema = z.object({
  skuCode: z.string().min(1),
  skuDescription: z.string().optional(),
  batchLot: z
    .string()
    .trim()
    .min(1)
    .refine(value => value.trim().toUpperCase() !== 'DEFAULT', 'Batch / lot is required'),
  quantity: z.number().int().positive(),
  storageCartonsPerPallet: z.number().int().positive().optional(),
  shippingCartonsPerPallet: z.number().int().positive().optional(),
  unitCost: z.number().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
})

const CreatePOSchema = z.object({
  counterpartyName: z.string().min(1),
  expectedDate: z.string().trim().optional(),
  incoterms: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  notes: z.string().optional(),
  lines: z.array(LineItemSchema).min(1, 'At least one line item is required'),
})

/**
 * POST /api/purchase-orders
 * Create a new Purchase Order in DRAFT status with auto-generated PO number
 * Warehouse is NOT required at this stage - selected at Stage 4 (WAREHOUSE)
 */
export const POST = withAuth(async (request: NextRequest, session) => {
  const payload = await request.json().catch(() => null)
  const result = CreatePOSchema.safeParse(payload)

  if (!result.success) {
    return ApiResponses.badRequest(
      `Invalid payload: ${result.error.errors.map(e => e.message).join(', ')}`
    )
  }

  const userContext: UserContext = {
    id: session.user.id,
    name: session.user.name || session.user.email || 'Unknown',
    email: session.user.email || '',
  }

  const canCreate = await hasPermission(userContext.id, 'po.create')
  if (!canCreate) {
    return ApiResponses.forbidden('Insufficient permissions')
  }

  try {
    const order = await createPurchaseOrder(
      {
        counterpartyName: result.data.counterpartyName,
        expectedDate: result.data.expectedDate,
        incoterms: result.data.incoterms,
        paymentTerms: result.data.paymentTerms,
        notes: result.data.notes,
        lines: result.data.lines.map(line => ({
          skuCode: line.skuCode,
          skuDescription: line.skuDescription,
          batchLot: line.batchLot,
          quantity: line.quantity,
          storageCartonsPerPallet: line.storageCartonsPerPallet,
          shippingCartonsPerPallet: line.shippingCartonsPerPallet,
          unitCost: line.unitCost,
          currency: line.currency,
          notes: line.notes,
        })),
      },
      userContext
    )

    const tenant = await getCurrentTenant()
    return ApiResponses.success(serializeNewPO(order, { defaultCurrency: tenant.currency }))
  } catch (error) {
    return ApiResponses.handleError(error)
  }
})
