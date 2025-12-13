import { Decimal } from '@prisma/client/runtime/library'

interface MaterialProfile {
  densityGCm3: Decimal | number
  thicknessOptions?: any // JSON field
  maxSheetLength?: number | null
  maxSheetWidth?: number | null
  wasteFactor: Decimal | number
  costPerUnit: Decimal | number
  costUnit: string
  minOrderQuantity?: Decimal | number | null
  setupCost?: Decimal | number | null
  maxBendRadius?: Decimal | number | null
  isRigid: boolean
  requiresLiner: boolean
}

interface ProductDimensions {
  length: number  // cm
  width: number   // cm
  height: number  // cm
}

interface MaterialCalculationResult {
  packagingWeight: number        // grams
  materialCost: number          // currency
  effectiveCost: number         // cost including waste and MOQ
  totalWeight: number           // product + packaging weight in grams
  materialVolume: number        // cm³
  wasteAmount: number          // percentage as decimal
  meetsConstraints: boolean
  constraintViolations: string[]
}

export class MaterialCalculationService {
  /**
   * Calculate the packaging weight based on material properties and product dimensions
   */
  calculatePackagingWeight(
    dimensions: ProductDimensions,
    material: MaterialProfile,
    thickness: number = 1.0  // mm
  ): number {
    const density = Number(material.densityGCm3)
    
    // Calculate surface area (assuming box packaging)
    const surfaceArea = this.calculateSurfaceArea(dimensions)
    
    // Convert thickness from mm to cm
    const thicknessCm = thickness / 10
    
    // Calculate volume of packaging material
    const materialVolume = surfaceArea * thicknessCm
    
    // Calculate weight (volume * density)
    const packagingWeight = materialVolume * density
    
    // Add liner weight if required
    if (material.requiresLiner) {
      // Assume liner adds 5% to packaging weight
      return packagingWeight * 1.05
    }
    
    return packagingWeight
  }

  /**
   * Calculate material cost with waste factor and minimum order quantity
   */
  calculateMaterialCost(
    dimensions: ProductDimensions,
    material: MaterialProfile,
    packSize: number,
    thickness: number = 1.0
  ): MaterialCalculationResult {
    const constraintViolations: string[] = []
    
    // Validate thickness options
    if (material.thicknessOptions) {
      const availableThicknesses = material.thicknessOptions as number[]
      if (!availableThicknesses.includes(thickness)) {
        constraintViolations.push(`Thickness ${thickness}mm not available. Options: ${availableThicknesses.join(', ')}`)
      }
    }
    
    // Calculate base material usage
    let unitMaterialCost = 0
    const costPerUnit = Number(material.costPerUnit)
    const wasteFactor = Number(material.wasteFactor)
    
    switch (material.costUnit) {
      case 'area':
        const surfaceArea = this.calculateSurfaceArea(dimensions) / 10000 // Convert to m²
        const effectiveArea = surfaceArea * (1 + wasteFactor)
        unitMaterialCost = costPerUnit * effectiveArea
        break
        
      case 'weight':
        const packagingWeight = this.calculatePackagingWeight(dimensions, material, thickness)
        const effectiveWeight = (packagingWeight / 1000) * (1 + wasteFactor) // Convert to kg
        unitMaterialCost = costPerUnit * effectiveWeight
        break
        
      case 'volume':
        const surfaceAreaCm2 = this.calculateSurfaceArea(dimensions)
        const volumeM3 = (surfaceAreaCm2 * thickness / 10) / 1000000 // Convert to m³
        const effectiveVolume = volumeM3 * (1 + wasteFactor)
        unitMaterialCost = costPerUnit * effectiveVolume
        break
        
      case 'piece':
        // For piece-based materials, assume one piece per product
        unitMaterialCost = costPerUnit * (1 + wasteFactor)
        break
    }
    
    // Calculate total cost for pack
    const packMaterialCost = unitMaterialCost * packSize
    
    // Apply minimum order quantity if specified
    let effectiveCost = packMaterialCost
    if (material.minOrderQuantity) {
      const moq = Number(material.minOrderQuantity)
      if (packMaterialCost < moq) {
        effectiveCost = moq
        constraintViolations.push(`Below MOQ. Actual: ${packMaterialCost.toFixed(2)}, MOQ: ${moq}`)
      }
    }
    
    // Add setup cost amortized over pack size
    if (material.setupCost) {
      const setupCostPerUnit = Number(material.setupCost) / packSize
      effectiveCost += setupCostPerUnit * packSize
    }
    
    // Calculate total weight
    const packagingWeight = this.calculatePackagingWeight(dimensions, material, thickness)
    const productWeight = this.estimateProductWeight(dimensions) // Placeholder
    const totalWeight = productWeight + packagingWeight
    
    return {
      packagingWeight,
      materialCost: packMaterialCost,
      effectiveCost,
      totalWeight,
      materialVolume: this.calculateSurfaceArea(dimensions) * thickness / 10,
      wasteAmount: wasteFactor,
      meetsConstraints: constraintViolations.length === 0,
      constraintViolations
    }
  }

  /**
   * Validate if dimensions are feasible with given material
   */
  validateMaterialConstraints(
    dimensions: ProductDimensions,
    material: MaterialProfile
  ): { isValid: boolean; violations: string[] } {
    const violations: string[] = []
    
    // Check if material sheet size can accommodate the dimensions
    if (material.maxSheetLength && material.maxSheetWidth) {
      const maxSheetLength = Number(material.maxSheetLength)
      const maxSheetWidth = Number(material.maxSheetWidth)
      
      // Check if any face of the box exceeds sheet dimensions
      const faces = [
        { l: dimensions.length, w: dimensions.width },
        { l: dimensions.length, w: dimensions.height },
        { l: dimensions.width, w: dimensions.height }
      ]
      
      for (const face of faces) {
        if (face.l > maxSheetLength || face.w > maxSheetWidth) {
          if (face.w > maxSheetLength || face.l > maxSheetWidth) {
            violations.push(`Face ${face.l}x${face.w}cm exceeds max sheet ${maxSheetLength}x${maxSheetWidth}cm`)
          }
        }
      }
    }
    
    // Check bend radius constraints for rigid materials
    if (material.isRigid && material.maxBendRadius) {
      const maxBendRadius = Number(material.maxBendRadius)
      const minDimension = Math.min(dimensions.length, dimensions.width, dimensions.height)
      
      if (minDimension / 2 < maxBendRadius) {
        violations.push(`Minimum dimension ${minDimension}cm too small for bend radius ${maxBendRadius}cm`)
      }
    }
    
    return {
      isValid: violations.length === 0,
      violations
    }
  }

  /**
   * Calculate surface area of a box
   */
  private calculateSurfaceArea(dimensions: ProductDimensions): number {
    const { length, width, height } = dimensions
    return 2 * (length * width + length * height + width * height)
  }

  /**
   * Estimate product weight based on dimensions (placeholder)
   * In reality, this would come from product data
   */
  private estimateProductWeight(dimensions: ProductDimensions): number {
    // Simple estimation: 0.5g per cm³ average density
    const volume = dimensions.length * dimensions.width * dimensions.height
    return volume * 0.5
  }

  /**
   * Calculate optimal thickness for given constraints
   */
  suggestOptimalThickness(
    dimensions: ProductDimensions,
    material: MaterialProfile,
    targetWeight?: number
  ): number {
    if (!material.thicknessOptions) {
      return 1.0 // Default 1mm
    }
    
    const availableThicknesses = material.thicknessOptions as number[]
    
    // If no target weight, choose middle thickness
    if (!targetWeight) {
      const midIndex = Math.floor(availableThicknesses.length / 2)
      return availableThicknesses[midIndex]
    }
    
    // Find thickness that gets closest to target weight
    let bestThickness = availableThicknesses[0]
    let bestDiff = Infinity
    
    for (const thickness of availableThicknesses) {
      const weight = this.calculatePackagingWeight(dimensions, material, thickness)
      const totalWeight = weight + this.estimateProductWeight(dimensions)
      const diff = Math.abs(totalWeight - targetWeight)
      
      if (diff < bestDiff) {
        bestDiff = diff
        bestThickness = thickness
      }
    }
    
    return bestThickness
  }
}