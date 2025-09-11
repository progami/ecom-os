import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/database';
import GLEntryService from '@/services/database/GLEntryService';
import logger from '@/utils/logger';

const glEntryService = GLEntryService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters into filters
    const filters = {
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      accountType: searchParams.get('accountType') || undefined,
      accountCode: searchParams.get('accountCode') || undefined,
      category: searchParams.get('category') || undefined,
      isProjection: searchParams.get('isProjection') ? searchParams.get('isProjection') === 'true' : undefined,
      isReconciled: searchParams.get('isReconciled') ? searchParams.get('isReconciled') === 'true' : undefined,
      isActual: searchParams.get('isActual') ? searchParams.get('isActual') === 'true' : undefined,
    };
    
    // Use the service method to get filtered entries
    const result = await glEntryService.getFilteredEntries(filters);
    
    return NextResponse.json(result);
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
    const { entries } = body;
    
    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: 'Invalid entries data' },
        { status: 400 }
      );
    }
    
    // Save entries to database
    await glEntryService.setEntries(entries);
    
    return NextResponse.json({ 
      success: true,
      message: `Saved ${entries.length} GL entries`
    });
  } catch (error) {
    logger.error('Error saving GL entries:', error);
    return NextResponse.json(
      { error: 'Failed to save GL entries' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entry } = body;
    
    if (!entry) {
      return NextResponse.json(
        { error: 'Invalid entry data' },
        { status: 400 }
      );
    }
    
    // Check reconciliation lock for manual expense entries
    if (entry.source === 'manual' || entry.source === 'manual-expense') {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      
      const reconStatus = await prisma.reconciliationStatus.findFirst({
        where: { isActive: true }
      });
      
      if (reconStatus && entryDate <= reconStatus.lastReconciledDate) {
        return NextResponse.json(
          { 
            error: `Cannot add manual entries for reconciled period. Reconciled through: ${reconStatus.lastReconciledDate.toLocaleDateString()}` 
          },
          { status: 403 }
        );
      }
    }
    
    // Add single entry
    await glEntryService.addEntry(entry);
    
    return NextResponse.json({ 
      success: true,
      message: 'Added GL entry'
    });
  } catch (error) {
    logger.error('Error adding GL entry:', error);
    return NextResponse.json(
      { error: 'Failed to add GL entry' },
      { status: 500 }
    );
  }
}