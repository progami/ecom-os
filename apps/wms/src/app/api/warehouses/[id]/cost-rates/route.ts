import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const warehouseId = id

    // Fetch cost rates for this warehouse from the CostRate table
    const costRates = await prisma.costRate.findMany({
      where: { 
        warehouseId: warehouseId,
        isActive: true
      },
      orderBy: [
        { costCategory: 'asc' },
        { costName: 'asc' }
      ]
    })

    // Transform to match frontend expectations
    const transformedRates = costRates.map(rate => {
      // Keep transportation as is, lowercase others
      let category: string = rate.costCategory
      if (category !== 'transportation') {
        category = category.toLowerCase()
      }
      
      return {
        id: rate.id,
        costCategory: category,
        costName: rate.costName,
        defaultRate: Number(rate.costValue),
        costValue: Number(rate.costValue),
        unitOfMeasure: rate.unitOfMeasure,
        isActive: rate.isActive
      }
    })

    return NextResponse.json({
      warehouseId,
      costRates: transformedRates
    })
  } catch (_error) {
    // console.error('Error fetching cost rates:', _error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const warehouseId = id
    const body = await request.json()
    const { costRates } = body

    // Delete existing cost rates for this warehouse
    await prisma.costRate.deleteMany({
      where: { warehouseId }
    })

    // Create new cost rates
    if (costRates && costRates.length > 0) {
      const rateData = costRates.map((rate: {
        costCategory: string;
        costName: string;
        defaultRate?: number;
        unitOfMeasure?: string;
        isActive?: boolean;
      }) => {
        // Keep transportation as is, capitalize other categories
        let category = rate.costCategory
        if (category !== 'transportation') {
          category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()
        }
        
        return {
          warehouseId,
          costCategory: category,
          costName: rate.costName,
          costValue: rate.defaultRate || 0,
          unitOfMeasure: rate.unitOfMeasure || 'unit',
          effectiveDate: new Date(),
          isActive: rate.isActive !== false,
          createdById: session.user.id
        }
      })

      await prisma.costRate.createMany({
        data: rateData
      })
    }

    // Fetch the updated rates
    const updatedRates = await prisma.costRate.findMany({
      where: { warehouseId },
      orderBy: [
        { costCategory: 'asc' },
        { costName: 'asc' }
      ]
    })

    const transformedRates = updatedRates.map(rate => ({
      id: rate.id,
      costCategory: rate.costCategory.toLowerCase(),
      costName: rate.costName,
      defaultRate: Number(rate.costValue),
      unitOfMeasure: rate.unitOfMeasure,
      isActive: rate.isActive
    }))

    return NextResponse.json({
      warehouseId,
      costRates: transformedRates
    })
  } catch (_error) {
    // console.error('Error updating cost rates:', _error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}