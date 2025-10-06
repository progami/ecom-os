import { withRole, ApiResponses } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const POST = withRole(['admin'], async () => {
  await prisma.$transaction(async tx => {
    await tx.warehouseInvoiceLine.deleteMany({})
    await tx.warehouseInvoice.deleteMany({})
    await tx.costLedger.deleteMany({})
    await tx.storageLedger.deleteMany({})
    await tx.inventoryTransaction.deleteMany({})
    await tx.movementNoteLine.deleteMany({})
    await tx.movementNote.deleteMany({})
    await tx.purchaseOrderLine.deleteMany({})
    await tx.purchaseOrder.deleteMany({})
  })

  return ApiResponses.success({ cleared: true })
})
