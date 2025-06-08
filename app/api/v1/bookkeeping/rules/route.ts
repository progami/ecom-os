import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const matchType = searchParams.get('matchType');
    const matchField = searchParams.get('matchField');

    // Build filter conditions
    const where: any = {};
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }
    if (matchType) {
      where.matchType = matchType;
    }
    if (matchField) {
      where.matchField = matchField;
    }

    // Fetch rules from database
    const rules = await prisma.categorizationRule.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    return NextResponse.json({ rules }, { status: 200 });
  } catch (error) {
    console.error('Error fetching categorization rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categorization rules' },
      { status: 500 }
    );
  }
}