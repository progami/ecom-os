import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AmazonFeeService } from '@/services/database/AmazonFeeService';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sizeTier = searchParams.get('sizeTier');
    const weightOz = searchParams.get('weightOz');
    const price = searchParams.get('price');
    const action = searchParams.get('action');

    // Get available size tiers
    if (action === 'sizeTiers') {
      const sizeTiers = await AmazonFeeService.getAvailableSizeTiers();
      return NextResponse.json({ sizeTiers });
    }

    // Calculate fee for specific parameters
    if (weightOz && sizeTier && price) {
      const fee = await AmazonFeeService.calculateFBAFee(
        parseFloat(weightOz),
        sizeTier,
        parseFloat(price)
      );
      return NextResponse.json({ fee });
    }

    // Get fees for a specific size tier
    if (sizeTier) {
      const fees = await AmazonFeeService.getFeesBySizeTier(sizeTier);
      return NextResponse.json(fees);
    }

    // Get all fees
    const allFees = await prisma.amazonFBAFee.findMany({
      orderBy: [
        { label: 'asc' },
        { productSizeTier: 'asc' },
        { minWeight: 'asc' }
      ]
    });

    const standardFees = allFees.filter(f => f.label === 'standard');
    const lowPriceFees = allFees.filter(f => f.label === 'low-price');

    return NextResponse.json({
      allFees,
      standardFees,
      lowPriceFees,
      summary: {
        totalFees: allFees.length,
        totalStandardFees: standardFees.length,
        totalLowPriceFees: lowPriceFees.length,
        sizeTiers: [...new Set(allFees.map(f => f.productSizeTier))],
        effectiveDate: allFees[0]?.effectiveDate || null
      }
    });
  } catch (error) {
    console.error('Error fetching Amazon fees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Amazon fees' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sku, strategyId } = body;

    if (action === 'updateProductFees') {
      if (sku) {
        // Update single product
        await AmazonFeeService.updateProductFBAFees(sku, strategyId);
        return NextResponse.json({ 
          success: true, 
          message: `FBA fees updated for product ${sku}` 
        });
      } else {
        // Update all products
        await AmazonFeeService.batchUpdateProductFBAFees(strategyId);
        return NextResponse.json({ 
          success: true, 
          message: 'FBA fees updated for all products' 
        });
      }
    }

    if (action === 'addFee') {
      const { label, ...feeData } = body;
      
      const fee = await prisma.amazonFBAFee.create({
        data: {
          label: label || 'standard',
          marketplace: feeData.marketplace || 'US',
          currency: feeData.currency || 'USD',
          effectiveDate: new Date(feeData.effectiveDate),
          expiryDate: feeData.expiryDate ? new Date(feeData.expiryDate) : null,
          productSizeTier: feeData.productSizeTier,
          unitWeight: feeData.unitWeight,
          minWeight: feeData.minWeight,
          maxWeight: feeData.maxWeight,
          priceThreshold: feeData.priceThreshold || null,
          fulfillmentFee: feeData.fulfillmentFee,
          metadata: feeData.metadata || {}
        }
      });
      return NextResponse.json({ success: true, fee });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing Amazon fees:', error);
    return NextResponse.json(
      { error: 'Failed to process Amazon fees' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    await prisma.amazonFBAFee.delete({
      where: { id }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Fee deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting Amazon fee:', error);
    return NextResponse.json(
      { error: 'Failed to delete Amazon fee' },
      { status: 500 }
    );
  }
}