import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export async function GET(request: NextRequest) {
  try {
    console.log('Storage ledger API called')
    
    const session = await getServerSession(authOptions)
    
    if (!session) {
      console.log('No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('Session found:', session.user.email)

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const warehouseId = searchParams.get('warehouseId')

    // Default to last 3 months if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    // Set time to end of day for end date
    end.setHours(23, 59, 59, 999)

    // Get warehouses for the filter
    const warehouses = await prisma.wmsWarehouse.findMany({
      where: {
        isActive: true,
        // Exclude Amazon warehouse from storage ledger
        NOT: {
          OR: [
            { code: 'AMZN' },
            { code: 'AMZN-UK' }
          ]
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Build where clause for storage ledger
    const whereClause: any = {
      weekEndingDate: {
        gte: start,
        lte: end
      }
    }

    if (warehouseId) {
      whereClause.warehouseId = warehouseId
    }

    // Get storage ledger entries from database
    const ledgerEntries = await prisma.wmsStorageLedger.findMany({
      where: whereClause,
      include: {
        sku: true,
        warehouse: true
      },
      orderBy: [
        { weekEndingDate: 'desc' },
        { warehouse: { name: 'asc' } }
      ]
    })

    console.log(`Found ${ledgerEntries.length} storage ledger entries`)

    // Transform ledger entries to snapshot format
    const snapshotsMap = new Map<string, any>()

    for (const entry of ledgerEntries) {
      // Get Monday date from week ending date (Sunday)
      const weekEndingDate = new Date(entry.weekEndingDate)
      const monday = new Date(weekEndingDate)
      monday.setDate(monday.getDate() - 6) // Go back 6 days to Monday
      
      const key = `${monday.toISOString().split('T')[0]}-${entry.warehouseId}`
      
      if (!snapshotsMap.has(key)) {
        snapshotsMap.set(key, {
          date: monday.toISOString(),
          weekNumber: getWeekNumber(monday),
          warehouse: entry.warehouse,
          totalPallets: 0,
          rate: Number(entry.applicableWeeklyRate),
          cost: 0,
          items: []
        })
      }
      
      const snapshot = snapshotsMap.get(key)
      snapshot.totalPallets += entry.storagePalletsCharged
      snapshot.cost += Number(entry.calculatedWeeklyCost)
      
      // Add item details
      // For proper display, we need to get the actual configuration
      // The stored data shows result (1 pallet for 1 carton) but not the config used
      const actualConfig = await getActualPalletConfig(
        entry.warehouseId, 
        entry.skuId, 
        entry.batchLot,
        new Date(entry.weekEndingDate)
      )
      
      snapshot.items.push({
        sku: entry.sku,
        batchLot: entry.batchLot,
        cartons: entry.cartonsEndOfMonday,
        pallets: entry.storagePalletsCharged,
        cartonsPerPallet: actualConfig || Math.ceil(entry.cartonsEndOfMonday / entry.storagePalletsCharged) || 1,
        cost: Number(entry.calculatedWeeklyCost)
      })
    }

    // Convert map to array and sort items within each snapshot
    const snapshots = Array.from(snapshotsMap.values()).map(snapshot => ({
      ...snapshot,
      items: snapshot.items.sort((a: any, b: any) => a.sku.skuCode.localeCompare(b.sku.skuCode))
    }))

    console.log(`Transformed into ${snapshots.length} snapshots`)

    return NextResponse.json({
      snapshots,
      warehouses,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    })
  } catch (error) {
    console.error('Storage ledger error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Failed to fetch storage ledger',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

// Helper function to get actual pallet configuration
async function getActualPalletConfig(
  warehouseId: string,
  skuId: string,
  batchLot: string,
  date: Date
): Promise<number | null> {
  // First check inventory balance
  const balance = await prisma.wmsInventoryBalance.findFirst({
    where: {
      warehouseId,
      skuId,
      batchLot
    }
  })
  
  if (balance?.storageCartonsPerPallet) {
    return balance.storageCartonsPerPallet
  }
  
  // Then check warehouse SKU config
  const config = await prisma.wmsWarehouseSkuConfig.findFirst({
    where: {
      warehouseId,
      skuId,
      effectiveDate: { lte: date },
      OR: [
        { endDate: null },
        { endDate: { gte: date } }
      ]
    }
  })
  
  return config?.storageCartonsPerPallet || null
}