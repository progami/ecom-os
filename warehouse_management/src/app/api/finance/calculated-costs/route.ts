import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  calculateAllCosts, 
  getBillingPeriod,
  getCalculatedCostsSummary,
  type BillingPeriod 
} from '@/lib/calculations/cost-aggregation';
import { parseISO, isValid } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const summary = searchParams.get('summary') === 'true';

    if (!warehouseId) {
      return NextResponse.json(
        { error: 'Warehouse ID is required' },
        { status: 400 }
      );
    }

    let billingPeriod: BillingPeriod;

    // If specific dates provided, use those
    if (startDate && endDate) {
      const start = parseISO(startDate);
      const end = parseISO(endDate);

      if (!isValid(start) || !isValid(end)) {
        return NextResponse.json(
          { error: 'Invalid date format' },
          { status: 400 }
        );
      }

      billingPeriod = { startDate: start, endDate: end };
    } else {
      // Otherwise, calculate current billing period
      billingPeriod = getBillingPeriod(new Date());
    }

    if (summary) {
      // Return summarized costs by category and name
      const costSummary = await getCalculatedCostsSummary(warehouseId, billingPeriod);
      const summaryArray = Array.from(costSummary.values());
      
      return NextResponse.json({
        warehouseId,
        billingPeriod: {
          startDate: billingPeriod.startDate.toISOString(),
          endDate: billingPeriod.endDate.toISOString(),
        },
        costs: summaryArray,
        totalAmount: summaryArray.reduce((sum, cost) => sum + cost.totalAmount, 0),
      });
    } else {
      // Return detailed costs
      const costs = await calculateAllCosts(warehouseId, billingPeriod);
      
      return NextResponse.json({
        warehouseId,
        billingPeriod: {
          startDate: billingPeriod.startDate.toISOString(),
          endDate: billingPeriod.endDate.toISOString(),
        },
        costs,
        totalAmount: costs.reduce((sum, cost) => sum + cost.totalAmount, 0),
      });
    }
  } catch (error) {
    console.error('Error calculating costs:', error);
    return NextResponse.json(
      { error: 'Failed to calculate costs' },
      { status: 500 }
    );
  }
}