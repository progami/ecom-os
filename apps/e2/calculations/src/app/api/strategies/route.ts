import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/utils/database'

// GET all strategies
export async function GET() {
  try {
    const strategies = await prisma.budgetStrategy.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { name: 'asc' } // Alphabetical order - consistent and predictable
    })
    
    // Get all counts in parallel batches for better performance
    const strategyIds = strategies.map(s => s.id)
    
    const [unitSalesCounts, expensesCounts] = await Promise.all([
      prisma.unitSales.groupBy({
        by: ['strategyId'],
        where: { strategyId: { in: strategyIds } },
        _count: true
      }),
      prisma.expense.groupBy({
        by: ['strategyId'],
        where: { strategyId: { in: strategyIds } },
        _count: true
      })
    ])
    
    // Create lookup maps for counts
    const unitSalesCountMap = new Map(unitSalesCounts.map(c => [c.strategyId, c._count]))
    const expensesCountMap = new Map(expensesCounts.map(c => [c.strategyId, c._count]))
    
    // Add counts to strategies
    const strategiesWithCounts = strategies.map(strategy => ({
      ...strategy,
      _count: {
        unitSales: unitSalesCountMap.get(strategy.id) || 0,
        expenses: expensesCountMap.get(strategy.id) || 0
      }
    }))
    
    const response = NextResponse.json(strategiesWithCounts)
    
    // Add cache headers - cache for 1 minute
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30')
    
    return response
  } catch (error) {
    console.error('Error fetching strategies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch strategies' },
      { status: 500 }
    )
  }
}

// POST save current state as new strategy or update existing
export async function POST(request: NextRequest) {
  try {
    const { name, description, copyFromActive = true, isActive = false } = await request.json()
    
    if (!name) {
      return NextResponse.json(
        { error: 'Strategy name is required' },
        { status: 400 }
      )
    }
    
    // Get or create the strategy
    let strategy = await prisma.budgetStrategy.findUnique({
      where: { name }
    })
    
    if (strategy) {
      // Update existing strategy
      strategy = await prisma.budgetStrategy.update({
        where: { name },
        data: {
          description,
          updatedAt: new Date()
        }
      })
    } else {
      // Create new strategy
      strategy = await prisma.budgetStrategy.create({
        data: {
          name,
          description,
          isActive: false  // Always create as inactive, will activate later if requested
        }
      })
      
      // If copyFromActive is true, copy data from active strategy
      if (copyFromActive) {
        const activeStrategy = await prisma.budgetStrategy.findFirst({
          where: { isActive: true }
        })
        
        if (activeStrategy) {
          // Copy unit sales from active strategy
          const activeUnitSales = await prisma.unitSales.findMany({
            where: { strategyId: activeStrategy.id }
          })
          
          if (activeUnitSales.length > 0 && strategy) {
            await prisma.unitSales.createMany({
              data: activeUnitSales.map(sale => ({
                weekStarting: sale.weekStarting,
                weekEnding: sale.weekEnding,
                sku: sale.sku,
                units: sale.units,
                revenue: sale.revenue,
                metadata: sale.metadata || undefined,
                isActual: sale.isActual,
                reconciledAt: sale.reconciledAt,
                strategyId: strategy!.id
              }))
            })
          }
          
          // Copy expenses from active strategy
          const activeExpenses = await prisma.expense.findMany({
            where: { 
              strategyId: activeStrategy.id,
              isCOGS: false // Only copy non-COGS expenses
            }
          })
          
          if (activeExpenses.length > 0 && strategy) {
            await prisma.expense.createMany({
              data: activeExpenses.map(expense => ({
                date: expense.date,
                weekStarting: expense.weekStarting,
                weekEnding: expense.weekEnding,
                category: expense.category,
                subcategory: expense.subcategory,
                description: expense.description,
                amount: expense.amount,
                type: expense.type,
                vendor: expense.vendor,
                invoiceNumber: expense.invoiceNumber,
                metadata: expense.metadata || undefined,
                isRecurring: expense.isRecurring,
                recurringFreq: expense.recurringFreq,
                isActual: expense.isActual,
                isCOGS: expense.isCOGS,
                sku: expense.sku,
                quantity: expense.quantity,
                unitCost: expense.unitCost,
                originalForecast: expense.originalForecast,
                reconciledAt: expense.reconciledAt,
                strategyId: strategy!.id,
                unitSalesId: null // Clear COGS linkage
              }))
            })
          }
        }
      }
    }
    
    // If isActive is true, activate this strategy
    if (isActive && strategy) {
      await prisma.$transaction([
        prisma.budgetStrategy.updateMany({
          where: { isActive: true },
          data: { isActive: false }
        }),
        prisma.budgetStrategy.update({
          where: { id: strategy.id },
          data: { isActive: true }
        })
      ])
    }
    
    return NextResponse.json({
      success: true,
      strategy: strategy ? {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        isActive: isActive || strategy.isActive
      } : null
    })
  } catch (error: any) {
    console.error('Error saving strategy:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save strategy' },
      { status: 500 }
    )
  }
}

// PUT activate a strategy
export async function PUT(request: NextRequest) {
  try {
    const { strategyId } = await request.json()
    
    if (!strategyId) {
      return NextResponse.json(
        { error: 'Strategy ID is required' },
        { status: 400 }
      )
    }
    
    // Check strategy exists
    const strategy = await prisma.budgetStrategy.findUnique({
      where: { id: strategyId }
    })
    
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      )
    }
    
    // Deactivate all strategies and activate the selected one
    await prisma.$transaction([
      prisma.budgetStrategy.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      }),
      prisma.budgetStrategy.update({
        where: { id: strategyId },
        data: { isActive: true }
      })
    ])
    
    // No need to delete GL entries - they are linked to specific strategy data
    // The GL view will automatically filter to show only the active strategy's entries
    
    return NextResponse.json({
      success: true,
      message: `Activated strategy: ${strategy.name}`
    })
  } catch (error: any) {
    console.error('Error activating strategy:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to activate strategy' },
      { status: 500 }
    )
  }
}

// DELETE a strategy
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const strategyId = searchParams.get('id')
    
    if (!strategyId) {
      return NextResponse.json(
        { error: 'Strategy ID is required' },
        { status: 400 }
      )
    }
    
    // Don't allow deleting active strategy
    const strategy = await prisma.budgetStrategy.findUnique({
      where: { id: strategyId }
    })
    
    if (strategy?.isActive) {
      return NextResponse.json(
        { error: 'Cannot delete active strategy. Please activate another strategy first.' },
        { status: 400 }
      )
    }
    
    // Delete strategy (cascade will delete related data)
    await prisma.budgetStrategy.delete({
      where: { id: strategyId }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Strategy deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting strategy:', error)
    return NextResponse.json(
      { error: 'Failed to delete strategy' },
      { status: 500 }
    )
  }
}