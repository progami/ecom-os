import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/database';
import logger from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    
    // Get active strategy
    const activeStrategy = await prisma.budgetStrategy.findFirst({
      where: { isActive: true }
    });
    
    if (!activeStrategy) {
      // Return empty if no active strategy
      return NextResponse.json({ entries: [] });
    }
    
    // Build where clause for date range
    const dateWhere: any = {};
    if (startDate && endDate) {
      dateWhere.date = {
        gte: startDate,
        lte: endDate
      };
    } else if (startDate) {
      dateWhere.date = { gte: startDate };
    } else if (endDate) {
      dateWhere.date = { lte: endDate };
    }
    
    // Get GL entries that are linked to the active strategy's data
    // This includes:
    // 1. GL entries linked to UnitSales of the active strategy
    // 2. GL entries linked to Expenses of the active strategy
    // 3. Manual GL entries (not linked to any source data)
    
    const entries = await prisma.gLEntry.findMany({
      where: {
        ...dateWhere,
        OR: [
          // GL entries linked to UnitSales of active strategy
          {
            UnitSalesGLEntry: {
              some: {
                UnitSales: {
                  strategyId: activeStrategy.id
                }
              }
            }
          },
          // GL entries linked to Expenses of active strategy
          {
            ExpenseGLEntry: {
              some: {
                Expense: {
                  strategyId: activeStrategy.id
                }
              }
            }
          },
          // Manual entries (not linked to any source)
          {
            AND: [
              { source: 'manual' },
              { UnitSalesGLEntry: { none: {} } },
              { ExpenseGLEntry: { none: {} } }
            ]
          },
          // Bank reconciliation entries
          {
            source: 'bank-reconciliation'
          },
          // Unit sales entries (all of them, since they're created by the active strategy's sales)
          {
            source: 'unit-sales'
          },
          // Recurring expense entries
          {
            source: 'recurring-expense'
          },
          // System entries (like opening balance)
          {
            source: 'System'
          },
          // Inventory/COGS entries
          {
            source: 'inventory-purchase'
          },
          // Expense forecast entries (including office equipment)
          {
            source: 'expense-forecast'
          },
          // Direct GL entries with strategy ID (for backwards compatibility)
          {
            strategyId: activeStrategy.id
          }
        ]
      },
      orderBy: { date: 'asc' }
    });
    
    // Return raw entries with original structure
    return NextResponse.json({ 
      entries: entries.map(entry => ({
        ...entry,
        debit: entry.debit.toNumber(),
        credit: entry.credit.toNumber()
      }))
    });
  } catch (error) {
    logger.error('Error fetching raw GL entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GL entries' },
      { status: 500 }
    );
  }
}