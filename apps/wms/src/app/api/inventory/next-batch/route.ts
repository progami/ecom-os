import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const skuId = searchParams.get('skuId')
    const warehouseId = searchParams.get('warehouseId')

    if (!skuId || !warehouseId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Get SKU code from ID
    const sku = await prisma.sku.findUnique({
      where: { id: skuId },
      select: { skuCode: true }
    })
    
    if (!sku) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
    }
    
    // Get warehouse code from ID
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { code: true }
    })
    
    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }
    
    // Query existing batch numbers from inventory_transactions for this SKU and warehouse
    // Using transactions table since inventory_balances is not being populated
    const transactions = await prisma.$queryRaw<{batch_lot: string}[]>`
      SELECT DISTINCT batch_lot 
      FROM inventory_transactions 
      WHERE sku_code = ${sku.skuCode} 
      AND warehouse_code = ${warehouse.code}
      AND batch_lot IS NOT NULL
    `

    // Extract batch numbers and find the highest integer
    const batchNumbers = transactions
      .map(t => parseInt(t.batch_lot))
      .filter(num => !isNaN(num))

    let nextBatch = 1 // Default to 1 if no existing batches

    if (batchNumbers.length > 0) {
      // Get the highest batch number and increment
      const maxBatch = Math.max(...batchNumbers)
      nextBatch = maxBatch + 1
    }

    return NextResponse.json({ nextBatch: nextBatch.toString() })
  } catch (_error) {
    // console.error('Error fetching next batch number:', _error)
    return NextResponse.json({ error: 'Failed to fetch next batch number' }, { status: 500 })
  }
}