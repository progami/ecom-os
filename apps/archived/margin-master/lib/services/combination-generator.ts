import { prisma } from '@/lib/prisma'
import type { MaterialProfile, SourcingProfile } from '@prisma/client'
import { MaterialCalculationService } from './material-calculation-service'

export interface GenerationParams {
  name: string
  materialProfiles: string[]
  sourcingProfiles: string[]
  packSizes: { min: number; max: number; step: number }
  dimensions: {
    length: { min: number; max: number; step: number }
    width: { min: number; max: number; step: number }
    height: { min: number; max: number; step: number }
  }
  weight: { min: number; max: number; step: number }
  price: { min: number; max: number; step: number }
  targetMarginPercent?: number
}

export interface GeneratedScenario {
  packSize: number
  length: number
  width: number
  height: number
  weight: number
  salePrice: number
  materialProfileId: string
  sourcingProfileId: string
}

// Size tier boundaries from the fee structure analysis
const SIZE_TIERS = {
  STANDARD_ENVELOPE: { maxLength: 33, maxWidth: 23, maxHeight: 2.5, maxWeight: 210 },
  STANDARD_SMALL: { maxLength: 33, maxWidth: 23, maxHeight: 5, maxWeight: 460 },
  STANDARD_REGULAR: { maxLength: 45, maxWidth: 34, maxHeight: 26, maxWeight: 9000 },
  STANDARD_LARGE: { maxLength: 61, maxWidth: 46, maxHeight: 46, maxWeight: 30000 },
  SMALL_OVERSIZE: { maxDimension: 61, maxWeight: 760 },
  STANDARD_OVERSIZE: { maxDimension: 120, maxWeight: 30000 },
}

export class CombinationGenerator {
  private batchId: string | null = null
  private materialCalc = new MaterialCalculationService()

  async createBatch(params: GenerationParams): Promise<string> {
    const batch = await prisma.generationBatch.create({
      data: {
        name: params.name,
        status: 'pending',
        rules: params as any,
      },
    })
    
    this.batchId = batch.id
    return batch.id
  }

  async generateCombinations(params: GenerationParams): Promise<GeneratedScenario[]> {
    const combinations: GeneratedScenario[] = []
    
    // Fetch material profiles to check constraints
    const materials = await prisma.materialProfile.findMany({
      where: { id: { in: params.materialProfiles } }
    })
    const materialMap = new Map(materials.map(m => [m.id, m]))
    
    // Generate all combinations
    for (const materialId of params.materialProfiles) {
      const material = materialMap.get(materialId)
      if (!material) continue
      
      for (const sourcingId of params.sourcingProfiles) {
        // Generate pack sizes from range
        const packSizes: number[] = []
        for (let ps = params.packSizes.min; ps <= params.packSizes.max; ps += params.packSizes.step) {
          packSizes.push(ps)
        }
        
        for (const packSize of packSizes) {
          // Generate dimension combinations with tier-aware stepping
          const dimensionCombos = this.generateDimensionCombinations(
            params.dimensions,
            packSize
          )
          
          for (const dims of dimensionCombos) {
            // Validate material constraints
            const validation = this.materialCalc.validateMaterialConstraints(dims, material)
            if (!validation.isValid) {
              // Skip combinations that violate material constraints
              continue
            }
            
            // Generate weight combinations based on dimensions and material
            const weightCombos = this.generateMaterialAwareWeights(
              params.weight,
              dims,
              material,
              packSize
            )
            
            for (const weight of weightCombos) {
              // Generate price combinations
              for (let price = params.price.min; price <= params.price.max; price += params.price.step) {
                combinations.push({
                  packSize,
                  length: dims.length,
                  width: dims.width,
                  height: dims.height,
                  weight,
                  salePrice: price,
                  materialProfileId: materialId,
                  sourcingProfileId: sourcingId,
                })
              }
            }
          }
        }
      }
    }
    
    return combinations
  }

  private generateDimensionCombinations(
    dimensions: GenerationParams['dimensions'],
    packSize: number
  ): Array<{ length: number; width: number; height: number }> {
    const combos: Array<{ length: number; width: number; height: number }> = []
    
    // Include tier boundary dimensions
    const tierBoundaries = this.getTierBoundaryDimensions()
    
    // Regular stepping
    for (let l = dimensions.length.min; l <= dimensions.length.max; l += dimensions.length.step) {
      for (let w = dimensions.width.min; w <= dimensions.width.max; w += dimensions.width.step) {
        for (let h = dimensions.height.min; h <= dimensions.height.max; h += dimensions.height.step) {
          combos.push({ length: l, width: w, height: h })
        }
      }
    }
    
    // Add tier boundary combinations
    for (const boundary of tierBoundaries) {
      if (boundary.length >= dimensions.length.min && boundary.length <= dimensions.length.max &&
          boundary.width >= dimensions.width.min && boundary.width <= dimensions.width.max &&
          boundary.height >= dimensions.height.min && boundary.height <= dimensions.height.max) {
        combos.push(boundary)
        
        // Add variations just below tier boundaries (95% of boundary)
        combos.push({
          length: boundary.length * 0.95,
          width: boundary.width * 0.95,
          height: boundary.height * 0.95,
        })
      }
    }
    
    // Remove duplicates
    return this.uniqueDimensions(combos)
  }

  private generateWeightCombinations(
    weightRange: { min: number; max: number; step: number },
    dimensions: { length: number; width: number; height: number },
    packSize: number
  ): number[] {
    const weights: number[] = []
    
    // Regular stepping
    for (let w = weightRange.min; w <= weightRange.max; w += weightRange.step) {
      weights.push(w)
    }
    
    // Add tier boundary weights
    const tierBoundaryWeights = [210, 460, 760, 9000, 30000]
    for (const boundary of tierBoundaryWeights) {
      if (boundary >= weightRange.min && boundary <= weightRange.max) {
        weights.push(boundary)
        weights.push(boundary * 0.95) // Just below boundary
      }
    }
    
    // Remove duplicates and sort
    return [...new Set(weights)].sort((a, b) => a - b)
  }
  
  private generateMaterialAwareWeights(
    weightRange: { min: number; max: number; step: number },
    dimensions: { length: number; width: number; height: number },
    material: MaterialProfile,
    packSize: number
  ): number[] {
    const weights: number[] = []
    
    // Get available thicknesses
    const thicknesses = material.thicknessOptions as number[] || [1.0]
    
    // For each thickness, calculate the resulting weight
    for (const thickness of thicknesses) {
      const packagingWeight = this.materialCalc.calculatePackagingWeight(dimensions, material, thickness)
      
      // Generate product weights that, combined with packaging, fall within range
      for (let totalWeight = weightRange.min; totalWeight <= weightRange.max; totalWeight += weightRange.step) {
        const productWeight = totalWeight - packagingWeight
        
        if (productWeight > 0) {
          weights.push(Math.round(totalWeight))
        }
      }
    }
    
    // Add tier boundary weights
    const tierBoundaryWeights = [210, 460, 760, 9000, 30000]
    for (const boundary of tierBoundaryWeights) {
      if (boundary >= weightRange.min && boundary <= weightRange.max) {
        weights.push(boundary)
        weights.push(Math.round(boundary * 0.95)) // Just below boundary
      }
    }
    
    // Remove duplicates and sort
    return [...new Set(weights)].sort((a, b) => a - b)
  }

  private getTierBoundaryDimensions(): Array<{ length: number; width: number; height: number }> {
    return [
      // Standard envelope boundaries
      { length: 33, width: 23, height: 2.5 },
      { length: 33, width: 23, height: 5 },
      // Standard regular boundary
      { length: 45, width: 34, height: 26 },
      // Standard large boundary
      { length: 61, width: 46, height: 46 },
    ]
  }

  private uniqueDimensions(
    dims: Array<{ length: number; width: number; height: number }>
  ): Array<{ length: number; width: number; height: number }> {
    const seen = new Set<string>()
    return dims.filter(d => {
      const key = `${d.length.toFixed(1)}-${d.width.toFixed(1)}-${d.height.toFixed(1)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  calculateTierEfficiency(
    length: number,
    width: number,
    height: number,
    weight: number,
    sizeTier: string
  ): number {
    // Calculate how efficiently the product uses its size tier
    // 1.0 = perfect fit (near boundary), 0.0 = poor fit (much smaller than tier allows)
    
    const tierLimits = this.getTierLimits(sizeTier)
    if (!tierLimits) return 0.5
    
    const dimensionEfficiency = Math.min(
      length / tierLimits.maxLength,
      width / tierLimits.maxWidth,
      height / tierLimits.maxHeight
    )
    
    const weightEfficiency = weight / tierLimits.maxWeight
    
    // Combined efficiency (weighted average)
    return dimensionEfficiency * 0.7 + weightEfficiency * 0.3
  }

  private getTierLimits(sizeTier: string): {
    maxLength: number
    maxWidth: number
    maxHeight: number
    maxWeight: number
  } | null {
    const tierMap: Record<string, any> = {
      'Standard Envelope': SIZE_TIERS.STANDARD_ENVELOPE,
      'Standard Small': SIZE_TIERS.STANDARD_SMALL,
      'Standard Regular': SIZE_TIERS.STANDARD_REGULAR,
      'Standard Large': SIZE_TIERS.STANDARD_LARGE,
    }
    
    return tierMap[sizeTier] || null
  }

  identifyOpportunities(
    combinations: Array<{
      sizeTier: string
      tierEfficiency: number
      netMarginPercent: number
      roi: number
    }>,
    targetMargin: number = 30
  ): Array<{ type: string; indices: number[] }> {
    const opportunities: Array<{ type: string; indices: number[] }> = []
    
    // Find sweet spots (target margin + good tier efficiency)
    const sweetSpots = combinations
      .map((c, i) => ({ ...c, index: i }))
      .filter(c => c.netMarginPercent >= targetMargin && c.tierEfficiency > 0.8)
      .map(c => c.index)
    
    if (sweetSpots.length > 0) {
      opportunities.push({ type: 'sweet-spot', indices: sweetSpots })
    }
    
    // Find tier boundary opportunities (high efficiency, meets minimum margin)
    const tierBoundaries = combinations
      .map((c, i) => ({ ...c, index: i }))
      .filter(c => c.tierEfficiency > 0.9 && c.netMarginPercent >= targetMargin * 0.8) // 80% of target
      .map(c => c.index)
    
    if (tierBoundaries.length > 0) {
      opportunities.push({ type: 'tier-boundary', indices: tierBoundaries })
    }
    
    // Find high margin opportunities (significantly above target)
    const highMargin = combinations
      .map((c, i) => ({ ...c, index: i }))
      .filter(c => c.netMarginPercent > targetMargin * 1.5) // 50% above target
      .sort((a, b) => b.netMarginPercent - a.netMarginPercent)
      .slice(0, 10)
      .map(c => c.index)
    
    if (highMargin.length > 0) {
      opportunities.push({ type: 'high-margin', indices: highMargin })
    }
    
    return opportunities
  }
}