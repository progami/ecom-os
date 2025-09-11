import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/utils/database'
import logger from '@/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const strategyId = searchParams.get('strategyId')
    const reportType = searchParams.get('type') // 'income', 'balance', 'cashflow'
    const periodType = searchParams.get('periodType') // 'monthly', 'quarterly', 'yearly'
    
    // Get active strategy if not provided
    let activeStrategyId = strategyId
    if (!activeStrategyId) {
      const activeStrategy = await prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      })
      if (!activeStrategy) {
        return NextResponse.json({ error: 'No active strategy found' }, { status: 400 })
      }
      activeStrategyId = activeStrategy.id
    }
    
    const where = {
      strategyId: activeStrategyId,
      ...(periodType && { periodType })
    }
    
    let reports = {}
    
    // Fetch requested report types
    if (!reportType || reportType === 'income') {
      const incomeStatements = await prisma.incomeStatement.findMany({
        where,
        orderBy: [{ year: 'asc' }, { quarter: 'asc' }, { month: 'asc' }]
      })
      reports.incomeStatements = incomeStatements
    }
    
    if (!reportType || reportType === 'balance') {
      const balanceSheets = await prisma.balanceSheet.findMany({
        where,
        orderBy: [{ year: 'asc' }, { quarter: 'asc' }, { month: 'asc' }]
      })
      reports.balanceSheets = balanceSheets
    }
    
    if (!reportType || reportType === 'cashflow') {
      const cashFlowStatements = await prisma.cashFlowStatement.findMany({
        where,
        orderBy: [{ year: 'asc' }, { quarter: 'asc' }, { month: 'asc' }]
      })
      reports.cashFlowStatements = cashFlowStatements
    }
    
    return NextResponse.json(reports)
    
  } catch (error) {
    logger.error('Error fetching financial reports:', error)
    return NextResponse.json(
      { error: 'Failed to fetch financial reports' },
      { status: 500 }
    )
  }
}