import { Decimal } from '@prisma/client/runtime/library';

export class ProductCalculationService {
  /**
   * Calculate CBM from dimensions in cm
   */
  static calculateCBM(length: number, width: number, height: number): number {
    // Convert cm to meters and calculate volume
    return (length * width * height) / 1000000;
  }

  /**
   * Determine Amazon FBA Size Tier based on dimensions and weight
   * Based on Amazon's 2024 size tier requirements
   */
  static determineSizeTier(
    lengthCm: number,
    widthCm: number,
    heightCm: number,
    weightOz: number
  ): string {
    // Convert cm to inches for Amazon's requirements
    const lengthIn = lengthCm / 2.54;
    const widthIn = widthCm / 2.54;
    const heightIn = heightCm / 2.54;
    
    // Sort dimensions to get longest, median, shortest
    const dimensions = [lengthIn, widthIn, heightIn].sort((a, b) => b - a);
    const longest = dimensions[0];
    const median = dimensions[1];
    const shortest = dimensions[2];
    
    // Convert weight to pounds
    const weightLb = weightOz / 16;
    
    // Small standard-size
    if (longest <= 15 && median <= 12 && shortest <= 0.75 && weightOz <= 16) {
      return 'Small standard';
    }
    
    // Large standard-size
    if (longest <= 18 && median <= 14 && shortest <= 8 && weightLb <= 20) {
      return 'Large standard';
    }
    
    // Large bulky
    if (longest <= 59 && 
        (longest + 2 * (median + shortest)) <= 130 && 
        weightLb <= 50) {
      return 'Large bulky';
    }
    
    // Extra-large size tiers based on weight
    if (weightLb <= 50) {
      return 'Extra-large 0 to 50 lb';
    } else if (weightLb <= 70) {
      return 'Extra-large 50+ to 70 lb';
    } else if (weightLb <= 150) {
      return 'Extra-large 70+ to 150 lb';
    } else {
      return 'Extra-large 150+ lb';
    }
  }

  /**
   * Convert inches to centimeters
   */
  static inchesToCm(inches: number): number {
    return inches * 2.54;
  }

  /**
   * Convert centimeters to inches
   */
  static cmToInches(cm: number): number {
    return cm / 2.54;
  }

  /**
   * Format dimensions as a display string
   */
  static formatDimensions(length: number, width: number, height: number): string {
    return `${length} x ${width} x ${height} cm`;
  }

  /**
   * Calculate dimensional weight for shipping (in pounds)
   * Using standard divisor of 139 for domestic shipping
   */
  static calculateDimensionalWeight(
    lengthCm: number,
    widthCm: number,
    heightCm: number,
    divisor: number = 139
  ): number {
    const lengthIn = lengthCm / 2.54;
    const widthIn = widthCm / 2.54;
    const heightIn = heightCm / 2.54;
    
    return (lengthIn * widthIn * heightIn) / divisor;
  }

  /**
   * Calculate selling price from costs and desired margin
   */
  static calculateSellingPrice(
    totalCost: number,
    desiredMarginPercent: number
  ): number {
    if (desiredMarginPercent >= 100) {
      throw new Error('Margin percentage must be less than 100%');
    }
    return totalCost / (1 - desiredMarginPercent / 100);
  }

  /**
   * Calculate margin from costs and selling price
   */
  static calculateMargin(sellingPrice: number, totalCost: number): {
    marginAmount: number;
    marginPercent: number;
  } {
    const marginAmount = sellingPrice - totalCost;
    const marginPercent = (marginAmount / sellingPrice) * 100;
    
    return {
      marginAmount,
      marginPercent: marginPercent > 0 ? marginPercent : 0
    };
  }
}