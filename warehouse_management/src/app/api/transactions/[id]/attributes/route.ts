import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { shipName, containerNumber, ...otherAttributes } = body

    // Update transaction with additional attributes
    const updatedTransaction = await prisma.inventoryTransaction.update({
      where: { id: params.id },
      data: {
        ...(shipName !== undefined && { shipName }),
        ...(containerNumber !== undefined && { containerNumber }),
        // Store other attributes in attachments field as metadata
        attachments: {
          ...(await prisma.inventoryTransaction.findUnique({
            where: { id: params.id },
            select: { attachments: true }
          }).then(t => t?.attachments || {})),
          metadata: {
            ...otherAttributes,
            lastUpdatedAt: new Date().toISOString(),
            lastUpdatedBy: session.user.id
          }
        }
      }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Attributes updated successfully',
      transaction: updatedTransaction
    })
  } catch (error) {
    console.error('Update attributes error:', error)
    return NextResponse.json({ 
      error: 'Failed to update attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}