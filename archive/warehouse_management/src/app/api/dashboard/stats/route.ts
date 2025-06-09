import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current date info
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Check if user has warehouse restriction
    const warehouseFilter = session.user.warehouseId 
      ? { warehouseId: session.user.warehouseId }
      : {
          warehouse: {
            NOT: {
              OR: [
                { code: 'AMZN' },
                { code: 'AMZN-UK' }
              ]
            }
          }
        }

    // Total inventory
    const inventoryStats = await prisma.inventoryBalance.aggregate({
      where: warehouseFilter,
      _sum: {
        currentCartons: true,
      },
    })
    const currentInventory = inventoryStats._sum.currentCartons || 0

    // Calculate inventory change from last month
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    lastMonthEnd.setHours(23, 59, 59, 999)
    
    // Get transactions to calculate last month's ending balance
    const transactionsUpToLastMonth = await prisma.inventoryTransaction.aggregate({
      where: {
        transactionDate: {
          lte: lastMonthEnd,
        },
        ...(session.user.warehouseId 
          ? { warehouseId: session.user.warehouseId }
          : {
              warehouse: {
                NOT: {
                  OR: [
                    { code: 'AMZN' },
                    { code: 'AMZN-UK' }
                  ]
                }
              }
            }
        ),
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

    // Storage cost estimate for current billing period
    // Billing period is 16th to 15th
    const billingStart = new Date(now)
    if (now.getDate() <= 15) {
      // We're in the period from last month's 16th to this month's 15th
      billingStart.setMonth(billingStart.getMonth() - 1)
    }
    billingStart.setDate(16)
    billingStart.setHours(0, 0, 0, 0)
    
    const billingEnd = new Date(billingStart)
    billingEnd.setMonth(billingEnd.getMonth() + 1)
    billingEnd.setDate(15)
    billingEnd.setHours(23, 59, 59, 999)

    // Get storage costs for current billing period
    const storageCosts = await prisma.calculatedCost.aggregate({
      where: {
        billingPeriodStart: {
          gte: billingStart,
          lte: billingEnd,
        },
        transactionType: 'STORAGE',
        ...(session.user.warehouseId 
          ? { warehouseId: session.user.warehouseId }
          : {
              warehouse: {
                NOT: {
                  OR: [
                    { code: 'AMZN' },
                    { code: 'AMZN-UK' }
                  ]
                }
              }
            }
        ),
      },
      _sum: {
        finalExpectedCost: true,
      },
    })
    
    const currentCost = Number(storageCosts._sum.finalExpectedCost || 0)

    // Get last billing period's costs
    const lastBillingStart = new Date(billingStart)
    lastBillingStart.setMonth(lastBillingStart.getMonth() - 1)
    const lastBillingEnd = new Date(billingEnd)
    lastBillingEnd.setMonth(lastBillingEnd.getMonth() - 1)
    
    const lastPeriodCosts = await prisma.calculatedCost.aggregate({
      where: {
        billingPeriodStart: {
          gte: lastBillingStart,
          lte: lastBillingEnd,
        },
        transactionType: 'STORAGE',
        ...(session.user.warehouseId 
          ? { warehouseId: session.user.warehouseId }
          : {
              warehouse: {
                NOT: {
                  OR: [
                    { code: 'AMZN' },
                    { code: 'AMZN-UK' }
                  ]
                }
              }
            }
        ),
      },
      _sum: {
        finalExpectedCost: true,
      },
    })
    
    const lastCost = Number(lastPeriodCosts._sum.finalExpectedCost || 0)
    const costChange = lastCost > 0 
      ? ((currentCost - lastCost) / lastCost) * 100 
      : 0

    // Active SKUs count
    const activeSkus = await prisma.inventoryBalance.findMany({
      where: {
        ...warehouseFilter,
        currentCartons: {
          gt: 0,
        },
      },
      select: {
        skuId: true,
      },
      distinct: ['skuId'],
    })
    const activeSkusCount = activeSkus.length

    // Pending invoices count
    const pendingInvoices = await prisma.invoice.count({
      where: {
        status: 'pending',
        ...(session.user.warehouseId && {
          OR: [
            { warehouse: { id: session.user.warehouseId } },
            { warehouseId: session.user.warehouseId }
          ]
        })
      },
    })

    // Overdue invoices (pending invoices over 30 days old)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const overdueInvoices = await prisma.invoice.count({
      where: {
        status: 'pending',
        invoiceDate: {
          lt: thirtyDaysAgo,
        },
        ...(session.user.warehouseId && {
          OR: [
            { warehouse: { id: session.user.warehouseId } },
            { warehouseId: session.user.warehouseId }
          ]
        })
      },
    })

    return NextResponse.json({
      totalInventory: currentInventory,
      inventoryChange: inventoryChange.toFixed(1),
      inventoryTrend: inventoryChange > 0 ? 'up' : inventoryChange < 0 ? 'down' : 'neutral',
      storageCost: currentCost.toFixed(2),
      costChange: costChange.toFixed(1),
      costTrend: costChange > 0 ? 'up' : costChange < 0 ? 'down' : 'neutral',
      activeSkus: activeSkusCount,
      pendingInvoices,
      overdueInvoices,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}