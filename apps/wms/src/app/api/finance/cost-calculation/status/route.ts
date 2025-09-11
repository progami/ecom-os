import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limiter'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(request, rateLimitConfigs.api)
    if (rateLimitResponse) return rateLimitResponse

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '7')
    const warehouseId = searchParams.get('warehouseId')

    // Check warehouse access for staff users
    if (session.user.role === 'staff' && session.user.warehouseId) {
      if (warehouseId && warehouseId !== session.user.warehouseId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const startDate = startOfDay(subDays(new Date(), days))
    const endDate = endOfDay(new Date())

    // Build where clause
    const where: Prisma.CostLedgerWhereInput = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }

    if (warehouseId) {
      where.warehouseId = warehouseId
    } else if (session.user.role === 'staff' && session.user.warehouseId) {
      where.warehouseId = session.user.warehouseId
    }

    // Get cost calculation statistics - commented out as calculatedCost model no longer exists
    // const [
    //   totalCalculations,
    //   transactionCosts,
    //   storageCosts,
    //   recentCalculations
    // ] = await Promise.all([
    //   // Total calculated costs
    //   prisma.calculatedCost.count({ where }),
    //   
    //   // Transaction-based costs (RECEIVE, SHIP, etc.)
    //   prisma.calculatedCost.groupBy({
    //     by: ['transactionType'],
    //     where: {
    //       ...where,
    //       transactionType: { not: 'STORAGE' }
    //     },
    //     _count: { id: true },
    //     _sum: { calculatedCost: true }
    //   }),
    //   
    //   // Storage costs
    //   prisma.calculatedCost.aggregate({
    //     where: {
    //       ...where,
    //       transactionType: 'STORAGE'
    //     },
    //     _count: { id: true },
    //     _sum: { calculatedCost: true }
    //   }),
    //   
    //   // Recent calculations
    //   prisma.calculatedCost.findMany({
    //     where,
    //     include: {
    //       warehouse: { select: { name: true, code: true } },
    //       sku: { select: { skuCode: true, description: true } },
    //       costRate: { select: { costCategory: true, costName: true } }
    //     },
    //     orderBy: { createdAt: 'desc' },
    //     take: 10
    //   })
    // ])
    
    const totalCalculations = 0
    const transactionCosts: unknown[] = []
    const storageCosts = { _count: { id: 0 }, _sum: { calculatedCost: 0 } }
    const recentCalculations: unknown[] = []

    // Get pending calculations count
    // Since the trigger function doesn't exist, return 0 for now
    const pendingCount = 0

    // Get storage ledger statistics
    const storageLedgerStats = await prisma.storageLedger.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...(warehouseId ? { warehouseId } : {})
      },
      _count: { id: true },
      _sum: { 
        averageBalance: true
      }
    })

    // Format the response
    const stats = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days
      },
      summary: {
        totalCalculations,
        pendingCalculations: pendingCount,
        totalCostAmount: [
          ...transactionCosts.map(t => Number(t._sum.calculatedCost || 0)),
          Number(storageCosts._sum.calculatedCost || 0)
        ].reduce((sum, val) => sum + val, 0)
      },
      transactionCosts: transactionCosts.map(tc => ({
        type: tc.transactionType,
        count: tc._count.id,
        totalCost: Number(tc._sum.calculatedCost || 0)
      })),
      storageCosts: {
        count: storageCosts._count.id,
        totalCost: Number(storageCosts._sum.calculatedCost || 0),
        ledgerEntries: storageLedgerStats._count.id,
        totalPalletsCharged: 0,
        totalWeeklyCost: Number(storageLedgerStats._sum.averageBalance || 0) * 0.5
      },
      recentCalculations: recentCalculations.map(calc => ({
        id: calc.id,
        calculatedCostId: calc.calculatedCostId,
        transactionType: calc.transactionType,
        warehouse: calc.warehouse.name,
        sku: calc.sku.skuCode,
        costCategory: calc.costRate.costCategory,
        costName: calc.costRate.costName,
        quantity: Number(calc.quantityCharged),
        rate: Number(calc.applicableRate),
        cost: Number(calc.calculatedCost),
        createdAt: calc.createdAt
      }))
    }

    return NextResponse.json(stats)
  } catch (_error) {
    // console.error('Error fetching cost calculation status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cost calculation status' },
      { status: 500 }
    )
  }
}