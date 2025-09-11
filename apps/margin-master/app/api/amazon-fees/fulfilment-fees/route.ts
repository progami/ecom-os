import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get all standard fees
    const standardFees = await prisma.standardFees.findMany({
      orderBy: [
        { marketplace: 'asc' },
        { sizeTierName: 'asc' },
        { rateWeightLowerBoundKg: 'asc' }
      ]
    });

    // Get all low price fees 
    const lowPriceFees = await prisma.lowPriceFees.findMany({
      orderBy: [
        { marketplace: 'asc' },
        { sizeTierName: 'asc' },
        { rateWeightLowerBoundKg: 'asc' }
      ]
    });

    return NextResponse.json({
      standardFees,
      lowPriceFees,
      total: standardFees.length + lowPriceFees.length
    });
  } catch (error) {
    console.error('Error fetching fulfilment fees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fulfilment fees' },
      { status: 500 }
    );
  }
}