import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For now, we'll store templates in the warehouse_notifications table as a temporary solution
    // In production, you would create a dedicated invoice_templates table
    const templates = await prisma.warehouseNotification.findMany({
      where: {
        type: 'INVOICE_TEMPLATE'
      },
      include: {
        warehouse: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to match the expected format
    const formattedTemplates = templates.map(t => ({
      id: t.id,
      warehouseId: t.warehouseId,
      warehouse: t.warehouse,
      name: t.subject,
      description: t.message,
      transactionType: (t.metadata as any)?.transactionType || 'BOTH',
      costMappings: (t.metadata as any)?.costMappings || {},
      isDefault: (t.metadata as any)?.isDefault || false,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    }))

    return NextResponse.json(formattedTemplates)
  } catch (error) {
    console.error('Get invoice templates error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch invoice templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { warehouseId, name, description, transactionType, costMappings, isDefault } = body

    if (!warehouseId || !name) {
      return NextResponse.json({ error: 'Warehouse and name are required' }, { status: 400 })
    }

    // If setting as default, unset other defaults for this warehouse
    if (isDefault) {
      await prisma.warehouseNotification.updateMany({
        where: {
          warehouseId,
          type: 'INVOICE_TEMPLATE',
          metadata: {
            path: ['isDefault'],
            equals: true
          }
        },
        data: {
          metadata: {
            ...(await prisma.warehouseNotification.findFirst({
              where: {
                warehouseId,
                type: 'INVOICE_TEMPLATE',
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

    // Create the template
    const template = await prisma.warehouseNotification.create({
      data: {
        warehouseId,
        type: 'INVOICE_TEMPLATE',
        subject: name,
        message: description || '',
        status: 'ACTIVE',
        metadata: {
          transactionType,
          costMappings,
          isDefault
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
      transactionType,
      costMappings,
      isDefault,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    }

    return NextResponse.json(formattedTemplate)
  } catch (error) {
    console.error('Create invoice template error:', error)
    return NextResponse.json({ 
      error: 'Failed to create invoice template',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}