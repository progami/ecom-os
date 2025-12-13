import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const programCode = searchParams.get('program') || 'FBA'

    const services = await prisma.optionalService.findMany({
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
        { serviceName: 'asc' },
        { serviceCode: 'asc' },
        { effectiveDate: 'desc' },
      ],
    })

    // Transform database data to match frontend expectations
    // Since optional services are typically the same across countries, group by service
    const serviceMap = new Map<string, any>()
    
    services.forEach(service => {
      const key = `${service.serviceName}-${service.serviceCode}`
      if (!serviceMap.has(key)) {
        serviceMap.set(key, {
          id: service.id,
          serviceName: service.serviceName,
          serviceCode: service.serviceCode,
          description: service.serviceName,
          fee: Number(service.feeAmount),
          unit: service.feeUnit || service.feeType,
          currency: service.currency,
          effectiveDate: service.effectiveDate,
        })
      }
    })
    
    const transformedServices = Array.from(serviceMap.values())

    // If no data in database, return mock data
    if (transformedServices.length === 0 && programCode === 'FBA') {
      const mockOptionalServices = [
        {
          id: '1',
          serviceName: 'FBA Prep Service',
          description: 'Polybagging - Opaque bag',
          fee: 0.55,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '2',
          serviceName: 'FBA Prep Service',
          description: 'Polybagging - Transparent bag (100 units or more)',
          fee: 0.75,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '3',
          serviceName: 'FBA Prep Service',
          description: 'Bubble wrap',
          fee: 1.00,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '4',
          serviceName: 'FBA Prep Service',
          description: 'Taping',
          fee: 0.20,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '5',
          serviceName: 'FBA Prep Service',
          description: 'Opaque bagging for adult products',
          fee: 2.00,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '6',
          serviceName: 'FBA Label Service',
          description: 'Labeling - Standard size (per item)',
          fee: 0.30,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '7',
          serviceName: 'FBA Label Service',
          description: 'Labeling - Oversize (per item)',
          fee: 0.30,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '8',
          serviceName: 'FBA Removal Order',
          description: 'Return to address - Standard size',
          fee: 0.97,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '9',
          serviceName: 'FBA Removal Order',
          description: 'Return to address - Oversize (0-10 lb)',
          fee: 1.78,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '10',
          serviceName: 'FBA Removal Order',
          description: 'Return to address - Oversize (10+ lb)',
          fee: 2.52,
          unit: 'per unit + $0.59/lb above first 10 lb',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '11',
          serviceName: 'FBA Disposal Order',
          description: 'Disposal - Standard size',
          fee: 0.32,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '12',
          serviceName: 'FBA Disposal Order',
          description: 'Disposal - Oversize (0-10 lb)',
          fee: 0.43,
          unit: 'per unit',
          effectiveDate: new Date('2024-01-01'),
        },
        {
          id: '13',
          serviceName: 'FBA Disposal Order',
          description: 'Disposal - Oversize (10+ lb)',
          fee: 0.96,
          unit: 'per unit + $0.19/lb above first 10 lb',
          effectiveDate: new Date('2024-01-01'),
        },
      ]
      return NextResponse.json(mockOptionalServices)
    }
    
    return NextResponse.json(transformedServices)
  } catch (error) {
    console.error('Failed to fetch optional services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch optional services' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // In a real app, validate and save to database
    // const service = await prisma.optionalService.create({ data: body })
    
    return NextResponse.json({ ...body, id: Date.now().toString() })
  } catch (error) {
    console.error('Failed to create optional service:', error)
    return NextResponse.json(
      { error: 'Failed to create optional service' },
      { status: 500 }
    )
  }
}