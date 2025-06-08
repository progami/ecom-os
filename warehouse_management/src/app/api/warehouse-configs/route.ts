import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const data = await request.json()
    
    // Validate required fields
    if (!data.warehouseId || !data.skuId || !data.storageCartonsPerPallet || !data.shippingCartonsPerPallet) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check for overlapping configurations
    const existingConfigs = await prisma.warehouseSkuConfig.findMany({
      where: {
        warehouseId: data.warehouseId,
        skuId: data.skuId
      },
      orderBy: { effectiveDate: 'asc' }
    })

    // Check for overlaps
    const effectiveDateObj = new Date(data.effectiveDate)
    const endDateObj = data.endDate ? new Date(data.endDate) : null

    for (const existing of existingConfigs) {
      const existingEffectiveDate = new Date(existing.effectiveDate)
      const existingEndDate = existing.endDate ? new Date(existing.endDate) : null

      // Check if periods overlap
      const overlap = checkPeriodOverlap(
        effectiveDateObj,
        endDateObj,
        existingEffectiveDate,
        existingEndDate
      )

      if (overlap) {
        return NextResponse.json(
          { 
            message: `Configuration overlaps with existing configuration from ${existingEffectiveDate.toLocaleDateString()}${
              existingEndDate ? ` to ${existingEndDate.toLocaleDateString()}` : ' (no end date)'
            }. Please adjust dates to avoid overlap.`
          },
          { status: 400 }
        )
      }
    }

    // Create new configuration
    const config = await prisma.warehouseSkuConfig.create({
      data: {
        warehouseId: data.warehouseId,
        skuId: data.skuId,
        storageCartonsPerPallet: data.storageCartonsPerPallet,
        shippingCartonsPerPallet: data.shippingCartonsPerPallet,
        maxStackingHeightCm: data.maxStackingHeightCm,
        effectiveDate: new Date(data.effectiveDate),
        notes: data.notes,
        createdById: session.user.id
      },
      include: {
        warehouse: true,
        sku: true
      }
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('Error creating warehouse config:', error)
    return NextResponse.json(
      { message: 'Failed to create configuration' },
      { status: 500 }
    )
  }
}

function checkPeriodOverlap(
  start1: Date,
  end1: Date | null,
  start2: Date,
  end2: Date | null
): boolean {
  // If either period is open-ended (no end date)
  if (!end1 && !end2) {
    // Both are open-ended, they will overlap
    return true
  }
  
  if (!end1) {
    // First period is open-ended
    return start1 <= (end2 as Date)
  }
  
  if (!end2) {
    // Second period is open-ended
    return end1 >= start2
  }
  
  // Both have end dates
  return start1 <= end2 && end1 >= start2
}