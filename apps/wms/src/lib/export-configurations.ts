// Export configurations for different models
// This file can be easily updated when schema changes without touching the export logic

import { ExportConfig } from './dynamic-export'
import { INVENTORY_TRANSACTION_COLUMNS, INVENTORY_BALANCE_COLUMNS } from './column-ordering'

// Helper function to generate export fields from column definitions
function generateExportFields(columns: typeof INVENTORY_TRANSACTION_COLUMNS) {
  return columns
    .filter(col => col.showInExport)
    .sort((a, b) => a.order - b.order)
    .map(col => {
      const field: {
        fieldName: string;
        columnName: string;
        isRelation?: boolean;
        format?: (value: unknown) => unknown;
      } = {
        fieldName: col.isRelation ? col.relationPath! : col.fieldName,
        columnName: col.exportName
      }
      
      if (col.isRelation) {
        field.isRelation = true
        field.format = (value: unknown) => value || ''
      }
      
      // Special formatting for document boolean fields
      if (col.fieldName === 'hasCommercialInvoice') {
        field.fieldName = 'attachments'
        field.format = (value: unknown) => {
          if (!value) return 'No'
          const attachments = value as unknown
          return attachments.commercialInvoice || attachments.commercial_invoice ? 'Yes' : 'No'
        }
      }
      
      if (col.fieldName === 'hasBillOfLading') {
        field.fieldName = 'attachments'
        field.format = (value: unknown) => {
          if (!value) return 'No'
          const attachments = value as unknown
          return attachments.billOfLading || attachments.bill_of_lading ? 'Yes' : 'No'
        }
      }
      
      if (col.fieldName === 'hasPackingList') {
        field.fieldName = 'attachments'
        field.format = (value: unknown) => {
          if (!value) return 'No'
          const attachments = value as unknown
          return attachments.packingList || attachments.packing_list ? 'Yes' : 'No'
        }
      }
      
      if (col.fieldName === 'hasDeliveryNote') {
        field.fieldName = 'attachments'
        field.format = (value: unknown) => {
          if (!value) return 'No'
          const attachments = value as unknown
          return attachments.deliveryNote || attachments.delivery_note ? 'Yes' : 'No'
        }
      }
      
      if (col.fieldName === 'hasCubeMaster') {
        field.fieldName = 'attachments'
        field.format = (value: unknown) => {
          if (!value) return 'No'
          const attachments = value as unknown
          return attachments.cubeMaster || attachments.cube_master ? 'Yes' : 'No'
        }
      }
      
      if (col.fieldName === 'hasTransactionCertificate') {
        field.fieldName = 'attachments'
        field.format = (value: unknown) => {
          if (!value) return 'No'
          const attachments = value as unknown
          return attachments.transactionCertificate || attachments.transaction_certificate || attachments.tcGrs ? 'Yes' : 'No'
        }
      }
      
      if (col.fieldName === 'hasCustomDeclaration') {
        field.fieldName = 'attachments'
        field.format = (value: unknown) => {
          if (!value) return 'No'
          const attachments = value as unknown
          return attachments.customDeclaration || attachments.custom_declaration ? 'Yes' : 'No'
        }
      }
      
      if (col.fieldName === 'hasProofOfPickup') {
        field.fieldName = 'attachments'
        field.format = (value: unknown) => {
          if (!value) return 'No'
          const attachments = value as unknown
          return attachments.proofOfPickup || attachments.proof_of_pickup ? 'Yes' : 'No'
        }
      }
      
      return field
    })
}

// Inventory Transaction Export Configuration
export const inventoryTransactionConfig: Partial<ExportConfig> = {
  modelName: 'InventoryTransaction',
  
  // Fields to exclude from export (internal IDs, etc.)
  excludeFields: ['id', 'warehouseId', 'skuId', 'createdById', 'transactionId'],
  
  // Relations to include in the export
  includeRelations: ['warehouse', 'sku', 'createdBy'],
  
  // Custom field configurations - Using standardized column ordering
  fields: generateExportFields(INVENTORY_TRANSACTION_COLUMNS)
}

// Inventory Balance Export Configuration
export const inventoryBalanceConfig: Partial<ExportConfig> = {
  modelName: 'InventoryBalance',
  excludeFields: ['id', 'warehouseId', 'skuId'],
  includeRelations: ['warehouse', 'sku'],
  fields: generateExportFields(INVENTORY_BALANCE_COLUMNS)
}

// SKU Export Configuration
export const skuConfig: Partial<ExportConfig> = {
  modelName: 'Sku',
  excludeFields: ['id'],
  fields: [
    { fieldName: 'skuCode', columnName: 'SKU Code' },
    { fieldName: 'asin', columnName: 'ASIN' },
    { fieldName: 'description', columnName: 'Description' },
    { fieldName: 'packSize', columnName: 'Pack Size' },
    { fieldName: 'material', columnName: 'Material' },
    { fieldName: 'unitDimensionsCm', columnName: 'Unit Dimensions (cm)' },
    { fieldName: 'unitWeightKg', columnName: 'Unit Weight (kg)' },
    { fieldName: 'unitsPerCarton', columnName: 'Units Per Carton' },
    { fieldName: 'cartonDimensionsCm', columnName: 'Carton Dimensions (cm)' },
    { fieldName: 'cartonWeightKg', columnName: 'Carton Weight (kg)' },
    { fieldName: 'packagingType', columnName: 'Packaging Type' },
    { fieldName: 'fbaStock', columnName: 'FBA Stock' },
    { fieldName: 'fbaStockLastUpdated', columnName: 'FBA Stock Last Updated' },
    { fieldName: 'notes', columnName: 'Notes' },
    { fieldName: 'isActive', columnName: 'Is Active' }
  ]
}

// Add more configurations as needed for other models...