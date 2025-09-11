import { NextRequest, NextResponse } from 'next/server';
import SharedFinancialDataService from '@/services/database/SharedFinancialDataService';
import ExpenseService from '@/services/database/ExpenseService';
import { startOfWeek, format } from 'date-fns';
import { getWeekDateRange } from '@/lib/utils/weekHelpers';
import logger from '@/utils/logger';
import { prisma } from '@/utils/database';

const sharedDataService = SharedFinancialDataService.getInstance();
const expenseService = ExpenseService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const quarter = searchParams.get('quarter') ? parseInt(searchParams.get('quarter')!) : null;
    
    // Get both actual revenue and projections
    const actualRevenue = await sharedDataService.getRevenue();
    
    // Filter by year and quarter if specified
    const filteredRevenue = actualRevenue.filter(rev => {
      const weekStarting = new Date(rev.weekStarting);
      const revYear = weekStarting.getFullYear();
      if (revYear !== year) return false;
      
      if (quarter) {
        const month = weekStarting.getMonth();
        const revQuarter = Math.floor(month / 3) + 1;
        return revQuarter === quarter;
      }
      
      return true;
    });
    
    return NextResponse.json({
      actualRevenue: filteredRevenue,
      projections: [] // No longer using hardcoded projections
    });
  } catch (error) {
    logger.error('Error fetching revenue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;
    
    if (action === 'updateActual') {
      const { year, week, sku, units, amount } = data;
      
      // Validate input data
      if (!year || !week || !sku || units === undefined || amount === undefined) {
        logger.error('Missing required fields:', { year, week, sku, units, amount });
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
      
      // Calculate week starting date using the proper week calculation
      const weekRange = getWeekDateRange(year, week);
      const weekStarting = weekRange.start;
      
      // Check if revenue entry exists
      let existingRevenue;
      try {
        existingRevenue = await sharedDataService.getRevenue();
      } catch (error) {
        logger.error('Error fetching existing revenue:', error);
        return NextResponse.json(
          { error: 'Failed to fetch existing revenue' },
          { status: 500 }
        );
      }
      
      const existing = existingRevenue.find(r => {
        const rWeekStart = new Date(r.weekStarting);
        const isSameWeek = rWeekStart.toISOString().split('T')[0] === weekStarting.toISOString().split('T')[0];
        const isSameSku = r.subcategory === sku;
        logger.info('Comparing revenue:', {
          rWeekStart: rWeekStart.toISOString().split('T')[0],
          weekStarting: weekStarting.toISOString().split('T')[0],
          isSameWeek,
          rSku: r.subcategory,
          sku,
          isSameSku,
          match: isSameWeek && isSameSku
        });
        return isSameWeek && isSameSku;
      });
      
      try {
        if (existing && existing.id) {
          // Update existing entry
          await sharedDataService.updateRevenue(existing.id, {
            units,
            amount,
            metadata: {
              ...existing.metadata,
              isActual: true,
              updatedAt: new Date().toISOString()
            }
          });
        } else if (units > 0) {
          // Create new revenue entry only if units > 0
          await sharedDataService.addRevenue({
            weekStarting: weekStarting.toISOString(),
            weekEnding: new Date(weekStarting.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'Amazon Sales',
            subcategory: sku,
            amount,
            units,
            orderCount: Math.round(units / 5), // Estimate
            metadata: {
              isActual: true,
              source: 'revenue-page-edit',
              createdAt: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        logger.error('Error updating/creating revenue:', error);
        return NextResponse.json(
          { error: `Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
      
      
      // After updating revenue, recalculate expenses for that week
      try {
        logger.info('[API] Starting expense recalculation for week:', weekStarting.toISOString());
        
        // Get all revenue data for the affected week
        const allRevenueForWeek = await sharedDataService.getRevenue();
        logger.info('[API] Total revenue entries:', allRevenueForWeek.length);
        
        const relevantRevenue = allRevenueForWeek.filter(r => {
          const rDate = new Date(r.weekStarting);
          const matches = rDate.toISOString().split('T')[0] === weekStarting.toISOString().split('T')[0];
          if (matches) {
            logger.info('[API] Matching revenue:', r.subcategory, r.units, r.amount);
          }
          return matches;
        });
        
        logger.info('[API] Relevant revenue entries for week:', relevantRevenue.length);
        
        // Format data for the expense service
        const skuDataForExpenses = relevantRevenue
          .filter(r => r.subcategory && r.units !== null && r.units !== undefined)
          .map(r => ({
            sku: r.subcategory!,
            units: r.units!,
            grossRevenue: r.amount
          }));
        
        logger.info('[API] SKU data for expenses:', JSON.stringify(skuDataForExpenses));
        
        // Trigger the expense calculation
        if (skuDataForExpenses.length > 0) {
          logger.info(`[API] Calling calculateAndStoreAmazonFees for ${skuDataForExpenses.length} SKUs`);
          await expenseService.calculateAndStoreAmazonFees({
            weekStarting,
            year,
            skuData: skuDataForExpenses
          });
          logger.info('[API] Expense recalculation completed successfully');
        } else {
          logger.info('[API] No SKU data found for expense calculation');
        }
      } catch (error) {
        logger.error('[API] Error recalculating expenses:', error);
        // Log but don't fail the request - revenue update was successful
      }
      
      return NextResponse.json({ success: true });
    }
    
    if (action === 'syncProjections') {
      // Sync projections to revenue table for a specific period
      const { year, startWeek, endWeek } = data;
      
      // Implementation would sync projection data to revenue table
      // This ensures both tables are in sync
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Error updating revenue:', error);
    return NextResponse.json(
      { error: 'Failed to update revenue' },
      { status: 500 }
    );
  }
}