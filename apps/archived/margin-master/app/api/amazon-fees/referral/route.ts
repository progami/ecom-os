import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const programCode = searchParams.get('program') || 'FBA'

    // Get unique categories across all countries for the program
    const fees = await prisma.referralFeeNew.findMany({
      include: {
        country: true,
        program: true,
      },
      where: {
        program: {
          code: programCode
        }
      },
      orderBy: [
        { category: 'asc' },
        { effectiveDate: 'desc' },
      ],
    })
    
    // Group by category and get average fees
    const categoryMap = new Map<string, any>()
    
    fees.forEach(fee => {
      if (!categoryMap.has(fee.category)) {
        categoryMap.set(fee.category, {
          id: fee.category,
          category: fee.category,
          percentages: [],
          minimumFees: [],
          currencies: new Set()
        })
      }
      
      const catData = categoryMap.get(fee.category)
      catData.percentages.push(Number(fee.feePercentage))
      catData.minimumFees.push(fee.minimumFee ? Number(fee.minimumFee) : 0.50)
      catData.currencies.add(fee.currency)
    })
    
    const uniqueFees = Array.from(categoryMap.values()).map(cat => ({
      id: cat.id,
      category: cat.category,
      percentage: cat.percentages[0], // All should be same percentage
      minimumFee: Math.min(...cat.minimumFees),
      currency: Array.from(cat.currencies)[0] || 'EUR'
    }))

    return NextResponse.json(uniqueFees)
  } catch (error) {
    console.error('Failed to fetch referral fees:', error)
    return NextResponse.json(
      { error: 'Failed to fetch referral fees' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // In a real app, validate and save to database
    // const fee = await prisma.referralFee.create({ data: body })
    
    return NextResponse.json({ ...body, id: Date.now().toString() })
  } catch (error) {
    console.error('Failed to create referral fee:', error)
    return NextResponse.json(
      { error: 'Failed to create referral fee' },
      { status: 500 }
    )
  }
}