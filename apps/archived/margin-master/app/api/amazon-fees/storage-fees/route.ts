import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get all storage fees from the Excel import
    const storageFees = await prisma.storageFeesLegacy.findMany({
      orderBy: [
        { marketplaceGroup: 'asc' },
        { productSize: 'asc' },
        { productCategory: 'asc' },
        { period: 'asc' }
      ]
    });

    return NextResponse.json({
      storageFees,
      total: storageFees.length
    });
  } catch (error) {
    console.error('Error fetching storage fees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch storage fees' },
      { status: 500 }
    );
  }
}