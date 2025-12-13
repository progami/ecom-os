import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withValidation } from '@/lib/validation/middleware';
import { analyticsPeriodSchema } from '@/lib/validation/schemas';

export const GET = withValidation(
  { querySchema: analyticsPeriodSchema },
  async (request, { query }) => {
    try {
      console.log('[Analytics API] Top vendors called with period:', query?.period);
      const period = query?.period || '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    let days = 30;
    switch (period) {
      case '7d':
        days = 7;
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        days = 30;
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        days = 90;
        startDate.setDate(now.getDate() - 90);
        break;
      case 'year':
        days = 365;
        startDate.setDate(now.getDate() - 365);
        break;
      default:
        days = 30;
        startDate.setDate(now.getDate() - 30);
    }

    // Query from database - group bills (ACCPAY invoices) by vendor
    const bills = await prisma.invoice.findMany({
      where: {
        date: {
          gte: startDate,
          lte: now
        },
        type: 'ACCPAY', // Bills are accounts payable invoices
        status: {
          not: {
            equals: 'DELETED'
          }
        }
      },
      // Note: Contact data will be fetched separately
    });

    console.log('[Analytics API] Found', bills.length, 'bills in current period');
    console.log('[Analytics API] Sample bill:', bills[0] ? {
      contactId: bills[0].contactId,
      total: bills[0].total?.toNumber(),
      amountDue: bills[0].amountDue?.toNumber(),
      date: bills[0].date
    } : 'No bills');

    // Calculate comparison period for growth
    const compareStartDate = new Date(startDate);
    compareStartDate.setDate(compareStartDate.getDate() - days);
    const compareEndDate = new Date(startDate);
    
    // Get previous period bills
    const previousBills = await prisma.invoice.findMany({
      where: {
        date: { 
          gte: compareStartDate, 
          lt: compareEndDate 
        },
        type: 'ACCPAY',
        status: {
          not: {
            equals: 'DELETED'
          }
        }
      }
    });

    // Get unique contact IDs from both current and previous bills
    const allBills = [...bills, ...previousBills];
    const contactIds = [...new Set(allBills.map(bill => bill.contactId).filter(id => id !== null))];
    
    // Fetch contacts
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds }
      },
      select: {
        id: true,
        name: true
      }
    });
    
    // Create contact map for quick lookup
    const contactMap = new Map(contacts.map(c => [c.id, c.name || 'Unknown Vendor']));

    // Group bills by vendor
    const vendorSpending: Record<string, {
      name: string;
      totalAmount: number;
      billCount: number;
      lastBillDate: Date;
      previousAmount: number;
    }> = {};

    // Process current period bills
    bills.forEach((bill) => {
      const vendorName = bill.contactId ? contactMap.get(bill.contactId) || 'Unknown Vendor' : 'Unknown Vendor';
      
      if (!vendorSpending[vendorName]) {
        vendorSpending[vendorName] = {
          name: vendorName,
          totalAmount: 0,
          billCount: 0,
          lastBillDate: bill.date,
          previousAmount: 0
        };
      }
      
      // Bills already have positive amounts
      vendorSpending[vendorName].totalAmount += bill.total?.toNumber() || 0;
      vendorSpending[vendorName].billCount += 1;
      
      if (bill.date > vendorSpending[vendorName].lastBillDate) {
        vendorSpending[vendorName].lastBillDate = bill.date;
      }
    });

    // Process previous period bills
    previousBills.forEach((bill) => {
      const vendorName = bill.contactId ? contactMap.get(bill.contactId) || 'Unknown Vendor' : 'Unknown Vendor';
      
      if (!vendorSpending[vendorName]) {
        vendorSpending[vendorName] = {
          name: vendorName,
          totalAmount: 0,
          billCount: 0,
          lastBillDate: new Date(0),
          previousAmount: 0
        };
      }
      
      vendorSpending[vendorName].previousAmount += bill.total?.toNumber() || 0;
    });

    // Convert to array and sort by total spend
    const sortedVendors = Object.values(vendorSpending)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    // Calculate total spend
    const totalSpend = Object.values(vendorSpending)
      .reduce((sum, vendor) => sum + vendor.totalAmount, 0);
    
    console.log('[Analytics API] Total spend calculated:', totalSpend);
    console.log('[Analytics API] Top vendors:', sortedVendors.slice(0, 3).map(v => ({
      name: v.name,
      totalAmount: v.totalAmount
    })));

    // Format response to match test expectations
    const topVendors = sortedVendors.map((vendor, index) => {
      let growth = 0;
      if (vendor.previousAmount > 0) {
        growth = ((vendor.totalAmount - vendor.previousAmount) / vendor.previousAmount) * 100;
      } else if (vendor.totalAmount > 0) {
        growth = 100; // New vendor
      }
      
      return {
        rank: index + 1,
        name: vendor.name,
        totalAmount: vendor.totalAmount,
        transactionCount: vendor.billCount, // Keep field name for backward compatibility
        lastTransaction: vendor.lastBillDate.toISOString(), // Keep field name for backward compatibility
        percentageOfTotal: totalSpend > 0 ? parseFloat(((vendor.totalAmount / totalSpend) * 100).toFixed(1)) : 0,
        averageTransactionAmount: vendor.billCount > 0 ? vendor.totalAmount / vendor.billCount : 0,
        growth: parseFloat(growth.toFixed(1))
      };
    });

      return NextResponse.json({
        success: true,
        topVendors,
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalSpend,
        vendorCount: Object.keys(vendorSpending).length,
        summary: {
          topVendorSpend: sortedVendors.reduce((sum, v) => sum + v.totalAmount, 0),
          topVendorPercentage: totalSpend > 0 
            ? (sortedVendors.reduce((sum, v) => sum + v.totalAmount, 0) / totalSpend) * 100 
            : 0,
          currency: 'GBP'
        }
      });

    } catch (error: any) {
      console.error('Error fetching top vendors from database:', error);
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch top vendors',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      );
    }
  }
)