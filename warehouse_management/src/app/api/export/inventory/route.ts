import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get warehouse filter based on user role
    const warehouseFilter = session.user.role === 'staff' && session.user.warehouseId
      ? { warehouseId: session.user.warehouseId }
      : {}

    // Fetch inventory data
    const inventoryBalances = await prisma.inventoryBalance.findMany({
      where: warehouseFilter,
      include: {
        warehouse: true,
        sku: true,
      },
      orderBy: [
        { warehouse: { name: 'asc' } },
        { sku: { skuCode: 'asc' } },
      ],
    })

    // Transform data for Excel
    const exportData = inventoryBalances.map(item => ({
      Warehouse: item.warehouse.name,
      'SKU Code': item.sku.skuCode,
      Description: item.sku.description,
      'Batch/Lot': item.batchLot,
      Cartons: item.currentCartons,
      Pallets: item.currentPallets,
      Units: item.currentUnits,
      'Last Activity': item.lastTransactionDate 
        ? new Date(item.lastTransactionDate).toLocaleDateString()
        : 'N/A',
    }))

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)

    // Auto-size columns
    const colWidths = [
      { wch: 15 }, // Warehouse
      { wch: 15 }, // SKU Code
      { wch: 40 }, // Description
      { wch: 15 }, // Batch/Lot
      { wch: 10 }, // Cartons
      { wch: 10 }, // Pallets
      { wch: 10 }, // Units
      { wch: 15 }, // Last Activity
    ]
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, 'Inventory')

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return file
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="inventory_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}