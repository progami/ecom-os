import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, rateLimitConfigs } from '@/lib/security/rate-limiter'
import { getWarehouseFilter } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

function generateStorageLedgerCSV(entries: any[]): string {
  const headers = [
    'Week Ending',
    'Warehouse Code',
    'Warehouse Name', 
    'SKU Code',
    'SKU Description',
    'Batch Lot',
    'Closing Balance',
    'Average Balance',
    'Storage Rate Per Carton',
    'Total Storage Cost',
    'Cost Calculated',
    'Rate Effective Date',
    'Created At'
  ]

  const csvRows = [headers.join(',')]

  entries.forEach(entry => {
    const row = [
      new Date(entry.weekEndingDate).toLocaleDateString(),
      `"${entry.warehouseCode}"`,
      `"${entry.warehouseName}"`,
      `"${entry.skuCode}"`,
      `"${entry.skuDescription.replace(/"/g, '""')}"`,
      `"${entry.batchLot}"`,
      entry.closingBalance,
      entry.averageBalance,
      entry.storageRatePerCarton || '',
      entry.totalStorageCost || '',
      entry.isCostCalculated ? 'Yes' : 'No',
      entry.rateEffectiveDate ? new Date(entry.rateEffectiveDate).toLocaleDateString() : '',
      new Date(entry.createdAt).toLocaleDateString()
    ]
    csvRows.push(row.join(','))
  })

  return csvRows.join('\n')
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(request, rateLimitConfigs.api)
    if (rateLimitResponse) return rateLimitResponse

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only staff and admin can export storage ledger
    if (!['staff', 'admin'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const warehouseCode = searchParams.get('warehouseCode')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const format = searchParams.get('format') || 'csv'

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    // Apply warehouse filter based on user role
    const warehouseFilter = getWarehouseFilter(session.user)
    const where: any = {
      weekEndingDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    if (warehouseFilter.warehouseId) {
      // Staff user - filter to their warehouse
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseFilter.warehouseId },
        select: { code: true }
      })
      if (warehouse) {
        where.warehouseCode = warehouse.code
      }
    } else if (warehouseCode) {
      // Admin user with warehouse filter
      where.warehouseCode = warehouseCode
    }

    // Get all matching entries (no pagination for export)
    const entries = await prisma.storageLedger.findMany({
      where,
      select: {
        warehouseCode: true,
        warehouseName: true,
        skuCode: true,
        skuDescription: true,
        batchLot: true,
        weekEndingDate: true,
        closingBalance: true,
        averageBalance: true,
        storageRatePerCarton: true,
        totalStorageCost: true,
        isCostCalculated: true,
        rateEffectiveDate: true,
        createdAt: true
      },
      orderBy: [
        { weekEndingDate: 'desc' },
        { warehouseCode: 'asc' },
        { skuCode: 'asc' }
      ]
    })

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'No data found for the specified criteria' },
        { status: 404 }
      )
    }

    if (format === 'csv') {
      const csv = generateStorageLedgerCSV(entries)
      const filename = `storage-ledger-${startDate}-to-${endDate}.csv`
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }

    // JSON format
    return NextResponse.json({
      entries,
      exportedAt: new Date().toISOString(),
      criteria: {
        startDate,
        endDate,
        warehouseCode: warehouseCode || 'all'
      },
      totalEntries: entries.length
    })

  } catch (error) {
    console.error('Storage ledger export error:', error)
    return NextResponse.json(
      { error: 'Failed to export storage ledger' },
      { status: 500 }
    )
  }
}