import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all SKUs with their inventory balances
    const skus = await prisma.wmsSku.findMany({
      include: {
        inventoryBalances: {
          include: {
            warehouse: true
          }
        }
      },
      orderBy: {
        skuCode: 'asc'
      }
    })

    // Get Amazon FBA warehouse
    const amazonWarehouse = await prisma.wmsWarehouse.findFirst({
      where: {
        name: {
          contains: 'Amazon FBA'
        }
      }
    })

    // Transform data for comparison
    const comparisonData = skus.map((sku: any) => {
      const warehouseBalance = sku.inventoryBalances
        .filter((bal: any) => bal.warehouseId !== amazonWarehouse?.id)
        .reduce((sum: number, bal: any) => sum + bal.currentCartons, 0)
      
      const amazonBalance = amazonWarehouse 
        ? sku.inventoryBalances
            .filter((bal: any) => bal.warehouseId === amazonWarehouse.id)
            .reduce((sum: number, bal: any) => sum + bal.currentCartons, 0)
        : 0

      const total = warehouseBalance + amazonBalance

      return {
        sku: sku.skuCode,
        description: sku.description || '',
        warehouseQty: warehouseBalance,
        amazonQty: amazonBalance,
        total,
        lastUpdated: new Date().toISOString(),
        trend: 'stable' as const,
        percentChange: 0
      }
    })

    return NextResponse.json(comparisonData)
  } catch (error) {
    console.error('Inventory comparison error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch inventory comparison',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}