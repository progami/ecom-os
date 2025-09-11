import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { structuredLogger } from '@/lib/logger'
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation'

export async function GET(
  request: NextRequest,
  { params }: { params: { importId: string } }
) {
  try {
    // Validate user session
    const session = await validateSession(request, ValidationLevel.USER)
    if (!session.isValid || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const importId = params.importId

    structuredLogger.info('[Balance Sheet Import API] Fetching imported balance sheet', {
      importId
    })

    // Fetch the specific import
    const reportData = await prisma.reportData.findFirst({
      where: {
        importedReportId: importId,
        reportType: 'BALANCE_SHEET',
        isActive: true
      }
    })

    if (!reportData) {
      structuredLogger.warn('[Balance Sheet Import API] Import not found', {
        importId
      })
      
      return NextResponse.json(
        { 
          error: 'Import not found',
          message: `No balance sheet import found with ID: ${importId}`
        },
        { status: 404 }
      )
    }

    const data = JSON.parse(reportData.data)

    structuredLogger.info('[Balance Sheet Import API] Successfully fetched imported data', {
      importId,
      periodEnd: reportData.periodEnd
    })

    return NextResponse.json({
      ...data,
      source: 'import',
      importId,
      importedAt: reportData.createdAt,
      periodStart: reportData.periodStart,
      periodEnd: reportData.periodEnd,
      fetchedAt: new Date().toISOString()
    })

  } catch (error) {
    structuredLogger.error('[Balance Sheet Import API] Error fetching imported data', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch imported balance sheet',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}