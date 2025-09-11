import { NextRequest, NextResponse } from 'next/server';
import SharedFinancialDataService from '@/services/database/SharedFinancialDataService';
import logger from '@/utils/logger';

const sharedDataService = SharedFinancialDataService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    
    if (type === 'revenue') {
      const revenues = await sharedDataService.getRevenue();
      
      // Transform to the expected format
      const revenueData: any = {};
      
      revenues.forEach(rev => {
        const yearWeek = `${new Date(rev.weekStarting).getFullYear()}-W${String(Math.ceil((new Date(rev.weekStarting).getMonth() + 1) / 12 * 52)).padStart(2, '0')}`;
        
        if (!revenueData[yearWeek]) {
          revenueData[yearWeek] = {};
        }
        
        if (rev.subcategory) {
          revenueData[yearWeek][rev.subcategory] = {
            grossRevenue: rev.amount,
            units: rev.units || 0,
            orderCount: rev.orderCount || 0
          };
        }
      });
      
      return NextResponse.json({ data: revenueData });
    } else {
      return NextResponse.json(
        { error: 'Invalid type parameter. Use "revenue"' },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Error fetching shared data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared data' },
      { status: 500 }
    );
  }
}