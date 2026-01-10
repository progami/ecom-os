import { NextResponse } from 'next/server'
import { withAuthAndParams } from '@/lib/api/auth-wrapper'
import { getTenantPrisma } from '@/lib/tenant/server'
export const dynamic = 'force-dynamic'

export const GET = withAuthAndParams(async (_request, params, _session) => {
 try {
 const { id } = params as { id: string }

 const prisma = await getTenantPrisma()
 const skuCode = id // Using id parameter but it contains skuCode

 // Get the SKU
 const sku = await prisma.sku.findFirst({
 where: { skuCode }
 })
 
 if (!sku) {
 return NextResponse.json(
 { message: 'SKU not found' },
 { status: 404 }
 )
 }

 // Find all batch numbers for this SKU from all sources
 const [transactionBatches, ledgerBatches] = await Promise.all([
 // Check inventory transactions
 prisma.inventoryTransaction.findMany({
 where: {
 skuCode: sku.skuCode,
 batchLot: {
 not: {
 in: ['', 'N/A', 'NA', '-']
 }
 }
 },
 select: {
 batchLot: true
 },
 distinct: ['batchLot']
 }),
 // Check storage ledger for historical batches
 prisma.storageLedger.findMany({
 where: {
 skuCode: sku.skuCode,
 batchLot: {
 not: {
 in: ['', 'N/A', 'NA', '-']
 }
 }
 },
 select: {
 batchLot: true
 },
 distinct: ['batchLot']
 })
 ])
 
 // Combine all batches and remove duplicates
 const allBatchLots = new Set<string>()
 transactionBatches.forEach(t => allBatchLots.add(t.batchLot))
 ledgerBatches.forEach(l => allBatchLots.add(l.batchLot))
 
 const allBatches = Array.from(allBatchLots).map(batchLot => ({ batchLot }))

 let nextBatchNumber = 1
 let lastBatch: string | null = null
 let suggestedBatchLot = '1'

 const numericBatchLots = allBatches
 .map(t => t.batchLot)
 .filter(batchLot => /^\d+$/.test(batchLot))

 if (numericBatchLots.length > 0) {
 const targetLength = Math.max(...numericBatchLots.map(batch => batch.length))
 let maxValue = 0n
 let rawMax = numericBatchLots[0]

 for (const batch of numericBatchLots) {
 const value = BigInt(batch)
 if (value > maxValue) {
 maxValue = value
 rawMax = batch
 }
 }

 const nextValue = maxValue + 1n
 const paddedNext = nextValue.toString().padStart(targetLength, '0')

 const numericSuggestion = Number(nextValue)
 nextBatchNumber = Number.isSafeInteger(numericSuggestion) ? numericSuggestion : Number.MAX_SAFE_INTEGER
 lastBatch = rawMax
 suggestedBatchLot = paddedNext
 }

 return NextResponse.json({
 skuCode,
 lastBatch,
 nextBatchNumber,
 suggestedBatchLot
 })
 } catch (_error) {
 // console.error('Error getting next batch number:', error)
 return NextResponse.json(
 { message: 'Failed to get next batch number' },
 { status: 500 }
 )
 }
})
