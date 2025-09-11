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
    if (!session.isValid || !session.user || session.user.userId === 'anonymous') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { importId } = params
    
    if (!importId) {
      return NextResponse.json(
        { error: 'Import ID is required' },
        { status: 400 }
      )
    }
    
    structuredLogger.info('[Import Details API] Fetching import details', {
      importId,
      userId: session.user.userId
    })

    // Fetch the imported report with all its data
    const importedReport = await prisma.importedReport.findUnique({
      where: { id: importId },
      select: {
        id: true,
        type: true,
        source: true,
        periodStart: true,
        periodEnd: true,
        importedAt: true,
        importedBy: true,
        fileName: true,
        fileSize: true,
        rawData: true,
        processedData: true,
        status: true,
        errorLog: true,
        recordCount: true,
        metadata: true
      }
    })

    if (!importedReport) {
      structuredLogger.warn('[Import Details API] Import not found', { importId })
      return NextResponse.json(
        { error: 'Import not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    let processedData = null
    let rawData = null
    let metadata = null

    try {
      if (importedReport.processedData) {
        processedData = JSON.parse(importedReport.processedData)
      }
    } catch (error) {
      structuredLogger.error('[Import Details API] Error parsing processed data', { error, importId })
    }

    try {
      if (importedReport.rawData) {
        rawData = JSON.parse(importedReport.rawData)
      }
    } catch (error) {
      structuredLogger.error('[Import Details API] Error parsing raw data', { error, importId })
    }

    try {
      if (importedReport.metadata) {
        metadata = JSON.parse(importedReport.metadata)
      }
    } catch (error) {
      structuredLogger.error('[Import Details API] Error parsing metadata', { error, importId })
    }

    // Transform the response
    const response = {
      id: importedReport.id,
      reportType: importedReport.type,
      source: importedReport.source,
      periodStart: importedReport.periodStart,
      periodEnd: importedReport.periodEnd,
      importedAt: importedReport.importedAt,
      importedBy: importedReport.importedBy,
      fileName: importedReport.fileName,
      fileSize: importedReport.fileSize,
      status: importedReport.status,
      errorLog: importedReport.errorLog,
      recordCount: importedReport.recordCount,
      processedData,
      rawData,
      metadata
    }

    structuredLogger.info('[Import Details API] Successfully fetched import details', {
      importId,
      reportType: importedReport.type,
      hasProcessedData: !!processedData,
      hasRawData: !!rawData
    })

    return NextResponse.json(response)

  } catch (error) {
    structuredLogger.error('[Import Details API] Error fetching import details', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch import details',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}