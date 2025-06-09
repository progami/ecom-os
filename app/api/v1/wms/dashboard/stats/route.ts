import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current month date range
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    // Get previous month for comparison
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Fetch current stats
    const [
      totalInventory,
      storageCost,
      activeSkus,
      pendingInvoices,
      overdueInvoices,
      lastMonthInventory,
      lastMonthCost
    ] = await Promise.all([
      // Current inventory
      prisma.wmsInventoryBalance.aggregate({
        _sum: { currentCartons: true }
      }),
      // Current month storage cost
      prisma.wmsStorageLedger.aggregate({
        where: {
          weekEndingDate: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        _sum: { calculatedWeeklyCost: true }
      }),
      // Active SKUs (with inventory)
      prisma.wmsInventoryBalance.count({
        where: { currentCartons: { gt: 0 } }
      }),
      // Pending invoices
      prisma.wmsInvoice.count({
        where: { status: 'pending' }
      }),
      // Overdue invoices (older than 30 days)
      prisma.wmsInvoice.count({
        where: {
          status: 'pending',
          dueDate: {
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      // Last month inventory for comparison
      prisma.wmsInventoryTransaction.aggregate({
        where: {
          transactionDate: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        },
        _sum: { cartonsIn: true, cartonsOut: true }
      }),
      // Last month storage cost
      prisma.wmsStorageLedger.aggregate({
        where: {
          weekEndingDate: {
            gte: startOfLastMonth,
            lte: endOfLastMonth
          }
        },
        _sum: { calculatedWeeklyCost: true }
      })
    ])

    // Calculate trends
    const currentInv = totalInventory._sum.currentCartons || 0
    const lastInv = Math.abs((lastMonthInventory._sum?.cartonsIn || 0) - (lastMonthInventory._sum?.cartonsOut || 0) || 1)
    const inventoryChange = ((currentInv - lastInv) / lastInv * 100).toFixed(1)
    
    const currentCost = Number(storageCost._sum.calculatedWeeklyCost || 0)
    const lastCost = Number(lastMonthCost._sum.calculatedWeeklyCost || 1)
    const costChange = ((currentCost - lastCost) / lastCost * 100).toFixed(1)

    return NextResponse.json({
      totalInventory: currentInv,
      storageCost: currentCost.toFixed(2),
      activeSkus,
      pendingInvoices,
      overdueInvoices,
      inventoryTrend: parseFloat(inventoryChange) >= 0 ? 'up' : 'down',
      inventoryChange: Math.abs(parseFloat(inventoryChange)),
      costTrend: parseFloat(costChange) >= 0 ? 'up' : 'down',
      costChange: Math.abs(parseFloat(costChange))
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}