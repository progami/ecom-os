import { NextResponse } from 'next/server';
import { 
  getFeeBreakdown, 
  validateProductContext, 
  ProductContext,
  FeeBreakdown,
  isProductOversized 
} from '@/lib/services/amazon-fee-service';

interface CalculationRequest {
  name: string;
  category: string;
  subcategory?: string;
  marketplace: string;
  program: string;
  salePrice: number;
  productCost: number;
  shippingCost: number;
  length: number;
  width: number;
  height: number;
  weight: number; // in grams
  isApparel?: boolean;
  includeStorageFees?: boolean;
  storageDuration?: number;
  includeSippDiscount?: boolean;
  includeLowInventoryFee?: boolean;
  daysOfSupply?: number;
}

export async function POST(request: Request) {
  try {
    // Parse request body
    const body: CalculationRequest = await request.json();
    
    // Build ProductContext from request
    const productContext: ProductContext = {
      marketplace: {
        countryCode: body.marketplace,
        programCode: body.program
      },
      product: {
        dimensions: {
          lengthCm: body.length,
          widthCm: body.width,
          heightCm: body.height
        },
        weightG: body.weight,
        price: body.salePrice,
        category: body.category,
        subcategory: body.subcategory,
        isApparel: body.isApparel
      },
      options: {
        includeStorageFees: body.includeStorageFees !== false, // Default to true
        storageDuration: body.storageDuration || 1,
        isOversized: isProductOversized(
          { lengthCm: body.length, widthCm: body.width, heightCm: body.height },
          body.weight
        ),
        includeSippDiscount: body.includeSippDiscount && body.program === 'SIPP',
        includeLowInventoryFee: body.includeLowInventoryFee,
        daysOfSupply: body.daysOfSupply
      }
    };

    // Validate product context
    const validationErrors = validateProductContext(productContext);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Invalid product data',
          details: validationErrors 
        },
        { status: 400 }
      );
    }

    // Get fee breakdown from the service
    let feeBreakdown: FeeBreakdown;
    try {
      feeBreakdown = await getFeeBreakdown(productContext);
    } catch (error) {
      // Handle specific service errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { 
          error: 'Fee calculation failed',
          details: errorMessage 
        },
        { status: 400 }
      );
    }

    // Calculate final profitability metrics
    const totalCosts = body.productCost + body.shippingCost + feeBreakdown.totalFees.amount;
    const netProfit = body.salePrice - totalCosts;
    const profitMargin = body.salePrice > 0 ? (netProfit / body.salePrice) * 100 : 0;
    const roi = (body.productCost + body.shippingCost) > 0 
      ? (netProfit / (body.productCost + body.shippingCost)) * 100 
      : 0;

    // Build response with complete analysis
    const response = {
      // Product info
      product: {
        name: body.name,
        category: body.category,
        subcategory: body.subcategory,
        marketplace: body.marketplace,
        program: body.program,
        dimensions: `${body.length}×${body.width}×${body.height} cm`,
        weight: `${body.weight}g`,
        isOversized: productContext.options?.isOversized
      },
      
      // Fee breakdown
      fees: {
        fulfillment: {
          amount: feeBreakdown.fulfillmentFee.baseFee,
          sizeTier: feeBreakdown.fulfillmentFee.sizeTier,
          weightBand: feeBreakdown.fulfillmentFee.weightBand,
          details: feeBreakdown.fulfillmentFee.details
        },
        referral: {
          amount: feeBreakdown.referralFee.fee,
          percentage: feeBreakdown.referralFee.percentage,
          minimumFee: feeBreakdown.referralFee.minimumFee,
          category: feeBreakdown.referralFee.category,
          subcategory: feeBreakdown.referralFee.subcategory
        },
        ...(feeBreakdown.storageFee && {
          storage: {
            monthlyAmount: feeBreakdown.storageFee.monthlyFee,
            totalAmount: feeBreakdown.storageFee.totalFee,
            duration: body.storageDuration || 1,
            periodType: feeBreakdown.storageFee.periodType,
            isOversized: feeBreakdown.storageFee.isOversized
          }
        }),
        ...(feeBreakdown.sippDiscount && {
          sippDiscount: {
            amount: feeBreakdown.sippDiscount.discount,
            sizeTier: feeBreakdown.sippDiscount.sizeTier
          }
        }),
        ...(feeBreakdown.lowInventoryFee && {
          lowInventory: {
            amount: feeBreakdown.lowInventoryFee.fee,
            tierGroup: feeBreakdown.lowInventoryFee.tierGroup,
            daysOfSupply: feeBreakdown.lowInventoryFee.daysOfSupply
          }
        }),
        total: {
          amount: feeBreakdown.totalFees.amount,
          percentageOfPrice: feeBreakdown.totalFees.percentageOfPrice
        }
      },
      
      // Costs breakdown
      costs: {
        product: body.productCost,
        shipping: body.shippingCost,
        amazonFees: feeBreakdown.totalFees.amount,
        total: totalCosts
      },
      
      // Profitability analysis
      profitability: {
        salePrice: body.salePrice,
        netProfit: netProfit,
        profitMargin: profitMargin,
        roi: roi,
        breakEven: netProfit >= 0
      },
      
      // Currency info
      currency: feeBreakdown.totalFees.currency,
      
      // Metadata
      calculated: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in calculate-fees endpoint:', error);
    
    // Generic error response
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while calculating fees'
      },
      { status: 500 }
    );
  }
}