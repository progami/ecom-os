import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stringify } from 'csv-stringify/sync'

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
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const warehouseId = searchParams.get('warehouseId')

    // Default to last 3 months if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    // Set time to end of day for end date
    end.setHours(23, 59, 59, 999)

    // Get ALL transactions up to the end date to calculate accurate balances
    const allTransactionsWhere: any = {
      transactionDate: {
        lte: end
      }
    }
    
    if (warehouseId) {
      allTransactionsWhere.warehouseId = warehouseId
    }
    
    const transactions = await prisma.inventoryTransaction.findMany({
      where: allTransactionsWhere,
      include: {
        sku: true,
        warehouse: true
      },
      orderBy: {
        transactionDate: 'asc'
      }
    })

    // Get warehouses for the filter
    const warehouses = await prisma.warehouse.findMany({
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

    // Get current rates for calculation
    const rates = await prisma.costRate.findMany({
      where: {
        costCategory: 'Storage',
        warehouseId: warehouseId || undefined,
        effectiveDate: {
          lte: end
        },
        OR: [
          { endDate: null },
          { endDate: { gte: start } }
        ]
      },
      include: {
        warehouse: true
      }
    })

    // Calculate Monday snapshots
    const snapshots = await calculateMondaySnapshots(transactions, warehouses, rates, start, end)

    // Prepare CSV data
    const csvData = []
    
    // Header row
    csvData.push([
      'Week Number',
      'Week Ending',
      'Warehouse',
      'Warehouse Code',
      'SKU Code',
      'SKU Description',
      'Batch/Lot',
      'Cartons',
      'Cartons Per Pallet',
      'Pallets',
      'Storage Rate (£/pallet/week)',
      'SKU Cost (£)',
      'Cost Share %',
      'Total Weekly Cost (£)'
    ])

    // Data rows
    for (const snapshot of snapshots) {
      if (snapshot.items.length === 0) {
        // Summary row for warehouse with no items
        csvData.push([
          `W${snapshot.weekNumber}`,
          new Date(snapshot.date).toLocaleDateString('en-GB'),
          snapshot.warehouse.name,
          snapshot.warehouse.code,
          '-',
          '-',
          '-',
          '0',
          '-',
          snapshot.totalPallets.toString(),
          snapshot.rate.toFixed(2),
          '0.00',
          '0.0%',
          snapshot.cost.toFixed(2)
        ])
      } else {
        // Detail rows for each item
        for (const item of snapshot.items) {
          const costShare = (item.pallets / snapshot.totalPallets) * 100
          csvData.push([
            `W${snapshot.weekNumber}`,
            new Date(snapshot.date).toLocaleDateString('en-GB'),
            snapshot.warehouse.name,
            snapshot.warehouse.code,
            item.sku.skuCode,
            item.sku.description,
            item.batchLot,
            item.cartons.toString(),
            item.cartonsPerPallet.toString(),
            item.pallets.toString(),
            snapshot.rate.toFixed(2),
            item.cost.toFixed(2),
            `${costShare.toFixed(1)}%`,
            snapshot.cost.toFixed(2)
          ])
        }
      }
    }

    // Add summary rows
    csvData.push([]) // Empty row
    csvData.push(['Summary', '', '', '', '', '', '', '', '', '', '', '', '', ''])
    csvData.push([
      'Total Weeks',
      snapshots.length.toString(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ])
    
    const totalPallets = snapshots.reduce((sum, s) => sum + s.totalPallets, 0)
    const totalCost = snapshots.reduce((sum, s) => sum + s.cost, 0)
    
    csvData.push([
      'Total Pallets',
      totalPallets.toString(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ])
    
    csvData.push([
      'Total Cost',
      `£${totalCost.toFixed(2)}`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ])

    // Convert to CSV
    const csv = stringify(csvData)

    // Return CSV response
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="storage-ledger-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ 
      error: 'Failed to export storage ledger',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function calculateMondaySnapshots(
  transactions: any[],
  warehouses: any[],
  rates: any[],
  startDate: Date,
  endDate: Date
) {
  const snapshots = []
  
  // Find all Mondays in the date range
  const mondays = []
  const current = new Date(startDate)
  
  // Move to next Monday if start date is not Monday
  const daysUntilMonday = (8 - current.getDay()) % 7
  if (daysUntilMonday > 0) {
    current.setDate(current.getDate() + daysUntilMonday)
  }
  
  while (current <= endDate) {
    mondays.push(new Date(current))
    current.setDate(current.getDate() + 7)
  }

  // For each Monday, calculate inventory snapshot
  for (const monday of mondays) {
    const mondayEnd = new Date(monday)
    mondayEnd.setHours(23, 59, 59, 999)
    
    // Calculate inventory for each warehouse
    for (const warehouse of warehouses) {
      // Get all unique SKU/batch combinations that have had transactions for this warehouse
      const warehouseTransactions = transactions.filter(t => 
        t.warehouseId === warehouse.id && 
        new Date(t.transactionDate) <= mondayEnd
      )
      
      // Create a map of unique SKU/batch combinations
      const skuBatchMap = new Map<string, { skuId: string, batchLot: string, sku: any }>()
      
      for (const t of warehouseTransactions) {
        const key = `${t.skuId}-${t.batchLot}`
        if (!skuBatchMap.has(key)) {
          skuBatchMap.set(key, {
            skuId: t.skuId,
            batchLot: t.batchLot,
            sku: t.sku
          })
        }
      }
      
      // Calculate total pallets for warehouse
      let totalPallets = 0
      const items = []
      
      // For each unique SKU/batch, calculate the balance at Monday
      for (const [key, { skuId, batchLot, sku }] of skuBatchMap) {
        // Get all transactions for this SKU/batch up to Monday
        const skuBatchTransactions = warehouseTransactions.filter(t => 
          t.skuId === skuId &&
          t.batchLot === batchLot
        )
        
        // Calculate cartons at Monday end
        let cartonsAtMonday = 0
        for (const t of skuBatchTransactions) {
          cartonsAtMonday += t.cartonsIn - t.cartonsOut
        }
        
        if (cartonsAtMonday > 0) {
          // Get the current inventory balance to find storage configuration
          const balance = await prisma.inventoryBalance.findFirst({
            where: {
              warehouseId: warehouse.id,
              skuId: skuId,
              batchLot: batchLot
            }
          })
          
          // Use storage configuration from balance, or warehouse config, or default
          let cartonsPerPallet = 1
          
          if (balance?.storageCartonsPerPallet) {
            cartonsPerPallet = balance.storageCartonsPerPallet
          } else {
            // Try to get from warehouse SKU config
            const warehouseConfig = await prisma.warehouseSkuConfig.findFirst({
              where: {
                warehouseId: warehouse.id,
                skuId: skuId,
                effectiveDate: { lte: monday },
                OR: [
                  { endDate: null },
                  { endDate: { gte: monday } }
                ]
              }
            })
            
            if (warehouseConfig?.storageCartonsPerPallet) {
              cartonsPerPallet = warehouseConfig.storageCartonsPerPallet
            }
          }
          
          const pallets = Math.ceil(cartonsAtMonday / cartonsPerPallet)
          totalPallets += pallets
          
          items.push({
            sku,
            batchLot,
            cartons: cartonsAtMonday,
            pallets,
            cartonsPerPallet,
            cost: 0 // Will be calculated after we know the total
          })
        }
      }
      
      if (totalPallets > 0) {
        // Find applicable rate
        const applicableRate = rates.find(r => 
          r.warehouseId === warehouse.id &&
          new Date(r.effectiveDate) <= monday &&
          (!r.endDate || new Date(r.endDate) >= monday)
        )
        
        const rate = applicableRate ? Number(applicableRate.costValue) : 0
        const cost = totalPallets * rate
        
        // Calculate cost share for each item
        items.forEach(item => {
          item.cost = (item.pallets / totalPallets) * cost
        })
        
        // Calculate week number
        const weekNumber = getWeekNumber(monday)
        
        snapshots.push({
          date: monday.toISOString(),
          weekNumber,
          warehouse,
          totalPallets,
          rate,
          cost,
          items: items.sort((a, b) => a.sku.skuCode.localeCompare(b.sku.skuCode))
        })
      }
    }
  }
  
  return snapshots.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime() ||
    a.warehouse.name.localeCompare(b.warehouse.name)
  )
}