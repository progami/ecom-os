import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const programCode = searchParams.get('program') || 'FBA'
    
    // Get all fees for the program across all countries
    const fees = await prisma.fulfilmentFee.findMany({
      include: {
        country: true,
        program: true,
        sizeTier: true,
        weightBand: true,
      },
      where: {
        program: {
          code: programCode
        }
      },
      orderBy: [
        { sizeTier: { name: 'asc' } },
        { weightBand: { maxWeightG: 'asc' } },
        { country: { code: 'asc' } },
      ],
    })

    // Group fees by size tier and weight band
    const rateCardData: any[] = []
    const sizeTierWeightMap = new Map<string, Set<string>>()
    
    // First pass: collect all unique size tier + weight combinations
    fees.forEach(fee => {
      const sizeTierKey = fee.sizeTier.name
      const weightKey = `${fee.weightBand?.minWeightG || 0}-${fee.weightBand?.maxWeightG || 0}`
      
      if (!sizeTierWeightMap.has(sizeTierKey)) {
        sizeTierWeightMap.set(sizeTierKey, new Set())
      }
      sizeTierWeightMap.get(sizeTierKey)?.add(weightKey)
    })
    
    // Second pass: build rate card structure
    sizeTierWeightMap.forEach((weightKeys, sizeTierName) => {
      const sortedWeightKeys = Array.from(weightKeys).sort((a, b) => {
        const aMax = parseInt(a.split('-')[1])
        const bMax = parseInt(b.split('-')[1])
        return aMax - bMax
      })
      
      sortedWeightKeys.forEach(weightKey => {
        const [minWeight, maxWeight] = weightKey.split('-').map(w => parseInt(w))
        const sizeTierFees = fees.filter(fee => 
          fee.sizeTier.name === sizeTierName && 
          fee.weightBand?.minWeightG?.toString() === minWeight.toString() &&
          fee.weightBand?.maxWeightG?.toString() === maxWeight.toString()
        )
        
        if (sizeTierFees.length === 0) return
        
        const firstFee = sizeTierFees[0]
        const row: any = {
          sizeTier: sizeTierName,
          dimensions: firstFee.sizeTier.maxLengthCm ? 
            `≤ ${firstFee.sizeTier.maxLengthCm} x ${firstFee.sizeTier.maxWidthCm} x ${firstFee.sizeTier.maxHeightCm}cm` : 
            '',
          weightRange: maxWeight ? `≤ ${maxWeight}g` : '',
          fees: {}
        }
        
        // Add fee for each country
        sizeTierFees.forEach(fee => {
          row.fees[fee.country.code] = {
            amount: Number(fee.baseFee),
            currency: fee.currency
          }
        })
        
        rateCardData.push(row)
      })
    })
    
    // Get list of countries that have fees
    const countries = await prisma.country.findMany({
      where: {
        fulfilmentFees: {
          some: {
            program: {
              code: programCode
            }
          }
        }
      },
      orderBy: {
        code: 'asc'
      }
    })
    
    return NextResponse.json({
      countries,
      rateCard: rateCardData,
      program: programCode
    })
  } catch (error) {
    console.error('Failed to fetch rate card data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rate card data' },
      { status: 500 }
    )
  }
}