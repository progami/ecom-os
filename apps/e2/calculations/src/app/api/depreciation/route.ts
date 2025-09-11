import { NextRequest, NextResponse } from 'next/server'
import { depreciationService } from '@/services/DepreciationService'
import { prisma } from '@/utils/database'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const quarter = searchParams.get('quarter') ? parseInt(searchParams.get('quarter')!) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
    
    // Get active strategy
    const activeStrategy = await prisma.budgetStrategy.findFirst({
      where: { isActive: true }
    })
    
    if (!activeStrategy) {
      return NextResponse.json({ 
        error: 'No active strategy found',
        depreciation: {
          monthlyDepreciation: 0,
          quarterlyDepreciation: 0,
          yearlyDepreciation: 0,
          assets: []
        }
      }, { status: 404 })
    }
    
    const strategyId = searchParams.get('strategyId') || activeStrategy.id
    
    // Calculate depreciation
    const depreciation = await depreciationService.calculateDepreciation(
      strategyId,
      year,
      quarter,
      month
    )
    
    return NextResponse.json({
      year,
      quarter,
      month,
      strategyId,
      depreciation
    })
  } catch (error) {
    console.error('Error calculating depreciation:', error)
    return NextResponse.json(
      { error: 'Failed to calculate depreciation' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, quarter, month, strategyId: providedStrategyId } = body
    
    if (!year) {
      return NextResponse.json(
        { error: 'Year is required' },
        { status: 400 }
      )
    }
    
    // Get active strategy if not provided
    let strategyId = providedStrategyId
    if (!strategyId) {
      const activeStrategy = await prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      })
      
      if (!activeStrategy) {
        return NextResponse.json(
          { error: 'No active strategy found' },
          { status: 404 }
        )
      }
      
      strategyId = activeStrategy.id
    }
    
    // Create depreciation GL entries
    await depreciationService.createDepreciationEntries(
      strategyId,
      year,
      quarter,
      month
    )
    
    // Return the calculated depreciation
    const depreciation = await depreciationService.calculateDepreciation(
      strategyId,
      year,
      quarter,
      month
    )
    
    return NextResponse.json({
      success: true,
      year,
      quarter,
      month,
      strategyId,
      depreciation
    })
  } catch (error) {
    console.error('Error creating depreciation entries:', error)
    return NextResponse.json(
      { error: 'Failed to create depreciation entries' },
      { status: 500 }
    )
  }
}