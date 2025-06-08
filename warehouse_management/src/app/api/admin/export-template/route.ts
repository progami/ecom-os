import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create template workbook
    const wb = XLSX.utils.book_new()

    // SKU Master sheet
    const skuHeaders = [
      'SKU_Version_ID',
      'SKU',
      'Batch_Lot_Identifier',
      'effective_date',
      'end_date', 
      'ASIN',
      'Description',
      'Pack_Size',
      'Material',
      'Unit_Dimensions_cm',
      'Unit_Weight_KG',
      'Units_Per_Carton',
      'Carton_Dimensions_cm',
      'Carton_Weight_KG',
      'Packaging_Type',
      'Notes'
    ]
    const skuData = [skuHeaders]
    const skuSheet = XLSX.utils.aoa_to_sheet(skuData)
    XLSX.utils.book_append_sheet(wb, skuSheet, 'sku master')

    // Warehouse Config sheet
    const configHeaders = [
      'WH_Config_ID',
      'warehouse',
      'SKU',
      'storage_cartons_per_pallet',
      'shipping_cartons_per_pallet',
      'max_stacking_height_cm',
      'effective_date',
      'end_date',
      'notes'
    ]
    const configData = [configHeaders]
    const configSheet = XLSX.utils.aoa_to_sheet(configData)
    XLSX.utils.book_append_sheet(wb, configSheet, 'warehouse config')

    // Cost Master sheet
    const costHeaders = [
      'Cost_Rate_ID',
      'warehouse',
      'cost_category',
      'cost_name',
      'cost_value',
      'unit_of_measure',
      'effective_date',
      'end_date',
      'notes'
    ]
    const costData = [costHeaders]
    const costSheet = XLSX.utils.aoa_to_sheet(costData)
    XLSX.utils.book_append_sheet(wb, costSheet, 'cost master')

    // Inventory Ledger sheet with ALL required columns
    const inventoryHeaders = [
      'transaction_date',
      'transaction_id',
      'warehouse',
      'sku',
      'batch_lot',
      'transaction_type',
      'reference_id',
      'cartons_in',
      'cartons_out',
      'storage_pallets_in',
      'shipping_pallets_out',
      'notes',
      'ship_name',
      'container_number',
      'pickup_date',
      'is_reconciled',
      'storage_cartons_per_pallet',
      'shipping_cartons_per_pallet',
      'has_packing_list',
      'has_commercial_invoice',
      'has_delivery_note',
      'has_cubemaster',
      'destination_warehouse',
      'carrier',
      'tracking_number',
      'fba_shipment_id'
    ]
    const inventoryData = [
      inventoryHeaders,
      // Add example rows
      [
        '2024-01-15',
        'IL-001',
        'FMC',
        'CS 007',
        '8',
        'RECEIVE',
        'OOCL Germany',
        '385',
        '0',
        '28',
        '0',
        'Initial inventory',
        'OOCL Germany',
        'OOCL1234567',
        '',
        'FALSE',
        '14',
        '14',
        'TRUE',
        'TRUE',
        'TRUE',
        'FALSE',
        '',
        '',
        '',
        ''
      ],
      [
        '2024-01-20',
        'IL-002',
        'FMC',
        'CS 007',
        '8',
        'SHIP',
        'Amazon FBA Shipment',
        '0',
        '100',
        '0',
        '7',
        'Shipment to Amazon',
        '',
        '',
        '2024-01-21',
        'FALSE',
        '14',
        '14',
        'TRUE',
        'FALSE',
        'TRUE',
        'FALSE',
        'AMAZON',
        'Amazon Partnered Carrier',
        'FBA15G123456',
        'FBA15G123456'
      ]
    ]
    const inventorySheet = XLSX.utils.aoa_to_sheet(inventoryData)
    XLSX.utils.book_append_sheet(wb, inventorySheet, 'inventory_ledger')

    // Generate Excel file
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    
    // Return file
    const response = new NextResponse(buffer)
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response.headers.set('Content-Disposition', 'attachment; filename="warehouse_import_template.xlsx"')
    
    return response
  } catch (error) {
    console.error('Export template error:', error)
    return NextResponse.json({ 
      error: 'Failed to generate template',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}