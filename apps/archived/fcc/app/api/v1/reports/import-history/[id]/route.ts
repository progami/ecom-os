import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate user session
    const session = await validateSession(request, ValidationLevel.USER);
    if (!session.isValid || !session.user || session.user.userId === 'anonymous') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = params;
    
    // Fetch the imported report
    const report = await prisma.importedReport.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        source: true,
        status: true,
        recordCount: true,
        fileName: true,
        periodStart: true,
        periodEnd: true,
        importedAt: true,
        importedBy: true,
        rawData: true,
        processedData: true,
        metadata: true,
        errorLog: true,
        importSummary: true
      }
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Failed to fetch import report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import report' },
      { status: 500 }
    );
  }
}