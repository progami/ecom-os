import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('country') || 'GB'
    const programCode = searchParams.get('program') || 'FBA'
    
    const fees = await prisma.fulfilmentFee.findMany({
      include: {
        country: true,
        program: true,
        sizeTier: true,
        weightBand: true,
      },
      where: {
        country: {
          code: countryCode
        },
        program: {
          code: programCode
        }
      },
      orderBy: [
        { effectiveDate: 'desc' },
      ],
    })

    // Transform the data to match the expected format
    const transformedFees = fees.map(fee => ({
      id: fee.id,
      country: fee.country.name,
      countryCode: fee.country.code,
      program: fee.program.name,
      sizeTier: fee.sizeTier.name,
      minLength: fee.sizeTier.maxLengthCm ? 0 : 0,
      maxLength: fee.sizeTier.maxLengthCm || 0,
      minWidth: fee.sizeTier.maxWidthCm ? 0 : 0,
      maxWidth: fee.sizeTier.maxWidthCm || 0,
      minHeight: fee.sizeTier.maxHeightCm ? 0 : 0,
      maxHeight: fee.sizeTier.maxHeightCm || 0,
      minWeight: fee.weightBand?.minWeightG ? Number(fee.weightBand.minWeightG) / 1000 : 0,
      maxWeight: fee.weightBand?.maxWeightG ? Number(fee.weightBand.maxWeightG) / 1000 : (fee.sizeTier.maxWeightG ? Number(fee.sizeTier.maxWeightG) / 1000 : 0),
      fee: Number(fee.baseFee),
      currency: fee.currency,
      effectiveDate: fee.effectiveDate,
    }))
    
    return NextResponse.json(transformedFees)
  } catch (error) {
    console.error('Failed to fetch fulfillment fees:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fulfillment fees' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // In a real app, validate and save to database
    // const fee = await prisma.fulfillmentFee.create({ data: body })
    
    return NextResponse.json({ ...body, id: Date.now().toString() })
  } catch (error) {
    console.error('Failed to create fulfillment fee:', error)
    return NextResponse.json(
      { error: 'Failed to create fulfillment fee' },
      { status: 500 }
    )
  }
}