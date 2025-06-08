import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/wms/wms/utils/auth-utils'
import { getWarehouseFilter } from '@/lib/wms/wms/utils/auth-utils-utils'
import prisma from '@/lib/wms/prisma'
import { z } from 'zod'

// Validation schemas
const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  warehouseId: z.string().uuid(),
  billingPeriodStart: z.string().datetime(),
  billingPeriodEnd: z.string().datetime(),
  invoiceDate: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  totalAmount: z.number().positive(),
  notes: z.string().optional(),
  lineItems: z.array(z.object({
    costCategory: z.enum(['Container', 'Carton', 'Pallet', 'Storage', 'Unit', 'Shipment', 'Accessorial']),
    costName: z.string().min(1),
    quantity: z.number().positive(),
    unitRate: z.number().positive().optional(),
    amount: z.number().positive(),
    notes: z.string().optional()
  }))
})

const updateInvoiceSchema = z.object({
  status: z.enum(['pending', 'reconciled', 'disputed', 'paid']).optional(),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional()
})

// GET /api/v1/wms/invoices - List invoices with filtering
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get('search')
    const warehouseId = searchParams.get('warehouseId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Get warehouse filter based on user role
    const warehouseFilter = getWarehouseFilter(session, warehouseId)
    if (warehouseFilter === null) {
      return NextResponse.json({ error: 'No warehouse access' }, { status: 403 })
    }

    // Build where clause
    const where: any = { ...warehouseFilter }
    
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { warehouse: { name: { contains: search, mode: 'insensitive' } } },
        { totalAmount: { equals: parseFloat(search) || undefined } }
      ]
    }

    if (status) {
      // Handle comma-separated statuses
      if (status.includes(',')) {
        where.status = { in: status.split(',') }
      } else {
        where.status = status
      }
    }

    if (startDate || endDate) {
      where.invoiceDate = {}
      if (startDate) where.invoiceDate.gte = new Date(startDate)
      if (endDate) where.invoiceDate.lte = new Date(endDate)
    }

    // Get total count for pagination
    const totalCount = await prisma.wmsInvoice.count({ where })

    // Get invoices with relations
    const invoices = await prisma.wmsInvoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        lineItems: true,
        reconciliations: {
          include: {
            resolvedBy: {
              select: {
                id: true,
                fullName: true,
                email: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    )
  }
}

// POST /api/v1/wms/invoices - Create new invoice
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = createInvoiceSchema.parse(body)

    // Validate warehouse access
    const warehouseFilter = getWarehouseFilter(session, validatedData.warehouseId)
    if (warehouseFilter === null || (warehouseFilter.warehouseId && warehouseFilter.warehouseId !== validatedData.warehouseId)) {
      return NextResponse.json(
        { error: 'Access denied to this warehouse' },
        { status: 403 }
      )
    }

    // Check for idempotency by looking for existing invoice with same number
    // This provides natural idempotency since invoice numbers must be unique
    const existingInvoice = await prisma.wmsInvoice.findUnique({
      where: { invoiceNumber: validatedData.invoiceNumber },
      include: {
        warehouse: true,
        lineItems: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    if (existingInvoice) {
      // Check if it's the same request (idempotent)
      const isSameRequest = 
        existingInvoice.warehouseId === validatedData.warehouseId &&
        existingInvoice.totalAmount === validatedData.totalAmount &&
        existingInvoice.lineItems.length === validatedData.lineItems.length

      if (isSameRequest) {
        // Return existing invoice (idempotent response)
        return NextResponse.json(
          { 
            invoice: existingInvoice,
            idempotent: true,
            message: 'Invoice already exists with this number'
          }, 
          { 
            status: 200,
            headers: {
              'X-Idempotent-Response': 'true'
            }
          }
        )
      } else {
        // Different request with same invoice number
        return NextResponse.json(
          { error: 'Invoice number already exists with different details' },
          { status: 409 }
        )
      }
    }

    // Create invoice with line items
    try {
      const invoice = await prisma.wmsInvoice.create({
      data: {
        invoiceNumber: validatedData.invoiceNumber,
        warehouseId: validatedData.warehouseId,
        billingPeriodStart: new Date(validatedData.billingPeriodStart),
        billingPeriodEnd: new Date(validatedData.billingPeriodEnd),
        invoiceDate: new Date(validatedData.invoiceDate),
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        totalAmount: validatedData.totalAmount,
        notes: validatedData.notes,
        createdById: session.user.id,
        lineItems: {
          create: validatedData.lineItems.map(item => ({
            costCategory: item.costCategory,
            costName: item.costName,
            quantity: item.quantity,
            unitRate: item.unitRate,
            amount: item.amount,
            notes: item.notes
          }))
        }
      },
      include: {
        warehouse: true,
        lineItems: true,
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(invoice, { status: 201 })
    } catch (prismaError: any) {
      // Handle other database errors
      console.error('Database error:', prismaError)
      return NextResponse.json(
        { error: 'Failed to create invoice' },
        { status: 500 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

// PATCH /api/v1/wms/invoices - Update invoice status
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const invoiceId = searchParams.get('id')
    
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validatedData = updateInvoiceSchema.parse(body)

    const updatedInvoice = await prisma.wmsInvoice.update({
      where: { id: invoiceId },
      data: {
        status: validatedData.status,
        notes: validatedData.notes,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
        updatedAt: new Date()
      },
      include: {
        warehouse: true,
        lineItems: true,
        reconciliations: true
      }
    })

    return NextResponse.json(updatedInvoice)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

// DELETE /api/v1/wms/invoices - Delete invoice
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !['admin', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const invoiceId = searchParams.get('id')
    
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    // Check if invoice can be deleted (not paid)
    const invoice = await prisma.wmsInvoice.findUnique({
      where: { id: invoiceId }
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot delete paid invoices' },
        { status: 400 }
      )
    }

    // Delete invoice (cascade will handle line items)
    await prisma.wmsInvoice.delete({
      where: { id: invoiceId }
    })

    return NextResponse.json({ message: 'Invoice deleted successfully' })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}