import { NextRequest, NextResponse } from 'next/server'
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation'
import { prisma } from '@/lib/prisma'
// Removed Xero client import - setup status should check database only

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await validateSession(request, ValidationLevel.USER)
    
    if (!session.isValid || !session.user) {
      return NextResponse.json({
        hasXeroConnection: false,
        hasData: false,
        hasCompletedSetup: false,
        isAuthenticated: false
      })
    }

    // Check Xero connection status from database instead of making API calls
    let hasXeroConnection = false
    let organizationName = null
    
    try {
      // Check if we have a valid Xero token in the database
      const userWithToken = await prisma.user.findFirst({
        where: {
          email: session.user.email,
          xeroAccessToken: { not: null },
          tokenExpiresAt: { gt: new Date() }
        },
        select: {
          xeroAccessToken: true,
          tenantName: true
        }
      })
      
      hasXeroConnection = !!userWithToken?.xeroAccessToken
      organizationName = userWithToken?.tenantName || null
    } catch (error) {
      // No valid Xero connection
      hasXeroConnection = false
    }

    // Check if we have any data
    const [
      bankAccountCount,
      transactionCount,
      glAccountCount,
      lastSyncRecord
    ] = await Promise.all([
      prisma.bankAccount.count(),
      prisma.bankTransaction.count(),
      prisma.gLAccount.count(),
      prisma.syncLog.findFirst({
        where: { 
          status: 'success',
          syncType: { in: ['full_sync', 'incremental_sync'] }
        },
        orderBy: { completedAt: 'desc' }
      })
    ])

    const hasData = bankAccountCount > 0 || transactionCount > 0 || glAccountCount > 0
    
    // Check if user has completed setup
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { hasCompletedSetup: true }
    })

    return NextResponse.json({
      isAuthenticated: true,
      hasXeroConnection,
      hasData,
      hasCompletedSetup: user?.hasCompletedSetup || false,
      organizationName,
      lastSync: lastSyncRecord?.completedAt || null,
      dataCounts: {
        bankAccounts: bankAccountCount,
        transactions: transactionCount,
        glAccounts: glAccountCount
      }
    })
  } catch (error: any) {
    console.error('Setup status error:', error)
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    )
  }
}