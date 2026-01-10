import { Prisma } from '@targon/prisma-talos'

export type ExportFieldValue = string | number | boolean | Date | null

export type FieldFormatter = (value: unknown) => ExportFieldValue

// Type definitions
export interface FieldConfig {
 fieldName: string
 columnName?: string
 format?: FieldFormatter
 includeInExport?: boolean
 isRelation?: boolean
 relationFields?: string[]
}

export interface ExportConfig {
 modelName: string
 fields?: FieldConfig[]
 includeRelations?: string[]
 excludeFields?: string[]
 defaultFormatters?: {
 DateTime?: FieldFormatter
 Boolean?: FieldFormatter
 Decimal?: FieldFormatter
 Json?: FieldFormatter
 }
}

// Default formatters for common data types
const defaultFormatters = {
 DateTime: (value: Date | string | number | null): ExportFieldValue =>
 value ? new Date(value).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }) : null,
 Boolean: (value: unknown): ExportFieldValue => {
 if (value === null || value === undefined) {
 return null
 }
 return value === true ? 'Yes' : 'No'
 },
 Decimal: (value: unknown): ExportFieldValue => {
 if (typeof value === 'number' || typeof value === 'bigint') {
 return value.toString()
 }

 if (value && typeof value === 'object' && 'toString' in value) {
 try {
 return (value as { toString(): string }).toString()
 } catch (_error) {
 return '0'
 }
 }

 return '0'
 },
 Json: (value: unknown): ExportFieldValue =>
 value === null || value === undefined ? '' : JSON.stringify(value),
}

// Get model fields from Prisma DMMF
export function getModelFields(modelName: string): readonly Prisma.DMMF.Field[] {
 const model = Prisma.dmmf.datamodel.models.find(m => m.name === modelName)
 if (!model) {
 throw new Error(`Model ${modelName} not found in Prisma schema`)
 }
 return model.fields as readonly Prisma.DMMF.Field[]
}

// Convert field name to display column name
export function fieldToColumnName(fieldName: string): string {
 // Convert camelCase to Title Case
 return fieldName
 .replace(/([A-Z])/g, ' $1')
 .replace(/^./, str => str.toUpperCase())
 .replace(/Id$/, 'ID')
 .replace(/^Is /, '')
 .trim()
}

// Generate export configuration from Prisma model
export function generateExportConfig(
 modelName: string,
 customConfig?: Partial<ExportConfig>
): FieldConfig[] {
 const fields = getModelFields(modelName)
 const excludeFields = customConfig?.excludeFields || []
 const fieldOverrides = customConfig?.fields || []
 
 const fieldConfigs: FieldConfig[] = []
 
 for (const field of fields) {
 // Skip excluded fields
 if (excludeFields.includes(field.name)) continue
 
 // Skip relation fields unless specifically included
 if (field.kind === 'object' && !customConfig?.includeRelations?.includes(field.name)) continue
 
 // Check for custom configuration
 const customField = fieldOverrides.find(f => f.fieldName === field.name)
 
 // Build field configuration
 const fieldConfig: FieldConfig = {
 fieldName: field.name,
 columnName: customField?.columnName || fieldToColumnName(field.name),
 includeInExport: customField?.includeInExport !== false,
 }
 
 // Add formatter based on field type
 if (!customField?.format) {
 const formatters = { ...defaultFormatters, ...customConfig?.defaultFormatters }
 
 if (field.type === 'DateTime') {
 fieldConfig.format = formatters.DateTime
 } else if (field.type === 'Boolean') {
 fieldConfig.format = formatters.Boolean
 } else if (field.type === 'Decimal') {
 fieldConfig.format = formatters.Decimal
 } else if (field.type === 'Json') {
 fieldConfig.format = formatters.Json
 } else {
 // Default format for other types
 fieldConfig.format = (value: unknown) => {
 if (value === null || value === undefined) {
 return null
 }

 if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
 return value
 }

 if (value instanceof Date) {
 return value
 }

 if (typeof value === 'object' && 'toString' in value) {
 try {
 return (value as { toString(): string }).toString()
 } catch (_error) {
 return null
 }
 }

 return null
 }
 }
 } else {
 fieldConfig.format = customField.format
 }
 
 fieldConfigs.push(fieldConfig)
 }
 
 // Add custom fields for relations
 if (customConfig?.fields) {
 const relationFields = customConfig.fields.filter(f => f.isRelation)
 fieldConfigs.push(...relationFields)
 }
 
 return fieldConfigs.filter(f => f.includeInExport !== false)
}

// Apply export configuration to data
export type ExportRecord = Record<string, ExportFieldValue>

export function applyExportConfig(
 data: Array<Record<string, unknown>>,
 fieldConfigs: FieldConfig[]
): ExportRecord[] {
 return data.map((record) => {
 const row: ExportRecord = {}

 for (const config of fieldConfigs) {
 const value = config.isRelation
 ? getNestedValue(record, config.fieldName)
 : record[config.fieldName]

 const formatted = config.format
 ? config.format(value)
 : defaultFormatValue(value)

 row[config.columnName || config.fieldName] = formatted
 }

 return row
 })
}

// Get nested value from object (e.g., 'warehouse.name')
function getNestedValue(obj: unknown, path: string): unknown {
 if (!obj || typeof obj !== 'object') {
 return undefined
 }

 return path.split('.').reduce<unknown>((current, key) => {
 if (!current || typeof current !== 'object') {
 return undefined
 }
 return (current as Record<string, unknown>)[key]
 }, obj)
}

function defaultFormatValue(value: unknown): ExportFieldValue {
 if (value === null || value === undefined) {
 return null
 }

 if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
 return value
 }

 if (value instanceof Date) {
 return value
 }

 if (typeof value === 'object' && 'toString' in value) {
 try {
 return (value as { toString(): string }).toString()
 } catch (_error) {
 return null
 }
 }

 return null
}

function listAttachmentTypes(value: unknown): string[] {
 if (!value) {
 return []
 }

 if (Array.isArray(value)) {
 const result = new Set<string>()
 value.forEach((entry) => {
 if (!entry || typeof entry !== 'object') {
 return
 }
 const record = entry as Record<string, unknown>
 const type = typeof record.type === 'string' ? record.type : undefined
 if (type) {
 result.add(type)
 }
 })
 return Array.from(result)
 }

 if (typeof value === 'object') {
 return Object.keys(value as Record<string, unknown>)
 }

 return []
}

// Specific configurations for common models
export const inventoryTransactionExportConfig: Partial<ExportConfig> = {
 modelName: 'InventoryTransaction',
 excludeFields: ['id', 'warehouseId', 'skuId', 'createdById'],
 includeRelations: ['warehouse', 'sku', 'createdBy'],
 fields: [
 // Override default column names
 { fieldName: 'transactionId', columnName: 'Transaction ID' },
 { fieldName: 'transactionType', columnName: 'Type' },
 { fieldName: 'pickupDate', columnName: 'Pickup Date' },
 { fieldName: 'isReconciled', columnName: 'Is Reconciled' },
 { fieldName: 'trackingNumber', columnName: 'Tracking Number' },
 
 // Add relation fields
 {
 fieldName: 'warehouse.name',
 columnName: 'Warehouse',
 isRelation: true,
 format: (value: unknown): ExportFieldValue =>
 value === null || value === undefined ? null : String(value)
 },
 {
 fieldName: 'sku.skuCode',
 columnName: 'SKU Code',
 isRelation: true,
 format: (value: unknown): ExportFieldValue =>
 value === null || value === undefined ? null : String(value)
 },
 {
 fieldName: 'sku.description',
 columnName: 'SKU Description',
 isRelation: true,
 format: (value: unknown): ExportFieldValue =>
 value === null || value === undefined ? null : String(value)
 },
 {
 fieldName: 'createdBy.fullName',
 columnName: 'Created By',
 isRelation: true,
 format: (value: unknown): ExportFieldValue =>
 value === null || value === undefined ? null : String(value)
 },
 
 // Special formatting
 {
 fieldName: 'attachments',
 columnName: 'Attachments',
 format: (value: unknown): ExportFieldValue => {
 const types = listAttachmentTypes(value)
 return types.length ? types.join(', ') : null
 }
 }
 ]
}

// Generate Excel export with dynamic fields
export function generateExcelExport(
 data: unknown[],
 sheetName: string,
 exportConfig: Partial<ExportConfig>
): ArrayBuffer {
 // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
 const XLSX = require('xlsx')
 
 // Generate field configuration
 const fieldConfigs = generateExportConfig(exportConfig.modelName!, exportConfig)
 
 // Apply configuration to data
 const records = data.filter((record): record is Record<string, unknown> =>
 typeof record === 'object' && record !== null
 )

 const exportData = applyExportConfig(records, fieldConfigs)
 
 // Create workbook
 const wb = XLSX.utils.book_new()
 const ws = XLSX.utils.json_to_sheet(exportData)
 
 // Auto-size columns based on content
 const colWidths = Object.keys(exportData[0] || {}).map(key => ({
 wch: Math.max(
 key.length,
 ...exportData.map(row => String(row[key] ?? '').length)
 ) + 2
 }))
 ws['!cols'] = colWidths
 
 XLSX.utils.book_append_sheet(wb, ws, sheetName)
 
 // Generate buffer
 return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
