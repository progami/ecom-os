import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const viewMode = searchParams.get('viewMode') || 'live'
    const date = searchParams.get('date')
    const warehouse = searchParams.get('warehouse')
    const transactionType = searchParams.get('transactionType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const skuCode = searchParams.get('skuCode')
    const batchLot = searchParams.get('batchLot')

    // Build where clause
    const where: any = {}
    
    // For staff, limit to their warehouse
    if (session.user.role === 'staff' && session.user.warehouseId) {
      where.warehouseId = session.user.warehouseId
    } else if (warehouse) {
      where.warehouseId = warehouse
    }

    if (transactionType) {
      where.transactionType = transactionType
    }

    if (skuCode) {
      where.sku = {
        skuCode: {
          contains: skuCode,
          mode: 'insensitive'
        }
      }
    }

    if (batchLot) {
      where.batchLot = {
        contains: batchLot,
        mode: 'insensitive'
      }
    }

    // Date filtering
    if (viewMode === 'point-in-time' && date) {
      const pointInTime = new Date(date)
      pointInTime.setHours(23, 59, 59, 999)
      where.transactionDate = { lte: pointInTime }
    } else if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) {
        where.transactionDate.gte = new Date(startDate)
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        where.transactionDate.lte = endDateTime
      }
    }

    // Fetch transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        warehouse: true,
        sku: true,
        createdBy: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Inventory Ledger Sheet
    const ledgerData = transactions.map(t => ({
      'Transaction Date': new Date(t.transactionDate).toLocaleString('en-US', { timeZone: 'America/Chicago' }),
      'Transaction ID': t.transactionId,
      'Type': t.transactionType,
      'Warehouse': t.warehouse.name,
      'SKU Code': t.sku.skuCode,
      'SKU Description': t.sku.description,
      'Batch/Lot': t.batchLot,
      'Reference': t.referenceId,
      'Cartons In': t.cartonsIn,
      'Cartons Out': t.cartonsOut,
      'Storage Pallets In': t.storagePalletsIn,
      'Shipping Pallets Out': t.shippingPalletsOut,
      'Notes': t.notes || '',
      'Created By': t.createdBy.fullName,
      'Created At': new Date(t.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })
    }))

    const ledgerSheet = XLSX.utils.json_to_sheet(ledgerData)
    XLSX.utils.book_append_sheet(wb, ledgerSheet, 'Inventory Ledger')

    // If point-in-time, add inventory summary sheet
    if (viewMode === 'point-in-time' && date) {
      // Calculate inventory balances
      const balances = new Map<string, any>()
      
      for (const transaction of transactions) {
        const key = `${transaction.warehouseId}-${transaction.skuId}-${transaction.batchLot}`
        const current = balances.get(key) || {
          warehouse: transaction.warehouse.name,
          skuCode: transaction.sku.skuCode,
          description: transaction.sku.description,
          batchLot: transaction.batchLot,
          cartons: 0,
          lastActivity: transaction.transactionDate
        }
        
        current.cartons += transaction.cartonsIn - transaction.cartonsOut
        current.lastActivity = transaction.transactionDate
        balances.set(key, current)
      }

      // Convert to array and filter out zero balances
      const summaryData = Array.from(balances.values())
        .filter(item => item.cartons > 0)
        .sort((a, b) => {
          if (a.warehouse !== b.warehouse) return a.warehouse.localeCompare(b.warehouse)
          if (a.skuCode !== b.skuCode) return a.skuCode.localeCompare(b.skuCode)
          return a.batchLot.localeCompare(b.batchLot)
        })
        .map(item => ({
          'Warehouse': item.warehouse,
          'SKU Code': item.skuCode,
          'Description': item.description,
          'Batch/Lot': item.batchLot,
          'Cartons': item.cartons,
          'Last Activity': new Date(item.lastActivity).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
        }))

      const summarySheet = XLSX.utils.json_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, summarySheet, `Inventory as of ${new Date(date).toLocaleDateString()}`)
    }

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    // Create filename
    const filename = viewMode === 'point-in-time' 
      ? `inventory_ledger_as_of_${date}.xlsx`
      : `inventory_ledger_${new Date().toISOString().split('T')[0]}.xlsx`

    // Return file
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ 
      error: 'Failed to export ledger data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}