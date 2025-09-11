import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get reconciliation stats from bills (ACCPAY invoices) instead of transactions
    const [totalBills, reconciledBills] = await Promise.all([
      prisma.invoice.count({ 
        where: { 
          type: 'ACCPAY', // Bills are accounts payable invoices
          status: {
            not: {
              equals: 'DELETED'
            }
          }
        } 
      }),
      prisma.invoice.count({ 
        where: { 
          type: 'ACCPAY',
          status: 'AUTHORISED',
          amountDue: 0
        } 
      })
    ])

    return NextResponse.json({
      unreconciledCount: totalBills - reconciledBills,
      reconciliationRate: totalBills > 0 
        ? Math.round((reconciledBills / totalBills) * 100)
        : 0,
      // Remove recentTransactions as we're not syncing transactions anymore
      recentTransactions: []
    })
  } catch (error) {
    console.error('Error fetching bookkeeping stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookkeeping statistics' },
      { status: 500 }
    )
  }
}