import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, transactionType, costMappings, isDefault } = body

    // Get current template
    const current = await prisma.warehouseNotification.findUnique({
      where: { id: params.id }
    })

    if (!current) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults for this warehouse
    if (isDefault && !(current.metadata as any)?.isDefault) {
      await prisma.warehouseNotification.updateMany({
        where: {
          warehouseId: current.warehouseId,
          type: 'INVOICE_TEMPLATE',
          id: { not: params.id },
          metadata: {
            path: ['isDefault'],
            equals: true
          }
        },
        data: {
          metadata: {
            ...(await prisma.warehouseNotification.findFirst({
              where: {
                warehouseId: current.warehouseId,
                type: 'INVOICE_TEMPLATE',
                id: { not: params.id },
                metadata: {
                  path: ['isDefault'],
                  equals: true
                }
              }
            }).then(n => n?.metadata || {})),
            isDefault: false
          }
        }
      })
    }

    // Update the template
    const template = await prisma.warehouseNotification.update({
      where: { id: params.id },
      data: {
        subject: name || current.subject,
        message: description !== undefined ? description : current.message,
        metadata: {
          transactionType: transactionType || (current.metadata as any)?.transactionType,
          costMappings: costMappings || (current.metadata as any)?.costMappings,
          isDefault: isDefault !== undefined ? isDefault : (current.metadata as any)?.isDefault
        }
      },
      include: {
        warehouse: true
      }
    })

    const formattedTemplate = {
      id: template.id,
      warehouseId: template.warehouseId,
      warehouse: template.warehouse,
      name: template.subject,
      description: template.message,
      transactionType: (template.metadata as any)?.transactionType,
      costMappings: (template.metadata as any)?.costMappings,
      isDefault: (template.metadata as any)?.isDefault,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }

    return NextResponse.json(formattedTemplate)
  } catch (error) {
    console.error('Update invoice template error:', error)
    return NextResponse.json({ 
      error: 'Failed to update invoice template',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.warehouseNotification.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete invoice template error:', error)
    return NextResponse.json({ 
      error: 'Failed to delete invoice template',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}