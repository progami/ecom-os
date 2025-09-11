import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/utils/database'

export async function GET(request: NextRequest) {
  try {
    const activeStrategy = await prisma.budgetStrategy.findFirst({
      where: { isActive: true }
    })
    
    return NextResponse.json({ 
      strategy: activeStrategy 
    })
  } catch (error) {
    console.error('Error fetching active strategy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch active strategy' },
      { status: 500 }
    )
  }
}