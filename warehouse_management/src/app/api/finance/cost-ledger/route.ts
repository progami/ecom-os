import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateAllCosts, getBillingPeriod } from '@/lib/calculations/cost-aggregation'
import { startOfWeek, endOfWeek, format, startOfMonth, endOfMonth } from 'date-fns'

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

    // Get all warehouses if not specified
    const warehouses = warehouseId 
      ? [await prisma.warehouse.findUnique({ where: { id: warehouseId } })]
      : await prisma.warehouse.findMany({ where: { isActive: true } })

    // Aggregate costs by period
    const ledger: any[] = []
    const costTotals = {
      storage: 0,
      container: 0,
      pallet: 0,
      carton: 0,
      unit: 0,
      shipment: 0,
      accessorial: 0,
      total: 0
    }

    // Process each warehouse
    for (const warehouse of warehouses) {
      if (!warehouse) continue

      // Get costs for this warehouse
      const costs = await calculateAllCosts(warehouse.id, { start, end })

      // Group costs by period
      const periodMap = new Map<string, any>()

      for (const cost of costs) {
        // Determine period key based on groupBy
        let periodKey: string
        let periodStart: Date
        let periodEnd: Date

        if (groupBy === 'month') {
          const monthStart = startOfMonth(start)
          periodKey = format(monthStart, 'yyyy-MM')
          periodStart = monthStart
          periodEnd = endOfMonth(monthStart)
        } else { // week
          const weekStart = startOfWeek(start, { weekStartsOn: 1 })
          periodKey = format(weekStart, 'yyyy-MM-dd')
          periodStart = weekStart
          periodEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
        }

        if (!periodMap.has(periodKey)) {
          periodMap.set(periodKey, {
            month: groupBy === 'month' ? format(periodStart, 'MMM yyyy') : undefined,
            weekStarting: groupBy === 'week' ? periodStart : undefined,
            weekEnding: groupBy === 'week' ? periodEnd : undefined,
            warehouse: warehouse.name,
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
            details: []
          })
        }

        const period = periodMap.get(periodKey)
        const category = cost.costCategory.toLowerCase() as keyof typeof costTotals
        
        if (category in period.costs && category !== 'total') {
          period.costs[category] += cost.amount
          period.costs.total += cost.amount
          costTotals[category] += cost.amount
          costTotals.total += cost.amount
        }

        // Add detail
        period.details.push({
          transactionDate: new Date(),
          transactionId: 'N/A',
          transactionType: cost.details?.[0]?.transactionType || 'N/A',
          warehouse: warehouse.name,
          sku: cost.details?.[0]?.skuCode || cost.costName,
          batchLot: cost.details?.[0]?.batchLot || 'N/A',
          category: cost.costCategory,
          rateDescription: cost.costName,
          quantity: cost.quantity,
          rate: cost.unitRate,
          cost: cost.amount
        })
      }

      // Add periods to ledger
      ledger.push(...Array.from(periodMap.values()))
    }

    // Sort ledger by date
    ledger.sort((a, b) => {
      if (groupBy === 'month') {
        return new Date(a.month).getTime() - new Date(b.month).getTime()
      } else {
        return new Date(a.weekStarting).getTime() - new Date(b.weekStarting).getTime()
      }
    })

    return NextResponse.json({
      ledger,
      totals: costTotals,
      groupBy,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    })
  } catch (error) {
    console.error('Cost ledger error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch cost ledger',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}