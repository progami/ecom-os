import { NextRequest, NextResponse } from 'next/server';
import ExpenseService from '@/services/database/ExpenseService';
import logger from '@/utils/logger';

const expenseService = ExpenseService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }
    
    const expenses = await expenseService.getExpensesByDateRange(
      new Date(startDate),
      new Date(endDate)
    );
    
    return NextResponse.json({ expenses });
  } catch (error) {
    logger.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { expenses } = body;
    
    if (!expenses || !Array.isArray(expenses)) {
      return NextResponse.json(
        { error: 'Invalid expenses data' },
        { status: 400 }
      );
    }
    
    // Upsert expenses
    await expenseService.upsertExpenses(expenses);
    
    return NextResponse.json({ 
      success: true,
      message: `Processed ${expenses.length} expenses`
    });
  } catch (error) {
    logger.error('Error saving expenses:', error);
    return NextResponse.json(
      { error: 'Failed to save expenses' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { weekStarting, year, skuData } = body;
    
    if (!weekStarting || !year || !skuData) {
      return NextResponse.json(
        { error: 'weekStarting, year, and skuData are required' },
        { status: 400 }
      );
    }
    
    // Calculate and store Amazon fees
    await expenseService.calculateAndStoreAmazonFees({
      weekStarting: new Date(weekStarting),
      year,
      skuData
    });
    
    return NextResponse.json({ 
      success: true,
      message: 'Amazon fees calculated and stored'
    });
  } catch (error) {
    logger.error('Error calculating Amazon fees:', error);
    return NextResponse.json(
      { error: 'Failed to calculate Amazon fees' },
      { status: 500 }
    );
  }
}