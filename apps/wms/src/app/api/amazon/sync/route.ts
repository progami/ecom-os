import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getInventory, getCatalogItem } from '@/lib/amazon/client'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
 try {
 const session = await auth()
 
 if (!session || session.user.role !== 'admin') {
 return NextResponse.json(
 { message: 'Unauthorized' },
 { status: 401 }
 )
 }

 const { syncType } = await request.json()

 switch (syncType) {
 case 'inventory':
 return await syncInventory()
 case 'products':
 return await syncProducts()
 default:
 return NextResponse.json(
 { message: 'Invalid sync type' },
 { status: 400 }
 )
 }
 } catch (_error) {
 // console.error('Amazon sync error:', _error)
 return NextResponse.json(
 { message: 'Failed to sync Amazon data', error: _error instanceof Error ? _error.message : 'Unknown error' },
 { status: 500 }
 )
 }
}

async function syncInventory() {
 try {
 // Get current session
 const session = await auth()
 if (!session?.user?.id) {
 return NextResponse.json(
 { message: 'Unauthorized' },
 { status: 401 }
 )
 }

 // Get FBA inventory from Amazon
 const inventoryData = await getInventory()
 
 if (!inventoryData || !inventoryData.inventorySummaries) {
 return NextResponse.json({
 message: 'No inventory data found',
 synced: 0
 })
 }

 let syncedCount = 0
 let skippedCount = 0
 const errors = []

 // Process each inventory item
 for (const item of inventoryData.inventorySummaries) {
 try {
 // Only sync SKUs that already exist in our system
 const sku = await prisma.sku.findFirst({
 where: {
 OR: [
 { asin: item.asin },
 { skuCode: item.sellerSku }
 ]
 }
 })

 if (!sku) {
 // Skip items that don't exist in our product catalog
 // console.log(`Skipping Amazon item ${item.sellerSku} (ASIN: ${item.asin}) - not in product catalog`)
 skippedCount++
 continue
 }

 // Get the total quantity from Amazon
 const totalQuantity = item.totalQuantity || 0
 
 // Update the SKU with FBA stock
 await prisma.sku.update({
 where: { id: sku.id },
 data: {
 fbaStock: totalQuantity,
 fbaStockLastUpdated: new Date()
 }
 })

 syncedCount++
 } catch (_itemError) {
 // console.error(`Error syncing item ${item.asin}:`, _itemError)
 errors.push({
 asin: item.asin,
 error: _itemError instanceof Error ? _itemError.message : 'Unknown error'
 })
 }
 }

 return NextResponse.json({
 message: `Successfully synced ${syncedCount} items${skippedCount > 0 ? `, skipped ${skippedCount} items not in catalog` : ''}`,
 synced: syncedCount,
 skipped: skippedCount,
 errors: errors.length > 0 ? errors : undefined
 })
 } catch (_error) {
 throw _error
 }
}

async function syncProducts() {
 try {
 // Get all SKUs with ASINs
 const skus = await prisma.sku.findMany({
 where: {
 asin: { not: null }
 }
 })

 let updatedCount = 0
 const errors = []

 for (const sku of skus) {
 if (!sku.asin) continue

 try {
 const catalogItem = await getCatalogItem(sku.asin)
 
 if (catalogItem?.item?.attributes) {
 const attributes = catalogItem.item.attributes
 const updates: Record<string, unknown> = {}

 // Update description if available
 if (attributes.title?.[0]?.value) {
 updates.description = attributes.title[0].value
 }

 // Update dimensions if available
 if (attributes.item_dimensions) {
 const dims = attributes.item_dimensions[0]
 if (dims.length && dims.width && dims.height) {
 updates.cartonDimensionsCm = `${Math.round(dims.length.value * 2.54)}x${Math.round(dims.width.value * 2.54)}x${Math.round(dims.height.value * 2.54)}`
 }
 }

 // Update weight if available
 if (attributes.item_weight?.[0]?.value) {
 updates.cartonWeightKg = attributes.item_weight[0].value * 0.453592 // Convert pounds to kg
 }

 if (Object.keys(updates).length > 0) {
 await prisma.sku.update({
 where: { id: sku.id },
 data: updates
 })
 updatedCount++
 }
 }
 } catch (_itemError) {
 // console.error(`Error updating product ${sku.asin}:`, _itemError)
 errors.push({
 asin: sku.asin,
 error: _itemError instanceof Error ? _itemError.message : 'Unknown error'
 })
 }

 // Add delay to avoid rate limiting
 await new Promise(resolve => setTimeout(resolve, 1000))
 }

 return NextResponse.json({
 message: `Successfully updated ${updatedCount} products`,
 updated: updatedCount,
 errors: errors.length > 0 ? errors : undefined
 })
 } catch (_error) {
 throw _error
 }
}