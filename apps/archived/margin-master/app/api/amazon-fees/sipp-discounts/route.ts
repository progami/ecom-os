import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get all SIPP discounts from the Excel import
    const sippDiscounts = await prisma.sippDiscounts.findMany({
      orderBy: [
        { marketplace: 'asc' },
        { programName: 'asc' },
        { sizeTierName: 'asc' },
        { rateWeightLowerBoundKg: 'asc' }
      ]
    });

    return NextResponse.json({
      sippDiscounts,
      total: sippDiscounts.length
    });
  } catch (error) {
    console.error('Error fetching SIPP discounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SIPP discounts' },
      { status: 500 }
    );
  }
}