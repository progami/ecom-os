import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createReadStream } from 'fs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      include: {
        warehouse: true,
        sku: true
      },
      orderBy: {
        transactionDate: 'desc'
      }
    })

    // Analyze missing attributes
    const missingData = transactions.map(transaction => {
      const missing: string[] = []
      const attachments = (transaction.attachments as any) || {}
      
      // Check for required documents based on transaction type
      if (transaction.transactionType === 'RECEIVE') {
        if (!attachments.packingList) missing.push('Packing List')
        if (!attachments.commercialInvoice) missing.push('Commercial Invoice')
        if (!attachments.deliveryNote) missing.push('Delivery Note')
        if (!attachments.cubemaster) missing.push('Cube Master Stacking Style')
        if (!transaction.shipName) missing.push('Ship Name')
        if (!transaction.containerNumber) missing.push('Container Number')
      }
      
      if (transaction.transactionType === 'SHIP') {
        if (!attachments.packingList) missing.push('Packing List')
        if (!attachments.deliveryNote) missing.push('Delivery Note')
      }

      return {
        transactionDate: transaction.transactionDate,
        transactionId: transaction.transactionId,
        transactionType: transaction.transactionType,
        warehouse: transaction.warehouse.name,
        sku: transaction.sku.skuCode,
        batchLot: transaction.batchLot,
        referenceId: transaction.referenceId || '',
        shipName: transaction.shipName || '',
        containerNumber: transaction.containerNumber || '',
        missingAttributes: missing.join(', '),
        missingCount: missing.length
      }
    }).filter(t => t.missingCount > 0)

    // Create Excel workbook
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Missing Attributes Report'],
      ['Generated:', new Date().toLocaleString()],
      [''],
      ['Total Transactions:', transactions.length],
      ['Transactions with Missing Attributes:', missingData.length],
      ['Completion Rate:', `${((transactions.length - missingData.length) / transactions.length * 100).toFixed(1)}%`]
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // Missing attributes detail sheet
    const headers = [
      'Date',
      'Transaction ID',
      'Type',
      'Warehouse',
      'SKU',
      'Batch/Lot',
      'Reference ID',
      'Ship Name',
      'Container Number',
      'Missing Attributes',
      'Missing Count'
    ]

    const data = [headers]
    missingData.forEach(row => {
      data.push([
        new Date(row.transactionDate).toLocaleDateString(),
        row.transactionId,
        row.transactionType,
        row.warehouse,
        row.sku,
        row.batchLot,
        row.referenceId,
        row.shipName,
        row.containerNumber,
        row.missingAttributes,
        row.missingCount
      ])
    })

    const detailWs = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, detailWs, 'Missing Attributes')

    // Write to temporary file
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const fileName = `missing-attributes-${new Date().toISOString().split('T')[0]}.xlsx`
    const filePath = join(tmpdir(), fileName)
    
    await writeFile(filePath, buffer)

    // Create response with file
    const fileStream = createReadStream(filePath)
    const response = new NextResponse(fileStream as any)
    
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response.headers.set('Content-Disposition', `attachment; filename="${fileName}"`)

    return response
  } catch (error) {
    console.error('Export missing attributes error:', error)
    return NextResponse.json({ 
      error: 'Failed to export missing attributes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}