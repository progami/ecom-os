import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { getS3Service } from '@/services/s3.service'
import { formatDateGMT } from '@/lib/date-utils'
import type { CostLedgerGroupResult, CostLedgerBucketTotals } from '@ecom-os/ledger'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for large exports

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the cost ledger data using the same logic as the main route
    const searchParams = request.nextUrl.searchParams
    const costLedgerUrl = new URL('/api/finance/cost-ledger', request.url)
    
    // Pass through all search params
    searchParams.forEach((value, key) => {
      costLedgerUrl.searchParams.set(key, value)
    })

    const costLedgerResponse = await fetch(costLedgerUrl.toString(), {
      headers: {
        cookie: request.headers.get('cookie') || ''
      }
    })

    if (!costLedgerResponse.ok) {
      throw new Error('Failed to fetch cost ledger data')
    }

    const data = await costLedgerResponse.json()
    const {
      groups,
      totals,
      groupBy = searchParams.get('groupBy') || 'week'
    } = data as {
      groups: CostLedgerGroupResult[]
      totals: CostLedgerBucketTotals
      groupBy: string
    }

    const safePercent = (value: number = 0) => {
      if (!totals.total) return '0.0%'
      return `${((value / totals.total) * 100).toFixed(1)}%`
    }

    // Create Excel workbook
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData: (string | number)[][] = [
      ['Cost Ledger Summary'],
      ['Generated:', formatDateGMT(new Date(), true)],
      ['Period:', `${searchParams.get('startDate')} to ${searchParams.get('endDate')}`],
      [''],
      ['Cost Category', 'Total Amount', 'Percentage'],
      ['Storage', totals.storage || 0, safePercent(totals.storage)],
      ['Container', totals.container || 0, safePercent(totals.container)],
      ['Pallet', totals.pallet || 0, safePercent(totals.pallet)],
      ['Carton', totals.carton || 0, safePercent(totals.carton)],
      ['Unit', totals.unit || 0, safePercent(totals.unit)],
      ['Transportation', totals.transportation || 0, safePercent(totals.transportation)],
      ['Accessorial', totals.accessorial || 0, safePercent(totals.accessorial)],
      ['Other', totals.other || 0, safePercent(totals.other)],
      ['', '', ''],
      ['TOTAL', totals.total, '100.0%']
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // Cost by period sheet
    const periodHeaders = groupBy === 'week' 
      ? ['Week Starting', 'Week Ending', 'Storage', 'Container', 'Pallet', 'Carton', 'Unit', 'Transportation', 'Accessorial', 'Other', 'Total']
      : ['Period', 'Storage', 'Container', 'Pallet', 'Carton', 'Unit', 'Transportation', 'Accessorial', 'Other', 'Total']

    const periodData: (string | number | null)[][] = [periodHeaders]
    
    groups.forEach(period => {
      if (groupBy === 'week') {
        periodData.push([
          formatDateGMT(new Date(period.rangeStart)),
          formatDateGMT(new Date(period.rangeEnd)),
          period.costs.storage || 0,
          period.costs.container || 0,
          period.costs.pallet || 0,
          period.costs.carton || 0,
          period.costs.unit || 0,
          period.costs.transportation || 0,
          period.costs.accessorial || 0,
          period.costs.other || 0,
          period.costs.total || 0
        ])
      } else {
        periodData.push([
          period.period,
          period.costs.storage || 0,
          period.costs.container || 0,
          period.costs.pallet || 0,
          period.costs.carton || 0,
          period.costs.unit || 0,
          period.costs.transportation || 0,
          period.costs.accessorial || 0,
          period.costs.other || 0,
          period.costs.total || 0
        ])
      }
    })

    // Add totals row
    if (groupBy === 'week') {
      periodData.push(['', 'TOTAL', totals.storage || 0, totals.container || 0, totals.pallet || 0, totals.carton || 0, totals.unit || 0, totals.transportation || 0, totals.accessorial || 0, totals.other || 0, totals.total || 0])
    } else {
      periodData.push(['TOTAL', totals.storage || 0, totals.container || 0, totals.pallet || 0, totals.carton || 0, totals.unit || 0, totals.transportation || 0, totals.accessorial || 0, totals.other || 0, totals.total || 0])
    }

    const periodWs = XLSX.utils.aoa_to_sheet(periodData)
    XLSX.utils.book_append_sheet(wb, periodWs, `Costs by ${groupBy === 'week' ? 'Week' : 'Month'}`)

    // Detailed transactions sheet
    const detailHeaders = [
      'Date', 'Transaction ID', 'Type', 'Warehouse', 'SKU', 'Batch/Lot', 
      'Category', 'Description', 'Quantity', 'Rate', 'Cost'
    ]
    const detailData: (string | number | null)[][] = [detailHeaders]

    groups.forEach(period => {
      period.details.forEach(detail => {
        detailData.push([
          formatDateGMT(new Date(detail.transactionDate)),
          detail.transactionId,
          detail.transactionType,
          detail.warehouse,
          detail.sku,
          detail.batchLot,
          detail.costCategory,
          detail.costName,
          detail.quantity,
          detail.unitRate,
          detail.totalCost
        ])
      })
    })

    const detailWs = XLSX.utils.aoa_to_sheet(detailData)
    XLSX.utils.book_append_sheet(wb, detailWs, 'Transaction Details')

    // Generate buffer
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const fileName = `cost-ledger-${new Date().toISOString().split('T')[0]}.xlsx`
    
    // Upload to S3 for temporary storage
    const s3Service = getS3Service()
    const s3Key = s3Service.generateKey(
      { 
        type: 'export-temp', 
        userId: session.user.id, 
        exportType: 'cost-ledger' 
      },
      fileName
    )
    
    // Upload with 24 hour expiration
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)
    
    await s3Service.uploadFile(buffer, s3Key, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      metadata: {
        exportType: 'cost-ledger',
        userId: session.user.id,
        filename: fileName,
        groupBy: searchParams.get('groupBy') || 'month',
      },
      expiresAt: expiresAt,
    })
    
    // Get presigned URL for download
    const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'get', {
      responseContentDisposition: `attachment; filename="${fileName}"`,
      expiresIn: 3600, // 1 hour
    })

    // Return URL instead of file directly
    return NextResponse.json({
      success: true,
      downloadUrl: presignedUrl,
      filename: fileName,
      expiresIn: 3600,
    })
  } catch (_error) {
    // console.error('Export cost ledger error:', error)
    return NextResponse.json({ 
      error: 'Failed to export cost ledger',
      details: _error instanceof Error ? _error.message : 'Unknown error'
    }, { status: 500 })
  }
}
