import { withAuth, ApiResponses } from '@/lib/api'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

interface DashboardStatsResponse {
  totalInventory: number
  inventoryChange: string
  inventoryTrend: 'up' | 'down' | 'neutral'
  storageCost: string
  costChange: string
  costTrend: 'up' | 'down' | 'neutral'
  activeSkus: number
  pendingInvoices: number
  overdueInvoices: number
  chartData: {
    inventoryTrend: Array<{ date: string; inventory: number }>
    costTrend: Array<{ date: string; cost: number }>
    warehouseDistribution: Array<{ name: string | null; value: number; percentage: number }>
  }
}

export const GET = withAuth<DashboardStatsResponse>(async (request, session) => {
  if (!prisma) {
    // console.error('Prisma client is undefined!')
    return ApiResponses.serverError('Database connection error')
  }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const _timeRange = searchParams.get('timeRange') || 'yearToDate'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    
    // Get current date info
    const now = new Date()

    // Check if user has warehouse restriction
    let warehouseFilter: { warehouseCode?: string } = {}
    if (session.user.warehouseId) {
      // Get warehouse code for the user's warehouse
      const userWarehouse = await prisma.warehouse.findUnique({
        where: { id: session.user.warehouseId },
        select: { code: true }
      })
      if (userWarehouse) {
        warehouseFilter = { warehouseCode: userWarehouse.code }
      }
    }
    // No exclusions - show all warehouses

    // Calculate total inventory from transactions
    const inventoryStats = await prisma.inventoryTransaction.aggregate({
      where: warehouseFilter,
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
    })
    const currentInventory = (inventoryStats._sum.cartonsIn || 0) - (inventoryStats._sum.cartonsOut || 0)

    // Calculate inventory change from last month
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    lastMonthEnd.setHours(23, 59, 59, 999)
    
    // Get transactions to calculate last month's ending balance
    const transactionsUpToLastMonth = await prisma.inventoryTransaction.aggregate({
      where: {
        transactionDate: {
          lte: lastMonthEnd,
        },
        ...warehouseFilter,
      },
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
    })
    
    const lastMonthInventory = (transactionsUpToLastMonth._sum.cartonsIn || 0) - 
                              (transactionsUpToLastMonth._sum.cartonsOut || 0)
    
    const inventoryChange = lastMonthInventory > 0 
      ? ((currentInventory - lastMonthInventory) / lastMonthInventory) * 100 
      : 0

    // Get storage costs from cost ledger (simplified calculation)
    // Sum all storage costs for the current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    const storageCosts = await prisma.costLedger.aggregate({
      where: {
        costCategory: 'Storage',
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        ...warehouseFilter,
      },
      _sum: {
        totalCost: true,
      },
    })
    
    const currentCost = Number(storageCosts._sum.totalCost || 0)

    // Get last month's costs
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    
    const lastPeriodCosts = await prisma.costLedger.aggregate({
      where: {
        costCategory: 'Storage',
        createdAt: {
          gte: prevMonthStart,
          lte: prevMonthEnd,
        },
        ...warehouseFilter,
      },
      _sum: {
        totalCost: true,
      },
    })
    
    const lastCost = Number(lastPeriodCosts._sum.totalCost || 0)
    const costChange = lastCost > 0 
      ? ((currentCost - lastCost) / lastCost) * 100 
      : 0

    // Active SKUs count - count unique SKUs with positive balance
    const activeSkusGroup = await prisma.inventoryTransaction.groupBy({
      by: ['skuCode'],
      where: warehouseFilter,
      _sum: {
        cartonsIn: true,
        cartonsOut: true
      }
    })
    const activeSkus = activeSkusGroup.filter(sku => 
      (sku._sum.cartonsIn || 0) - (sku._sum.cartonsOut || 0) > 0
    )
    const activeSkusCount = activeSkus.length

    // Pending invoices count (set to 0 since Invoice model doesn't exist)
    const pendingInvoices = 0

    // Overdue invoices (set to 0 since Invoice model doesn't exist)
    const overdueInvoices = 0

    // Chart Data: Inventory Trend - use selected date range
    let trendStartDate: Date
    let trendEndDate: Date
    
    if (startDateParam && endDateParam) {
      // Use provided date range
      trendStartDate = new Date(startDateParam)
      trendEndDate = new Date(endDateParam)
    } else {
      // Default to last 30 days
      trendStartDate = new Date()
      trendStartDate.setDate(trendStartDate.getDate() - 30)
      trendEndDate = new Date()
    }
    
    // Ensure we capture full days
    trendStartDate.setHours(0, 0, 0, 0)
    trendEndDate.setHours(23, 59, 59, 999)
    
    // Always extend 14 days into the future for better rendering
    const extendedEndDate = new Date(trendEndDate)
    extendedEndDate.setDate(extendedEndDate.getDate() + 14)
    
    // Get daily inventory snapshots (including any future transactions)
    const inventoryTrendData = await prisma.inventoryTransaction.groupBy({
      by: ['transactionDate'],
      where: {
        transactionDate: {
          gte: trendStartDate,
          lte: extendedEndDate,
        },
        ...warehouseFilter,
      },
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
      orderBy: {
        transactionDate: 'asc',
      },
    })

    // Calculate running balance for each day
    const inventoryTrend: Array<{ date: string; inventory: number }> = []
    let runningBalance = 0
    
    // Get initial balance before the selected period
    const initialBalanceData = await prisma.inventoryTransaction.aggregate({
      where: {
        transactionDate: {
          lt: trendStartDate,
        },
        ...warehouseFilter,
      },
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
    })
    
    runningBalance = (initialBalanceData._sum.cartonsIn || 0) - (initialBalanceData._sum.cartonsOut || 0)
    
    // Create a map of dates with transactions
    const transactionMap = new Map<string, { in: number; out: number }>()
    inventoryTrendData.forEach(item => {
      // Use UTC date parts since transactions are stored in UTC
      const date = new Date(item.transactionDate)
      const dateKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
      
      // Accumulate transactions for the same date
      const existing = transactionMap.get(dateKey)
      if (existing) {
        transactionMap.set(dateKey, {
          in: (existing.in || 0) + (item._sum.cartonsIn || 0),
          out: (existing.out || 0) + (item._sum.cartonsOut || 0),
        })
      } else {
        transactionMap.set(dateKey, {
          in: item._sum.cartonsIn || 0,
          out: item._sum.cartonsOut || 0,
        })
      }
    })
    
    // Log today's transactions for debugging
    const today = new Date()
    const _todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    // Fill in all days including those without transactions (plus 14 days future)
    const currentDate = new Date(trendStartDate)
    
    while (currentDate <= extendedEndDate) {
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
      const dayTransactions = transactionMap.get(dateKey)
      
      if (dayTransactions) {
        runningBalance += dayTransactions.in - dayTransactions.out
      }
      
      inventoryTrend.push({
        date: currentDate.toISOString(), // Send full ISO string with timezone
        inventory: Math.max(0, runningBalance),
      })
      
      // Move to next day - create new date to avoid mutation issues
      currentDate.setTime(currentDate.getTime() + 24 * 60 * 60 * 1000)
    }

    // Chart Data: Cost Trend (simplified - last 12 weeks)
    const costTrend: Array<{ date: string; cost: number }> = []
    
    // Generate weekly cost data
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - (i * 7))
      weekStart.setHours(0, 0, 0, 0)
      
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
      
      const weekCosts = await prisma.costLedger.aggregate({
        where: {
          costCategory: 'Storage',
          createdAt: {
            gte: weekStart,
            lte: weekEnd,
          },
          ...warehouseFilter,
        },
        _sum: {
          totalCost: true,
        },
      })
      
      costTrend.push({
        date: weekStart.toISOString().split('T')[0],
        cost: Number(weekCosts._sum?.totalCost || 0),
      })
    }
    
    // If no cost data, create empty array with proper structure
    if (costTrend.length === 0) {
      for (let i = 1; i <= 12; i++) {
        costTrend.push({ date: `Week ${i}`, cost: 0 })
      }
    }

    // Chart Data: Warehouse Distribution
    const warehouseInventory = await prisma.inventoryTransaction.groupBy({
      by: ['warehouseCode', 'warehouseName'],
      where: warehouseFilter,
      _sum: {
        cartonsIn: true,
        cartonsOut: true,
      },
    })
    
    const totalCartons = warehouseInventory.reduce((sum, w) => 
      sum + ((w._sum.cartonsIn || 0) - (w._sum.cartonsOut || 0)), 0)
    
    const warehouseDistribution = warehouseInventory
      .map(w => {
        const balance = (w._sum.cartonsIn || 0) - (w._sum.cartonsOut || 0)
        return {
          name: w.warehouseName,
          value: balance,
          percentage: totalCartons > 0 ? (balance / totalCartons) * 100 : 0,
        }
      })
      .filter(w => w.value > 0)
      .sort((a, b) => b.value - a.value)

    return ApiResponses.success<DashboardStatsResponse>({
      totalInventory: currentInventory,
      inventoryChange: inventoryChange.toFixed(1),
      inventoryTrend: inventoryChange > 0 ? 'up' : inventoryChange < 0 ? 'down' : 'neutral',
      storageCost: currentCost.toFixed(2),
      costChange: costChange.toFixed(1),
      costTrend: costChange > 0 ? 'up' : costChange < 0 ? 'down' : 'neutral',
      activeSkus: activeSkusCount,
      pendingInvoices,
      overdueInvoices,
      chartData: {
        inventoryTrend,
        costTrend,
        warehouseDistribution,
      },
    })
})
