import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/auth-wrapper'

export const dynamic = 'force-dynamic'

// Finance dashboard functionality removed in v0.5.0 with removal of Invoice/CalculatedCost models
export const GET = withAuth(async (_request, _session) => {
 try {
 // Return minimal dashboard data as most financial models were removed in v0.5.0
 const currentDate = new Date()
 const billingPeriodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
 const billingPeriodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

 return NextResponse.json({
 kpis: {
 totalRevenue: "0.00",
 revenueChange: "0.0",
 outstandingAmount: "0.00",
 outstandingCount: 0,
 costVariance: "0.0",
 costSavings: "0.00",
 collectionRate: "0.0",
 },
 costBreakdown: [],
 invoiceStatus: {
 paid: { count: 0, amount: 0 },
 pending: { count: 0, amount: 0 },
 overdue: { count: 0, amount: 0 },
 disputed: { count: 0, amount: 0 },
 },
 reconciliationStats: {
 matched: 0,
 overbilled: 0,
 underbilled: 0,
 total: 0,
 },
 recentActivity: [],
 billingPeriod: {
 start: billingPeriodStart,
 end: billingPeriodEnd,
 },
 message: 'Finance functionality reduced in v0.5.0'
 })
 } catch (_error) {
 // console.error('Finance dashboard error:', error)
 return NextResponse.json(
 { error: 'Failed to fetch financial data', details: _error instanceof Error ? _error.message : 'Unknown error' },
 { status: 500 }
 )
 }
})