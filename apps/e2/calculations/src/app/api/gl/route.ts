import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/database';
import logger from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Build where clause
    const where: any = {};
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    
    // Get GL entries
    const entries = await prisma.gLEntry.findMany({
      where,
      orderBy: { date: 'desc' }
    });
    
    return NextResponse.json({ entries });
  } catch (error) {
    logger.error('Error fetching GL entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GL entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data, strategyId } = body;
    
    // Get active strategy if not provided
    let activeStrategyId = strategyId;
    if (!activeStrategyId) {
      const activeStrategy = await prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      });
      if (!activeStrategy) {
        return NextResponse.json(
          { error: 'No active strategy found' },
          { status: 400 }
        );
      }
      activeStrategyId = activeStrategy.id;
    }
    
    if (action === 'addEntry') {
      // For double-entry accounting, create both debit and credit entries
      const entries = [];
      
      // Main entry
      const mainEntry = await prisma.gLEntry.create({
        data: {
          strategyId: activeStrategyId,
          date: new Date(data.date),
          account: data.account,
          accountCategory: data.accountCategory || 'Expense',
          description: data.description,
          debit: data.debit || 0,
          credit: data.credit || 0,
          reference: data.reference,
          metadata: data.metadata || {}
        }
      });
      entries.push(mainEntry);
      
      // If double-entry is specified, create the offsetting entry
      if (data.offsetAccount) {
        const offsetEntry = await prisma.gLEntry.create({
          data: {
            strategyId: activeStrategyId,
            date: new Date(data.date),
            account: data.offsetAccount,
            accountCategory: data.offsetCategory || 'Asset',
            description: data.description,
            debit: data.credit || 0,  // Opposite of main entry
            credit: data.debit || 0,   // Opposite of main entry
            reference: data.reference,
            metadata: data.metadata || {}
          }
        });
        entries.push(offsetEntry);
      }
      
      return NextResponse.json({ entries });
    }
    
    if (action === 'addEntries') {
      const entries = await prisma.gLEntry.createMany({
        data: data.map((entry: any) => ({
          strategyId: activeStrategyId,
          date: new Date(entry.date),
          account: entry.account,
          accountCategory: entry.accountCategory,
          description: entry.description,
          debit: entry.debit || 0,
          credit: entry.credit || 0,
          reference: entry.reference || null,
          source: entry.source || 'manual',
          metadata: entry.metadata || {}
        }))
      });
      
      return NextResponse.json({ count: entries.count });
    }
    
    if (action === 'deleteAll') {
      await prisma.gLEntry.deleteMany({});
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Error processing GL action:', error);
    return NextResponse.json(
      { error: 'Failed to process GL action' },
      { status: 500 }
    );
  }
}