import { NextRequest, NextResponse } from 'next/server'
import SharedFinancialDataService from '@/services/database/SharedFinancialDataService'
import logger from '@/utils/logger'

const sharedDataService = SharedFinancialDataService.getInstance()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const quarter = searchParams.get('quarter') ? parseInt(searchParams.get('quarter')!) : null
    
    const expenses = await sharedDataService.getExpenses()
    
    // Filter by year and quarter if specified
    const filteredExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date)
      const expYear = expDate.getFullYear()
      
      if (expYear !== year) return false
      
      if (quarter) {
        const month = expDate.getMonth()
        const expQuarter = Math.floor(month / 3) + 1
        return expQuarter === quarter
      }
      
      return true
    })
    
    // Calculate summary
    const summary = {
      total: filteredExpenses.reduce((sum, exp) => sum + (typeof exp.amount === 'number' ? exp.amount : Number(exp.amount)), 0),
      byCategory: {} as Record<string, number>,
      bySubcategory: {} as Record<string, number>,
      count: filteredExpenses.length
    }
    
    filteredExpenses.forEach(exp => {
      const amount = typeof exp.amount === 'number' ? exp.amount : Number(exp.amount)
      
      // By category
      if (!summary.byCategory[exp.category]) {
        summary.byCategory[exp.category] = 0
      }
      summary.byCategory[exp.category] += amount
      
      // By subcategory
      if (exp.subcategory) {
        const key = `${exp.category} - ${exp.subcategory}`
        if (!summary.bySubcategory[key]) {
          summary.bySubcategory[key] = 0
        }
        summary.bySubcategory[key] += amount
      }
    })
    
    return NextResponse.json(summary)
  } catch (error) {
    logger.error('Error fetching expense summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense summary' },
      { status: 500 }
    )
  }
}