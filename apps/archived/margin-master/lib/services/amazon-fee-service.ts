import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Product context for fee calculations
 * Contains all necessary inputs to calculate Amazon fees
 */
export interface ProductContext {
  marketplace: {
    countryCode: string;
    programCode?: string; // Default to 'STANDARD' if not provided
  };
  product: {
    dimensions: {
      lengthCm: number;
      widthCm: number;
      heightCm: number;
    };
    weightG: number;
    price: number;
    category: string;
    subcategory?: string;
    isApparel?: boolean;
  };
  options?: {
    includeStorageFees?: boolean;
    storageDuration?: number; // months
    isOversized?: boolean;
    includeSippDiscount?: boolean;
    includeLowInventoryFee?: boolean;
    daysOfSupply?: number;
  };
}

/**
 * Fee breakdown interface for unified output
 */
export interface FeeBreakdown {
  fulfillmentFee: {
    baseFee: number;
    sizeTier: string;
    weightBand?: string;
    currency: string;
    details?: {
      perUnitFee?: number;
      perUnitWeight?: number;
      isApparel?: boolean;
      programName?: string;
    };
  };
  referralFee: {
    fee: number;
    percentage: number;
    minimumFee?: number;
    currency: string;
    category: string;
    subcategory?: string;
  };
  storageFee?: {
    monthlyFee: number;
    totalFee: number;
    feePerUnit: number;
    currency: string;
    periodType: string;
    isOversized: boolean;
  };
  sippDiscount?: {
    discount: number;
    currency: string;
    sizeTier: string;
  };
  lowInventoryFee?: {
    fee: number;
    currency: string;
    tierGroup: string;
    daysOfSupply: number;
  };
  totalFees: {
    amount: number;
    currency: string;
    percentageOfPrice: number;
  };
}

/**
 * Main function to get fee breakdown for a product
 */
export async function getFeeBreakdown(context: ProductContext): Promise<FeeBreakdown> {
  const { marketplace, product, options = {} } = context;
  const programCode = marketplace.programCode || 'STANDARD';

  // Get country information
  const country = await prisma.country.findUnique({
    where: { code: marketplace.countryCode }
  });

  if (!country) {
    throw new Error(`Country ${marketplace.countryCode} not found`);
  }

  // Get program information
  const program = await prisma.program.findUnique({
    where: { code: programCode }
  });

  if (!program) {
    throw new Error(`Program ${programCode} not found`);
  }

  // Verify program is available in country by checking if there are any fulfilment fees
  const feeExists = await prisma.fulfilmentFee.findFirst({
    where: {
      countryId: country.id,
      programId: program.id
    }
  });

  if (!feeExists) {
    throw new Error(`Program ${programCode} not available in ${marketplace.countryCode}`);
  }

  // Calculate all fees in parallel for performance
  const [
    fulfillmentFee,
    referralFee,
    storageFee,
    sippDiscount,
    lowInventoryFee
  ] = await Promise.all([
    findFulfillmentFee(context, country.id, program.id),
    findReferralFee(context, country.id, program.id),
    options.includeStorageFees ? findStorageFee(context, country.id, program.id) : null,
    options.includeSippDiscount && programCode === 'SIPP' ? findSippDiscount(context) : null,
    options.includeLowInventoryFee ? findLowInventoryFee(context, country.id) : null
  ]);

  // Calculate total fees
  let totalAmount = fulfillmentFee.baseFee + referralFee.fee;
  
  if (storageFee) {
    totalAmount += storageFee.totalFee;
  }
  
  if (sippDiscount) {
    totalAmount -= sippDiscount.discount;
  }
  
  if (lowInventoryFee) {
    totalAmount += lowInventoryFee.fee;
  }

  return {
    fulfillmentFee: {
      baseFee: fulfillmentFee.baseFee,
      sizeTier: fulfillmentFee.sizeTier,
      weightBand: fulfillmentFee.weightBand,
      currency: country.currency,
      details: {
        perUnitFee: fulfillmentFee.perUnitFee,
        perUnitWeight: fulfillmentFee.perUnitWeight,
        isApparel: fulfillmentFee.isApparel,
        programName: program.name
      }
    },
    referralFee: {
      fee: referralFee.fee,
      percentage: referralFee.percentage,
      minimumFee: referralFee.minimumFee,
      currency: country.currency,
      category: product.category,
      subcategory: product.subcategory
    },
    ...(storageFee && {
      storageFee: {
        monthlyFee: storageFee.monthlyFee,
        totalFee: storageFee.totalFee,
        feePerUnit: storageFee.feePerUnit,
        currency: country.currency,
        periodType: storageFee.periodType,
        isOversized: storageFee.isOversized
      }
    }),
    ...(sippDiscount && {
      sippDiscount: {
        discount: sippDiscount.discount,
        currency: country.currency,
        sizeTier: sippDiscount.sizeTier
      }
    }),
    ...(lowInventoryFee && {
      lowInventoryFee: {
        fee: lowInventoryFee.fee,
        currency: country.currency,
        tierGroup: lowInventoryFee.tierGroup,
        daysOfSupply: lowInventoryFee.daysOfSupply
      }
    }),
    totalFees: {
      amount: totalAmount,
      currency: country.currency,
      percentageOfPrice: (totalAmount / product.price) * 100
    }
  };
}

/**
 * Find the appropriate fulfillment fee based on product dimensions and weight
 */
async function findFulfillmentFee(
  context: ProductContext,
  countryId: string,
  programId: string
): Promise<{
  baseFee: number;
  perUnitFee?: number;
  perUnitWeight?: number;
  sizeTier: string;
  weightBand?: string;
  isApparel: boolean;
}> {
  const { product } = context;
  const now = new Date();

  // Convert dimensions to find matching size tier
  const maxDimension = Math.max(
    product.dimensions.lengthCm,
    product.dimensions.widthCm,
    product.dimensions.heightCm
  );

  // Find all applicable size tiers
  const sizeTiers = await prisma.sizeTier.findMany({
    where: {
      OR: [
        {
          AND: [
            { maxLengthCm: { gte: product.dimensions.lengthCm } },
            { maxWidthCm: { gte: product.dimensions.widthCm } },
            { maxHeightCm: { gte: product.dimensions.heightCm } }
          ]
        },
        {
          maxDimensionsCm: { gte: maxDimension }
        }
      ],
      isApparel: product.isApparel || false
    },
    orderBy: { sortOrder: 'asc' }
  });

  if (sizeTiers.length === 0) {
    throw new Error('No matching size tier found for product dimensions');
  }

  // Try to find fulfillment fee for each size tier
  for (const sizeTier of sizeTiers) {
    const fulfillmentFee = await prisma.fulfilmentFee.findFirst({
      where: {
        countryId,
        programId,
        sizeTierId: sizeTier.id,
        effectiveDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ],
        isApparel: product.isApparel || false,
        ...(sizeTier.isOversized ? {} : {
          weightBand: {
            minWeightG: { lte: product.weightG },
            OR: [
              { maxWeightG: null },
              { maxWeightG: { gte: product.weightG } }
            ]
          }
        })
      },
      include: {
        weightBand: true,
        sizeTier: true
      }
    });

    if (fulfillmentFee) {
      return {
        baseFee: fulfillmentFee.baseFee.toNumber(),
        perUnitFee: fulfillmentFee.perUnitFee?.toNumber(),
        perUnitWeight: fulfillmentFee.perUnitWeight?.toNumber(),
        sizeTier: fulfillmentFee.sizeTier.name,
        weightBand: fulfillmentFee.weightBand ? 
          `${fulfillmentFee.weightBand.minWeightG}-${fulfillmentFee.weightBand.maxWeightG || '∞'}g` : 
          undefined,
        isApparel: fulfillmentFee.isApparel
      };
    }
  }

  throw new Error('No fulfillment fee found for product specifications');
}

/**
 * Find the referral fee based on product category and price
 */
async function findReferralFee(
  context: ProductContext,
  countryId: string,
  programId: string
): Promise<{
  fee: number;
  percentage: number;
  minimumFee?: number;
}> {
  const { product } = context;
  const now = new Date();

  // First try to find exact category match
  let referralFee = await prisma.referralFeeNew.findFirst({
    where: {
      countryId,
      programId,
      category: product.category,
      ...(product.subcategory ? { subcategory: product.subcategory } : {}),
      effectiveDate: { lte: now },
      OR: [
        { endDate: null },
        { endDate: { gte: now } }
      ]
    }
  });

  // If no exact match, try category only
  if (!referralFee && product.subcategory) {
    referralFee = await prisma.referralFeeNew.findFirst({
      where: {
        countryId,
        programId,
        category: product.category,
        subcategory: null,
        effectiveDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ]
      }
    });
  }

  // If still no match, try to find a general category
  if (!referralFee) {
    referralFee = await prisma.referralFeeNew.findFirst({
      where: {
        countryId,
        programId,
        category: 'Everything Else',
        effectiveDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ]
      }
    });
  }

  if (!referralFee) {
    throw new Error(`No referral fee found for category ${product.category}`);
  }

  // Calculate the fee
  const percentageFee = (product.price * referralFee.feePercentage.toNumber()) / 100;
  const minimumFee = referralFee.minimumFee?.toNumber() || 0;
  const perItemMinimum = referralFee.perItemMinimum?.toNumber() || 0;

  const fee = Math.max(percentageFee, minimumFee, perItemMinimum);

  return {
    fee,
    percentage: referralFee.feePercentage.toNumber(),
    minimumFee: Math.max(minimumFee, perItemMinimum) || undefined
  };
}

/**
 * Find storage fees based on product size and duration
 */
async function findStorageFee(
  context: ProductContext,
  countryId: string,
  programId: string
): Promise<{
  monthlyFee: number;
  totalFee: number;
  feePerUnit: number;
  periodType: string;
  isOversized: boolean;
}> {
  const { product, options = {} } = context;
  const duration = options.storageDuration || 1;
  const isOversized = options.isOversized || false;
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-based

  // Find the storage fee for the current period
  const storageFee = await prisma.storageFeeNew.findFirst({
    where: {
      countryId,
      programId,
      effectiveDate: { lte: now },
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } }
          ]
        },
        {
          OR: [
            {
              periodType: 'MONTHLY',
              monthStart: { lte: currentMonth },
              monthEnd: { gte: currentMonth }
            },
            {
              periodType: 'ANNUAL'
            }
          ]
        }
      ]
    }
  });

  if (!storageFee) {
    throw new Error('No storage fee found for current period');
  }

  // Calculate volume in cubic feet (Amazon typically uses cubic feet for storage)
  const volumeCubicFeet = (
    product.dimensions.lengthCm * 
    product.dimensions.widthCm * 
    product.dimensions.heightCm
  ) / 28316.8; // Convert cm³ to ft³

  const feePerUnit = isOversized ? 
    storageFee.oversizeFee.toNumber() : 
    storageFee.standardSizeFee.toNumber();

  const monthlyFee = volumeCubicFeet * feePerUnit;
  const totalFee = monthlyFee * duration;

  return {
    monthlyFee,
    totalFee,
    feePerUnit,
    periodType: storageFee.periodType,
    isOversized
  };
}

/**
 * Find SIPP discount if applicable
 */
async function findSippDiscount(
  context: ProductContext
): Promise<{
  discount: number;
  sizeTier: string;
} | null> {
  const { marketplace, product } = context;
  
  // Find SIPP discount from legacy table
  const sippDiscount = await prisma.sippDiscounts.findFirst({
    where: {
      marketplace: marketplace.countryCode,
      programName: 'SIPP',
      rateWeightLowerBoundKg: { lte: product.weightG / 1000 },
      rateWeightUpperBoundKg: { gte: product.weightG / 1000 }
    }
  });

  if (!sippDiscount) {
    return null;
  }

  return {
    discount: sippDiscount.discount.toNumber(),
    sizeTier: sippDiscount.sizeTierName
  };
}

/**
 * Find low inventory fee if applicable
 */
async function findLowInventoryFee(
  context: ProductContext,
  countryId: string
): Promise<{
  fee: number;
  tierGroup: string;
  daysOfSupply: number;
} | null> {
  const { product, options = {} } = context;
  const daysOfSupply = options.daysOfSupply || 30;

  // Convert weight to kg for comparison
  const weightKg = product.weightG / 1000;

  const lowInventoryFee = await prisma.lowInventoryFees.findFirst({
    where: {
      marketplaceGroup: countryId, // Using countryId as marketplaceGroup for now
      tierWeightLimitKg: { gte: weightKg },
      daysOfSupplyLowerBound: { lte: daysOfSupply },
      daysOfSupplyUpperBound: { gte: daysOfSupply }
    },
    orderBy: {
      tierWeightLimitKg: 'asc'
    }
  });

  if (!lowInventoryFee) {
    return null;
  }

  return {
    fee: lowInventoryFee.fee.toNumber(),
    tierGroup: lowInventoryFee.tierGroup,
    daysOfSupply
  };
}

/**
 * Helper function to validate product context
 */
export function validateProductContext(context: ProductContext): string[] {
  const errors: string[] = [];

  if (!context.marketplace?.countryCode) {
    errors.push('Country code is required');
  }

  if (!context.product) {
    errors.push('Product information is required');
  } else {
    if (!context.product.dimensions) {
      errors.push('Product dimensions are required');
    } else {
      if (!context.product.dimensions.lengthCm || context.product.dimensions.lengthCm <= 0) {
        errors.push('Product length must be greater than 0');
      }
      if (!context.product.dimensions.widthCm || context.product.dimensions.widthCm <= 0) {
        errors.push('Product width must be greater than 0');
      }
      if (!context.product.dimensions.heightCm || context.product.dimensions.heightCm <= 0) {
        errors.push('Product height must be greater than 0');
      }
    }

    if (!context.product.weightG || context.product.weightG <= 0) {
      errors.push('Product weight must be greater than 0');
    }

    if (!context.product.price || context.product.price <= 0) {
      errors.push('Product price must be greater than 0');
    }

    if (!context.product.category) {
      errors.push('Product category is required');
    }
  }

  return errors;
}

/**
 * Calculate dimension weight for oversized products
 */
export function calculateDimensionalWeight(dimensions: {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}): number {
  // Amazon uses dimensional weight divisor of 139 for metric (5000 for imperial)
  const volumeCm3 = dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm;
  return volumeCm3 / 139; // Returns weight in grams
}

/**
 * Determine if product is oversized based on dimensions and weight
 */
export function isProductOversized(
  dimensions: { lengthCm: number; widthCm: number; heightCm: number },
  weightG: number
): boolean {
  // Standard size limits (approximate, varies by marketplace)
  const maxStandardLength = 45; // cm
  const maxStandardWidth = 35; // cm
  const maxStandardHeight = 20; // cm
  const maxStandardWeight = 9000; // grams

  return (
    dimensions.lengthCm > maxStandardLength ||
    dimensions.widthCm > maxStandardWidth ||
    dimensions.heightCm > maxStandardHeight ||
    weightG > maxStandardWeight
  );
}