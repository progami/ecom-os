import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const since = searchParams.get('since')
    
    // Default to 14 days ago if no date provided
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    
    // Fetch bills since the date (bills are ACCPAY invoices)
    const bills = await prisma.invoice.findMany({
      where: {
        type: 'ACCPAY', // Bills are accounts payable invoices
        dueDate: {
          gte: sinceDate
        },
        status: {
          not: {
            equals: 'DELETED'
          }
        }
      },
      select: {
        id: true,
        status: true,
        dueDate: true,
        total: true,
        amountDue: true,
        contactId: true,
        amountPaid: true
      }
    })
    
    // Get unique contact IDs
    const contactIds = [...new Set(bills.map(b => b.contactId).filter(id => id !== null))];
    
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
    
    // Create contact map
    const contactMap = new Map(contacts.map(c => [c.id, c.name || 'Unknown']));
    
    // Calculate reconciliation stats based on payment status
    const totalBills = bills.length
    const reconciledCount = bills.filter((b: any) => b.status === 'AUTHORISED' && b.amountDue?.toNumber() === 0).length
    const pendingCount = totalBills - reconciledCount
    
    // Group by vendor
    const vendorStats = bills.reduce((acc: any, bill: any) => {
      const vendorName = bill.contactId ? contactMap.get(bill.contactId) || 'Unknown' : 'Unknown'
      if (!acc[vendorName]) {
        acc[vendorName] = { reconciledCount: 0, pendingCount: 0 }
      }
      if (bill.status === 'AUTHORISED' && bill.amountDue?.toNumber() === 0) {
        acc[vendorName].reconciledCount++
      } else {
        acc[vendorName].pendingCount++
      }
      return acc
    }, {} as Record<string, { reconciledCount: number; pendingCount: number }>)
    
    // Convert to array and sort by activity
    const accounts = Object.entries(vendorStats)
      .map(([name, stats]) => ({
        name,
        reconciledCount: stats.reconciledCount,
        pendingCount: stats.pendingCount
      }))
      .sort((a, b) => (b.reconciledCount + b.pendingCount) - (a.reconciledCount + a.pendingCount))
    
    // Flag bills for review (e.g., overdue or large amounts)
    const flaggedForReview = bills.filter((bill: any) => {
      const isOverdue = bill.dueDate && new Date(bill.dueDate) < new Date() && bill.amountDue?.toNumber() > 0
      const isLarge = Math.abs(bill.total?.toNumber() || 0) > 10000
      return isOverdue || (isLarge && bill.amountDue?.toNumber() > 0)
    }).length
    
    return NextResponse.json({
      startDate: sinceDate,
      endDate: new Date(),
      totalTransactions: totalBills,
      reconciledCount,
      pendingCount,
      flaggedForReview,
      accounts
    })
    
  } catch (error) {
    console.error('Error fetching reconciliation summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation summary' },
      { status: 500 }
    )
  }
}