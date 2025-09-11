import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get all low inventory fees from the Excel import
    const lowInventoryFees = await prisma.lowInventoryFees.findMany({
      orderBy: [
        { marketplaceGroup: 'asc' },
        { tierGroup: 'asc' },
        { daysOfSupplyLowerBound: 'asc' }
      ]
    });

    return NextResponse.json({
      lowInventoryFees,
      total: lowInventoryFees.length
    });
  } catch (error) {
    console.error('Error fetching low inventory fees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch low inventory fees' },
      { status: 500 }
    );
  }
}