import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/database';
import { getWeekNumber, getWeekDateRange } from '@/lib/utils/weekHelpers';
import logger from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const quarter = searchParams.get('quarter') ? parseInt(searchParams.get('quarter')!) : null;
    
    
    // Get date range based on quarter or full year
    let startDate: Date;
    let endDate: Date;
    
    if (quarter) {
      // Quarter-specific date ranges, extended to include complete weeks
      const quarterMonths = {
        1: { start: 0, end: 2 },  // Jan-Mar
        2: { start: 3, end: 5 },  // Apr-Jun
        3: { start: 6, end: 8 },  // Jul-Sep
        4: { start: 9, end: 11 }  // Oct-Dec
      };
      
      const months = quarterMonths[quarter as keyof typeof quarterMonths];
      const quarterStart = new Date(year, months.start, 1);
      const quarterEnd = new Date(year, months.end + 1, 0); // Last day of end month
      
      // Find the Sunday start of the week containing the quarter start
      const quarterStartDay = quarterStart.getDay();
      startDate = new Date(quarterStart);
      startDate.setDate(quarterStart.getDate() - quarterStartDay);
      startDate.setHours(0, 0, 0, 0);
      
      // Find the Saturday end of the week containing the quarter end
      const quarterEndDay = quarterEnd.getDay();
      endDate = new Date(quarterEnd);
      endDate.setDate(quarterEnd.getDate() + (6 - quarterEndDay));
      endDate.setHours(23, 59, 59, 999);
      
      // Handle edge case where the week might span into previous/next year
      // For Q1, we might need to include late December from previous year
      // For Q4, we might need to include early January from next year
      if (quarter === 1 && startDate.getFullYear() < year) {
        // Week spans from previous year - this is OK, we want those entries
      } else if (quarter === 4 && endDate.getFullYear() > year) {
        // Week spans into next year - this is OK, we want those entries
      }
    } else {
      // Full year - also extend to complete weeks
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      
      // Find the Sunday start of the week containing January 1
      const yearStartDay = yearStart.getDay();
      startDate = new Date(yearStart);
      startDate.setDate(yearStart.getDate() - yearStartDay);
      startDate.setHours(0, 0, 0, 0);
      
      // Find the Saturday end of the week containing December 31
      const yearEndDay = yearEnd.getDay();
      endDate = new Date(yearEnd);
      endDate.setDate(yearEnd.getDate() + (6 - yearEndDay));
      endDate.setHours(23, 59, 59, 999);
    }
    
    
    
    // Get expenses from Expense table
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'asc' }
    });
    
    
    // Transform expenses to the expected format
    const formattedExpenses = expenses.map(expense => {
      // Use the stored weekStarting value from the database
      return {
        id: expense.id,
        date: expense.date,
        weekStarting: expense.weekStarting, // Use stored value
        category: expense.category,
        subcategory: expense.subcategory,
        description: expense.description,
        amount: expense.amount,
        type: expense.type,
        vendor: expense.vendor || 'Various',
        isRecurring: expense.isRecurring,
        metadata: expense.metadata
      };
    });
    
    return NextResponse.json({ expenses: formattedExpenses });
  } catch (error) {
    logger.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

// POST endpoint removed - use /api/expense-forecast for creating expenses