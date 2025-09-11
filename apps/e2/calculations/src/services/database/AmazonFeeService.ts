import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class AmazonFeeService {
  /**
   * Calculate selling price from product costs
   */
  private static calculateSellingPriceFromCosts(product: any): number {
    // Sum up all costs
    const manufacturing = product.manufacturing?.toNumber() || 0;
    const freight = product.freight?.toNumber() || 0;
    const tariff = product.tariff?.toNumber() || 0;
    const awd = product.awd?.toNumber() || 0;
    const fulfillmentFee = product.fulfillmentFee?.toNumber() || 0;
    const referralFee = product.referralFee?.toNumber() || 0;
    
    const totalCost = manufacturing + freight + tariff + awd + fulfillmentFee + referralFee;
    
    // Apply default margin if not set
    const marginPercent = product.marginPercent?.toNumber() || 30;
    
    return totalCost / (1 - marginPercent / 100);
  }
  /**
   * Calculate the FBA fulfillment fee for a product
   * @param weightOz Product weight in ounces
   * @param sizeTier Product size tier (e.g., "Small standard", "Large standard")
   * @param price Product selling price (to determine if low-price FBA applies)
   * @param marketplace Destination marketplace (e.g., "US", "UK", "DE")
   * @param effectiveDate Date to check fees for (defaults to current date)
   */
  static async calculateFBAFee(
    weightOz: number,
    sizeTier: string,
    price: number,
    marketplace: string = 'US',
    effectiveDate: Date = new Date()
  ): Promise<{ fee: number; isLowPrice: boolean; feeType: string; currency: string }> {
    // Determine price threshold based on marketplace
    const priceThresholds: Record<string, number> = {
      'US': 10,
      'UK': 10,
      'DE': 10,
      'FR': 10,
      'IT': 10,
      'ES': 10,
      'JP': 1500
    };
    
    const threshold = priceThresholds[marketplace] || 10;
    
    // Check if low-price FBA applies
    if (price < threshold) {
      console.log(`Looking for Low-Price fee: marketplace=${marketplace}, sizeTier=${sizeTier}, weight=${weightOz}oz`)
      const lowPriceFee = await prisma.amazonFBAFee.findFirst({
        where: {
          marketplace: marketplace,
          label: 'low-price',
          productSizeTier: sizeTier,
          minWeight: { lte: weightOz },
          AND: [
            {
              OR: [
                { maxWeight: { gte: weightOz } },
                { maxWeight: null }
              ]
            },
            {
              effectiveDate: { lte: effectiveDate }
            },
            {
              OR: [
                { expiryDate: null },
                { expiryDate: { gt: effectiveDate } }
              ]
            }
          ]
        },
        orderBy: { effectiveDate: 'desc' }
      });

      if (lowPriceFee) {
        console.log(`Found Low-Price fee: ${lowPriceFee.unitWeight} = $${lowPriceFee.fulfillmentFee}`)
        return {
          fee: lowPriceFee.fulfillmentFee.toNumber(),
          isLowPrice: true,
          feeType: 'Low-Price FBA',
          currency: lowPriceFee.currency
        };
      } else {
        console.log('No Low-Price fee found!')
      }
    }

    // Use standard FBA fees
    const standardFee = await prisma.amazonFBAFee.findFirst({
      where: {
        marketplace: marketplace,
        label: 'standard',
        productSizeTier: sizeTier,
        minWeight: { lte: weightOz },
        AND: [
          {
            OR: [
              { maxWeight: { gte: weightOz } },
              { maxWeight: null }
            ]
          },
          {
            effectiveDate: { lte: effectiveDate }
          },
          {
            OR: [
              { expiryDate: null },
              { expiryDate: { gt: effectiveDate } }
            ]
          }
        ]
      },
      orderBy: { effectiveDate: 'desc' }
    });

    if (standardFee) {
      let calculatedFee = standardFee.fulfillmentFee.toNumber();
      
      // Calculate additional per-weight charges for heavier items
      if (sizeTier === 'Large standard' && weightOz > 48) {
        // $0.16 per half-pound above 3 lb (48 oz)
        const additionalHalfPounds = Math.ceil((weightOz - 48) / 8);
        calculatedFee += additionalHalfPounds * 0.16;
      } else if (sizeTier.includes('bulky') || sizeTier.includes('Extra-large')) {
        // $0.38 per pound above base weight (varies by tier)
        let baseWeight = 16; // 1 lb default
        if (sizeTier === 'Extra-large 50+ to 70 lb') baseWeight = 816; // 51 lb
        else if (sizeTier === 'Extra-large 70+ to 150 lb') baseWeight = 1136; // 71 lb
        else if (sizeTier === 'Extra-large 150+ lb') baseWeight = 2416; // 151 lb
        
        if (weightOz > baseWeight) {
          const additionalPounds = (weightOz - baseWeight) / 16;
          const ratePerPound = sizeTier === 'Extra-large 150+ lb' ? 0.83 : 0.38;
          calculatedFee += additionalPounds * ratePerPound;
        }
      }

      return {
        fee: calculatedFee,
        isLowPrice: false,
        feeType: 'Standard FBA',
        currency: standardFee.currency
      };
    }

    // No fee found - return 0
    return {
      fee: 0,
      isLowPrice: false,
      feeType: 'No fee found',
      currency: 'USD'
    };
  }

  /**
   * Get all FBA fees for a specific size tier
   */
  static async getFeesBySizeTier(sizeTier: string, effectiveDate: Date = new Date()) {
    const fees = await prisma.amazonFBAFee.findMany({
      where: {
        productSizeTier: sizeTier,
        effectiveDate: { lte: effectiveDate },
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: effectiveDate } }
        ]
      },
      orderBy: [
        { label: 'asc' },
        { effectiveDate: 'desc' },
        { minWeight: 'asc' }
      ]
    });

    const standardFees = fees.filter(f => f.label === 'standard');
    const lowPriceFees = fees.filter(f => f.label === 'low-price');

    return {
      standardFees,
      lowPriceFees
    };
  }

  /**
   * Get all available size tiers
   */
  static async getAvailableSizeTiers(): Promise<string[]> {
    const result = await prisma.amazonFBAFee.findMany({
      distinct: ['productSizeTier'],
      select: { productSizeTier: true }
    });

    return result.map(r => r.productSizeTier);
  }

  /**
   * Update product FBA fees based on current weight and size tier
   */
  static async updateProductFBAFees(
    sku: string,
    strategyId?: string,
    sellingPrice?: number
  ): Promise<void> {
    const product = await prisma.product.findFirst({
      where: { 
        sku,
        ...(strategyId && { strategyId })
      }
    });

    if (!product) {
      throw new Error(`Product not found: ${sku}`);
    }

    // Use provided size tier or calculate from dimensions
    let sizeTier = product.sizeTier || 'Large standard';
    
    const weightOz = product.weightOz?.toNumber() || (product.weightLb?.toNumber() || 0) * 16 || 0;
    // Calculate selling price from costs if not provided
    const price = sellingPrice || this.calculateSellingPriceFromCosts(product);

    const feeResult = await this.calculateFBAFee(
      weightOz,
      sizeTier,
      price
    );

    // Update the product with the calculated FBA fee
    await prisma.product.update({
      where: { id: product.id },
      data: {
        fulfillmentFee: feeResult.fee,
        sizeTier,
        metadata: {
          ...((product.metadata as any) || {}),
          fbaFeeType: feeResult.feeType,
          fbaFeeCalculatedAt: new Date().toISOString()
        }
      }
    });
  }

  /**
   * Batch update FBA fees for all products
   */
  static async batchUpdateProductFBAFees(strategyId?: string): Promise<void> {
    const products = await prisma.product.findMany({
      where: strategyId ? { strategyId } : {}
    });

    console.log(`Updating FBA fees for ${products.length} products...`);

    for (const product of products) {
      try {
        await this.updateProductFBAFees(product.sku, product.strategyId || undefined);
        console.log(`✅ Updated FBA fees for ${product.sku}`);
      } catch (error) {
        console.error(`❌ Failed to update FBA fees for ${product.sku}:`, error);
      }
    }

    console.log('FBA fee update completed');
  }
}