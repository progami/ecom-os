import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SHIPMENT_PLANNING_CONFIG } from '@/lib/config/shipment-planning'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check FBA stock levels against threshold
    // TODO: This should be run as a scheduled job and store notifications in DB
    // For now, we'll calculate on-demand
    
    // Fetch Amazon inventory comparison data
    const amazonInventory = await prisma.amazonInventory.findMany({
      where: {
        isActive: true,
      },
      include: {
        sku: true,
      }
    })

    const lowStockItems = []
    
    for (const item of amazonInventory) {
      // TODO: Replace with actual sales velocity calculation
      const dailySalesVelocity = 1 // Default for now
      
      if (item.quantity > 0 && dailySalesVelocity > 0) {
        const daysOfStock = Math.floor(item.quantity / dailySalesVelocity)
        
        if (daysOfStock <= SHIPMENT_PLANNING_CONFIG.LOW_STOCK_THRESHOLD_DAYS) {
          // Check if warehouse has stock to replenish
          const warehouseStock = await prisma.inventoryBalance.aggregate({
            where: {
              skuId: item.skuId,
              isActive: true,
            },
            _sum: {
              currentCartons: true,
            }
          })
          
          if (warehouseStock._sum.currentCartons && warehouseStock._sum.currentCartons > 0) {
            lowStockItems.push({
              skuCode: item.sku.skuCode,
              description: item.sku.description,
              fbaStock: item.quantity,
              daysOfStock,
              warehouseStock: warehouseStock._sum.currentCartons,
              urgency: daysOfStock <= 7 ? 'critical' : daysOfStock <= 14 ? 'high' : 'medium',
              message: `${item.sku.skuCode} has only ${daysOfStock} days of stock at FBA`,
              createdAt: new Date().toISOString()
            })
          }
        }
      }
    }

    // Sort by urgency
    lowStockItems.sort((a, b) => a.daysOfStock - b.daysOfStock)

    return NextResponse.json({
      notifications: lowStockItems,
      count: lowStockItems.length,
      threshold: SHIPMENT_PLANNING_CONFIG.LOW_STOCK_THRESHOLD_DAYS
    })
  } catch (error) {
    console.error('Low stock notification error:', error)
    return NextResponse.json({ 
      error: 'Failed to get low stock notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Mark notifications as read
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationIds } = body

    // TODO: When we have a proper notifications table, mark them as read
    // For now, just acknowledge the request
    
    return NextResponse.json({
      success: true,
      message: `Marked ${notificationIds?.length || 0} notifications as read`
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to update notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}