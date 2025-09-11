import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getS3Service } from '@/services/s3.service'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        transactionDate: true,
        transactionType: true,
        batchLot: true,
        referenceId: true,
        cartonsIn: true,
        cartonsOut: true,
        storagePalletsIn: true,
        shippingPalletsOut: true,
        createdAt: true,
        shipName: true,
        trackingNumber: true,
        pickupDate: true,
        attachments: true,
        storageCartonsPerPallet: true,
        shippingCartonsPerPallet: true,
        unitsPerCarton: true,
        supplier: true,
        // Use snapshot data instead of relations
        warehouseCode: true,
        warehouseName: true,
        warehouseAddress: true,
        skuCode: true,
        skuDescription: true,
        unitDimensionsCm: true,
        unitWeightKg: true,
        cartonDimensionsCm: true,
        cartonWeightKg: true,
        packagingType: true,
        createdById: true,
        createdByName: true
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Fetch costs from CostLedger for this transaction
    const costLedger = await prisma.costLedger.findMany({
      where: {
        transactionId: id // Use the UUID directly
      },
      select: {
        costCategory: true,
        costName: true,
        quantity: true,
        unitRate: true,
        totalCost: true
      }
    })

    // Process attachments to add presigned URLs
    let processedAttachments = transaction.attachments
    if (transaction.attachments && Array.isArray(transaction.attachments)) {
      const s3Service = getS3Service()
      processedAttachments = await Promise.all(
        transaction.attachments.map(async (attachment: {
          id?: string;
          s3Key?: string;
          name?: string;
          type?: string;
          uploadedAt?: Date;
          uploadedBy?: string;
        }) => {
          if (attachment.s3Key) {
            try {
              // Generate presigned URL for download
              const s3Url = await s3Service.getPresignedUrl(attachment.s3Key, 'get', {
                responseContentDisposition: `attachment; filename="${attachment.name}"`,
                expiresIn: 3600 // 1 hour
              })
              return { ...attachment, s3Url }
            } catch (_error) {
              // console.error('Failed to generate presigned URL:', _error)
              return attachment
            }
          }
          return attachment
        })
      )
    }

    // Create response object with transaction and costs
    // Transform to match expected format with nested objects
    const response = {
      ...transaction,
      attachments: processedAttachments,
      costLedger: costLedger,
      calculatedCosts: costLedger, // For backward compatibility
      // Add nested objects for backward compatibility
      warehouse: {
        id: '', // No longer have warehouse ID
        code: transaction.warehouseCode,
        name: transaction.warehouseName
      },
      sku: {
        id: '', // No longer have SKU ID
        skuCode: transaction.skuCode,
        description: transaction.skuDescription,
        unitsPerCarton: transaction.unitsPerCarton
      },
      createdBy: {
        id: transaction.createdById,
        fullName: transaction.createdByName
      }
    }

    return NextResponse.json(response)
  } catch (_error) {
    // console.error('Failed to fetch transaction:', _error)
    return NextResponse.json({ 
      error: 'Failed to fetch transaction' 
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Get the existing transaction
    const existingTransaction = await prisma.inventoryTransaction.findUnique({
      where: { id }
    })

    if (!existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check if user has permission to edit this warehouse's transactions
    // Since we don't have warehouseId anymore, we need to check by warehouse code
    if (session.user.role === 'staff' && session.user.warehouseId) {
      const userWarehouse = await prisma.warehouse.findUnique({
        where: { id: session.user.warehouseId },
        select: { code: true }
      })
      if (userWarehouse && userWarehouse.code !== existingTransaction.warehouseCode) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Only allow updating reference fields, NOT quantities or costs
    const allowedFields = [
      'referenceId',
      'shipName',
      'trackingNumber',
      'supplier'
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Update the transaction
    const updatedTransaction = await prisma.inventoryTransaction.update({
      where: { id },
      data: updateData as Prisma.InventoryTransactionUpdateInput
    })

    return NextResponse.json(updatedTransaction)
  } catch (_error) {
    // console.error('Failed to update transaction:', _error)
    return NextResponse.json({ 
      error: 'Failed to update transaction' 
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First validate if this transaction can be deleted
    const validationResponse = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/transactions/${id}/validate-edit`,
      {
        method: 'GET',
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      }
    )

    if (!validationResponse.ok) {
      return NextResponse.json({ error: 'Failed to validate transaction' }, { status: 500 })
    }

    const validation = await validationResponse.json()

    if (!validation.canDelete) {
      return NextResponse.json({ 
        error: validation.reason || 'Cannot delete this transaction' 
      }, { status: 400 })
    }

    // Get transaction details before deletion for logging
    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Check user permissions
    if (session.user.role === 'staff' && session.user.warehouseId) {
      const userWarehouse = await prisma.warehouse.findUnique({
        where: { id: session.user.warehouseId },
        select: { code: true }
      })
      if (userWarehouse && userWarehouse.code !== transaction.warehouseCode) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Delete the transaction (cascade deletion will handle related cost ledger entries)
    await prisma.inventoryTransaction.delete({
      where: { id }
    })

    // Log the deletion
    // console.log(`Transaction ${transaction.id} deleted by ${session.user.email}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Transaction deleted successfully',
      deletedTransaction: {
        id: transaction.id,
        type: transaction.transactionType,
        sku: transaction.skuCode,
        batch: transaction.batchLot,
        quantity: transaction.cartonsIn || transaction.cartonsOut
      }
    })
  } catch (_error) {
    // console.error('Failed to delete transaction:', _error)
    return NextResponse.json({ 
      error: 'Failed to delete transaction' 
    }, { status: 500 })
  }
}