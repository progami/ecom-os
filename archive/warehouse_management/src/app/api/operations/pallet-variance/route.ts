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

    // Get all inventory balances
    const balances = await prisma.inventoryBalance.findMany({
      include: {
        warehouse: true,
        sku: true
      }
    })

    // Calculate variances - for demo purposes, we'll simulate some variances
    // In production, you would compare with actual physical count data
    const variances = balances
      .filter(balance => balance.currentPallets > 0)
      .map(balance => {
        // Simulate variance - in production, this would come from physical count data
        const simulatedVariance = Math.floor(Math.random() * 5) - 2 // -2 to +2 variance
        const actualPallets = Math.max(0, balance.currentPallets + simulatedVariance)
        const variance = actualPallets - balance.currentPallets
        const variancePercentage = balance.currentPallets > 0 
          ? (variance / balance.currentPallets) * 100 
          : 0

        return {
          id: balance.id,
          warehouseId: balance.warehouseId,
          warehouse: balance.warehouse,
          skuId: balance.skuId,
          sku: balance.sku,
          batchLot: balance.batchLot,
          systemPallets: balance.currentPallets,
          actualPallets,
          variance,
          variancePercentage,
          lastPhysicalCount: null,
          notes: null,
          status: variance !== 0 ? 'PENDING' : 'RESOLVED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })
      .filter(v => v.variance !== 0) // Only show items with variance

    return NextResponse.json(variances)
  } catch (error) {
    console.error('Get pallet variance error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch pallet variances',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}