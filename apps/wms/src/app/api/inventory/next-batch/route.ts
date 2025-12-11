import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
 try {
 const session = await auth()
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
 const transactions = await prisma.$queryRaw<{ batch_lot: string | null }[]>`
 SELECT DISTINCT batch_lot 
 FROM inventory_transactions 
 WHERE sku_code = ${sku.skuCode} 
 AND warehouse_code = ${warehouse.code}
 AND batch_lot IS NOT NULL
 `

 const numericBatchLots = transactions
 .map(record => record.batch_lot)
 .filter((value): value is string => typeof value === 'string' && /^\d+$/.test(value))

 const numericValues = numericBatchLots.map(batch => BigInt(batch))
 const maxValue = numericValues.reduce<bigint>((acc, value) => (value > acc ? value : acc), 0n)
 const nextValue = maxValue + 1n
 const targetLength = numericBatchLots.length > 0 ? Math.max(...numericBatchLots.map(batch => batch.length)) : 1
 const nextBatch = nextValue.toString().padStart(targetLength, '0')

 return NextResponse.json({ nextBatch })
 } catch (_error) {
 // console.error('Error fetching next batch number:', _error)
 return NextResponse.json({ error: 'Failed to fetch next batch number' }, { status: 500 })
 }
}
