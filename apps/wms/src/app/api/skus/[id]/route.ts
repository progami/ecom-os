import { NextRequest, NextResponse } from 'next/server'
import { withAuthAndParams } from '@/lib/api/auth-wrapper'
import { getTenantPrisma } from '@/lib/tenant/server'
export const dynamic = 'force-dynamic'

// GET /api/skus/[id] - Get a single SKU by ID
export const GET = withAuthAndParams(async (_request, params, _session) => {
 try {
 const { id } = params as { id: string }

 const prisma = await getTenantPrisma()
 const sku = await prisma.sku.findUnique({
 where: { id }
 })

 if (!sku) {
 return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
 }

 // Manually count transactions since relation no longer exists
 const transactionCount = await prisma.inventoryTransaction.count({
 where: { skuCode: sku.skuCode }
 })

 const storageLedgerCount = await prisma.storageLedger.count({
 where: { skuCode: sku.skuCode }
 })

 return NextResponse.json({
 ...sku,
 _count: {
 inventoryTransactions: transactionCount,
 storageLedgerEntries: storageLedgerCount
 }
 })
 } catch (_error) {
 // console.error('Error fetching SKU:', error)
 return NextResponse.json(
 { error: 'Failed to fetch SKU' },
 { status: 500 }
 )
 }
})

// PUT /api/skus/[id] - Update a SKU
export const PUT = withAuthAndParams(async (request, params, _session) => {
 try {
 const { id } = params as { id: string }

 const prisma = await getTenantPrisma()
 const body = await request.json()

 // Validate required fields
 if (!body.skuCode || !body.description) {
 return NextResponse.json(
 { error: 'SKU code and description are required' },
 { status: 400 }
 )
 }

 // Check if SKU code is being changed and if new code already exists
 const existingSku = await prisma.sku.findFirst({
 where: {
 skuCode: body.skuCode,
 NOT: { id }
 }
 })

 if (existingSku) {
 return NextResponse.json(
 { error: 'SKU code already exists' },
 { status: 400 }
 )
 }

 // Update the SKU
 const updatedSku = await prisma.sku.update({
 where: { id },
 data: {
 skuCode: body.skuCode,
 asin: body.asin,
 description: body.description,
 packSize: body.packSize,
 material: body.material,
 unitDimensionsCm: body.unitDimensionsCm,
 unitWeightKg: body.unitWeightKg,
 unitsPerCarton: body.unitsPerCarton,
 cartonDimensionsCm: body.cartonDimensionsCm,
 cartonWeightKg: body.cartonWeightKg,
 packagingType: body.packagingType,
 isActive: body.isActive
 }
 })

 return NextResponse.json(updatedSku)
 } catch (_error) {
 // console.error('Error updating SKU:', error)
 return NextResponse.json(
 { error: 'Failed to update SKU' },
 { status: 500 }
 )
 }
})

// DELETE /api/skus/[id] - Delete or deactivate a SKU
export const DELETE = withAuthAndParams(async (_request, params, _session) => {
 try {
 const { id } = params as { id: string }

 const prisma = await getTenantPrisma()
 // Check if SKU has related data
 const sku = await prisma.sku.findUnique({
 where: { id }
 })

 if (!sku) {
 return NextResponse.json({ error: 'SKU not found' }, { status: 404 })
 }

 // Manually count related data since relations no longer exist
 const transactionCount = await prisma.inventoryTransaction.count({
 where: { skuCode: sku.skuCode }
 })

 const storageLedgerCount = await prisma.storageLedger.count({
 where: { skuCode: sku.skuCode }
 })

 // If SKU has related data, deactivate instead of delete
 if ((transactionCount > 0) || (storageLedgerCount > 0)) {
 const deactivatedSku = await prisma.sku.update({
 where: { id },
 data: { isActive: false }
 })
 
 return NextResponse.json({
 message: 'SKU deactivated due to existing relationships',
 sku: deactivatedSku
 })
 }

 // Otherwise, delete the SKU
 await prisma.sku.delete({
 where: { id: id }
 })

 return NextResponse.json({
 message: 'SKU deleted successfully'
 })
 } catch (_error) {
 // console.error('Error deleting SKU:', error)
 return NextResponse.json(
 { error: 'Failed to delete SKU' },
 { status: 500 }
 )
 }
})