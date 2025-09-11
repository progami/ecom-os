import { NextRequest, NextResponse } from 'next/server'
import { ReportDatabaseFetcher } from '@/lib/report-database-fetcher'
import { structuredLogger } from '@/lib/logger'
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation'

export async function GET(request: NextRequest) {
  try {
    // Validate user session
    const session = await validateSession(request, ValidationLevel.USER)
    if (!session.isValid || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const importId = searchParams.get('importId')
    const asAtDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date()

    structuredLogger.info('[Trial Balance Report API] Fetching trial balance', {
      importId,
      asAtDate: asAtDate.toISOString()
    })

    // Fetch from database (includes imported data)
    const databaseData = await ReportDatabaseFetcher.fetchTrialBalance(asAtDate, importId || undefined)
    
    if (databaseData) {
      structuredLogger.info('[Trial Balance Report API] Successfully fetched from database', {
        source: importId ? 'import' : 'database',
        importId
      })
      
      return NextResponse.json({
        ...databaseData,
        source: importId ? 'import' : 'database',
        fetchedAt: new Date().toISOString()
      })
    }

    // No data found
    return NextResponse.json(
      { 
        error: 'No trial balance data found',
        message: importId ? 'Import not found' : 'No data available'
      },
      { status: 404 }
    )

  } catch (error) {
    structuredLogger.error('[Trial Balance Report API] Error fetching trial balance', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch trial balance',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}