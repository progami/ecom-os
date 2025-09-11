import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Updated interface to match frontend expectations
interface StorageFee {
  id: string;
  category: string;
  monthlyFee: number;
  peakMonthlyFee: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const programCode = searchParams.get('program') || 'FBA'

    // For storage fees, we'll return a combined view across all countries
    const fees = await prisma.storageFeeNew.findMany({
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
        { country: { code: 'asc' } },
        { periodType: 'asc' },
        { standardSizeFee: 'desc' },
      ],
    })

    // Transform database data to match frontend expectations
    const transformedFees: StorageFee[] = []
    
    // Group by period and size to show consolidated view
    const periodGroups: Record<string, any[]> = {}
    
    fees.forEach(fee => {
      const period = fee.periodType === 'OFF_PEAK' ? 'Jan-Sep' : 'Oct-Dec'
      const country = fee.country.code
      const currency = fee.currency
      
      const key = `${period}-standard`
      if (!periodGroups[key]) {
        periodGroups[key] = []
      }
      periodGroups[key].push({
        country,
        currency,
        fee: Number(fee.standardSizeFee)
      })
      
      const oversizeKey = `${period}-oversize`
      if (!periodGroups[oversizeKey]) {
        periodGroups[oversizeKey] = []
      }
      periodGroups[oversizeKey].push({
        country,
        currency,
        fee: Number(fee.oversizeFee)
      })
    })
    
    // Create summary rows
    Object.entries(periodGroups).forEach(([key, countries]) => {
      const [period, size] = key.split('-')
      const avgFee = countries.reduce((sum, c) => sum + c.fee, 0) / countries.length
      
      transformedFees.push({
        id: key,
        category: `${size === 'standard' ? 'Standard Size' : 'Oversize'} - ${period}`,
        monthlyFee: avgFee,
        peakMonthlyFee: avgFee,
      })
    })
    
    return NextResponse.json(transformedFees)
  } catch (error) {
    console.error('Failed to fetch storage fees:', error)
    return NextResponse.json(
      { error: 'Failed to fetch storage fees' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // In a real app, validate and save to database
    // const fee = await prisma.storageFee.create({ data: body })
    
    return NextResponse.json({ ...body, id: Date.now().toString() })
  } catch (error) {
    console.error('Failed to create storage fee:', error)
    return NextResponse.json(
      { error: 'Failed to create storage fee' },
      { status: 500 }
    )
  }
}