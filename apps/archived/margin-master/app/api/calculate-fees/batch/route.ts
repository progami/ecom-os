import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  getFeeBreakdown, 
  ProductContext,
  FeeBreakdown,
  isProductOversized
} from '@/lib/services/amazon-fee-service'
import { CombinationGenerator } from '@/lib/services/combination-generator'
import type { GenerationParams } from '@/lib/services/combination-generator'
import { MaterialCalculationService } from '@/lib/services/material-calculation-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large batches

// In-memory cache for fee calculations (reset on deploy)
const feeCache = new Map<string, any>()

interface BatchCalculationRequest {
  batchId: string
  scenarios: Array<{
    id: string
    packSize: number
    length: number
    width: number
    height: number
    weight: number
    salePrice: number
    materialProfileId: string
    sourcingProfileId: string
  }>
  marketplace?: string
  estimatedAcosPercent?: number
  refundProvisionPercent?: number
  targetMarginPercent?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchCalculationRequest = await request.json()
    const { batchId, scenarios, marketplace = 'US', estimatedAcosPercent = 20, refundProvisionPercent = 2, targetMarginPercent = 30 } = body

    if (!scenarios || scenarios.length === 0) {
      return NextResponse.json({ error: 'No scenarios provided' }, { status: 400 })
    }

    // Update batch status
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: { 
        status: 'calculating',
        totalCombinations: scenarios.length 
      }
    })

    // Fetch material and sourcing profiles
    const materialIds = [...new Set(scenarios.map(s => s.materialProfileId))]
    const sourcingIds = [...new Set(scenarios.map(s => s.sourcingProfileId))]

    const [materials, sourcingProfiles] = await Promise.all([
      prisma.materialProfile.findMany({
        where: { id: { in: materialIds } }
      }),
      prisma.sourcingProfile.findMany({
        where: { id: { in: sourcingIds } }
      })
    ])

    const materialMap = new Map(materials.map(m => [m.id, m]))
    const sourcingMap = new Map(sourcingProfiles.map(s => [s.id, s]))

    // Initialize services
    const generator = new CombinationGenerator()
    const materialCalc = new MaterialCalculationService()

    // Process scenarios in batches of 100
    const batchSize = 100
    const results = []
    let processedCount = 0

    for (let i = 0; i < scenarios.length; i += batchSize) {
      const batch = scenarios.slice(i, i + batchSize)
      
      const batchResults = await Promise.all(
        batch.map(async (scenario) => {
          try {
            // Create cache key
            const cacheKey = `${scenario.length}-${scenario.width}-${scenario.height}-${scenario.weight}-${scenario.salePrice}-${marketplace}`
            
            // Check cache
            let feeResult
            if (feeCache.has(cacheKey)) {
              feeResult = feeCache.get(cacheKey)
            } else {
              // Build product context
              const productContext: ProductContext = {
                marketplace: {
                  countryCode: marketplace,
                  programCode: 'FBA'
                },
                product: {
                  dimensions: {
                    lengthCm: scenario.length,
                    widthCm: scenario.width,
                    heightCm: scenario.height
                  },
                  weightG: scenario.weight,
                  price: scenario.salePrice,
                  category: 'General',
                  isApparel: false
                }
              }
              
              // Calculate fees
              const feeBreakdown = await getFeeBreakdown(productContext)
              
              // Determine size tier based on dimensions and weight
              const isOversized = isProductOversized(
                { lengthCm: scenario.length, widthCm: scenario.width, heightCm: scenario.height },
                scenario.weight
              )
              
              let sizeTier = 'Standard'
              if (isOversized) {
                sizeTier = 'Oversize'
              } else if (scenario.length <= 33 && scenario.width <= 23 && scenario.height <= 2.5 && scenario.weight <= 210) {
                sizeTier = 'Standard Envelope'
              } else if (scenario.length <= 33 && scenario.width <= 23 && scenario.height <= 5 && scenario.weight <= 460) {
                sizeTier = 'Standard Small'
              } else if (scenario.length <= 45 && scenario.width <= 34 && scenario.height <= 26 && scenario.weight <= 9000) {
                sizeTier = 'Standard Regular'
              } else if (scenario.length <= 61 && scenario.width <= 46 && scenario.height <= 46 && scenario.weight <= 30000) {
                sizeTier = 'Standard Large'
              }
              
              feeResult = {
                fulfillmentFee: feeBreakdown.fulfillmentFee.baseFee,
                referralFee: feeBreakdown.referralFee.fee,
                totalFees: feeBreakdown.fulfillmentFee.baseFee + feeBreakdown.referralFee.fee,
                sizeTier
              }
              
              // Cache result
              feeCache.set(cacheKey, feeResult)
            }

            // Get material and sourcing data
            const material = materialMap.get(scenario.materialProfileId)
            const sourcing = sourcingMap.get(scenario.sourcingProfileId)

            if (!material || !sourcing) {
              throw new Error('Material or sourcing profile not found')
            }

            // Use material calculation service for accurate cost and weight
            const dimensions = {
              length: scenario.length,
              width: scenario.width,
              height: scenario.height
            }
            
            // Get optimal thickness or use default
            const thickness = materialCalc.suggestOptimalThickness(dimensions, material, scenario.weight)
            
            // Calculate material costs and weight
            const materialResult = materialCalc.calculateMaterialCost(
              dimensions,
              material,
              scenario.packSize,
              thickness
            )
            
            const packMaterialCost = materialResult.effectiveCost
            const shippingCost = Number(sourcing.shippingCostPerKg) * (scenario.weight / 1000)
            const tariffCost = packMaterialCost * (Number(sourcing.tariffPercentage) / 100)
            const landedCost = packMaterialCost + shippingCost + tariffCost

            // Calculate margins
            const totalCost = landedCost + feeResult.totalFees
            const netProfit = scenario.salePrice - totalCost
            const netMarginPercent = (netProfit / scenario.salePrice) * 100
            const roi = (netProfit / totalCost) * 100

            // Calculate tier efficiency
            const tierEfficiency = generator.calculateTierEfficiency(
              scenario.length,
              scenario.width,
              scenario.height,
              scenario.weight,
              feeResult.sizeTier
            )

            return {
              ...scenario,
              sizeTier: feeResult.sizeTier,
              landedCost,
              fbaFee: feeResult.fulfillmentFee,
              referralFee: feeResult.referralFee,
              netMarginPercent,
              roi,
              profitPerUnit: netProfit,
              tierEfficiency,
              meetsTargetMargin: netMarginPercent >= targetMarginPercent,
              materialConstraints: materialResult.constraintViolations,
              packagingWeight: materialResult.packagingWeight,
              totalWeight: materialResult.totalWeight,
              success: true
            }
          } catch (error) {
            console.error(`Error processing scenario ${scenario.id}:`, error)
            return {
              ...scenario,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      )

      results.push(...batchResults)
      processedCount += batch.length

      // Update progress
      await prisma.generationBatch.update({
        where: { id: batchId },
        data: { completedCombinations: processedCount }
      })
    }

    // Save all successful results to database
    const successfulResults = results.filter(r => r.success && 'netMarginPercent' in r) as Array<any>
    
    if (successfulResults.length > 0) {
      // Rank by margin
      const sortedByMargin = [...successfulResults].sort((a, b) => b.netMarginPercent - a.netMarginPercent)
      sortedByMargin.forEach((result, index) => {
        result.marginRank = index + 1
      })

      // Identify opportunities based on target margin
      const opportunities = generator.identifyOpportunities(successfulResults, targetMarginPercent)
      
      // Mark opportunities
      opportunities.forEach(opp => {
        opp.indices.forEach(idx => {
          if (successfulResults[idx]) {
            successfulResults[idx].opportunity = opp.type
          }
        })
      })

      // Batch insert results
      await prisma.generatedCombination.createMany({
        data: successfulResults.map(r => ({
          ruleId: batchId,
          batchId,
          packSize: r.packSize,
          length: r.length,
          width: r.width,
          height: r.height,
          weight: r.weight,
          salePrice: r.salePrice,
          materialProfileId: r.materialProfileId,
          sourcingProfileId: r.sourcingProfileId,
          sizeTier: r.sizeTier,
          landedCost: r.landedCost,
          fbaFee: r.fbaFee,
          referralFee: r.referralFee,
          netMarginPercent: r.netMarginPercent,
          roi: r.roi,
          profitPerUnit: r.profitPerUnit,
          tierEfficiency: r.tierEfficiency,
          marginRank: r.marginRank,
          opportunity: r.opportunity,
          meetsTargetMargin: r.meetsTargetMargin || false
        }))
      })
    }

    // Generate summary statistics
    let summary: any = {
      totalProcessed: results.length,
      successful: successfulResults.length,
      failed: results.filter(r => !r.success).length,
      avgMargin: 0,
      avgROI: 0,
      topMargin: 0,
      topROI: 0,
      sizeTierDistribution: {},
      opportunities: []
    }
    
    if (successfulResults.length > 0) {
      summary.avgMargin = successfulResults.reduce((sum, r) => sum + r.netMarginPercent, 0) / successfulResults.length
      summary.avgROI = successfulResults.reduce((sum, r) => sum + r.roi, 0) / successfulResults.length
      summary.topMargin = Math.max(...successfulResults.map(r => r.netMarginPercent))
      summary.topROI = Math.max(...successfulResults.map(r => r.roi))
      summary.sizeTierDistribution = successfulResults.reduce((acc, r) => {
        acc[r.sizeTier] = (acc[r.sizeTier] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      // Get opportunities that were identified earlier
      const opportunities = generator.identifyOpportunities(successfulResults)
      summary.opportunities = opportunities.map(o => ({
        type: o.type,
        count: o.indices.length
      }))
    }

    // Update batch status
    await prisma.generationBatch.update({
      where: { id: batchId },
      data: {
        status: 'complete',
        completedAt: new Date(),
        summary: summary as any
      }
    })

    return NextResponse.json({
      success: true,
      batchId,
      summary,
      results: results.slice(0, 100) // Return first 100 for preview
    })
  } catch (error) {
    console.error('Batch calculation error:', error)
    
    // Update batch status to failed
    if (request.body) {
      try {
        const { batchId } = await request.json()
        await prisma.generationBatch.update({
          where: { id: batchId },
          data: { status: 'failed' }
        })
      } catch {}
    }

    return NextResponse.json(
      { error: 'Failed to process batch calculations' },
      { status: 500 }
    )
  }
}