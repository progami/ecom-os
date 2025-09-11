import { NextRequest, NextResponse } from 'next/server';
import GLExpenseAnalysisService from '@/services/database/GLExpenseAnalysisService';
import logger from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const quarter = searchParams.get('quarter') ? parseInt(searchParams.get('quarter')!) : undefined;
    
    // Use the dedicated service for expense analysis
    const glExpenseService = GLExpenseAnalysisService.getInstance();
    const result = await glExpenseService.getWeeklyExpenseSummary(year, quarter);
    
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error fetching GL expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GL expenses' },
      { status: 500 }
    );
  }
}

// Additional endpoint to get expense breakdown
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, quarter } = body;
    
    const glExpenseService = GLExpenseAnalysisService.getInstance();
    const breakdown = await glExpenseService.getExpenseBreakdown(
      year || new Date().getFullYear(),
      quarter
    );
    
    return NextResponse.json(breakdown);
  } catch (error) {
    logger.error('Error getting expense breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to get expense breakdown' },
      { status: 500 }
    );
  }
}