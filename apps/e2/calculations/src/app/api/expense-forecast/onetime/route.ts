import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/utils/database'
import logger from '@/utils/logger'
import { CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts'

// GET - Fetch one-time expenses for a year
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    
    // Get active strategy
    const activeStrategy = await prisma.budgetStrategy.findFirst({
      where: { isActive: true }
    })
    
    if (!activeStrategy) {
      return NextResponse.json({ expenses: [] })
    }
    
    // Fetch one-time expenses for the year
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59)
    
    const expenses = await prisma.expense.findMany({
      where: {
        strategyId: activeStrategy.id,
        type: 'onetime',
        isRecurring: false,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'desc' }
    })
    
    return NextResponse.json({ expenses })
  } catch (error) {
    logger.error('Error fetching one-time expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch one-time expenses' },
      { status: 500 }
    )
  }
}

// POST - Create a new one-time expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, description, category, amount, strategyId } = body
    
    // Get active strategy if not provided
    let activeStrategyId = strategyId
    if (!activeStrategyId) {
      const activeStrategy = await prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      })
      if (!activeStrategy) {
        return NextResponse.json(
          { error: 'No active strategy found' },
          { status: 400 }
        )
      }
      activeStrategyId = activeStrategy.id
    }
    
    // Convert date string to Date object
    const expenseDate = new Date(date)
    
    // Get week dates for the expense
    const weekStarting = new Date(expenseDate)
    weekStarting.setUTCDate(expenseDate.getUTCDate() - expenseDate.getUTCDay())
    weekStarting.setUTCHours(0, 0, 0, 0)
    
    const weekEnding = new Date(weekStarting)
    weekEnding.setUTCDate(weekStarting.getUTCDate() + 6)
    weekEnding.setUTCHours(23, 59, 59, 999)
    
    // Get account information
    const account = CHART_OF_ACCOUNTS[category]
    if (!account) {
      return NextResponse.json(
        { error: 'Invalid expense category' },
        { status: 400 }
      )
    }
    
    // Create expense and GL entries in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the expense
      const expense = await tx.expense.create({
        data: {
          strategyId: activeStrategyId,
          date: expenseDate,
          weekStarting,
          weekEnding,
          category,
          description,
          amount,
          type: 'onetime',
          isRecurring: false,
          isActual: false,
          isCOGS: false
        }
      })
      
      // Create GL entries (double-entry)
      // Debit: Expense account
      const expenseEntry = await tx.gLEntry.create({
        data: {
          strategyId: activeStrategyId,
          date: expenseDate,
          account: category,
          accountCategory: 'Expense',
          description: `One-time expense: ${description}`,
          debit: amount,
          credit: 0,
          reference: `EXPENSE-${expense.id}`,
          source: 'expense-onetime'
        }
      })
      
      // Credit: Bank account
      const bankEntry = await tx.gLEntry.create({
        data: {
          strategyId: activeStrategyId,
          date: expenseDate,
          account: '1000',
          accountCategory: 'Asset',
          description: `One-time expense: ${description}`,
          debit: 0,
          credit: amount,
          reference: `EXPENSE-${expense.id}`,
          source: 'expense-onetime'
        }
      })
      
      // Link GL entries to expense
      await tx.expenseGLEntry.createMany({
        data: [
          { expenseId: expense.id, glEntryId: expenseEntry.id },
          { expenseId: expense.id, glEntryId: bankEntry.id }
        ]
      })
      
      return expense
    })
    
    return NextResponse.json({ expense: result })
  } catch (error) {
    logger.error('Error creating one-time expense:', error)
    return NextResponse.json(
      { error: 'Failed to create one-time expense' },
      { status: 500 }
    )
  }
}