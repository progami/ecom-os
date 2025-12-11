import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { getImportConfig } from '@/lib/import-config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
 try {
 const session = await auth()
 
 if (!session) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 }

 const searchParams = request.nextUrl.searchParams
 const entityName = searchParams.get('entity')

 if (!entityName) {
 return NextResponse.json({ error: 'No entity specified' }, { status: 400 })
 }

 const config = getImportConfig(entityName)
 if (!config) {
 return NextResponse.json({ error: 'Invalid entity' }, { status: 400 })
 }

 // Create workbook
 const wb = XLSX.utils.book_new()

 // Create headers from field mappings
 const headers = config.fieldMappings.map(mapping => mapping.excelColumns[0])
 
 // Create sample data rows based on entity type
 const sampleData = getSampleData(entityName, config)
 
 // Create worksheet data with headers and sample rows
 const wsData = [headers, ...sampleData]
 
 // Create worksheet
 const ws = XLSX.utils.aoa_to_sheet(wsData)
 
 // Add column widths
 const colWidths = headers.map(header => ({ wch: Math.max(header.length + 5, 15) }))
 ws['!cols'] = colWidths

 // Add to workbook
 XLSX.utils.book_append_sheet(wb, ws, 'Data')

 // Create instructions sheet
 const instructionsData = [
 ['Import Instructions for ' + config.displayName],
 [''],
 ['Required Fields:', ...config.fieldMappings.filter(m => m.required).map(m => m.excelColumns[0])],
 [''],
 ['Field Descriptions:'],
 ...config.fieldMappings.map(m => [
 m.excelColumns[0],
 m.type,
 m.required ? 'Required' : 'Optional',
 getFieldDescription(m.dbField, entityName)
 ]),
 [''],
 ['Notes:'],
 ['1. Do not modify the column headers in the Data sheet'],
 ['2. Dates should be in format: YYYY-MM-DD or MM/DD/YYYY'],
 ['3. Boolean fields accept: true/false, yes/no, 1/0'],
 ['4. Duplicate records will be updated based on: ' + config.uniqueFields.join(', ')],
 ]

 const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData)
 wsInstructions['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 50 }]
 XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

 // Write to buffer
 const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

 // Return file
 return new NextResponse(buf, {
 headers: {
 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'Content-Disposition': `attachment; filename="${config.displayName}_template.xlsx"`,
 },
 })
 } catch (_error) {
 // console.error('Template generation error:', error)
 return NextResponse.json({ 
 error: 'Failed to generate template',
 details: _error instanceof Error ? _error.message : 'Unknown error'
 }, { status: 500 })
 }
}

interface ImportConfig {
 displayName: string
 fieldMappings: Array<{
 excelColumns: string[]
 required: boolean
 dbField: string
 type: string
 }>
 uniqueFields: string[]
}

function getSampleData(entityName: string, _config: ImportConfig): unknown[][] {
 switch (entityName) {
 case 'skus':
 return [
 ['SKU001', 'B08XYZ123', 'Product A - Small Pack', '1', 'Plastic', '10x5x3', '0.5', '12', '30x20x15', '6.5', 'Box', 'Sample product'],
 ['SKU002', 'B08ABC456', 'Product B - Large Pack', '2', 'Metal', '15x10x5', '1.2', '6', '40x25x20', '8.0', 'Carton', 'Another sample'],
 ]
 
 case 'warehouses':
 return [
 ['WH-LA', 'Los Angeles Warehouse', '123 Main St, Los Angeles, CA 90001', '34.0522', '-118.2437', 'la@warehouse.com', '+1-213-555-0100'],
 ['WH-NY', 'New York Warehouse', '456 Broadway, New York, NY 10001', '40.7128', '-74.0060', 'ny@warehouse.com', '+1-212-555-0200'],
 ]
 
 case 'warehouseSkuConfigs':
 return [
 ['Los Angeles Warehouse', 'SKU001', '48', '40', '200', '2024-01-01', '', 'Standard pallet configuration'],
 ['New York Warehouse', 'SKU001', '50', '42', '180', '2024-01-01', '', 'NYC specific configuration'],
 ]
 
 case 'costRates':
 return [
 ['Los Angeles Warehouse', 'storage', 'Weekly Pallet Storage', '25.00', 'pallet/week', '2024-01-01', '', 'Standard storage rate'],
 ['Los Angeles Warehouse', 'shipment', 'Outbound Shipment', '15.00', 'shipment', '2024-01-01', '', 'Per shipment fee'],
 ]
 
 case 'inventoryTransactions':
 return [
 ['2024-01-15', '', 'false', 'RECEIVE', 'Los Angeles Warehouse', 'SKU001', 'BATCH001', 'PO-12345', '100', '0', '3', '0', 'OOCL VESSEL', 'TCNU1234567', '', '48', '40'],
 ['2024-01-20', '2024-01-21', 'false', 'SHIP', 'Los Angeles Warehouse', 'SKU001', 'BATCH001', 'SO-54321', '0', '50', '0', '2', '', 'FBA123456', 'LTL', '48', '40'],
 ]
 
 default:
 return [['Sample data not available for this entity']]
 }
}

function getFieldDescription(dbField: string, entityName: string): string {
 const descriptions: Record<string, Record<string, string>> = {
 skus: {
 skuCode: 'Unique product identifier code',
 asin: 'Amazon Standard Identification Number',
 description: 'Product description',
 packSize: 'Number of units in a pack',
 material: 'Product material',
 unitDimensionsCm: 'Dimensions of a single unit in cm (LxWxH)',
 unitWeightKg: 'Weight of a single unit in kilograms',
 unitsPerCarton: 'Number of units packed in one carton',
 cartonDimensionsCm: 'Dimensions of a carton in cm (LxWxH)',
 cartonWeightKg: 'Weight of a full carton in kilograms',
 packagingType: 'Type of packaging (Box, Carton, etc.)',
 },
 warehouses: {
 code: 'Unique warehouse code (e.g., WH-LA)',
 name: 'Full warehouse name',
 address: 'Physical address of the warehouse',
 latitude: 'Geographic latitude coordinate',
 longitude: 'Geographic longitude coordinate',
 contactEmail: 'Contact email for the warehouse',
 contactPhone: 'Contact phone number',
 },
 warehouseSkuConfigs: {
 warehouse: 'Warehouse name (must match existing warehouse)',
 sku: 'SKU code (must match existing SKU)',
 storageCartonsPerPallet: 'Number of cartons per pallet for storage',
 shippingCartonsPerPallet: 'Number of cartons per pallet for shipping',
 maxStackingHeightCm: 'Maximum stacking height in centimeters',
 effectiveDate: 'Date when this configuration becomes effective',
 endDate: 'Date when this configuration ends (optional)',
 notes: 'Configuration notes',
 },
 costRates: {
 warehouse: 'Warehouse name (must match existing warehouse)',
 costCategory: 'Category: storage, container, pallet, carton, unit, shipment, accessorial',
 costValue: 'Cost amount',
 unitOfMeasure: 'Unit of measure (e.g., pallet/week, shipment, carton)',
 effectiveDate: 'Date when this rate becomes effective',
 endDate: 'Date when this rate ends (optional)',
 notes: 'Additional notes',
 },
 inventoryTransactions: {
 transactionId: 'Transaction ID (leave blank for new, provide for updates - immutable fields won\'t change)',
 transactionDate: 'Date when the transaction occurred',
 pickupDate: 'Pickup date for shipments (optional)',
 isReconciled: 'Whether transaction is reconciled (true/false)',
 transactionType: 'RECEIVE or SHIP',
 warehouse: 'Warehouse name (must match existing warehouse)',
 sku: 'SKU code (must match existing SKU)',
 batchLot: 'Batch or lot number',
 referenceId: 'Reference ID (PO number, SO number, email tag, etc.)',
 cartonsIn: 'Number of cartons received (0 for shipments)',
 cartonsOut: 'Number of cartons shipped (0 for receipts)',
 storagePalletsIn: 'Number of storage pallets received',
 shippingPalletsOut: 'Number of shipping pallets sent out',
 shipName: 'Vessel name for ocean shipments (e.g., OOCL VESSEL)',
 trackingNumber: 'Container number for receipts, FBA shipment ID for shipments',
 storageCartonsPerPallet: 'Override cartons per pallet for storage calculations',
 shippingCartonsPerPallet: 'Override cartons per pallet for shipping calculations',
 unitsPerCarton: 'Override units per carton (if different from SKU default)',
 },
 }

 return descriptions[entityName]?.[dbField] || 'No description available'
}
