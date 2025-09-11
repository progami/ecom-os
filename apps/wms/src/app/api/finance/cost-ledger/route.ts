import { withAuth, ApiResponses } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request, _session) => {

    const searchParams = request.nextUrl.searchParams
    const groupBy = searchParams.get('groupBy') || 'week'
    const warehouseCode = searchParams.get('warehouseCode')
    
    // Parse dates properly - ensure we cover the full day in the user's timezone
    const startDateStr = searchParams.get('startDate') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDateStr = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    
    // Create dates at start and end of day in UTC
    const startDate = new Date(startDateStr)
    startDate.setUTCHours(0, 0, 0, 0)
    
    const endDate = new Date(endDateStr)
    endDate.setUTCHours(23, 59, 59, 999)

    // Build where clause
    const where: Prisma.CostLedgerWhereInput = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }

    if (warehouseCode) {
      where.warehouseCode = warehouseCode
    }
    

    // Fetch cost ledger entries with transaction details
    const costEntries = await prisma.costLedger.findMany({
      where,
      include: {
        transaction: {
          select: {
            transactionType: true,
            warehouseCode: true,
            warehouseName: true,
            skuCode: true,
            skuDescription: true,
            batchLot: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Group by week or month
    const groupedData = new Map<string, { period: string; costs: Record<string, number> }>()
    
    costEntries.forEach(entry => {
      const date = new Date(entry.createdAt)
      let key: string
      let weekStarting: Date
      let weekEnding: Date

      if (groupBy === 'week') {
        weekStarting = startOfWeek(date, { weekStartsOn: 1 }) // Monday
        weekEnding = endOfWeek(date, { weekStartsOn: 1 })
        key = weekStarting.toISOString()
      } else {
        weekStarting = startOfMonth(date)
        weekEnding = endOfMonth(date)
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }

      if (!groupedData.has(key)) {
        groupedData.set(key, {
          weekStarting: weekStarting.toISOString(),
          weekEnding: weekEnding.toISOString(),
          costs: {
            container: 0,
            pallet: 0,
            carton: 0,
            unit: 0,
            transportation: 0,
            accessorial: 0
          },
          transactions: [],
          details: []
        })
      }

      const group = groupedData.get(key)
      
      // Map cost categories
      const category = entry.costCategory.toLowerCase()
      if (category in group.costs) {
        group.costs[category] += Number(entry.totalCost)
      }

      // Track transaction
      if (!group.transactions.includes(entry.transactionId)) {
        group.transactions.push(entry.transactionId)
      }

      // Add detail for expanded view
      group.details.push({
        transactionId: entry.transactionId,
        transactionDate: entry.createdAt,
        transactionType: entry.transaction?.transactionType || 'UNKNOWN',
        warehouse: entry.transaction?.warehouseName || entry.warehouseCode,
        sku: entry.transaction?.skuCode || '',
        batchLot: entry.transaction?.batchLot || '',
        costCategory: entry.costCategory,
        costName: entry.costName,
        quantity: Number(entry.quantity) || 0,
        unitRate: Number(entry.unitRate) || 0,
        totalCost: Number(entry.totalCost) || 0
      })
    })

    // Convert to array, calculate totals per week, and sort
    const ledgerData = Array.from(groupedData.values())
      .map(week => {
        // Calculate total for each week/month
        const total = Object.values(week.costs).reduce((sum: number, cost: number) => sum + (cost || 0), 0)
        return {
          ...week,
          costs: {
            ...week.costs,
            total
          }
        }
      })
      .sort((a, b) => new Date(a.weekStarting).getTime() - new Date(b.weekStarting).getTime())

    // Calculate totals
    const totals = {
      container: 0,
      pallet: 0,
      carton: 0,
      unit: 0,
      transportation: 0,
      accessorial: 0,
      total: 0
    }

    ledgerData.forEach(week => {
      Object.keys(week.costs).forEach(key => {
        if (key !== 'total') {
          totals[key as keyof typeof totals] += week.costs[key]
        }
      })
      totals.total += week.costs.total
    })

    return ApiResponses.success({
      ledgerData,
      totals
    })
})