import { NextRequest, NextResponse } from 'next/server'
import { AmazonFeeService } from '@/services/database/AmazonFeeService'
import { ProductCalculationService } from '@/services/database/ProductCalculationService'

export async function POST(request: NextRequest) {
  try {
    const { weightOz, weightGrams, sizeTier, price, marketplace, length, width, height } = await request.json()
    
    console.log('API received:', { weightOz, weightGrams, sizeTier, price, marketplace, length, width, height })
    
    // Calculate weight in oz if only grams provided
    const finalWeightOz = weightOz || (weightGrams ? weightGrams * 0.035274 : 0)
    
    // Calculate size tier from dimensions and weight if dimensions provided
    // Always calculate if we have dimensions, don't rely on empty sizeTier from DB
    let finalSizeTier = sizeTier
    if (length && width && height && finalWeightOz) {
      finalSizeTier = ProductCalculationService.determineSizeTier(
        length,
        width, 
        height,
        finalWeightOz
      )
      console.log(`Calculated size tier: ${finalSizeTier} (was ${sizeTier || 'not set'})`)
    } else if (!sizeTier || sizeTier === '') {
      // If no size tier and no dimensions, default based on weight
      if (finalWeightOz <= 16) {
        finalSizeTier = 'Small standard'
      } else {
        finalSizeTier = 'Large standard'
      }
      console.log(`Default size tier based on weight: ${finalSizeTier}`)
    }
    
    if (!finalWeightOz || !finalSizeTier || price === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }
    
    const feeResult = await AmazonFeeService.calculateFBAFee(
      finalWeightOz,
      finalSizeTier,
      price,
      marketplace || 'US' // Default to US if not provided
    )
    
    console.log(`FBA fee calculated: $${feeResult.fee} for ${finalWeightOz}oz, ${finalSizeTier}, $${price} (${feeResult.feeType})`)
    
    // Add weight range information - more precise ranges
    let weightRange = ''
    if (finalSizeTier === 'Small standard') {
      if (finalWeightOz <= 4) weightRange = '≤4 oz'
      else if (finalWeightOz <= 8) weightRange = '>4-8 oz'
      else if (finalWeightOz <= 12) weightRange = '>8-12 oz'
      else if (finalWeightOz <= 16) weightRange = '>12-16 oz'
      else weightRange = `${finalWeightOz.toFixed(1)} oz`
    } else if (finalSizeTier === 'Large standard') {
      if (finalWeightOz <= 4) weightRange = '≤4 oz'
      else if (finalWeightOz <= 8) weightRange = '>4-8 oz'
      else if (finalWeightOz <= 12) weightRange = '>8-12 oz'
      else if (finalWeightOz <= 16) weightRange = '>12-16 oz'
      else if (finalWeightOz <= 20) weightRange = '>16-20 oz'
      else if (finalWeightOz <= 24) weightRange = '>20-24 oz'
      else if (finalWeightOz <= 28) weightRange = '>24-28 oz'
      else if (finalWeightOz <= 32) weightRange = '>28-32 oz'
      else if (finalWeightOz <= 48) weightRange = `>32-48 oz`
      else if (finalWeightOz <= 64) weightRange = `>3-4 lb`
      else if (finalWeightOz <= 80) weightRange = `>4-5 lb`
      else if (finalWeightOz <= 160) weightRange = `>5-10 lb`
      else if (finalWeightOz <= 320) weightRange = `>10-20 lb`
      else weightRange = `>${Math.floor(finalWeightOz/16)} lb`
    } else if (finalSizeTier.includes('bulky')) {
      const weightLb = finalWeightOz / 16
      if (weightLb <= 50) weightRange = `≤50 lb`
      else if (weightLb <= 70) weightRange = `>50-70 lb`
      else if (weightLb <= 150) weightRange = `>70-150 lb`
      else weightRange = `>150 lb`
    } else {
      weightRange = `${finalWeightOz.toFixed(1)} oz`
    }
    
    return NextResponse.json({
      ...feeResult,
      sizeTier: finalSizeTier,  // Return the calculated size tier
      weightRange
    })
  } catch (error) {
    console.error('Error calculating FBA fee:', error)
    return NextResponse.json(
      { error: 'Failed to calculate FBA fee' },
      { status: 500 }
    )
  }
}