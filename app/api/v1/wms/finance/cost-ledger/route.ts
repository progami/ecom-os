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

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const warehouseId = searchParams.get('warehouseId')
    const groupBy = searchParams.get('groupBy') || 'week' // week, month, warehouse, sku

    // Default to last 3 months if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    // Set time to end of day for end date
    end.setHours(23, 59, 59, 999)

    // Get all transactions with their calculated costs
    const transactions = await prisma.wmsInventoryTransaction.findMany({
      where: {
        transactionDate: {
          gte: start,
          lte: end
        },
        ...(warehouseId && { warehouseId })
      },
      include: {
        warehouse: true,
        sku: true,
        calculatedCosts: {
          include: {
            costRate: true
          }
        }
      },
      orderBy: {
        transactionDate: 'desc'
      }
    })

    // Get storage ledger entries
    const storageLedger = await prisma.wmsStorageLedger.findMany({
      where: {
        weekEndingDate: {
          gte: start,
          lte: end
        },
        ...(warehouseId && { warehouseId })
      },
      include: {
        warehouse: true,
        sku: true
      }
    })

    // Aggregate costs by week
    const costsByWeek = new Map<string, any>()

    // Process transaction costs
    for (const transaction of transactions) {
      const weekKey = getWeekKey(new Date(transaction.transactionDate))
      
      if (!costsByWeek.has(weekKey)) {
        costsByWeek.set(weekKey, {
          weekStarting: getWeekStartDate(new Date(transaction.transactionDate)),
          weekEnding: getWeekEndDate(new Date(transaction.transactionDate)),
          costs: {
            storage: 0,
            container: 0,
            pallet: 0,
            carton: 0,
            unit: 0,
            shipment: 0,
            accessorial: 0,
            total: 0
          },
          transactions: [],
          details: []
        })
      }

      const weekData = costsByWeek.get(weekKey)
      
      // Add calculated costs
      for (const cost of transaction.calculatedCosts) {
        const category = cost.costRate.category.toLowerCase()
        if (weekData.costs[category] !== undefined) {
          weekData.costs[category] += Number(cost.calculatedCost)
          weekData.costs.total += Number(cost.calculatedCost)
        }

        weekData.details.push({
          transactionId: transaction.transactionId,
          transactionDate: transaction.transactionDate,
          transactionType: transaction.transactionType,
          warehouse: transaction.warehouse.name,
          sku: transaction.sku.skuCode,
          batchLot: transaction.batchLot,
          category: cost.costRate.category,
          rate: cost.costRate.rate,
          quantity: cost.quantity,
          cost: Number(cost.calculatedCost),
          rateDescription: cost.costRate.description
        })
      }

      weekData.transactions.push({
        id: transaction.id,
        transactionId: transaction.transactionId,
        type: transaction.transactionType,
        date: transaction.transactionDate
      })
    }

    // Add storage costs from storage ledger
    for (const entry of storageLedger) {
      const weekKey = getWeekKey(new Date(entry.weekEndingDate))
      
      if (!costsByWeek.has(weekKey)) {
        costsByWeek.set(weekKey, {
          weekStarting: getWeekStartDate(new Date(entry.weekEndingDate)),
          weekEnding: getWeekEndDate(new Date(entry.weekEndingDate)),
          costs: {
            storage: 0,
            container: 0,
            pallet: 0,
            carton: 0,
            unit: 0,
            shipment: 0,
            accessorial: 0,
            total: 0
          },
          transactions: [],
          details: []
        })
      }

      const weekData = costsByWeek.get(weekKey)
      weekData.costs.storage += Number(entry.calculatedWeeklyCost)
      weekData.costs.total += Number(entry.calculatedWeeklyCost)

      weekData.details.push({
        transactionId: `STORAGE-${entry.id}`,
        transactionDate: entry.weekEndingDate,
        transactionType: 'STORAGE',
        warehouse: entry.warehouse.name,
        sku: entry.sku.skuCode,
        batchLot: entry.batchLot,
        category: 'STORAGE',
        rate: Number(entry.applicableWeeklyRate),
        quantity: entry.storagePalletsCharged,
        cost: Number(entry.calculatedWeeklyCost),
        rateDescription: 'Weekly storage per pallet'
      })
    }

    // Convert map to array and sort
    const costLedger = Array.from(costsByWeek.values())
      .sort((a, b) => new Date(b.weekStarting).getTime() - new Date(a.weekStarting).getTime())

    // Calculate totals
    const totals = {
      storage: 0,
      container: 0,
      pallet: 0,
      carton: 0,
      unit: 0,
      shipment: 0,
      accessorial: 0,
      total: 0
    }

    for (const week of costLedger) {
      for (const [category, amount] of Object.entries(week.costs)) {
        totals[category as keyof typeof totals] += amount as number
      }
    }

    // Group by month if requested
    if (groupBy === 'month') {
      const costsByMonth = new Map<string, any>()
      
      for (const week of costLedger) {
        const monthKey = getMonthKey(new Date(week.weekStarting))
        
        if (!costsByMonth.has(monthKey)) {
          costsByMonth.set(monthKey, {
            month: monthKey,
            costs: {
              storage: 0,
              container: 0,
              pallet: 0,
              carton: 0,
              unit: 0,
              shipment: 0,
              accessorial: 0,
              total: 0
            },
            weeks: [],
            details: []
          })
        }

        const monthData = costsByMonth.get(monthKey)
        
        // Add costs
        for (const [category, amount] of Object.entries(week.costs)) {
          monthData.costs[category] += amount
        }
        
        monthData.weeks.push(week)
        monthData.details.push(...week.details)
      }

      return NextResponse.json({
        ledger: Array.from(costsByMonth.values()).sort((a, b) => b.month.localeCompare(a.month)),
        totals,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        groupBy: 'month'
      })
    }

    return NextResponse.json({
      ledger: costLedger,
      totals,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      groupBy: 'week'
    })
  } catch (error) {
    console.error('Cost ledger error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch cost ledger',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper functions
function getWeekKey(date: Date): string {
  const monday = getWeekStartDate(date)
  return monday.toISOString().split('T')[0]
}

function getWeekStartDate(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
  return new Date(d.setDate(diff))
}

function getWeekEndDate(date: Date): Date {
  const start = getWeekStartDate(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return end
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}