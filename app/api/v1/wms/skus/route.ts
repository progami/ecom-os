import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schemas
const createSkuSchema = z.object({
  skuCode: z.string().min(1).max(50),
  asin: z.string().optional(),
  description: z.string().min(1),
  packSize: z.number().int().positive(),
  material: z.string().optional(),
  unitDimensionsCm: z.string().optional(),
  unitWeightKg: z.number().positive().optional(),
  unitsPerCarton: z.number().int().positive(),
  cartonDimensionsCm: z.string().optional(),
  cartonWeightKg: z.number().positive().optional(),
  packagingType: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true)
})

const updateSkuSchema = createSkuSchema.partial().extend({
  skuCode: z.string().min(1).max(50).optional()
})

// GET /api/v1/wms/skus - List SKUs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: any = {}
    
    if (!includeInactive) {
      where.isActive = true
    }

    if (search) {
      where.OR = [
        { skuCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { asin: { contains: search, mode: 'insensitive' } }
      ]
    }

    const skus = await prisma.wmsSku.findMany({
      where,
      orderBy: { skuCode: 'asc' },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
            warehouseConfigs: true
          }
        }
      }
    })

    return NextResponse.json(skus)
  } catch (error) {
    console.error('Error fetching SKUs:', error)
    return NextResponse.json({ error: 'Failed to fetch SKUs', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

// POST /api/v1/wms/skus - Create new SKU
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['admin', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createSkuSchema.parse(body)

    // Check if SKU code already exists
    const existingSku = await prisma.wmsSku.findUnique({
      where: { skuCode: validatedData.skuCode }
    })

    if (existingSku) {
      return NextResponse.json(
        { error: 'SKU code already exists' },
        { status: 400 }
      )
    }

    const sku = await prisma.wmsSku.create({
      data: validatedData
    })

    return NextResponse.json(sku, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating SKU:', error)
    return NextResponse.json({ error: 'Failed to create SKU' }, { status: 500 })
  }
}

// PATCH /api/v1/wms/skus - Update SKU
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !['admin', 'staff'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const skuId = searchParams.get('id')
    
    if (!skuId) {
      return NextResponse.json(
        { error: 'SKU ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateSkuSchema.parse(body)

    // If updating code, check if it's already in use
    if (validatedData.skuCode) {
      const existingSku = await prisma.wmsSku.findFirst({
        where: {
          skuCode: validatedData.skuCode,
          id: { not: skuId }
        }
      })

      if (existingSku) {
        return NextResponse.json(
          { error: 'SKU code already in use' },
          { status: 400 }
        )
      }
    }

    const updatedSku = await prisma.wmsSku.update({
      where: { id: skuId },
      data: validatedData
    })

    return NextResponse.json(updatedSku)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating SKU:', error)
    return NextResponse.json({ error: 'Failed to update SKU' }, { status: 500 })
  }
}

// DELETE /api/v1/wms/skus - Delete SKU
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const skuId = searchParams.get('id')
    
    if (!skuId) {
      return NextResponse.json(
        { error: 'SKU ID is required' },
        { status: 400 }
      )
    }

    // Check if SKU has related data
    const relatedData = await prisma.wmsSku.findUnique({
      where: { id: skuId },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
            inventoryTransactions: true,
            calculatedCosts: true
          }
        }
      }
    })

    if (!relatedData) {
      return NextResponse.json(
        { error: 'SKU not found' },
        { status: 404 }
      )
    }

    // Check if SKU has any related data
    const hasRelatedData = Object.values(relatedData._count).some(count => count > 0)
    
    if (hasRelatedData) {
      // Soft delete - just mark as inactive
      const updatedSku = await prisma.wmsSku.update({
        where: { id: skuId },
        data: { isActive: false }
      })

      return NextResponse.json({
        message: 'SKU deactivated (has related data)',
        sku: updatedSku
      })
    } else {
      // Hard delete - no related data
      await prisma.wmsSku.delete({
        where: { id: skuId }
      })

      return NextResponse.json({
        message: 'SKU deleted successfully'
      })
    }
  } catch (error) {
    console.error('Error deleting SKU:', error)
    return NextResponse.json({ error: 'Failed to delete SKU' }, { status: 500 })
  }
}