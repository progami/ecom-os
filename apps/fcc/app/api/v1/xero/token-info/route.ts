import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DatabaseSession } from '@/lib/database-session'
import { Logger } from '@/lib/logger'

const logger = new Logger({ component: 'xero-token-info' })

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    logger.info('Fetching Xero token information')
    
    // Get token from database
    const databaseToken = await DatabaseSession.getXeroToken()
    
    if (!databaseToken) {
      logger.info('No Xero token found')
      return NextResponse.json({
        hasToken: false,
        expiresAt: null
      })
    }
    
    // Get additional info from user record
    const user = await prisma.user.findFirst({
      where: {
        xeroAccessToken: { not: null }
      },
      select: {
        tokenExpiresAt: true,
        updatedAt: true
      }
    })
    
    // Calculate expiry time (tokens expire after 30 minutes)
    const expiresAt = user?.tokenExpiresAt || 
      new Date(databaseToken.expires_at * 1000)
    
    logger.info('Token info retrieved', {
      hasToken: true,
      expiresAt: expiresAt.toISOString(),
      isExpired: expiresAt < new Date()
    })
    
    return NextResponse.json({
      hasToken: true,
      expiresAt: expiresAt.toISOString(),
      issuedAt: user?.updatedAt || null
    })
  } catch (error) {
    logger.error('Error fetching token info', error)
    return NextResponse.json(
      { error: 'Failed to fetch token information' },
      { status: 500 }
    )
  }
}