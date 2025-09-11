import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { structuredLogger } from '@/lib/logger'
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation'

export async function GET(request: NextRequest) {
  try {
    // Validate user session
    const session = await validateSession(request, ValidationLevel.USER)
    if (!session.isValid || !session.user || session.user.userId === 'anonymous') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('reportType')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    
    structuredLogger.info('[Import History API] Fetching import history', {
      reportType,
      limit,
      offset,
      status,
      source
    })

    // Build query filters
    const where: any = {}
    
    if (reportType) {
      where.type = reportType
    }
    
    if (status) {
      where.status = status
    }
    
    if (source) {
      where.source = source
    }

    // Fetch imports
    const [imports, total] = await Promise.all([
      prisma.importedReport.findMany({
        where,
        orderBy: { importedAt: 'desc' },
        take: limit,
        skip: offset,
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
          status: true,
          errorLog: true,
          recordCount: true,
          checksum: true,
          metadata: true
        }
      }),
      prisma.importedReport.count({ where })
    ])

    // Transform data to match frontend interface
    const transformedImports = imports.map(imp => ({
      id: imp.id,
      reportType: imp.type,
      source: imp.source,
      periodStart: imp.periodStart,
      periodEnd: imp.periodEnd,
      importedAt: imp.importedAt,
      importedBy: imp.importedBy,
      fileName: imp.fileName,
      fileSize: imp.fileSize,
      status: imp.status,
      errorLog: imp.errorLog,
      recordCount: imp.recordCount,
      checksum: imp.checksum,
      metadata: imp.metadata ? JSON.parse(imp.metadata) : {}
    }))

    return NextResponse.json({
      imports: transformedImports,
      total,
      limit,
      offset
    })

  } catch (error) {
    structuredLogger.error('[Import History API] Error fetching import history', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch import history',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Validate user session
    const session = await validateSession(request, ValidationLevel.USER)
    if (!session.isValid || !session.user || session.user.userId === 'anonymous') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const importId = searchParams.get('id')

    if (!importId) {
      return NextResponse.json(
        { error: 'Import ID is required' },
        { status: 400 }
      )
    }

    structuredLogger.info('[Import History API] Deleting import', { importId })

    // Delete the import and all related data
    await prisma.$transaction([
      // Delete related report data
      prisma.reportData.deleteMany({
        where: { importedReportId: importId }
      }),
      // Delete related account balances
      prisma.accountBalance.deleteMany({
        where: { importedReportId: importId }
      }),
      // Delete related general ledger entries
      prisma.generalLedgerEntry.deleteMany({
        where: { importedReportId: importId }
      }),
      // Delete the import record
      prisma.importedReport.delete({
        where: { id: importId }
      })
    ])

    structuredLogger.info('[Import History API] Import deleted successfully', { importId })

    return NextResponse.json({
      success: true,
      message: 'Import deleted successfully'
    })

  } catch (error) {
    structuredLogger.error('[Import History API] Error deleting import', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete import',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}