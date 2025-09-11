import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const programCode = searchParams.get('program') || 'FBA'

    const surcharges = await prisma.surcharge.findMany({
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
        { surchargeType: 'asc' },
        { surchargeName: 'asc' },
        { effectiveDate: 'desc' },
      ],
    })

    // Transform database data to match frontend expectations
    // Group by surcharge name to avoid duplicates across countries
    const surchargeMap = new Map<string, any>()
    
    surcharges.forEach(surcharge => {
      const key = surcharge.surchargeName
      if (!surchargeMap.has(key)) {
        surchargeMap.set(key, {
          id: surcharge.id,
          name: surcharge.surchargeName,
          description: surcharge.condition || surcharge.surchargeType,
          fee: Number(surcharge.feeAmount),
          unit: surcharge.feeType,
          currency: surcharge.currency,
          effectiveDate: surcharge.effectiveDate,
        })
      }
    })
    
    const transformedSurcharges = Array.from(surchargeMap.values())

    // If no data in database, return actual data
    if (transformedSurcharges.length === 0 && programCode === 'FBA') {
      const mockSurcharges = [
        {
          id: '1',
          name: 'Holiday Peak Fulfillment',
          description: 'Additional fee during peak holiday season (Oct 15 - Jan 14)',
          fee: 0.50,
          effectiveDate: new Date('2024-10-15'),
        },
        {
          id: '2',
          name: 'Fuel and Inflation Surcharge',
          description: 'Variable surcharge based on fuel costs and inflation',
          fee: 0.35,
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '3',
          name: 'Low-Level Inventory Fee',
          description: 'Charged when inventory levels are consistently low relative to sales',
          fee: 0.89,
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '4',
          name: 'Storage Utilization Surcharge',
          description: 'Applied when storage utilization ratio exceeds limits',
          fee: 1.14,
          effectiveDate: new Date('2024-04-01'),
        },
        {
          id: '5',
          name: 'FBA Inbound Defect Fee',
          description: 'Charged for inventory shipments that arrive with problems',
          fee: 0.10,
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '6',
          name: 'Long-Term Storage Fee',
          description: 'Items in fulfillment centers 271-365 days',
          fee: 2.50,
          unit: 'per cubic foot',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '7',
          name: 'Long-Term Storage Fee',
          description: 'Items in fulfillment centers 365+ days',
          fee: 6.90,
          unit: 'per cubic foot or $0.15/unit (whichever is greater)',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '8',
          name: 'High-Volume Listing Fee',
          description: 'Monthly fee for maintaining high number of listings',
          fee: 0.005,
          unit: 'per eligible ASIN beyond 100,000',
          effectiveDate: new Date('2024-01-01'),
        },
      ]
      return NextResponse.json(mockSurcharges)
    }
    
    return NextResponse.json(transformedSurcharges)
  } catch (error) {
    console.error('Failed to fetch surcharges:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surcharges' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // In a real app, validate and save to database
    // const surcharge = await prisma.surcharge.create({ data: body })
    
    return NextResponse.json({ ...body, id: Date.now().toString() })
  } catch (error) {
    console.error('Failed to create surcharge:', error)
    return NextResponse.json(
      { error: 'Failed to create surcharge' },
      { status: 500 }
    )
  }
}