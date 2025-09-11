import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get all referral fees from the Excel import
    const referralFees = await prisma.referralFeesLegacy.findMany({
      orderBy: [
        { marketplaceGroup: 'asc' },
        { productCategory: 'asc' },
        { priceLowerBound: 'asc' }
      ]
    });

    return NextResponse.json({
      referralFees,
      total: referralFees.length
    });
  } catch (error) {
    console.error('Error fetching referral fees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch referral fees' },
      { status: 500 }
    );
  }
}