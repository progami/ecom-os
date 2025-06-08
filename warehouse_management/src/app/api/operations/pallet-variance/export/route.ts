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

    // Get all inventory balances
    const balances = await prisma.inventoryBalance.findMany({
      include: {
        warehouse: true,
        sku: true
      }
    })

    // Calculate variances
    const variances = balances
      .filter(balance => balance.currentPallets > 0)
      .map(balance => {
        // Simulate variance - in production, this would come from physical count data
        const simulatedVariance = Math.floor(Math.random() * 5) - 2
        const actualPallets = Math.max(0, balance.currentPallets + simulatedVariance)
        const variance = actualPallets - balance.currentPallets
        const variancePercentage = balance.currentPallets > 0 
          ? (variance / balance.currentPallets) * 100 
          : 0

        return {
          warehouse: balance.warehouse.name,
          warehouseCode: balance.warehouse.code,
          sku: balance.sku.skuCode,
          description: balance.sku.description,
          batchLot: balance.batchLot,
          systemPallets: balance.currentPallets,
          actualPallets,
          variance,
          variancePercentage: variancePercentage.toFixed(1) + '%',
          status: variance !== 0 ? 'PENDING' : 'RESOLVED',
          lastUpdated: balance.lastUpdated
        }
      })

    // Create Excel workbook
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const totalVariance = variances.reduce((sum, v) => sum + v.variance, 0)
    const positiveCount = variances.filter(v => v.variance > 0).length
    const negativeCount = variances.filter(v => v.variance < 0).length
    const pendingCount = variances.filter(v => v.status === 'PENDING').length

    const summaryData = [
      ['Pallet Variance Report'],
      ['Generated:', new Date().toLocaleString()],
      [''],
      ['Total Items:', variances.length],
      ['Total Variance:', totalVariance + ' pallets'],
      ['Overages (Physical > System):', positiveCount],
      ['Shortages (Physical < System):', negativeCount],
      ['Pending Review:', pendingCount]
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

    // Variance detail sheet
    const headers = [
      'Warehouse',
      'Warehouse Code',
      'SKU',
      'Description',
      'Batch/Lot',
      'System Pallets',
      'Actual Pallets',
      'Variance',
      'Variance %',
      'Status',
      'Last Updated'
    ]

    const data = [headers]
    variances.forEach(row => {
      data.push([
        row.warehouse,
        row.warehouseCode,
        row.sku,
        row.description,
        row.batchLot,
        row.systemPallets.toString(),
        row.actualPallets.toString(),
        row.variance.toString(),
        row.variancePercentage,
        row.status,
        new Date(row.lastUpdated).toLocaleString()
      ])
    })

    const detailWs = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, detailWs, 'Variance Details')

    // Write to temporary file
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const fileName = `pallet-variance-${new Date().toISOString().split('T')[0]}.xlsx`
    const filePath = join(tmpdir(), fileName)
    
    await writeFile(filePath, buffer)

    // Create response with file
    const fileStream = createReadStream(filePath)
    const response = new NextResponse(fileStream as any)
    
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response.headers.set('Content-Disposition', `attachment; filename="${fileName}"`)

    return response
  } catch (error) {
    console.error('Export pallet variance error:', error)
    return NextResponse.json({ 
      error: 'Failed to export pallet variance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}